import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

const NOT_RUNNING =
  "Integration tests need local Supabase. Run `npx supabase start`, then copy the keys from " +
  "`npx supabase status -o env` into .env.local (see .env.example).";

function env() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !publishableKey || !secretKey) throw new Error(`Missing Supabase env vars. ${NOT_RUNNING}`);
  return { url, publishableKey, secretKey };
}

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

/** Fails loudly (instead of skipping) when the local stack isn't reachable. */
export async function assertSupabaseRunning() {
  const { url, publishableKey } = env();
  try {
    const res = await fetch(`${url}/auth/v1/health`, { headers: { apikey: publishableKey } });
    if (!res.ok) throw new Error(`status ${res.status}`);
  } catch (error) {
    throw new Error(`Supabase isn't reachable at ${url} (${String(error)}). ${NOT_RUNNING}`);
  }
}

export function anonClient(): SupabaseClient<Database> {
  const { url, publishableKey } = env();
  return createClient<Database>(url, publishableKey, noSession);
}

// Test-only: the secret key never appears in app code.
function adminClient() {
  const { url, secretKey } = env();
  return createClient<Database>(url, secretKey, noSession);
}

export type TestUser = { id: string; email: string; client: SupabaseClient<Database> };

const created: string[] = [];

/** Creates a confirmed user via the admin API and returns a client signed in as them. */
export async function createTestUser(label: string): Promise<TestUser> {
  const email = `test-${label}-${randomUUID()}@example.test`;
  const password = `pw-${randomUUID()}`;
  const { data, error } = await adminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);
  created.push(data.user.id);

  const client = anonClient();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`signIn failed: ${signInError.message}`);
  return { id: data.user.id, email, client };
}

/** Deletes every user created by this file; their tasks go with them (on delete cascade). */
export async function deleteTestUsers() {
  const admin = adminClient();
  await Promise.all(created.splice(0).map((id) => admin.auth.admin.deleteUser(id)));
}

export const sampleTask = (overrides: Partial<Database["public"]["Tables"]["tasks"]["Insert"]> = {}) => ({
  title: `Task ${randomUUID().slice(0, 8)}`,
  due_date: "2026-01-05",
  priority: 3,
  ...overrides,
});
