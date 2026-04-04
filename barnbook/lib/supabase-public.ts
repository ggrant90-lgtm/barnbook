import { createClient } from "@supabase/supabase-js";
import { getSupabaseAnonKey, getSupabaseUrl } from "./supabase-config";
import type { Database } from "./types";

/**
 * Unauthenticated Supabase client for public pages (no cookies/session).
 * Queries run under RLS as the anonymous role — only rows allowed by
 * public-facing RLS policies will be returned.
 */
export function createPublicSupabaseClient() {
  return createClient<Database>(getSupabaseUrl(), getSupabaseAnonKey());
}
