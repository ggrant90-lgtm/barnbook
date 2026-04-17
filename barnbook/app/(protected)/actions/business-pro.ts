"use server";

import { canUserEditHorse } from "@/lib/horse-access";
import { createServerComponentClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

type Source = "activity" | "health";

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

/** Fetch the entry to verify access + read total_cost/horse_id. */
async function loadEntry(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  entryId: string,
  source: Source,
): Promise<{ horse_id: string; total_cost: number | null } | null> {
  const table = source === "activity" ? "activity_log" : "health_records";
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
  const table = source === "activity" ? "activity_log" : "health_records";
  return supabase.from(table).update(patch).eq("id", entryId);
}

/** Mark a log entry as fully paid (sets paid_amount = total_cost, paid_at = now). */
export async function markAsPaidAction(entryId: string, source: Source) {
  const auth = await requireBusinessPro();
  if ("error" in auth) return { error: auth.error };
  const { supabase, userId } = auth;

  const entry = await loadEntry(supabase, entryId, source);
  if (!entry) return { error: "Entry not found" };

  const { data: horse } = await supabase.from("horses").select("barn_id").eq("id", entry.horse_id).maybeSingle();
  if (!horse) return { error: "Horse not found" };

  const canEdit = await canUserEditHorse(supabase, userId, horse.barn_id);
  if (!canEdit) return { error: "No permission" };

  const { error } = await updateEntry(supabase, entryId, source, {
    payment_status: "paid",
    paid_amount: entry.total_cost,
    paid_at: new Date().toISOString(),
  });
  if (error) return { error: error.message };

  revalidatePath("/business-pro/overview");
  revalidatePath(`/horses/${entry.horse_id}`);
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

  const { data: horse } = await supabase.from("horses").select("barn_id").eq("id", entry.horse_id).maybeSingle();
  if (!horse) return { error: "Horse not found" };

  const canEdit = await canUserEditHorse(supabase, userId, horse.barn_id);
  if (!canEdit) return { error: "No permission" };

  if (!(amount > 0)) return { error: "Amount must be greater than zero" };

  const { error } = await updateEntry(supabase, entryId, source, {
    payment_status: "partial",
    paid_amount: amount,
    paid_at: paidAt ? new Date(paidAt).toISOString() : new Date().toISOString(),
  });
  if (error) return { error: error.message };

  revalidatePath("/business-pro/overview");
  revalidatePath(`/horses/${entry.horse_id}`);
  return { ok: true, newStatus: "partial" as const, paid_amount: amount };
}

/** Waive the charge (forgive / write off). */
export async function waiveChargeAction(entryId: string, source: Source) {
  const auth = await requireBusinessPro();
  if ("error" in auth) return { error: auth.error };
  const { supabase, userId } = auth;

  const entry = await loadEntry(supabase, entryId, source);
  if (!entry) return { error: "Entry not found" };

  const { data: horse } = await supabase.from("horses").select("barn_id").eq("id", entry.horse_id).maybeSingle();
  if (!horse) return { error: "Horse not found" };

  const canEdit = await canUserEditHorse(supabase, userId, horse.barn_id);
  if (!canEdit) return { error: "No permission" };

  const { error } = await updateEntry(supabase, entryId, source, {
    payment_status: "waived",
  });
  if (error) return { error: error.message };

  revalidatePath("/business-pro/overview");
  revalidatePath(`/horses/${entry.horse_id}`);
  return { ok: true, newStatus: "waived" as const };
}
