import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";

/**
 * Effective capacity = base_stalls + SUM(active blocks.block_size).
 * Lighter than getBarnCapacitySnapshot when all we need is the number.
 */
export async function getEffectiveCapacity(
  supabase: SupabaseClient<Database>,
  barnId: string,
): Promise<number> {
  const [{ data: barn }, blocksRes] = await Promise.all([
    supabase
      .from("barns")
      .select("base_stalls")
      .eq("id", barnId)
      .maybeSingle(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("barn_stall_blocks")
      .select("block_size")
      .eq("barn_id", barnId)
      .eq("status", "active"),
  ]);

  if (!barn) return 0;
  const base = (barn as { base_stalls: number | null }).base_stalls ?? 0;
  const blocks = (blocksRes.data ?? []) as Array<{ block_size: number }>;
  return base + blocks.reduce((sum, b) => sum + (b.block_size ?? 0), 0);
}

/**
 * Batch version: returns a Map keyed by barn_id → effective capacity.
 * Single query for N barns. Used on dashboard + shell loads.
 */
export async function getEffectiveCapacityMap(
  supabase: SupabaseClient<Database>,
  barnIds: string[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (barnIds.length === 0) return out;

  const [{ data: barns }, blocksRes] = await Promise.all([
    supabase
      .from("barns")
      .select("id, base_stalls")
      .in("id", barnIds),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("barn_stall_blocks")
      .select("barn_id, block_size")
      .in("barn_id", barnIds)
      .eq("status", "active"),
  ]);

  const blockSumByBarn = new Map<string, number>();
  for (const b of ((blocksRes.data ?? []) as Array<{ barn_id: string; block_size: number }>)) {
    blockSumByBarn.set(b.barn_id, (blockSumByBarn.get(b.barn_id) ?? 0) + (b.block_size ?? 0));
  }

  for (const b of ((barns ?? []) as Array<{ id: string; base_stalls: number | null }>)) {
    const base = b.base_stalls ?? 0;
    out.set(b.id, base + (blockSumByBarn.get(b.id) ?? 0));
  }
  return out;
}
