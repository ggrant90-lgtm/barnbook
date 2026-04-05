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
