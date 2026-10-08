export const MIN_PASSWORD_LENGTH = 8;

// Loose on purpose: the auth server is the real check. This only catches obvious typos early.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normaliseEmail(value: unknown): string {
  return String(value ?? "").trim();
}

/** Returns an error message, or null when the email looks usable. */
export function validateEmail(email: string): string | null {
  if (!email) return "Enter your email address.";
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) return "Enter a valid email address.";
  return null;
}

/** Returns an error message, or null when the new password and its confirmation are acceptable. */
export function validateNewPassword(password: string, confirmation: string): string | null {
  if (!password) return "Enter a password.";
  if (password.length < MIN_PASSWORD_LENGTH) return `Use a password of at least ${MIN_PASSWORD_LENGTH} characters.`;
  // bcrypt (used by Supabase Auth) only reads the first 72 bytes.
  if (new TextEncoder().encode(password).length > 72) return "Use a password of at most 72 characters.";
  if (password !== confirmation) return "The passwords don't match.";
  return null;
}

/** Email link types /auth/confirm accepts for verifyOtp. */
const EMAIL_LINK_TYPES = ["email", "signup", "magiclink"] as const;
export type EmailLinkType = (typeof EMAIL_LINK_TYPES)[number];

export function parseEmailLinkType(value: string | null): EmailLinkType | null {
  return EMAIL_LINK_TYPES.find((t) => t === value) ?? null;
}
