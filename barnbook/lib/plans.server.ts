import type { SupabaseClient } from "@supabase/supabase-js";
import type { Barn, Database } from "./types";
import {
  canAddHorseToBarn,
  stallsRemaining,
  isBarnOverCapacity,
  graceDaysRemaining,
} from "./plans";

export interface BarnCapacitySnapshot {
  barn: Barn;
  horseCount: number;
  stallsRemaining: number;
  isOverCapacity: boolean;
  graceDaysRemaining: number | null;
  canAddHorse: boolean;
}

/** Fetch barn with horse count and return a capacity snapshot */
export async function getBarnCapacitySnapshot(
  supabase: SupabaseClient<Database>,
  barnId: string,
): Promise<BarnCapacitySnapshot | null> {
  const { data: barn } = await supabase
    .from("barns")
    .select("*")
    .eq("id", barnId)
    .single();

  if (!barn) return null;

  const { count } = await supabase
    .from("horses")
    .select("id", { count: "exact", head: true })
    .eq("barn_id", barnId)
    .eq("archived", false);

  const horseCount = count ?? 0;
  const barnTyped = barn as Barn;

  return {
    barn: barnTyped,
    horseCount,
    stallsRemaining: stallsRemaining(barnTyped, horseCount),
    isOverCapacity: isBarnOverCapacity(barnTyped, horseCount),
    graceDaysRemaining: graceDaysRemaining(barnTyped),
    canAddHorse: canAddHorseToBarn(barnTyped, horseCount),
  };
}

/** Check if user can create another free barn */
export async function userCanCreateFreeBarn(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<boolean> {
  const { count } = await supabase
    .from("barns")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", userId)
    .eq("plan_tier", "free");

  return (count ?? 0) < 1;
}
