"use server";

import { canUserEditHorse } from "@/lib/horse-access";
import { createServerComponentClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

/**
 * Log a pregnancy check (14d, 30d, 45d, 60d, 90d).
 * If result is "not_pregnant", cascades: pregnancy→lost, embryo→lost, surrogate→open.
 */
export async function logPregnancyCheckAction(
  pregnancyId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pregnancy } = await (supabase as any)
    .from("pregnancies")
    .select("*")
    .eq("id", pregnancyId)
    .single();

  if (!pregnancy) return { error: "Pregnancy not found" };

  const canEdit = await canUserEditHorse(supabase, user.id, pregnancy.barn_id);
  if (!canEdit) return { error: "No permission" };

  const checkField = String(formData.get("check_field") ?? "");
  const checkResult = String(formData.get("check_result") ?? "confirmed");
  const checkDate = String(formData.get("check_date") ?? "").trim()
    || new Date().toISOString().slice(0, 10);

  const validFields = ["check_14_day", "check_30_day", "check_45_day", "check_60_day", "check_90_day"];
  if (!validFields.includes(checkField)) return { error: "Invalid check field" };

  // Update the check field
  const update: Record<string, unknown> = {
    [checkField]: checkResult,
    [`${checkField}_date`]: checkDate,
    updated_at: new Date().toISOString(),
  };

  // If not pregnant, cascade status changes
  if (checkResult === "not_pregnant") {
    update.status = "lost_early";

    // Update embryo to lost
    if (pregnancy.embryo_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("embryos")
        .update({
          status: "lost",
          loss_reason: "early_pregnancy_loss",
          loss_date: checkDate,
          updated_at: new Date().toISOString(),
        })
        .eq("id", pregnancy.embryo_id);
    }

    // Update surrogate to open
    if (pregnancy.surrogate_horse_id) {
      await supabase
        .from("horses")
        .update({ reproductive_status: "open" } as Record<string, unknown>)
        .eq("id", pregnancy.surrogate_horse_id);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("pregnancies")
    .update(update)
    .eq("id", pregnancyId);

  if (error) return { error: error.message };

  revalidatePath(`/embryo-bank/pregnancy/${pregnancyId}`);
  revalidatePath("/embryo-bank");
  return {};
}

/**
 * Record a foaling event.
 */
export async function recordFoalingAction(
  pregnancyId: string,
  formData: FormData,
): Promise<{ foalingId?: string; error?: string }> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pregnancy } = await (supabase as any)
    .from("pregnancies")
    .select("*")
    .eq("id", pregnancyId)
    .single();

  if (!pregnancy) return { error: "Pregnancy not found" };

  const canEdit = await canUserEditHorse(supabase, user.id, pregnancy.barn_id);
  if (!canEdit) return { error: "No permission" };

  const foalingDate = String(formData.get("foal_date") ?? "").trim()
    || new Date().toISOString().slice(0, 10);
  const foalSex = String(formData.get("foal_sex") ?? "").trim() || null;
  const foalColor = String(formData.get("foal_color") ?? "").trim() || null;
  const foalName = String(formData.get("foal_name") ?? "").trim() || null;
  const foalingType = String(formData.get("foaling_type") ?? "normal");
  const vetName = String(formData.get("veterinarian_name") ?? "").trim() || null;
  const complications = String(formData.get("complications") ?? "").trim() || null;
  const createHorseProfile = formData.get("create_horse_profile") === "true";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("record_foaling", {
    p_barn_id: pregnancy.barn_id,
    p_pregnancy_id: pregnancyId,
    p_foaling_date: foalingDate,
    p_foaling_time: null,
    p_foaling_type: foalingType,
    p_foal_sex: foalSex,
    p_foal_color: foalColor,
    p_foal_markings: null,
    p_birth_weight_lbs: null,
    p_placenta_passed: null,
    p_iga_result: null,
    p_foal_alive_24hr: true,
    p_complications: complications,
    p_attending_vet: vetName,
    p_notes: null,
    p_created_by: user.id,
    p_create_horse: createHorseProfile,
    p_foal_name: foalName,
  });

  if (error) return { error: error.message };
  if (!data?.ok) return { error: data?.error ?? "Unknown error" };

  revalidatePath(`/embryo-bank/pregnancy/${pregnancyId}`);
  revalidatePath("/embryo-bank");
  if (pregnancy.surrogate_horse_id) {
    revalidatePath(`/horses/${pregnancy.surrogate_horse_id}`);
  }

  return { foalingId: data.foaling_id };
}

/**
 * Confirm 30-day survival for a foaling.
 */
export async function confirmSurvivalAction(
  foalingId: string,
): Promise<{ error?: string }> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: foaling } = await (supabase as any)
    .from("foalings")
    .select("*, pregnancies!inner(barn_id, donor_horse_id)")
    .eq("id", foalingId)
    .single();

  if (!foaling) return { error: "Foaling not found" };

  const barnId = foaling.pregnancies?.barn_id;
  if (!barnId) return { error: "Barn not found" };

  const canEdit = await canUserEditHorse(supabase, user.id, barnId);
  if (!canEdit) return { error: "No permission" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("foalings")
    .update({
      foal_alive_at_30d: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", foalingId);

  if (error) return { error: error.message };

  // Increment donor lifetime_live_foal_count
  const donorId = foaling.pregnancies?.donor_horse_id;
  if (donorId) {
    const { data: donor } = await supabase
      .from("horses")
      .select("lifetime_live_foal_count")
      .eq("id", donorId)
      .single();
    if (donor) {
      const currentCount = ((donor as Record<string, unknown>).lifetime_live_foal_count as number) ?? 0;
      await supabase
        .from("horses")
        .update({ lifetime_live_foal_count: currentCount + 1 } as Record<string, unknown>)
        .eq("id", donorId);
    }
  }

  revalidatePath(`/embryo-bank/pregnancy/${foaling.pregnancy_id}`);
  revalidatePath("/embryo-bank");
  return {};
}
