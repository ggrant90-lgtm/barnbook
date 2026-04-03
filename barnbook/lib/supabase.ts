import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseAnonKey, getSupabaseUrl } from "./supabase-config";
import type { Database } from "./types";

/** Browser client — use in Client Components; pairs with middleware + server client for SSR auth. */
export const supabase = createBrowserClient<Database>(
  getSupabaseUrl(),
  getSupabaseAnonKey(),
);
