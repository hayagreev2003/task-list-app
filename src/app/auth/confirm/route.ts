import { NextResponse, type NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";
import { parseEmailLinkType } from "@/lib/credentials";
import { createClient } from "@/lib/supabase/server";

/**
 * Landing page for the link in the sign-up email. Exchanges the link for a session, then sends
 * new users on to choose a password.
 *
 * Accepts both link shapes Supabase can send:
 * - `token_hash` + `type` (our email templates): works even if the link is opened in another browser.
 * - `code` (the default hosted template, PKCE): needs the browser that requested the email.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = parseEmailLinkType(searchParams.get("type"));
  const code = searchParams.get("code");

  const supabase = await createClient();
  let user: User | null = null;

  if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) user = data.user;
  } else if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) user = data.user;
  }

  if (!user) return redirectTo(request, "/signup?error=link");
  return redirectTo(request, user.user_metadata?.needs_password === true ? "/set-password" : "/tasks");
}

function redirectTo(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, request.nextUrl.origin));
}
