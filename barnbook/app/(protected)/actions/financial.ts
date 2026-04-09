"use server";

import { canUserEditHorse } from "@/lib/horse-access";
import { createServerComponentClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

/**
 * Add a financial record to a flush, embryo, pregnancy, or horse.
 */
export async function addFinancialRecordAction(
  formData: FormData,
): Promise<{ id?: string; error?: string }> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const barnId = String(formData.get("barn_id") ?? "").trim();
  if (!barnId) return { error: "Barn ID required" };

  const canEdit = await canUserEditHorse(supabase, user.id, barnId);
  if (!canEdit) return { error: "No permission" };

  const category = String(formData.get("category") ?? "other");
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const amount = amountRaw ? parseFloat(amountRaw) : 0;
  if (amount <= 0) return { error: "Amount must be greater than 0" };

  const recordDate = String(formData.get("record_date") ?? "").trim()
    || new Date().toISOString().slice(0, 10);
  const vendor = String(formData.get("vendor") ?? "").trim() || null;
  const paid = formData.get("paid") === "true";
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const flushId = String(formData.get("flush_id") ?? "").trim() || null;
  const embryoId = String(formData.get("embryo_id") ?? "").trim() || null;
  const pregnancyId = String(formData.get("pregnancy_id") ?? "").trim() || null;
  const horseId = String(formData.get("horse_id") ?? "").trim() || null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("financial_records")
    .insert({
      barn_id: barnId,
      flush_id: flushId,
      embryo_id: embryoId,
      pregnancy_id: pregnancyId,
      horse_id: horseId,
      category,
      amount,
      record_date: recordDate,
      vendor,
      paid,
      notes,
      created_by_user_id: user.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/embryo-bank");
  return { id: data.id };
}
