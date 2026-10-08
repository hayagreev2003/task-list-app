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
        <input name="email" type="email" autoComplete="email" required defaultValue={state.email} />
      </label>
      <label>
        Password
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      {state.error ? (
        <p role="alert" className="error">
          {state.error}
        </p>
      ) : null}
      {state.message ? <p role="status">{state.message}</p> : null}
      <div className="row">
        <button type="submit" name="intent" value="signin" disabled={pending}>
          Sign in
        </button>
        <button type="submit" name="intent" value="signup" className="secondary" disabled={pending}>
          Create account
        </button>
      </div>
    </form>
  );
}
