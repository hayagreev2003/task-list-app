import type { Metadata } from "next";
import { CheckSquareIcon } from "@/components/icons";
import { LoginForm } from "@/components/LoginForm";

export const metadata: Metadata = { title: "Sign in · Tasks" };

export default function LoginPage() {
  return (
    <section className="auth-card">
      <span className="brand-mark brand-mark-lg" aria-hidden="true">
        <CheckSquareIcon />
      </span>
      <h1>Sign in to Tasks</h1>
      <p className="muted">Sign in, or create an account with an email and password.</p>
      <LoginForm />
    </section>
  );
}
