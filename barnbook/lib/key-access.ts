import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { isOwnerOrManagerRole } from "./roles";

/** Owner or manager of the given barn may manage keys dashboard. */
export async function canManageBarnKeys(
  supabase: SupabaseClient<Database>,
  userId: string,
  barnId: string,
): Promise<boolean> {
  const { data: barn } = await supabase
    .from("barns")
    .select("owner_id")
    .eq("id", barnId)
    .maybeSingle();

  if (barn?.owner_id === userId) return true;

  const { data: row } = await supabase
    .from("barn_members")
    .select("role")
    .eq("barn_id", barnId)
    .eq("user_id", userId)
    .maybeSingle();

  return isOwnerOrManagerRole(row?.role);
}
