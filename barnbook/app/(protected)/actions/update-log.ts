"use server";

import { isLogType, type LogType } from "@/lib/horse-form-constants";
import { canUserEditHorse } from "@/lib/horse-access";
import { createServerComponentClient } from "@/lib/supabase-server";
import type { Json } from "@/lib/types";
import { revalidatePath } from "next/cache";

function extractCrmFields(formData: FormData) {
  const performed_by_user_id =
    String(formData.get("performed_by_user_id") ?? "").trim() || null;
  const performed_by_name =
    String(formData.get("performed_by_name") ?? "").trim() || null;
  const performedAtRaw = String(formData.get("performed_at") ?? "").trim();
  const performed_at = performedAtRaw
    ? new Date(performedAtRaw).toISOString()
    : new Date().toISOString();
  const totalCostRaw = String(formData.get("total_cost") ?? "").trim();
  const total_cost = totalCostRaw ? parseFloat(totalCostRaw) : null;

  return { performed_by_user_id, performed_by_name, performed_at, total_cost };
}

function extractFinancialFields(formData: FormData, total_cost: number | null) {
  const cost_type = String(formData.get("cost_type") ?? "").trim() || null;
  const isBillable = cost_type === "revenue" || cost_type === "pass_through";

  const client_id = isBillable
    ? String(formData.get("client_id") ?? "").trim() || null
    : null;
  const billable_to_user_id = isBillable
    ? String(formData.get("billable_to_user_id") ?? "").trim() || null
    : null;
  const billable_to_name = isBillable
    ? String(formData.get("billable_to_name") ?? "").trim() || null
    : null;
  const payment_status = isBillable
    ? String(formData.get("payment_status") ?? "").trim() || null
    : null;

  const needsPayment = payment_status === "paid" || payment_status === "partial";
  const paidAmountRaw = String(formData.get("paid_amount") ?? "").trim();
  let paid_amount: number | null = needsPayment && paidAmountRaw ? parseFloat(paidAmountRaw) : null;
  if (payment_status === "paid" && paid_amount == null && total_cost != null) {
    paid_amount = total_cost;
  }

  const paidAtRaw = String(formData.get("paid_at") ?? "").trim();
  let paid_at: string | null = needsPayment && paidAtRaw
    ? new Date(paidAtRaw).toISOString()
    : null;
  if (payment_status === "paid" && !paid_at) {
    paid_at = new Date().toISOString();
  }

  return { cost_type, client_id, billable_to_user_id, billable_to_name, payment_status, paid_amount, paid_at };
}

function extractLineItems(formData: FormData): { description: string; amount: number }[] {
  const items: { description: string; amount: number }[] = [];
  for (let i = 0; i < 50; i++) {
    const desc = String(formData.get(`line_item_desc_${i}`) ?? "").trim();
    const amtRaw = String(formData.get(`line_item_amt_${i}`) ?? "").trim();
    if (!desc && !amtRaw) break;
    const amt = parseFloat(amtRaw);
    if (desc && !Number.isNaN(amt) && amt > 0) {
      items.push({ description: desc, amount: amt });
    }
  }
  return items;
}

