import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseEnv } from "@/lib/supabase/env";

/** Sign-in and sign-up pages: signed-out only, signed-in users are sent on. */
const SIGNED_OUT_PATHS = ["/login", "/signup"];
/** Open to everyone: the email link lands here whether or not the browser has a session. */
const OPEN_PATHS = ["/auth"];
/** Where a user who followed the sign-up link but hasn't chosen a password must go. */
const SET_PASSWORD_PATH = "/set-password";

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
  const claims = data?.claims;
  const signedIn = Boolean(claims);
  const { pathname } = request.nextUrl;
  if (matches(pathname, OPEN_PATHS)) return response;
  const isSignedOutPage = matches(pathname, SIGNED_OUT_PATHS);

  if (!signedIn) return isSignedOutPage ? response : redirectKeepingCookies(request, response, "/login");

  // Set at sign-up and cleared when the password is saved (see /signup and /set-password).
  const needsPassword = claims?.user_metadata?.needs_password === true;
  const home = needsPassword ? SET_PASSWORD_PATH : "/tasks";

  if (isSignedOutPage) {
    // getClaims only checks the JWT locally, so a revoked session still looks signed in until
    // the token expires. requireUser() asks the auth server and would send /tasks straight back
    // here, looping. Confirm with the auth server before leaving these pages (only they pay this),
    // and clear the stale session if it fails.
    const { data: userData, error } = await supabase.auth.getUser();
    if (!error && userData.user) return redirectKeepingCookies(request, response, home);
    await supabase.auth.signOut({ scope: "local" });
    return response;
  }

  const onSetPassword = matches(pathname, [SET_PASSWORD_PATH]);
  if (needsPassword !== onSetPassword) return redirectKeepingCookies(request, response, home);
  return response;
}

function matches(pathname: string, paths: string[]) {
  return paths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
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
