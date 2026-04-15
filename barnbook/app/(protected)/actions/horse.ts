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
      breeding_role: (String(formData.get("breeding_role") ?? "none").trim() || "none") as "donor" | "recipient" | "stallion" | "multiple" | "none",
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

export async function deleteHorseAction(
  horseId: string,
  permanent: boolean = false,
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
  if (!canEdit) return { error: "You don't have permission to delete this horse." };

  if (!permanent) {
    // Soft delete — archive the horse.
    const { error } = await supabase
      .from("horses")
      .update({ archived: true })
      .eq("id", horseId);

    if (error) return { error: error.message };
  } else {
    // Hard delete — remove horse and ALL associated data.
    // Order matters: delete child records before the horse.

    // 1. Foalings — linked to pregnancies or directly referencing this horse
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: pregIds } = await (supabase as any)
      .from("pregnancies")
      .select("id")
      .or(`donor_horse_id.eq.${horseId},surrogate_horse_id.eq.${horseId},stallion_horse_id.eq.${horseId}`);
    const pIds = (pregIds ?? []).map((p: { id: string }) => p.id);
    if (pIds.length > 0) {
      await (supabase as any).from("foalings").delete().in("pregnancy_id", pIds);
    }
    // Also delete foalings that reference this horse directly
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("foalings")
      .delete()
      .or(`surrogate_horse_id.eq.${horseId},foal_horse_id.eq.${horseId}`);

    // 2. Pregnancies (as donor, surrogate, or stallion)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("pregnancies")
      .delete()
      .or(`donor_horse_id.eq.${horseId},surrogate_horse_id.eq.${horseId},stallion_horse_id.eq.${horseId}`);

    // 3. ICSI batches linked to OPU sessions for this horse
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: opuIds } = await (supabase as any)
      .from("opu_sessions")
      .select("id")
      .eq("donor_horse_id", horseId);
    const oIds = (opuIds ?? []).map((o: { id: string }) => o.id);
    if (oIds.length > 0) {
      await (supabase as any).from("icsi_batches").delete().in("opu_session_id", oIds);
      await (supabase as any).from("oocytes").delete().in("opu_session_id", oIds);
    }

    // 4. OPU sessions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("opu_sessions").delete().eq("donor_horse_id", horseId);

    // 5. Embryos (as donor or stallion)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("embryos")
      .delete()
      .or(`donor_horse_id.eq.${horseId},stallion_horse_id.eq.${horseId}`);

    // 6. Flushes (as donor or stallion)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("flushes")
      .delete()
      .or(`donor_horse_id.eq.${horseId},stallion_horse_id.eq.${horseId}`);

    // 7. Log entries and related media/line items
    const { data: logEntries } = await supabase
      .from("log_entries")
      .select("id")
      .eq("horse_id", horseId);
    const logIds = (logEntries ?? []).map((e: { id: string }) => e.id);
    if (logIds.length > 0) {
      await supabase.from("log_entry_media").delete().in("log_entry_id", logIds);
      await supabase.from("log_entry_line_items").delete().in("log_entry_id", logIds);
    }
    await supabase.from("log_entries").delete().eq("horse_id", horseId);

    // 8. Health records, horse stays, location assignments
    await supabase.from("health_records").delete().eq("horse_id", horseId);
    await supabase.from("horse_stays").delete().eq("horse_id", horseId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("horse_location_assignments").delete().eq("horse_id", horseId);

    // 9. Financial records
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("financial_records").delete().eq("horse_id", horseId);

    // 10. Access keys referencing this horse
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("access_keys").update({ horse_id: null }).eq("horse_id", horseId);

    // 11. Clear sire/dam references from other horses
    await supabase.from("horses").update({ sire_horse_id: null } as Record<string, unknown>).eq("sire_horse_id", horseId);
    await supabase.from("horses").update({ dam_horse_id: null } as Record<string, unknown>).eq("dam_horse_id", horseId);

    // 12. Finally delete the horse
    const { error } = await supabase.from("horses").delete().eq("id", horseId);
    if (error) return { error: error.message };
  }

  revalidatePath("/horses");
  revalidatePath("/dashboard");
  revalidatePath("/breeders-pro");
  revalidatePath("/breeders-pro/donors");
  revalidatePath("/breeders-pro/stallions");
  revalidatePath("/breeders-pro/surrogates");
  revalidatePath("/breeders-pro/pregnancies");
  return { ok: true };
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
