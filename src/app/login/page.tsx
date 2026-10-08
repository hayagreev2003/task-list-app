import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CheckSquareIcon } from "@/components/icons";
import { LoginForm } from "@/components/LoginForm";

export const metadata: Metadata = { title: "Sign in · Tasks" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <section className="auth-card">
      <span className="brand-mark brand-mark-lg" aria-hidden="true">
        <CheckSquareIcon />
      </span>
      <h1>Sign in to Tasks</h1>
      <p className="muted">Welcome back. Sign in with your email and password.</p>
      <Suspense fallback={null}>
        <StatusNotice searchParams={searchParams} />
      </Suspense>
      <LoginForm />
      <p className="auth-switch">
        New to Tasks? <Link href="/signup">Create an account</Link>
      </p>
    </section>
  );
}

async function StatusNotice({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { status } = await searchParams;
  if (status !== "password-set") return null;
  return (
    <p role="status" className="notice">
      Your password is set. Sign in to get started.
    </p>
  );
}
