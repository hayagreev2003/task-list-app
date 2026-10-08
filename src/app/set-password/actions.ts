"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { validateNewPassword } from "@/lib/credentials";

export type SetPasswordState = { error?: string };

/** Final step of account creation: save the password, then send the user to sign in with it. */
export async function setPassword(_prev: SetPasswordState, formData: FormData): Promise<SetPasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmPassword") ?? "");

  const invalid = validateNewPassword(password, confirmation);
  if (invalid) return { error: invalid };

  const { supabase } = await requireUser();
  const { error } = await supabase.auth.updateUser({ password, data: { needs_password: false } });
  if (error) {
    if (error.code === "weak_password") return { error: "That password is too easy to guess. Choose another." };
    return { error: "Couldn't save your password. Try again." };
  }

  // Sign in fresh with the new password, so the user knows it works before they need it.
  await supabase.auth.signOut();
  redirect("/login?status=password-set");
}
