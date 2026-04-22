import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { isEditorPlusRole } from "./roles";

/**
 * User can view a horse if they own the barn, are a barn member, or have stall-key access.
 */
export async function canUserAccessHorse(
  supabase: SupabaseClient<Database>,
  userId: string,
  horseId: string,
): Promise<boolean> {
  const { data: horse } = await supabase
    .from("horses")
    .select("barn_id")
    .eq("id", horseId)
    .maybeSingle();

  if (!horse) return false;

  const { data: stall } = await supabase
    .from("user_horse_access")
    .select("id")
    .eq("horse_id", horseId)
    .eq("user_id", userId)
    .maybeSingle();

  if (stall) return true;

  const { data: barn } = await supabase
    .from("barns")
    .select("owner_id")
    .eq("id", horse.barn_id)
    .maybeSingle();

  if (barn?.owner_id === userId) return true;

  const { data: mem } = await supabase
    .from("barn_members")
    .select("id")
    .eq("barn_id", horse.barn_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (mem) return true;

  // Check if user is in a host barn with an active stay for this horse
  const { data: stays } = await supabase
    .from("horse_stays")
    .select("host_barn_id")
    .eq("horse_id", horseId)
    .eq("status", "active");

  if (stays && stays.length > 0) {
    for (const stay of stays) {
      const { data: hostBarn } = await supabase
        .from("barns")
        .select("owner_id")
        .eq("id", stay.host_barn_id)
        .maybeSingle();
      if (hostBarn?.owner_id === userId) return true;

      const { data: hostMem } = await supabase
        .from("barn_members")
        .select("id")
        .eq("barn_id", stay.host_barn_id)
        .eq("user_id", userId)
        .maybeSingle();
      if (hostMem) return true;
    }
  }

  return false;
}

/**
 * Effective role for the user on this barn: owner wins, else barn_members.role.
 */
export async function getBarnRoleForUser(
  supabase: SupabaseClient<Database>,
  userId: string,
  barnId: string,
): Promise<string | null> {
  const { data: barn } = await supabase
    .from("barns")
    .select("owner_id")
    .eq("id", barnId)
    .maybeSingle();

  if (barn?.owner_id === userId) return "owner";

  const { data: mem } = await supabase
    .from("barn_members")
    .select("role")
    .eq("barn_id", barnId)
    .eq("user_id", userId)
    .maybeSingle();

  return mem?.role ?? null;
}

export async function canUserEditHorse(
  supabase: SupabaseClient<Database>,
  userId: string,
  barnId: string,
): Promise<boolean> {
  const role = await getBarnRoleForUser(supabase, userId, barnId);
  return isEditorPlusRole(role);
}

/**
 * Can the user create a log entry on this horse? Broader than
 * `canUserEditHorse` — also accepts Stall Keys from `user_horse_access`
 * with a permission level above `view_only`. This mirrors what the
 * `user_can_log_entry` SQL helper does, and is what lets a farrier
 * with a Stall Key log/schedule shoeing on a client's horse.
 *
 * When `logType` is provided, `custom` permission is honored against
 * the key's `allowed_log_types[]`. Without a logType, we treat any
 * non-view_only level as permissive (used by mark-done / reschedule /
 * cancel where the row has already been created and we just need a
 * general write gate).
 */
export async function canUserLogOnHorse(
  supabase: SupabaseClient<Database>,
  userId: string,
  horseId: string,
  barnId: string,
  logType?: string,
): Promise<boolean> {
  // Fast path: barn owner or editor member.
  if (await canUserEditHorse(supabase, userId, barnId)) return true;

  // Stall key path: user_horse_access carries the granular permission
  // level and the optional allowed_log_types[] for custom keys.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("user_horse_access")
    .select("permission_level, allowed_log_types")
    .eq("horse_id", horseId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return false;

  const rawLevel = data.permission_level as string | null;
  const level =
    rawLevel === "view_only" ||
    rawLevel === "log_all" ||
    rawLevel === "full_contributor" ||
    rawLevel === "custom"
      ? rawLevel
      : rawLevel === "editor"
        ? "log_all"
        : rawLevel === "viewer"
          ? "view_only"
          : null;
  if (!level || level === "view_only") return false;
  if (level === "log_all" || level === "full_contributor") return true;
  if (level === "custom" && logType) {
    const allowed = data.allowed_log_types as string[] | null;
    return Array.isArray(allowed) && allowed.includes(logType);
  }
  // custom without a specific logType → treat as write-capable for
  // cross-cutting actions like mark-done; schedule-insert always
  // passes logType so this branch doesn't accidentally widen custom.
  return level === "custom";
}

/**
 * Horse PROFILE edits (name, breed, color, photo, core identity fields) are
 * owner-only — no exceptions, no matter what role or key permission level.
 * Use this instead of canUserEditHorse for any mutation that changes the
 * horse itself (vs. log entries attached to it).
 */
export async function canUserEditHorseProfile(
  supabase: SupabaseClient<Database>,
  userId: string,
  barnId: string,
): Promise<boolean> {
  const { data: barn } = await supabase
    .from("barns")
    .select("owner_id")
    .eq("id", barnId)
    .maybeSingle();
  return (barn as { owner_id?: string } | null)?.owner_id === userId;
}
