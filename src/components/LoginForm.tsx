"use client";

import { useActionState } from "react";
import { authenticate, type AuthFormState } from "@/app/login/actions";

const initialState: AuthFormState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(authenticate, initialState);

  return (
    <form action={formAction} className="stack">
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
      <label>
        Password
        <input name="password" type="password" autoComplete="current-password" placeholder="At least 8 characters" required />
      </label>
      {state.error ? (
        <p role="alert" className="error banner">
          {state.error}
        </p>
      ) : null}
      {state.message ? (
        <p role="status" className="notice">
          {state.message}
        </p>
      ) : null}
      <div className="auth-actions">
        <button type="submit" name="intent" value="signin" disabled={pending}>
          {pending ? "Please wait…" : "Sign in"}
        </button>
        <button type="submit" name="intent" value="signup" className="secondary" disabled={pending}>
          Create account
        </button>
      </div>
    </form>
  );
}
