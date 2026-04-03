"use server";

import { isLogType, type LogType } from "@/lib/horse-form-constants";
import { canUserEditHorse } from "@/lib/horse-access";
import { createServerComponentClient } from "@/lib/supabase-server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/types";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function todayISODate(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function submitHorseLogAction(
  horseId: string,
  typeRaw: string,
  formData: FormData,
): Promise<void> {
  const t = typeRaw.toLowerCase();
  if (!isLogType(t)) {
    redirect(`/horses/${horseId}?error=invalid_log`);
  }

  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const { data: horse } = await supabase
    .from("horses")
    .select("barn_id")
    .eq("id", horseId)
    .single();

  if (!horse) redirect(`/horses/${horseId}`);

  const canEdit = await canUserEditHorse(supabase, user.id, horse.barn_id);
  if (!canEdit) redirect(`/horses/${horseId}?error=no_permission`);

  const logType = t as LogType;

  if (
    logType === "exercise" ||
    logType === "feed" ||
    logType === "medication" ||
    logType === "note"
  ) {
    const err = await insertActivity(supabase, horseId, user.id, logType, formData);
    if (err) {
      redirect(
        `/horses/${horseId}?tab=activity&error=${encodeURIComponent(err)}`,
      );
    }
    revalidatePath(`/horses/${horseId}`);
    redirect(`/horses/${horseId}?tab=activity`);
  }

  const err = await insertHealth(supabase, horseId, logType, formData);
  if (err) {
    redirect(
      `/horses/${horseId}?tab=health&error=${encodeURIComponent(err)}`,
    );
  }
  revalidatePath(`/horses/${horseId}`);
  redirect(`/horses/${horseId}?tab=health`);
}

async function insertActivity(
  supabase: SupabaseClient<Database>,
  horseId: string,
  userId: string,
  logType: "exercise" | "feed" | "medication" | "note",
  formData: FormData,
): Promise<string | undefined> {
  let details: Json = {};
  let notes: string | null = null;
  let duration_minutes = 0;
  let distance: number | null = null;
  const loggedAt = String(formData.get("logged_at") ?? "").trim();
  const created_at = loggedAt
    ? new Date(`${loggedAt}T12:00:00Z`).toISOString()
    : new Date().toISOString();

  if (logType === "exercise") {
    const subtype = String(formData.get("subtype") ?? "walk");
    const dur = parseInt(String(formData.get("duration_minutes") ?? "0"), 10);
    duration_minutes = Number.isNaN(dur) || dur < 0 ? 0 : dur;
    const distRaw = String(formData.get("distance") ?? "").trim();
    distance = distRaw === "" ? null : parseFloat(distRaw.replace(",", "."));
    if (distance !== null && Number.isNaN(distance)) distance = null;
    const track_condition = String(formData.get("track_condition") ?? "").trim() || null;
    notes = String(formData.get("notes") ?? "").trim() || null;
    details = {
      subtype,
      track_condition,
      duration_minutes,
      distance,
    };
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
  } else {
    const title = String(formData.get("title") ?? "").trim();
    notes = String(formData.get("notes") ?? "").trim() || null;
    details = { title };
  }

  const { error } = await supabase.from("activity_log").insert({
    horse_id: horseId,
    logged_by: userId,
    activity_type: logType,
    notes,
    distance,
    duration_minutes,
    speed_avg: null,
    details,
    created_at,
  });

  return error?.message;
}

async function insertHealth(
  supabase: SupabaseClient<Database>,
  horseId: string,
  logType: "shoeing" | "worming" | "vet_visit",
  formData: FormData,
): Promise<string | undefined> {
  const record_date = String(formData.get("record_date") ?? "").trim() || todayISODate();
  let record_type = "";
  let provider_name: string | null = null;
  let description: string | null = null;
  let notes: string | null = String(formData.get("notes") ?? "").trim() || null;
  let next_due_date: string | null =
    String(formData.get("next_due_date") ?? "").trim() || null;
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

  const { error } = await supabase.from("health_records").insert({
    horse_id: horseId,
    record_type,
    provider_name,
    description,
    notes,
    record_date,
    next_due_date,
    document_url: null,
    details,
  });

  return error?.message;
}
