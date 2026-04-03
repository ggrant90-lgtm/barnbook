/**
 * Allows builds when `.env.local` still has template placeholders.
 * Replace with real Supabase URL and anon key for runtime.
 */
export function getSupabaseUrl(): string {
  const u = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (u && !u.includes("your_supabase")) return u;
  return "https://placeholder.supabase.co";
}

export function getSupabaseAnonKey(): string {
  const k = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (k && !k.includes("your_supabase")) return k;
  return "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.build-placeholder";
}
