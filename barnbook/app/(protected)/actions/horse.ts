"use server";

import { getActiveBarnContext } from "@/lib/barn-session";
import { canUserEditHorse } from "@/lib/horse-access";
import { getBarnCapacitySnapshot } from "@/lib/plans.server";
import { createServerComponentClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function generateQrCode(): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 10);
  return `BB-${ts}-${rand}`;
}

export async function createHorseAction(
  _prev: { error?: string } | null,
  formData: FormData,
): Promise<{ error?: string; horseId?: string } | null> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const ctx = await getActiveBarnContext(supabase, user.id);
  if (!ctx) return { error: "Join or create a barn first." };

  const canEdit = await canUserEditHorse(supabase, user.id, ctx.barn.id);
  if (!canEdit) return { error: "You don’t have permission to add horses." };

  // Capacity check
  const snapshot = await getBarnCapacitySnapshot(supabase, ctx.barn.id);
  if (snapshot && !snapshot.canAddHorse) {
    return { error: "BARN_FULL" };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name is required." };

  const barn_name = String(formData.get("barn_name") ?? "").trim() || null;
  const breed = String(formData.get("breed") ?? "").trim() || null;
  const sex = String(formData.get("sex") ?? "").trim() || null;
  const color = String(formData.get("color") ?? "").trim() || null;
  const foal_date = String(formData.get("foal_date") ?? "").trim() || null;
  const owner_name = String(formData.get("owner_name") ?? "").trim() || null;
  const sire = String(formData.get("sire") ?? "").trim() || null;
  const dam = String(formData.get("dam") ?? "").trim() || null;
  const registration_number = String(formData.get("registration_number") ?? "").trim() || null;
  const microchip_number = String(formData.get("microchip_number") ?? "").trim() || null;

  const { data: horse, error } = await supabase
    .from("horses")
    .insert({
      barn_id: ctx.barn.id,
      created_by: user.id,
      name,
      barn_name,
      breed,
      sex,
      color,
      foal_date,
      owner_name,
      sire,
      dam,
      registration_number,
      microchip_number,
      qr_code: generateQrCode(),
    })
    .select("id")
    .single();

  if (error || !horse) {
    return { error: error?.message ?? "Could not create horse." };
  }

  revalidatePath("/horses");
  revalidatePath("/dashboard");
  return { horseId: horse.id };
}

export async function updateHorseAction(
  horseId: string,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { data: horse } = await supabase
    .from("horses")
    .select("barn_id")
    .eq("id", horseId)
    .single();

  if (!horse) return { error: "Horse not found." };

  const canEdit = await canUserEditHorse(supabase, user.id, horse.barn_id);
  if (!canEdit) return { error: "You don’t have permission to edit this horse." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name is required." };

  const { error } = await supabase
    .from("horses")
    .update({
      name,
      barn_name: String(formData.get("barn_name") ?? "").trim() || null,
      breed: String(formData.get("breed") ?? "").trim() || null,
      sex: String(formData.get("sex") ?? "").trim() || null,
      color: String(formData.get("color") ?? "").trim() || null,
      foal_date: String(formData.get("foal_date") ?? "").trim() || null,
      owner_name: String(formData.get("owner_name") ?? "").trim() || null,
      sire: String(formData.get("sire") ?? "").trim() || null,
      dam: String(formData.get("dam") ?? "").trim() || null,
      registration_number: String(formData.get("registration_number") ?? "").trim() || null,
      microchip_number: String(formData.get("microchip_number") ?? "").trim() || null,
      feed_regimen: String(formData.get("feed_regimen") ?? "").trim() || null,
      supplements: String(formData.get("supplements") ?? "").trim() || null,
      special_care_notes: String(formData.get("special_care_notes") ?? "").trim() || null,
      turnout_schedule: String(formData.get("turnout_schedule") ?? "").trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", horseId);

  if (error) return { error: error.message };

  revalidatePath(`/horses/${horseId}`);
  revalidatePath("/horses");
  return { ok: true };
}

/** Form `action` — Next.js expects `Promise<void>`, not a return object. */
export async function updateHorseFormAction(
  horseId: string,
  formData: FormData,
): Promise<void> {
  const r = await updateHorseAction(horseId, formData);
  if (r?.error) {
    redirect(
      `/horses/${horseId}?tab=overview&error=${encodeURIComponent(r.error)}`,
    );
  }
}

export async function updateHorsePhotoUrlAction(
  horseId: string,
  photoUrl: string,
): Promise<{ error?: string; ok?: boolean }> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { data: horse } = await supabase
    .from("horses")
    .select("barn_id")
    .eq("id", horseId)
    .single();

  if (!horse) return { error: "Horse not found." };

  const canEdit = await canUserEditHorse(supabase, user.id, horse.barn_id);
  if (!canEdit) return { error: "Permission denied." };

  const { error } = await supabase
    .from("horses")
    .update({ photo_url: photoUrl, updated_at: new Date().toISOString() })
    .eq("id", horseId);

  if (error) return { error: error.message };

  revalidatePath(`/horses/${horseId}`);
  return { ok: true };
}
