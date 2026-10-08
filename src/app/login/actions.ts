"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normaliseEmail } from "@/lib/credentials";

export type SignInState = { error?: string; email?: string };

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = normaliseEmail(formData.get("email"));
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "Enter your email and password.", email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Incorrect email or password.", email };

  redirect("/tasks");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
