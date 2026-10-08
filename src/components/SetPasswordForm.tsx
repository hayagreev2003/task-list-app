"use client";

import { useActionState } from "react";
import { setPassword, type SetPasswordState } from "@/app/set-password/actions";
import { MIN_PASSWORD_LENGTH } from "@/lib/credentials";

const initialState: SetPasswordState = {};

export function SetPasswordForm({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState(setPassword, initialState);

  return (
    <form action={formAction} className="stack">
      {/* Lets password managers save the new password against the right account. */}
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
      <label>
        Password
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
          minLength={MIN_PASSWORD_LENGTH}
          required
        />
      </label>
      <label>
        Confirm password
        <input name="confirmPassword" type="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} required />
      </label>
      {state.error ? (
        <p role="alert" className="error banner">
          {state.error}
        </p>
      ) : null}
      <div className="auth-actions">
        <button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Set password"}
        </button>
      </div>
    </form>
  );
}
