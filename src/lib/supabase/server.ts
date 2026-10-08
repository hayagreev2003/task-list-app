import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import type { Database } from "./database.types";
import { supabaseEnv } from "./env";

/**
 * Supabase client acting as the signed-in user (publishable key + session cookies).
 * RLS is the security boundary; the app never uses the secret/service-role key.
 * Create one per request.
 */
export async function createClient() {
  // Session reads and token checks use the current time, so always run them at request time
  // (Cache Components would otherwise flag supabase-js's Date.now() during prerendering).
  await connection();
  const cookieStore = await cookies();
  const { url, publishableKey } = supabaseEnv();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Server Components can't set cookies. The Proxy refreshes the session instead.
        }
      },
    },
  });
}
