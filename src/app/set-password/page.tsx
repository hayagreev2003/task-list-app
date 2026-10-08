import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckSquareIcon } from "@/components/icons";
import { SetPasswordForm } from "@/components/SetPasswordForm";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Set your password · Tasks" };

export default function SetPasswordPage() {
  return (
    <section className="auth-card">
      <span className="brand-mark brand-mark-lg" aria-hidden="true">
        <CheckSquareIcon />
      </span>
      <h1>Set your password</h1>
      <Suspense fallback={null}>
        <VerifiedAccount />
      </Suspense>
    </section>
  );
}

async function VerifiedAccount() {
  const { user } = await requireUser();
  return (
    <>
      <p className="muted">
        Email verified for <strong>{user.email}</strong>. Choose a password to finish creating your account.
      </p>
      <SetPasswordForm email={user.email} />
    </>
  );
}
