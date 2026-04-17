"use server";

import { createServerComponentClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

/** Guard: require Business Pro + barn owner. Mirrors invoices.ts. */
async function requireBusinessProOwner(barnId: string) {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" as const };

  const { data: profile } = await supabase
    .from("profiles")
    .select("has_business_pro")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.has_business_pro) {
    return { error: "Business Pro required" as const };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: barn } = await (supabase as any)
    .from("barns")
    .select("owner_id")
    .eq("id", barnId)
    .maybeSingle();
  if (!barn || barn.owner_id !== user.id) {
    return { error: "Must be the barn owner to manage expenses" as const };
  }

  return { supabase, userId: user.id };
}

export interface BarnExpenseInput {
  barnId: string;
  performed_at: string; // ISO date or datetime
  category: string;
  total_cost: number;
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
}

function sanitize(input: BarnExpenseInput) {
  return {
    performed_at: input.performed_at,
    category: input.category.trim(),
    total_cost: Number.isFinite(input.total_cost) ? input.total_cost : 0,
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
    cost_type: input.cost_type ?? "expense",
  };
}

function revalidateAll(expenseId?: string) {
  revalidatePath("/business-pro/expenses");
  revalidatePath("/business-pro/overview");
  if (expenseId) revalidatePath(`/business-pro/expenses/${expenseId}`);
}

/** Create a barn expense. */
export async function createBarnExpenseAction(
  input: BarnExpenseInput,
): Promise<{ ok?: true; expenseId?: string; error?: string }> {
  if (!input.barnId) return { error: "Barn is required" };
  if (!input.category?.trim()) return { error: "Category is required" };
  if (!(input.total_cost > 0)) return { error: "Amount must be greater than 0" };

  const auth = await requireBusinessProOwner(input.barnId);
  if ("error" in auth) return { error: auth.error };
  const { supabase, userId } = auth;

  const payload = {
    barn_id: input.barnId,
    created_by_user_id: userId,
    ...sanitize(input),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("barn_expenses")
    .insert(payload)
    .select("id")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Failed to create expense" };
  }

  revalidateAll();
  return { ok: true, expenseId: data.id as string };
}

/** Update an existing barn expense. */
export async function updateBarnExpenseAction(
  expenseId: string,
  patch: Partial<BarnExpenseInput>,
): Promise<{ ok?: true; error?: string }> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from("barn_expenses")
    .select("barn_id")
    .eq("id", expenseId)
    .maybeSingle();
  if (!existing) return { error: "Expense not found" };

  const auth = await requireBusinessProOwner(existing.barn_id);
  if ("error" in auth) return { error: auth.error };

  // Only include fields actually provided in patch. Using sanitize would
  // overwrite everything to null — instead build a sparse update.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };
  if (patch.performed_at !== undefined) updates.performed_at = patch.performed_at;
  if (patch.category !== undefined) updates.category = patch.category.trim();
  if (patch.total_cost !== undefined) updates.total_cost = patch.total_cost;
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (auth.supabase as any)
    .from("barn_expenses")
    .update(updates)
    .eq("id", expenseId);
  if (error) return { error: error.message };

  revalidateAll(expenseId);
  return { ok: true };
}

/** Delete a barn expense (hard delete; RLS enforces owner-only). */
export async function deleteBarnExpenseAction(
  expenseId: string,
): Promise<{ ok?: true; error?: string }> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from("barn_expenses")
    .select("barn_id")
    .eq("id", expenseId)
    .maybeSingle();
  if (!existing) return { error: "Expense not found" };

  const auth = await requireBusinessProOwner(existing.barn_id);
  if ("error" in auth) return { error: auth.error };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (auth.supabase as any)
    .from("barn_expenses")
    .delete()
    .eq("id", expenseId);
  if (error) return { error: error.message };

  revalidateAll();
  return { ok: true };
}

/** Quick-mark an expense as paid from the list view. */
export async function markBarnExpensePaidAction(
  expenseId: string,
  method?: BarnExpenseInput["payment_method"],
  reference?: string | null,
): Promise<{ ok?: true; error?: string }> {
  return updateBarnExpenseAction(expenseId, {
    payment_status: "paid",
    paid_at: new Date().toISOString(),
    payment_method: method ?? null,
    payment_reference: reference ?? null,
  });
}
