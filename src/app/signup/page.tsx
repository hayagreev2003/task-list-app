import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CheckSquareIcon } from "@/components/icons";
import { SignupForm } from "@/components/SignupForm";

export const metadata: Metadata = { title: "Create account · Tasks" };

export default function SignupPage({ searchParams }: PageProps<"/signup">) {
  return (
    <section className="auth-card">
      <span className="brand-mark brand-mark-lg" aria-hidden="true">
        <CheckSquareIcon />
      </span>
      <h1>Create your account</h1>
      <p className="muted">Enter your email. We&apos;ll send you a link to verify it and set your password.</p>
      <SignupForm>
        <Suspense fallback={null}>
          <LinkError searchParams={searchParams} />
        </Suspense>
      </SignupForm>
      <p className="auth-switch">
        Already have an account? <Link href="/login">Sign in</Link>
      </p>
    </section>
  );
}

async function LinkError({ searchParams }: Pick<PageProps<"/signup">, "searchParams">) {
  const { error } = await searchParams;
  if (error !== "link") return null;
  return (
    <p role="alert" className="error banner">
      That link is invalid or has expired. Enter your email to get a new one.
    </p>
  );
}
