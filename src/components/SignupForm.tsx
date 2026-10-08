"use client";

import { useActionState, useState, type ReactNode } from "react";
import { requestSignup, type SignupState } from "@/app/signup/actions";

const initialState: SignupState = {};

/** `children` is a notice shown only until the form is first submitted (e.g. "that link expired"). */
export function SignupForm({ children }: { children?: ReactNode }) {
  const [state, formAction, pending] = useActionState(requestSignup, initialState);
  // "Use a different email" hides this result until the next submission returns a new one.
  const [dismissed, setDismissed] = useState<SignupState | null>(null);

  if (state.sentTo && state !== dismissed) {
    return (
      <div className="stack">
        <p role="status" className="notice">
          We&apos;ve sent a link to <strong>{state.sentTo}</strong>. Open it to verify your email and choose a
          password. The link expires in 1 hour.
        </p>
        <p className="muted">Can&apos;t find it? Check your spam folder, or send it again.</p>
        <form action={formAction} className="auth-actions">
          <input type="hidden" name="email" value={state.sentTo} />
          <button type="submit" className="secondary" disabled={pending}>
            {pending ? "Sending…" : "Resend email"}
          </button>
        </form>
        <p className="auth-switch">
          Wrong address?{" "}
          <button type="button" className="link" onClick={() => setDismissed(state)}>
            Use a different email
          </button>
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="stack">
      {state === initialState ? children : null}
      <label>
        Email
        <input
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          defaultValue={state.email}
        />
      </label>
      {state.error ? (
        <p role="alert" className="error banner">
          {state.error}
        </p>
      ) : null}
      <div className="auth-actions">
        <button type="submit" disabled={pending}>
          {pending ? "Sending…" : "Create account"}
        </button>
      </div>
    </form>
  );
}
