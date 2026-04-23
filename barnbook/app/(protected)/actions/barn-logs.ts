"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase-admin";
import { createServerComponentClient } from "@/lib/supabase-server";
import { isEditorPlusRole } from "@/lib/roles";

/**
 * Barn Logs — server actions for inserting, editing, and deleting rows
 * in `barn_expenses` without the Business Pro gate that
 * `barn-expenses.ts` enforces.
 *
 * Why a parallel file:
 *   - `barn-expenses.ts` assumes BP (checks `profiles.has_business_pro`
 *     on every write). The general-purpose "Barn Logs" surface is
 *     available to every user with a barn — no BP required.
 *   - Zero-cost rows ("cleaned water troughs") are valid here; the
 *     BP form rejects `total_cost <= 0`.
 *   - BP users still use the same table — when `cost_type` /
 *     `billable_to_*` / `payment_status` fields are set, entries flow
 *     into BP Overview and Receivables automatically.
 *
 * Access rule: barn owner or editor barn member. No stall-key path —
 * barn-level logs are operational, not horse-scoped.
 */

export interface BarnLogInput {
  barnId: string;
  performed_at: string; // ISO date or datetime
  category: string;
  total_cost?: number | null; // optional; 0 when omitted
  vendor_name?: string | null;
  description?: string | null;
  notes?: string | null;
  payment_method?:
    | "check"
    | "cash"
    | "card"
    | "ach"
    | "venmo"
    | "other"
    | null;
  payment_reference?: string | null;
  payment_status?: "unpaid" | "paid" | "partial" | "waived" | null;
  paid_amount?: number | null;
  paid_at?: string | null;
  cost_type?: "expense" | "revenue" | "pass_through" | null;
  billable_to_user_id?: string | null;
  billable_to_name?: string | null;
  client_id?: string | null;
}

/**
 * Require the user to be the barn owner or an editor member. Returns
 * the auth context on success; { error } on failure.
 */
async function requireBarnWriter(barnId: string) {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" as const };

  const { data: barn } = await supabase
    .from("barns")
    .select("owner_id")
    .eq("id", barnId)
    .maybeSingle();
  if (!barn) return { error: "Barn not found" as const };

  if (barn.owner_id === user.id) {
    return { supabase, userId: user.id };
  }

  const { data: mem } = await supabase
    .from("barn_members")
    .select("role")
    .eq("barn_id", barnId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (mem && isEditorPlusRole(mem.role as string | null | undefined)) {
    return { supabase, userId: user.id };
  }

  return { error: "Must be the barn owner or editor to manage barn logs" as const };
}

function sanitize(input: BarnLogInput) {
  return {
    performed_at: input.performed_at,
    category: input.category.trim(),
    total_cost:
      typeof input.total_cost === "number" && Number.isFinite(input.total_cost)
        ? input.total_cost
        : 0,
    vendor_name: input.vendor_name?.trim() || null,
    description: input.description?.trim() || null,
    notes: input.notes?.trim() || null,
    payment_method: input.payment_method ?? null,
    payment_reference: input.payment_reference?.trim() || null,
    payment_status: input.payment_status ?? null,
    paid_amount:
      input.paid_amount != null && Number.isFinite(input.paid_amount)
        ? input.paid_amount
        : null,
    paid_at: input.paid_at ?? null,
    cost_type: input.cost_type ?? null,
    billable_to_user_id: input.billable_to_user_id ?? null,
    billable_to_name: input.billable_to_name?.trim() || null,
  };
}

function revalidateAll(barnId?: string) {
  revalidatePath("/logs");
  revalidatePath("/dashboard");
  revalidatePath("/business-pro/overview");
  revalidatePath("/business-pro/expenses");
  revalidatePath("/business-pro/receivables");
  if (barnId) revalidatePath(`/barn/${barnId}`);
}

export async function createBarnLogAction(
  input: BarnLogInput,
): Promise<{ ok?: true; logId?: string; error?: string }> {
  if (!input.barnId) return { error: "Barn is required" };
  if (!input.category?.trim()) return { error: "Category is required" };

  const auth = await requireBarnWriter(input.barnId);
  if ("error" in auth) return { error: auth.error };
  const { userId } = auth;

  // Admin client: app-layer auth is done; the horse-logging actions
  // follow the same 4d18c68 pattern for consistent behavior when RLS
  // policies referencing auth.uid() get flaky in server-action
  // contexts.
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;

  const payload = {
    barn_id: input.barnId,
    created_by_user_id: userId,
    ...sanitize(input),
  };

  const { data, error } = await db
    .from("barn_expenses")
    .insert(payload)
    .select("id")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Failed to create barn log" };
  }

  revalidateAll(input.barnId);
  return { ok: true, logId: data.id as string };
}

export async function updateBarnLogAction(
  logId: string,
  patch: Partial<BarnLogInput>,
): Promise<{ ok?: true; error?: string }> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;

  const { data: existing } = await db
    .from("barn_expenses")
    .select("barn_id")
    .eq("id", logId)
    .maybeSingle();
  if (!existing) return { error: "Barn log not found" };

  const auth = await requireBarnWriter(existing.barn_id);
  if ("error" in auth) return { error: auth.error };

  // Sparse update: only touch fields the caller actually provided.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };
  if (patch.performed_at !== undefined) updates.performed_at = patch.performed_at;
  if (patch.category !== undefined) updates.category = patch.category.trim();
  if (patch.total_cost !== undefined) updates.total_cost = patch.total_cost ?? 0;
  if (patch.vendor_name !== undefined)
    updates.vendor_name = patch.vendor_name?.trim() || null;
  if (patch.description !== undefined)
    updates.description = patch.description?.trim() || null;
  if (patch.notes !== undefined) updates.notes = patch.notes?.trim() || null;
  if (patch.payment_method !== undefined)
    updates.payment_method = patch.payment_method ?? null;
  if (patch.payment_reference !== undefined)
    updates.payment_reference = patch.payment_reference?.trim() || null;
  if (patch.payment_status !== undefined)
    updates.payment_status = patch.payment_status ?? null;
  if (patch.paid_amount !== undefined) updates.paid_amount = patch.paid_amount;
  if (patch.paid_at !== undefined) updates.paid_at = patch.paid_at ?? null;
  if (patch.cost_type !== undefined) updates.cost_type = patch.cost_type;
  if (patch.billable_to_user_id !== undefined)
    updates.billable_to_user_id = patch.billable_to_user_id ?? null;
  if (patch.billable_to_name !== undefined)
    updates.billable_to_name = patch.billable_to_name?.trim() || null;

  const { error } = await db
    .from("barn_expenses")
    .update(updates)
    .eq("id", logId);
  if (error) return { error: error.message };

  revalidateAll(existing.barn_id as string);
  return { ok: true };
}

export async function deleteBarnLogAction(
  logId: string,
): Promise<{ ok?: true; error?: string }> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;

  const { data: existing } = await db
    .from("barn_expenses")
    .select("barn_id")
    .eq("id", logId)
    .maybeSingle();
  if (!existing) return { error: "Barn log not found" };

  const auth = await requireBarnWriter(existing.barn_id);
  if ("error" in auth) return { error: auth.error };

  const { error } = await db.from("barn_expenses").delete().eq("id", logId);
  if (error) return { error: error.message };

  revalidateAll(existing.barn_id as string);
  return { ok: true };
}
