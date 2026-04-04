import type { SupabaseClient } from "@supabase/supabase-js";
import type { Barn, BarnMember, Database } from "./types";

export type PrimaryBarnContext = {
  barn: Barn;
  membership: BarnMember | null;
};

/**
 * First barn owned by the user, else first barn membership (any role).
 */
export async function getPrimaryBarnContext(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<PrimaryBarnContext | null> {
  const { data: owned } = await supabase
    .from("barns")
    .select("*")
    .eq("owner_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (owned) {
    const { data: mem } = await supabase
      .from("barn_members")
      .select("*")
      .eq("barn_id", owned.id)
      .eq("user_id", userId)
      .maybeSingle();
    return { barn: owned, membership: mem };
  }

  const { data: memRow } = await supabase
    .from("barn_members")
    .select("*")
    .eq("user_id", userId)
    .or("status.eq.active,status.is.null")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!memRow) return null;

  const { data: barn } = await supabase
    .from("barns")
    .select("*")
    .eq("id", memRow.barn_id)
    .single();

  if (!barn) return null;
  return { barn, membership: memRow };
}

export async function userHasAnyBarn(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<boolean> {
  const ctx = await getPrimaryBarnContext(supabase, userId);
  return ctx !== null;
}
