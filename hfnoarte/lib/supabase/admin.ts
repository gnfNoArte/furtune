import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client for the scheduled job only. It bypasses Row Level
 * Security, so it must never be used in code that serves a browser request
 * on behalf of a user. The database still refuses approvals from it.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false } });
}
