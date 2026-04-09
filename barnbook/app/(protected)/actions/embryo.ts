"use server";

import { canUserEditHorse } from "@/lib/horse-access";
import { createServerComponentClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

/**
 * Creates a flush with N embryos in a single transaction via RPC.
 */
export async function createFlushAction(
  donorHorseId: string,
  formData: FormData,
): Promise<{ flushId?: string; embryoCount?: number; error?: string }> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Fetch horse to get barn_id
  const { data: horse } = await supabase
    .from("horses")
    .select("barn_id")
    .eq("id", donorHorseId)
    .single();
  if (!horse) return { error: "Horse not found" };

  const canEdit = await canUserEditHorse(supabase, user.id, horse.barn_id);
  if (!canEdit) return { error: "No permission" };

  // Extract form fields
  const stallionSource = String(formData.get("stallion_source") ?? "external");
  const stallionHorseId = stallionSource === "in_system"
    ? String(formData.get("stallion_horse_id") ?? "").trim() || null
    : null;
  const externalStallionName = stallionSource === "external"
    ? String(formData.get("external_stallion_name") ?? "").trim() || null
    : null;
  const externalStallionRegistration = stallionSource === "external"
    ? String(formData.get("external_stallion_registration") ?? "").trim() || null
    : null;

  const flushDate = String(formData.get("flush_date") ?? "").trim()
    || new Date().toISOString().slice(0, 10);
  const vetName = String(formData.get("veterinarian_name") ?? "").trim() || null;
  const breedingMethod = String(formData.get("breeding_method") ?? "ai_fresh");
  const embryoCountRaw = parseInt(String(formData.get("embryo_count") ?? "0"), 10);
  const embryoCount = Number.isNaN(embryoCountRaw) || embryoCountRaw < 0 ? 0 : embryoCountRaw;
  const flushCostRaw = String(formData.get("flush_cost") ?? "").trim();
  const flushCost = flushCostRaw ? parseFloat(flushCostRaw) : null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (embryoCount === 0) return { error: "Embryo count must be at least 1" };

  // Collect grades and stages for each embryo
  const grades: string[] = [];
  const stages: string[] = [];
  for (let i = 0; i < embryoCount; i++) {
    grades.push(String(formData.get(`grade_${i}`) ?? "grade_1"));
    stages.push(String(formData.get(`stage_${i}`) ?? "morula"));
  }

  // Call the transactional RPC
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("create_flush_with_embryos", {
    p_barn_id: horse.barn_id,
    p_donor_horse_id: donorHorseId,
    p_stallion_horse_id: stallionHorseId,
    p_external_stallion_name: externalStallionName,
    p_external_stallion_registration: externalStallionRegistration,
    p_flush_date: flushDate,
    p_veterinarian_name: vetName,
    p_breeding_method: breedingMethod,
    p_embryo_count: embryoCount,
    p_flush_cost: flushCost,
    p_notes: notes,
    p_created_by: user.id,
    p_grades: grades,
    p_stages: stages,
  });

  if (error) return { error: error.message };
  if (!data?.ok) return { error: data?.error ?? "Unknown error" };

  revalidatePath(`/horses/${donorHorseId}`);
  revalidatePath("/embryo-bank");

  return { flushId: data.flush_id, embryoCount };
}

/**
 * Transfer an embryo to a surrogate mare, creating a pregnancy.
 */
