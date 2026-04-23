"use server";

import { canUserEditHorse } from "@/lib/horse-access";
import { createServerComponentClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

type Source = "activity" | "health" | "barn_expense";

async function requireBusinessPro() {
  const supabase = await createServerComponentClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" as const };

  const { data: profile } = await supabase
    .from("profiles")
    .select("has_business_pro")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.has_business_pro) return { error: "Business Pro required" as const };

  return { supabase, userId: user.id };
}

function tableForSource(source: Source): string {
  if (source === "activity") return "activity_log";
  if (source === "health") return "health_records";
  return "barn_expenses";
}

/** Fetch the entry to verify access + read total_cost + parent scope.
 *  Horse-sourced rows carry `horse_id`; barn_expense rows carry
 *  `barn_id` instead. Callers branch on the presence of horse_id. */
async function loadEntry(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  entryId: string,
  source: Source,
): Promise<
  | { horse_id: string; barn_id?: undefined; total_cost: number | null }
  | { horse_id?: undefined; barn_id: string; total_cost: number | null }
  | null
> {
  const table = tableForSource(source);
  if (source === "barn_expense") {
    const { data } = await supabase
      .from(table)
      .select("barn_id, total_cost")
      .eq("id", entryId)
      .maybeSingle();
    return data ?? null;
  }
  const { data } = await supabase
    .from(table)
    .select("horse_id, total_cost")
    .eq("id", entryId)
    .maybeSingle();
  return data ?? null;
}

async function updateEntry(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  entryId: string,
  source: Source,
  patch: Record<string, unknown>,
) {
  return supabase.from(tableForSource(source)).update(patch).eq("id", entryId);
}

/** Verify the caller can mutate the given entry — horse-level rows
 *  use canUserEditHorse; barn_expense rows use the barn owner check
 *  (same gate `actions/barn-expenses.ts` uses). Returns true on
 *  success, false otherwise. */
async function canEditEntry(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  entry: Awaited<ReturnType<typeof loadEntry>>,
): Promise<boolean> {
  if (!entry) return false;
  if ("horse_id" in entry && entry.horse_id) {
    const { data: horse } = await supabase
      .from("horses")
      .select("barn_id")
      .eq("id", entry.horse_id)
      .maybeSingle();
    if (!horse) return false;
    return canUserEditHorse(supabase, userId, horse.barn_id);
  }
  if ("barn_id" in entry && entry.barn_id) {
    const { data: barn } = await supabase
      .from("barns")
      .select("owner_id")
      .eq("id", entry.barn_id)
      .maybeSingle();
    return !!barn && barn.owner_id === userId;
  }
  return false;
}

function revalidateForEntry(
  entry: Awaited<ReturnType<typeof loadEntry>>,
) {
  revalidatePath("/business-pro/overview");
  revalidatePath("/business-pro/receivables");
  if (entry && "horse_id" in entry && entry.horse_id) {
    revalidatePath(`/horses/${entry.horse_id}`);
  }
  if (entry && "barn_id" in entry && entry.barn_id) {
    revalidatePath("/logs");
    revalidatePath("/business-pro/expenses");
  }
}

/** Mark a log entry as fully paid (sets paid_amount = total_cost, paid_at = now). */
export async function markAsPaidAction(entryId: string, source: Source) {
  const auth = await requireBusinessPro();
  if ("error" in auth) return { error: auth.error };
  const { supabase, userId } = auth;

  const entry = await loadEntry(supabase, entryId, source);
  if (!entry) return { error: "Entry not found" };

  if (!(await canEditEntry(supabase, userId, entry))) {
    return { error: "No permission" };
  }

  const { error } = await updateEntry(supabase, entryId, source, {
    payment_status: "paid",
    paid_amount: entry.total_cost,
    paid_at: new Date().toISOString(),
  });
  if (error) return { error: error.message };

  revalidateForEntry(entry);
  return { ok: true, newStatus: "paid" as const, paid_amount: entry.total_cost };
}

/** Record a partial payment. */
export async function logPartialPaymentAction(
  entryId: string,
  source: Source,
  amount: number,
  paidAt: string,
) {
  const auth = await requireBusinessPro();
  if ("error" in auth) return { error: auth.error };
  const { supabase, userId } = auth;

  const entry = await loadEntry(supabase, entryId, source);
  if (!entry) return { error: "Entry not found" };

  if (!(await canEditEntry(supabase, userId, entry))) {
    return { error: "No permission" };
  }

  if (!(amount > 0)) return { error: "Amount must be greater than zero" };

  const { error } = await updateEntry(supabase, entryId, source, {
    payment_status: "partial",
    paid_amount: amount,
    paid_at: paidAt ? new Date(paidAt).toISOString() : new Date().toISOString(),
  });
  if (error) return { error: error.message };

  revalidateForEntry(entry);
  return { ok: true, newStatus: "partial" as const, paid_amount: amount };
}

/** Waive the charge (forgive / write off). */
export async function waiveChargeAction(entryId: string, source: Source) {
  const auth = await requireBusinessPro();
  if ("error" in auth) return { error: auth.error };
  const { supabase, userId } = auth;

  const entry = await loadEntry(supabase, entryId, source);
  if (!entry) return { error: "Entry not found" };

  if (!(await canEditEntry(supabase, userId, entry))) {
    return { error: "No permission" };
  }

  const { error } = await updateEntry(supabase, entryId, source, {
    payment_status: "waived",
  });
  if (error) return { error: error.message };

  revalidateForEntry(entry);
  return { ok: true, newStatus: "waived" as const };
}
