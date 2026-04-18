import type { SupabaseClient } from "@supabase/supabase-js";

export interface RateLimitWindows {
  /** Max calls in the last 60 minutes. */
  hour: number;
  /** Max calls in the last 24 hours. */
  day: number;
}

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSeconds: number; reason: "hour" | "day" };

/**
 * Count recent rows in api_call_log to enforce per-user rate limits.
 *
 * NOTE: Count + insert happen in two queries (the caller inserts the log
 * row after Claude responds), so a tight race can let 21 scans through a
 * 20/hr limit. Acceptable for v1 — the limits are soft cost guards, not
 * security boundaries.
 */
export async function checkRateLimit(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string,
  endpoint: string,
  limits: RateLimitWindows,
): Promise<RateLimitResult> {
  const now = Date.now();
  const hourAgoISO = new Date(now - 60 * 60 * 1000).toISOString();
  const dayAgoISO = new Date(now - 24 * 60 * 60 * 1000).toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [{ count: hourCount }, { count: dayCount }] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("api_call_log")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("endpoint", endpoint)
      .gte("called_at", hourAgoISO),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("api_call_log")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("endpoint", endpoint)
      .gte("called_at", dayAgoISO),
  ]);

  if ((hourCount ?? 0) >= limits.hour) {
    // Find the oldest row in the hour window to compute retry-after.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: oldest } = await (supabase as any)
      .from("api_call_log")
      .select("called_at")
      .eq("user_id", userId)
      .eq("endpoint", endpoint)
      .gte("called_at", hourAgoISO)
      .order("called_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    const oldestMs = oldest?.called_at
      ? new Date(oldest.called_at as string).getTime()
      : now;
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((oldestMs + 60 * 60 * 1000 - now) / 1000),
    );
    return { ok: false, retryAfterSeconds, reason: "hour" };
  }

  if ((dayCount ?? 0) >= limits.day) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: oldest } = await (supabase as any)
      .from("api_call_log")
      .select("called_at")
      .eq("user_id", userId)
      .eq("endpoint", endpoint)
      .gte("called_at", dayAgoISO)
      .order("called_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    const oldestMs = oldest?.called_at
      ? new Date(oldest.called_at as string).getTime()
      : now;
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((oldestMs + 24 * 60 * 60 * 1000 - now) / 1000),
    );
    return { ok: false, retryAfterSeconds, reason: "day" };
  }

  return { ok: true };
}

/**
 * Best-effort write to api_call_log. Never throws — failures are logged.
 * Must be called even on extraction failure so quota accounting stays honest
 * (a broken API call still cost you a slot against the rate limit).
 */
export async function logApiCall(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  row: {
    user_id: string;
    endpoint: string;
    success: boolean;
    confidence?: string | null;
    cost_cents?: number | null;
    error?: string | null;
  },
): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("api_call_log").insert({
      user_id: row.user_id,
      endpoint: row.endpoint,
      success: row.success,
      confidence: row.confidence ?? null,
      cost_cents: row.cost_cents ?? null,
      error: row.error ?? null,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[api_call_log] insert failed:", e);
  }
}
