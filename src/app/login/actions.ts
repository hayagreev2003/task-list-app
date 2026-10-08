"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthFormState = { error?: string; message?: string; email?: string };

export async function authenticate(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const intent = formData.get("intent") === "signup" ? "signup" : "signin";
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "Enter your email and password.", email };

  const supabase = await createClient();

  if (intent === "signin") {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: "Incorrect email or password.", email };
  } else {
    if (password.length < 8) return { error: "Use a password of at least 8 characters.", email };
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message, email };
    if (!data.session) return { message: "Check your email to confirm your account, then sign in.", email };
  }

  redirect("/tasks");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
