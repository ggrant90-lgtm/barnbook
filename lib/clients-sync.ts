import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

function normalizeNameKey(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * Ensure a `barn_clients` row exists for this barn + owner name.
 *
 * Silent sync from BarnBook's free-text `horses.owner_name` to the Business Pro
 * Clients module. Called after horse create/update. Gated on the barn owner's
 * `has_business_pro` flag — non-BP barns are no-ops so we don't leak Client
 * rows for barns that can't see them.
 *
 * Invariants:
 * - Caller must already be authorized to mutate the horse (barn owner), which
 *   is what the `barn_clients_insert` RLS policy (`is_barn_owner(barn_id)`)
 *   also requires. Passing an admin client is fine too.
 * - Never throws: a failed sync must not break the horse save.
 * - Dedupes on the existing unique index `(barn_id, name_key)` — ON CONFLICT
 *   DO NOTHING, so repeat saves with the same owner name are free.
 *
 * Returns `{ created }` so callers can decide whether to revalidate client
 * caches; on any error or no-op path, returns `{ created: false }`.
 */
export async function ensureClientForOwnerName(
  supabase: SupabaseClient<Database>,
  barnId: string,
  ownerName: string | null | undefined,
): Promise<{ created: boolean }> {
  try {
    const trimmed = ownerName?.trim();
    if (!trimmed) return { created: false };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    // Business Pro is gated on the barn owner's profile flag across the app
    // (see business-pro/layout.tsx, actions/invoices.ts, actions/clients.ts).
    const { data: barn } = await db
      .from("barns")
      .select("owner_id")
      .eq("id", barnId)
      .maybeSingle();
    if (!barn?.owner_id) return { created: false };

    const { data: profile } = await db
      .from("profiles")
      .select("has_business_pro")
      .eq("id", barn.owner_id)
      .maybeSingle();
    if (!profile?.has_business_pro) return { created: false };

    const name_key = normalizeNameKey(trimmed);

    const { data, error } = await db
      .from("barn_clients")
      .upsert(
        {
          barn_id: barnId,
          display_name: trimmed,
          name_key,
          created_by_user_id: barn.owner_id,
        },
        { onConflict: "barn_id,name_key", ignoreDuplicates: true },
      )
      .select("id");

    if (error) {
      console.warn("[clients-sync] insert failed:", error.message);
      return { created: false };
    }

    // With ignoreDuplicates, a conflict returns an empty array (nothing inserted).
    return { created: Array.isArray(data) && data.length > 0 };
  } catch (e) {
    console.warn("[clients-sync] unexpected error:", e);
    return { created: false };
  }
}
