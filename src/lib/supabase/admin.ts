import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * The Supabase secret (service-role) key. Bypasses RLS. Supports both the new
 * `sb_secret_...` key (SUPABASE_SECRET_KEY) and the legacy service-role JWT
 * (SUPABASE_SERVICE_ROLE_KEY).
 */
function secretKey(): string | undefined {
  return process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
}

/**
 * Privileged Supabase client. Bypasses RLS, so it must ONLY be used in
 * server-side code paths after the caller has been verified as an admin.
 * Never import this into client components.
 */
export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = secretKey();

  if (!url || !key) {
    throw new Error(
      "SUPABASE_SECRET_KEY (and NEXT_PUBLIC_SUPABASE_URL) must be set to manage app settings.",
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function isServiceRoleConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && secretKey());
}
