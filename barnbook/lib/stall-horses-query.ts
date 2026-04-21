import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";

/**
 * A horse the user has Stall Key access to, with display fields from
 * horses and the owning barn's name + the user's permission level for
 * that horse.
 *
 * Shape is the same as the object used on the dashboard's stall-key
 * card and on the LinkHorseModal for Service Barns. Extracted to a
 * helper so both callsites share the same query shape.
 */
export interface StallHorseListItem {
  id: string;
  name: string;
  barn_name_horse: string | null; // horses.barn_name (nickname) — renamed so it doesn't collide with the owning barn's name
  primary_name_pref: "papered" | "barn";
  breed: string | null;
  photo_url: string | null;
  barn_id: string;
  /** The owning barn's name (barns.name), not horses.barn_name. */
  owning_barn_name: string;
  permission_level: string | null;
  allowed_log_types: string[] | null;
}

/**
 * Fetch every horse the given user holds a Stall Key for, enriched
 * with the owning barn's name and the user's permission level.
 *
 * Excludes archived horses. Ordered by horse name asc.
 */
export async function getStallKeyHorses(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<StallHorseListItem[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: stallAccessRows } = await (supabase as any)
    .from("user_horse_access")
    .select("horse_id, permission_level, allowed_log_types")
    .eq("user_id", userId);

  const stallRows = (stallAccessRows ?? []) as Array<{
    horse_id: string;
    permission_level: string | null;
    allowed_log_types: string[] | null;
  }>;
  if (stallRows.length === 0) return [];

  const horseIds = stallRows.map((r) => r.horse_id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: horseRows } = await (supabase as any)
    .from("horses")
    .select("id, name, barn_name, primary_name_pref, breed, photo_url, barn_id")
    .in("id", horseIds)
    .eq("archived", false)
    .order("name", { ascending: true });

  const horses = (horseRows ?? []) as Array<{
    id: string;
    name: string;
    barn_name: string | null;
    primary_name_pref: "papered" | "barn";
    breed: string | null;
    photo_url: string | null;
    barn_id: string;
  }>;

  const barnIds = [...new Set(horses.map((h) => h.barn_id))];
  const owningBarnNameById: Record<string, string> = {};
  if (barnIds.length > 0) {
    const { data: barnRows } = await supabase
      .from("barns")
      .select("id, name")
      .in("id", barnIds);
    for (const b of (barnRows ?? []) as { id: string; name: string }[]) {
      owningBarnNameById[b.id] = b.name;
    }
  }

  const rowByHorseId = new Map(stallRows.map((r) => [r.horse_id, r]));

  return horses.map((h) => {
    const access = rowByHorseId.get(h.id);
    return {
      id: h.id,
      name: h.name,
      barn_name_horse: h.barn_name,
      primary_name_pref: h.primary_name_pref,
      breed: h.breed,
      photo_url: h.photo_url,
      barn_id: h.barn_id,
      owning_barn_name: owningBarnNameById[h.barn_id] ?? "Barn",
      permission_level: access?.permission_level ?? null,
      allowed_log_types: access?.allowed_log_types ?? null,
    };
  });
}
