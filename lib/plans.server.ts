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
  /** Free/base stalls (from barns.base_stalls). */
  baseStalls: number;
  /** Count of active stall blocks (just for display). */
  blockCount: number;
  /** Sum of active blocks' block_size. */
  blockCapacity: number;
  /** baseStalls + blockCapacity — what capacity helpers compare against. */
  effectiveCapacity: number;
  stallsRemaining: number;
  isOverCapacity: boolean;
  graceDaysRemaining: number | null;
  canAddHorse: boolean;
}

/**
 * Fetch barn + horse count + active stall blocks, compose a capacity
 * snapshot. Effective capacity = base_stalls + SUM(active blocks).
 */
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

  const [{ count }, blocksRes] = await Promise.all([
    supabase
      .from("horses")
      .select("id", { count: "exact", head: true })
      .eq("barn_id", barnId)
      .eq("archived", false),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("barn_stall_blocks")
      .select("block_size")
      .eq("barn_id", barnId)
      .eq("status", "active"),
  ]);

  const horseCount = count ?? 0;
  const barnTyped = barn as Barn;
  const baseStalls = barnTyped.base_stalls ?? 0;

  const blocks = (blocksRes.data ?? []) as Array<{ block_size: number }>;
  const blockCapacity = blocks.reduce((sum, b) => sum + (b.block_size ?? 0), 0);
  const effectiveCapacity = baseStalls + blockCapacity;

  return {
    barn: barnTyped,
    horseCount,
    baseStalls,
    blockCount: blocks.length,
    blockCapacity,
    effectiveCapacity,
    stallsRemaining: stallsRemaining(horseCount, effectiveCapacity),
    isOverCapacity: isBarnOverCapacity(horseCount, effectiveCapacity),
    graceDaysRemaining: graceDaysRemaining(barnTyped),
    canAddHorse: canAddHorseToBarn(barnTyped, horseCount, effectiveCapacity),
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
