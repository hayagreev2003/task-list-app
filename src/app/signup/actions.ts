"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { normaliseEmail, validateEmail } from "@/lib/credentials";

export type SignupState = { error?: string; sentTo?: string; email?: string };

/**
 * Step 1 of account creation: email the user a verification link. The account gets a password
 * only after they follow the link (see /auth/confirm and /set-password).
 */
export async function requestSignup(_prev: SignupState, formData: FormData): Promise<SignupState> {
  const email = normaliseEmail(formData.get("email"));
  const invalid = validateEmail(email);
  if (invalid) return { error: invalid, email };

  // Server Action POSTs always carry Origin, and Next.js rejects ones that don't match the host.
  // Supabase Auth also checks the redirect against its allow-list.
  const origin = (await headers()).get("origin");
  if (!origin) return { error: "Couldn't send the email. Reload the page and try again.", email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${origin}/auth/confirm`,
      // Only applied when the user is created, so existing accounts are untouched.
      data: { needs_password: true },
    },
  });

  if (error) {
    if (error.status === 429) return { error: "Too many emails requested. Wait a minute and try again.", email };
    return { error: "Couldn't send the email. Try again in a moment.", email };
  }

  // Same response whether or not the email already has an account, so this can't be used to
  // find out who has signed up. Existing users get a sign-in link instead.
  return { sentTo: email, email };
}
