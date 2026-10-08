import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseEnv } from "@/lib/supabase/env";

const PUBLIC_PATHS = ["/login"];

/**
 * Refreshes the Supabase session cookie and makes an optimistic redirect.
 * This is not the authorisation check: requireUser() and RLS are.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, publishableKey } = supabaseEnv();

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
      },
    },
  });

  // getClaims validates the JWT and refreshes an expired session (writing new cookies above).
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!signedIn && !isPublic) return redirectKeepingCookies(request, response, "/login");

  if (signedIn && isPublic) {
    // getClaims only checks the JWT locally, so a revoked session still looks signed in until
    // the token expires. requireUser() asks the auth server and would send /tasks straight back
    // here, looping. Confirm with the auth server before leaving /login (only /login pays this),
    // and clear the stale session if it fails.
    const { data: userData, error } = await supabase.auth.getUser();
    if (!error && userData.user) return redirectKeepingCookies(request, response, "/tasks");
    await supabase.auth.signOut({ scope: "local" });
  }
  return response;
}

function redirectKeepingCookies(request: NextRequest, from: NextResponse, pathname: string) {
  const target = request.nextUrl.clone();
  target.pathname = pathname;
  target.search = "";
  const redirect = NextResponse.redirect(target);
  for (const cookie of from.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