export async function transferEmbryoAction(
  embryoId: string,
  formData: FormData,
): Promise<{ pregnancyId?: string; error?: string }> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: embryo } = await (supabase as any)
    .from("embryos")
    .select("id, barn_id, flush_id, donor_horse_id, stallion_horse_id, status")
    .eq("id", embryoId)
    .single();

  if (!embryo) return { error: "Embryo not found" };
  if (embryo.status !== "in_bank_fresh" && embryo.status !== "in_bank_frozen") {
    return { error: "Embryo is not available for transfer" };
  }

  const canEdit = await canUserEditHorse(supabase, user.id, embryo.barn_id);
  if (!canEdit) return { error: "No permission" };

  const surrogateHorseId = String(formData.get("surrogate_horse_id") ?? "").trim();
  if (!surrogateHorseId) return { error: "Surrogate mare is required" };

  const transferDate = String(formData.get("transfer_date") ?? "").trim()
    || new Date().toISOString().slice(0, 10);
  const vetName = String(formData.get("transfer_veterinarian_name") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  // Calculate expected foaling date: transfer_date + 340 days
  const transferDateObj = new Date(transferDate);
  const expectedFoalDate = new Date(transferDateObj);
  expectedFoalDate.setDate(expectedFoalDate.getDate() + 340);
  const expectedFoalDateStr = expectedFoalDate.toISOString().slice(0, 10);

  // Create pregnancy
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pregnancy, error: pErr } = await (supabase as any)
    .from("pregnancies")
    .insert({
      barn_id: embryo.barn_id,
      embryo_id: embryoId,
      surrogate_horse_id: surrogateHorseId,
      donor_horse_id: embryo.donor_horse_id,
      stallion_horse_id: embryo.stallion_horse_id,
      transfer_date: transferDate,
      transfer_veterinarian_name: vetName,
      expected_foaling_date: expectedFoalDateStr,
      notes,
      created_by_user_id: user.id,
    })
    .select("id")
    .single();

  if (pErr) return { error: pErr.message };

  // Update embryo status
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("embryos")
    .update({ status: "transferred", updated_at: new Date().toISOString() })
    .eq("id", embryoId);

  // Update surrogate reproductive status
  await supabase
    .from("horses")
    .update({ reproductive_status: "bred" } as Record<string, unknown>)
    .eq("id", surrogateHorseId);

  revalidatePath(`/embryo-bank/${embryoId}`);
  revalidatePath("/embryo-bank");
  revalidatePath(`/horses/${surrogateHorseId}`);

  return { pregnancyId: pregnancy.id };
}

/**
 * Freeze an embryo (send to storage).
 */
export async function freezeEmbryoAction(
  embryoId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: embryo } = await (supabase as any)
    .from("embryos")
    .select("id, barn_id, status")
    .eq("id", embryoId)
    .single();

  if (!embryo) return { error: "Embryo not found" };
  if (embryo.status !== "in_bank_fresh") return { error: "Only fresh embryos can be frozen" };

  const canEdit = await canUserEditHorse(supabase, user.id, embryo.barn_id);
  if (!canEdit) return { error: "No permission" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("embryos")
    .update({
      status: "in_bank_frozen",
      storage_facility: String(formData.get("storage_facility") ?? "").trim() || null,
      storage_tank: String(formData.get("storage_tank") ?? "").trim() || null,
      storage_cane: String(formData.get("storage_cane") ?? "").trim() || null,
      storage_position: String(formData.get("storage_position") ?? "").trim() || null,
      freeze_date: String(formData.get("freeze_date") ?? "").trim() || new Date().toISOString().slice(0, 10),
      freeze_method: String(formData.get("freeze_method") ?? "vitrification"),
      updated_at: new Date().toISOString(),
    })
    .eq("id", embryoId);

  if (error) return { error: error.message };

  revalidatePath(`/embryo-bank/${embryoId}`);
  revalidatePath("/embryo-bank");
  return {};
}

/**
 * Ship out an embryo.
 */
export async function shipEmbryoAction(
  embryoId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: embryo } = await (supabase as any)
    .from("embryos")
    .select("id, barn_id, status")
    .eq("id", embryoId)
    .single();

  if (!embryo) return { error: "Embryo not found" };
  const canEdit = await canUserEditHorse(supabase, user.id, embryo.barn_id);
  if (!canEdit) return { error: "No permission" };

  const salePriceRaw = String(formData.get("sale_price") ?? "").trim();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("embryos")
    .update({
      status: "shipped_out",
      shipped_to: String(formData.get("shipped_to") ?? "").trim() || null,
      ship_date: String(formData.get("ship_date") ?? "").trim() || new Date().toISOString().slice(0, 10),
      sale_price: salePriceRaw ? parseFloat(salePriceRaw) : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", embryoId);

  if (error) return { error: error.message };

  revalidatePath(`/embryo-bank/${embryoId}`);
  revalidatePath("/embryo-bank");
  return {};
}

/**
 * Mark an embryo as lost.
 */
export async function markEmbryoLostAction(
  embryoId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: embryo } = await (supabase as any)
    .from("embryos")
    .select("id, barn_id, status")
    .eq("id", embryoId)
    .single();

  if (!embryo) return { error: "Embryo not found" };
  const canEdit = await canUserEditHorse(supabase, user.id, embryo.barn_id);
  if (!canEdit) return { error: "No permission" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("embryos")
    .update({
      status: "lost",
      loss_reason: String(formData.get("loss_reason") ?? "other"),
      loss_date: String(formData.get("loss_date") ?? "").trim() || new Date().toISOString().slice(0, 10),
      loss_notes: String(formData.get("loss_notes") ?? "").trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", embryoId);

  if (error) return { error: error.message };

  revalidatePath(`/embryo-bank/${embryoId}`);
  revalidatePath("/embryo-bank");
  return {};
}
