import type { Metadata } from "next";
import { LoginForm } from "@/components/LoginForm";

export const metadata: Metadata = { title: "Sign in · Tasks" };

export default function LoginPage() {
  return (
    <section className="narrow">
      <h1>Sign in</h1>
      <p className="muted">Sign in, or create an account with an email and password.</p>
      <LoginForm />
    </section>
  );
}
