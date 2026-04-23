"use server";

import { revalidatePath } from "next/cache";
import { createServerComponentClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  STALL_BLOCK_PRICE_CENTS,
  STALL_BLOCK_SIZE,
} from "@/lib/plans";

export interface AddStallBlockResult {
  ok?: true;
  blockId?: string;
  error?: string;
}

/**
 * Add a 10-stall block to an existing barn. App-layer ownership check
 * plus RLS enforces that only the barn owner can insert. During early
 * access we always mark is_free_promo=true so we can find these users
 * later when billing turns on.
 */
export async function addStallBlockAction(
  barnId: string,
  opts: { isFreePromo?: boolean } = {},
): Promise<AddStallBlockResult> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: barn } = await supabase
    .from("barns")
    .select("id, owner_id")
    .eq("id", barnId)
    .maybeSingle();
  if (!barn) return { error: "Barn not found" };
  if (barn.owner_id !== user.id) {
    return { error: "Only the barn owner can add stalls" };
  }

  const isFreePromo = opts.isFreePromo ?? true;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("barn_stall_blocks")
    .insert({
      barn_id: barnId,
      block_size: STALL_BLOCK_SIZE,
      price_cents: STALL_BLOCK_PRICE_CENTS,
      is_free_promo: isFreePromo,
      status: "active",
      added_by_user_id: user.id,
    })
    .select("id")
    .single();
  if (error || !data) {
    return { error: error?.message ?? "Failed to add stall block" };
  }

  revalidatePath("/dashboard");
  revalidatePath("/horses");
  revalidatePath(`/barn/${barnId}/edit`);
  return { ok: true, blockId: data.id as string };
}

export interface BuildNewBarnResult {
  ok?: true;
  barnId?: string;
  blockId?: string;
  error?: string;
}

/**
 * Create a brand-new paid-tier barn with 0 base stalls and a single
 * attached 10-stall block. Per product decision in the flow:
 *   - plan_tier = 'paid' (the one-free-barn rule is untouched; users who
 *     already have a free barn don't lose eligibility by using this).
 *   - base_stalls = 0 (all capacity comes from the attached block).
 *   - is_free_promo = true during early access.
 *
 * Uses the admin client for the two INSERTs after the app-layer auth
 * check passes, matching the pattern used for horses_insert in 4d18c68 —
 * insulates this path from SECURITY-DEFINER / auth.uid()-in-RLS flakiness.
 */
export async function buildNewBarnWithBlockAction(input: {
  name: string;
  isFreePromo?: boolean;
}): Promise<BuildNewBarnResult> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const name = input.name.trim();
  if (!name) return { error: "Barn name is required" };

  const isFreePromo = input.isFreePromo ?? true;
  const admin = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: barn, error: barnErr } = await (admin as any)
    .from("barns")
    .insert({
      name,
      owner_id: user.id,
      barn_type: "standard",
      plan_tier: "paid",
      base_stalls: 0,
      plan_notes: isFreePromo
        ? "Built-A-Barn (early access — 10 stalls comped)"
        : "Built-A-Barn — paid",
      plan_started_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (barnErr || !barn) {
    return { error: barnErr?.message ?? "Could not create barn" };
  }

  // Attach a 10-stall block. If this fails we still return success for the
  // barn itself — the user can retry adding stalls from the dashboard —
  // but surface the error so they know.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: block, error: blockErr } = await (admin as any)
    .from("barn_stall_blocks")
    .insert({
      barn_id: barn.id,
      block_size: STALL_BLOCK_SIZE,
      price_cents: STALL_BLOCK_PRICE_CENTS,
      is_free_promo: isFreePromo,
      status: "active",
      added_by_user_id: user.id,
    })
    .select("id")
    .single();

  // Owner row for membership-scoped reads (mirrors createBarnAction).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from("barn_members").insert({
    barn_id: barn.id,
    user_id: user.id,
    role: "owner",
  });

  revalidatePath("/dashboard");
  revalidatePath("/horses");

  if (blockErr) {
    return {
      ok: true,
      barnId: barn.id as string,
      error: `Barn created, but could not attach stalls: ${blockErr.message}`,
    };
  }

  return {
    ok: true,
    barnId: barn.id as string,
    blockId: block?.id as string | undefined,
  };
}