export async function updateLogAction(
  logId: string,
  horseId: string,
  typeRaw: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const t = typeRaw.toLowerCase();
  if (!isLogType(t)) return { error: "Invalid log type" };

  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: horse } = await supabase
    .from("horses")
    .select("barn_id")
    .eq("id", horseId)
    .single();
  if (!horse) return { error: "Horse not found" };

  const canEdit = await canUserEditHorse(supabase, user.id, horse.barn_id);
  if (!canEdit) return { error: "No permission to edit this horse" };

  const logType = t as LogType;
  const crm = extractCrmFields(formData);
  const lineItems = extractLineItems(formData);
  const activityTypes = ["exercise", "pony", "feed", "medication", "note", "breed_data"] as const;

  if ((activityTypes as readonly string[]).includes(logType)) {
    // Build activity update payload
    let details: Json = {};
    let notes: string | null = null;
    let duration_minutes = 0;
    let distance: number | null = null;
    const loggedAt = String(formData.get("logged_at") ?? "").trim();
    const created_at = loggedAt
      ? new Date(`${loggedAt}T12:00:00Z`).toISOString()
      : undefined; // don't overwrite if not provided

    if (logType === "pony") {
      // Matches the shape in create-log.ts insertActivity for "pony".
      const dur = parseInt(String(formData.get("duration_minutes") ?? "0"), 10);
      duration_minutes = Number.isNaN(dur) || dur < 0 ? 0 : dur;
      const distRaw = String(formData.get("distance") ?? "").trim();
      distance = distRaw === "" ? null : parseFloat(distRaw.replace(",", "."));
      if (distance !== null && Number.isNaN(distance)) distance = null;
      notes = String(formData.get("notes") ?? "").trim() || null;
      details = { duration_minutes, distance };
    } else if (logType === "exercise") {
      const subtype = String(formData.get("subtype") ?? "walk");
      const dur = parseInt(String(formData.get("duration_minutes") ?? "0"), 10);
      duration_minutes = Number.isNaN(dur) || dur < 0 ? 0 : dur;
      const distRaw = String(formData.get("distance") ?? "").trim();
      distance = distRaw === "" ? null : parseFloat(distRaw.replace(",", "."));
      if (distance !== null && Number.isNaN(distance)) distance = null;
      const track_condition = String(formData.get("track_condition") ?? "").trim() || null;
      notes = String(formData.get("notes") ?? "").trim() || null;
      details = { subtype, track_condition, duration_minutes, distance };
    } else if (logType === "feed") {
      notes = String(formData.get("notes") ?? "").trim() || null;
      details = {
        feed_type: String(formData.get("feed_type") ?? "").trim() || null,
        amount: String(formData.get("amount") ?? "").trim() || null,
      };
    } else if (logType === "medication") {
      notes = String(formData.get("notes") ?? "").trim() || null;
      details = {
        medication_name: String(formData.get("medication_name") ?? "").trim() || null,
        dosage: String(formData.get("dosage") ?? "").trim() || null,
        frequency: String(formData.get("frequency") ?? "").trim() || null,
        start_date: String(formData.get("start_date") ?? "").trim() || null,
        end_date: String(formData.get("end_date") ?? "").trim() || null,
      };
    } else if (logType === "breed_data") {
      notes = String(formData.get("notes") ?? "").trim() || null;
      const breed_subtype = String(formData.get("breed_subtype") ?? "custom").trim();
      const breedDetails: Record<string, Json | undefined> = { breed_subtype };
      if (breed_subtype === "bred_ai") {
        breedDetails.stallion_name = String(formData.get("stallion_name") ?? "").trim() || null;
        breedDetails.breeding_method = String(formData.get("breeding_method") ?? "").trim() || null;
      } else if (breed_subtype === "flush_embryo") {
        breedDetails.vet = String(formData.get("vet") ?? "").trim() || null;
        const recovered = parseInt(String(formData.get("embryos_recovered") ?? ""), 10);
        breedDetails.embryos_recovered = Number.isNaN(recovered) ? null : recovered;
        const viable = parseInt(String(formData.get("embryos_viable") ?? ""), 10);
        breedDetails.embryos_viable = Number.isNaN(viable) ? null : viable;
        breedDetails.storage_location = String(formData.get("storage_location") ?? "").trim() || null;
      } else if (breed_subtype === "embryo_transfer") {
        breedDetails.vet = String(formData.get("vet") ?? "").trim() || null;
        breedDetails.recipient_mare = String(formData.get("recipient_mare") ?? "").trim() || null;
        breedDetails.embryo_source = String(formData.get("embryo_source") ?? "").trim() || null;
      } else if (breed_subtype === "ultrasound") {
        breedDetails.vet = String(formData.get("vet") ?? "").trim() || null;
        const daysBred = parseInt(String(formData.get("days_bred") ?? ""), 10);
        breedDetails.days_bred = Number.isNaN(daysBred) ? null : daysBred;
        breedDetails.result = String(formData.get("result") ?? "").trim() || null;
      } else if (breed_subtype === "foaling") {
        breedDetails.foal_sex = String(formData.get("foal_sex") ?? "").trim() || null;
        breedDetails.foal_color = String(formData.get("foal_color") ?? "").trim() || null;
        breedDetails.alive = formData.get("alive") === "true" || formData.get("alive") === "on";
        breedDetails.vet = String(formData.get("vet") ?? "").trim() || null;
      }
      details = breedDetails;
    } else {
      // note
      const title = String(formData.get("title") ?? "").trim();
      notes = String(formData.get("notes") ?? "").trim() || null;
      details = { title };
    }

    const updatePayload: Record<string, unknown> = {
      notes,
      distance,
      duration_minutes,
      details,
      performed_by_user_id: crm.performed_by_user_id,
      performed_by_name: crm.performed_by_name,
      performed_at: crm.performed_at,
      total_cost: crm.total_cost,
      ...extractFinancialFields(formData, crm.total_cost),
      updated_at: new Date().toISOString(),
      updated_by_user_id: user.id,
    };
    if (created_at) updatePayload.created_at = created_at;

    const { error } = await supabase
      .from("activity_log")
      .update(updatePayload)
      .eq("id", logId);

    if (error) return { error: error.message };
  } else {
    // Health record update
    let record_type = "";
    let provider_name: string | null = null;
    let description: string | null = null;
    const notes: string | null = String(formData.get("notes") ?? "").trim() || null;
    const record_date = String(formData.get("record_date") ?? "").trim() || undefined;
    let next_due_date: string | null = String(formData.get("next_due_date") ?? "").trim() || null;
    let details: Json = {};

    if (logType === "shoeing") {
      record_type = "Shoeing";
      provider_name = String(formData.get("farrier_name") ?? "").trim() || null;
      const shoe_type = String(formData.get("shoe_type") ?? "").trim() || null;
      description = shoe_type;
      details = { farrier_name: provider_name, shoe_type };
    } else if (logType === "worming") {
      record_type = "Worming";
      const product_name = String(formData.get("product_name") ?? "").trim() || null;
      provider_name = product_name;
      description = product_name;
      details = { product_name };
    } else if (logType === "dentistry") {
      record_type = "Dentistry";
      provider_name = String(formData.get("dentist_name") ?? "").trim() || null;
      const procedure = String(formData.get("procedure") ?? "").trim() || null;
      description = procedure;
      details = { dentist_name: provider_name, procedure };
    } else {
      record_type = "Vet visit";
      provider_name = String(formData.get("vet_name") ?? "").trim() || null;
      description = String(formData.get("reason") ?? "").trim() || null;
      const followUp = String(formData.get("follow_up_date") ?? "").trim() || null;
      next_due_date = followUp || next_due_date;
      details = {
        vet_name: provider_name,
        reason: String(formData.get("reason") ?? "").trim() || null,
        diagnosis: String(formData.get("diagnosis") ?? "").trim() || null,
        treatment: String(formData.get("treatment") ?? "").trim() || null,
        follow_up_date: followUp,
      };
    }

    const updatePayload: Record<string, unknown> = {
      record_type,
      provider_name,
      description,
      notes,
      next_due_date,
      details,
      performed_by_user_id: crm.performed_by_user_id,
      performed_by_name: crm.performed_by_name,
      performed_at: crm.performed_at,
      total_cost: crm.total_cost,
      ...extractFinancialFields(formData, crm.total_cost),
      updated_at: new Date().toISOString(),
      updated_by_user_id: user.id,
    };
    if (record_date) updatePayload.record_date = record_date;

    const { error } = await supabase
      .from("health_records")
      .update(updatePayload)
      .eq("id", logId);

    if (error) return { error: error.message };
  }

  // Replace line items: delete old, insert new
  const logCategory = (activityTypes as readonly string[]).includes(logType) ? "activity" : "health";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("log_entry_line_items")
    .delete()
    .eq("log_type", logCategory)
    .eq("log_id", logId);

  if (lineItems.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("log_entry_line_items").insert(
      lineItems.map((li, i) => ({
        log_type: logCategory,
        log_id: logId,
        description: li.description,
        amount: li.amount,
        sort_order: i,
      })),
    );
  }

  revalidatePath(`/horses/${horseId}`);
  return {};
}
