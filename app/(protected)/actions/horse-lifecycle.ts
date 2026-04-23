"use server";

/**
 * Breeders Pro — Horse lifecycle server actions.
 *
 * These wrap the SECURITY DEFINER RPCs installed by
 * `20260411000000_breeders_pro_lifecycle_and_locations.sql`:
 *
 *   - move_horse_to_location
 *   - record_horse_disposition
 *   - unarchive_horse
 *
 * Plus:
 *
 *   - recordPregnancyLossAction — a dedicated pregnancy-loss path,
 *     distinct from the existing logPregnancyCheckAction (which only
 *     reaches loss territory as a side-effect of a "not_pregnant"
 *     check result). Clicking "Record Pregnancy Loss" from the
 *     surrogate profile goes here.
 *
 * All actions are role-agnostic — they operate on any horse, which is
 * deliberate so the same lifecycle component can work for donors and
 * stallions later when live-cover ships.
 */

import { canUserEditHorse } from "@/lib/horse-access";
import { createServerComponentClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

// ============================================================
// move_horse_to_location
// ============================================================

/**
 * Move a horse to a new location. Accepts either an existing facility
 * via `location_mode=existing&location_id=…` or a new facility via
 * `location_mode=new&facility_name=…&address_line_1=…` etc.
 *
 * Calls the atomic RPC which closes out the previous assignment and
 * inserts a new one in one transaction.
 */
export async function moveHorseToLocationAction(
  horseId: string,
  formData: FormData,
): Promise<{
  assignmentId?: string;
  locationId?: string;
  createdLocation?: boolean;
  error?: string;
}> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: horse } = await (supabase as any)
    .from("horses")
    .select("id, barn_id")
    .eq("id", horseId)
    .single();
  if (!horse) return { error: "Horse not found" };

  const canEdit = await canUserEditHorse(supabase, user.id, horse.barn_id);
  if (!canEdit) return { error: "No permission" };

  // ---------- Location input (existing OR new) ----------
  const mode = String(formData.get("location_mode") ?? "existing");
  let locationInput: Record<string, unknown> | null = null;

  if (mode === "existing") {
    const id = String(formData.get("location_id") ?? "").trim();
    if (!id) return { error: "Select a facility or add a new one" };
    locationInput = { id };
  } else {
    const facilityName = String(
      formData.get("facility_name") ?? "",
    ).trim();
    if (!facilityName) return { error: "Facility name is required" };
    locationInput = {
      facility_name: facilityName,
      address_line_1:
        String(formData.get("address_line_1") ?? "").trim() || null,
      address_line_2:
        String(formData.get("address_line_2") ?? "").trim() || null,
      city: String(formData.get("city") ?? "").trim() || null,
      state_province:
        String(formData.get("state_province") ?? "").trim() || null,
      postal_code:
        String(formData.get("postal_code") ?? "").trim() || null,
      country: String(formData.get("country") ?? "").trim() || null,
      notes: String(formData.get("facility_notes") ?? "").trim() || null,
    };
  }

  // ---------- Assignment fields ----------
  const startedAt =
    String(formData.get("started_at") ?? "").trim() ||
    new Date().toISOString().slice(0, 10);
  const assignmentNote =
    String(formData.get("assignment_note") ?? "").trim() || null;

  // ---------- Call the transactional RPC ----------
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc(
    "move_horse_to_location",
    {
      p_horse_id: horseId,
      p_location_input: locationInput,
      p_assignment_note: assignmentNote,
      p_started_at: startedAt,
      p_created_by: user.id,
    },
  );

  if (error) return { error: error.message };
  if (!data) return { error: "Unknown error" };

  // Refresh profile + list pages so the new location shows up
  revalidatePath(`/breeders-pro/surrogates/${horseId}`);
  revalidatePath(`/breeders-pro/donors/${horseId}`);
  revalidatePath(`/breeders-pro/stallions/${horseId}`);
  revalidatePath("/breeders-pro/surrogates");
  revalidatePath("/breeders-pro/donors");
  revalidatePath("/breeders-pro/stallions");

  return {
    assignmentId: data.assignment_id,
    locationId: data.location_id,
    createdLocation: !!data.created_location,
  };
}

// ============================================================
// record_horse_disposition
// ============================================================

/**
 * Mark a horse as sold / died / retired from the program. One action
 * for all three — the `disposition` form field selects which.
 *
 * Closes out any active location assignment and archives the horse
 * in one transaction via the RPC.
 */
export async function recordHorseDispositionAction(
  horseId: string,
  formData: FormData,
): Promise<{ horseId?: string; disposition?: string; error?: string }> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: horse } = await (supabase as any)
    .from("horses")
    .select("id, barn_id")
    .eq("id", horseId)
    .single();
  if (!horse) return { error: "Horse not found" };

  const canEdit = await canUserEditHorse(supabase, user.id, horse.barn_id);
  if (!canEdit) return { error: "No permission" };

  const disposition = String(formData.get("disposition") ?? "").trim();
  if (!["sold", "died", "retired"].includes(disposition)) {
    return { error: "Disposition must be sold, died, or retired" };
  }

  const dispositionDate =
    String(formData.get("disposition_date") ?? "").trim() ||
    new Date().toISOString().slice(0, 10);
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const soldTo =
    disposition === "sold"
      ? String(formData.get("sold_to") ?? "").trim() || null
      : null;
  const salePriceRaw = String(formData.get("sale_price") ?? "").trim();
  const salePrice =
    disposition === "sold" && salePriceRaw.length > 0
      ? Number(salePriceRaw)
      : null;
  if (salePrice != null && Number.isNaN(salePrice)) {
    return { error: "Sale price must be a number" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc(
    "record_horse_disposition",
    {
      p_horse_id: horseId,
      p_disposition: disposition,
      p_disposition_date: dispositionDate,
      p_notes: notes,
      p_sold_to: soldTo,
      p_sale_price: salePrice,
      p_created_by: user.id,
    },
  );

  if (error) return { error: error.message };
  if (!data) return { error: "Unknown error" };

  revalidatePath(`/breeders-pro/surrogates/${horseId}`);
  revalidatePath(`/breeders-pro/donors/${horseId}`);
  revalidatePath(`/breeders-pro/stallions/${horseId}`);
  revalidatePath("/breeders-pro/surrogates");
  revalidatePath("/breeders-pro/donors");
  revalidatePath("/breeders-pro/stallions");

  return {
    horseId: data.horse_id,
    disposition: data.disposition,
  };
}

// ============================================================
// unarchive_horse
// ============================================================

/**
 * Reverse a disposition. Clears the disposition fields and un-archives
 * the horse. Does NOT restore the prior location — the user must run
 * moveHorseToLocationAction separately to place her somewhere.
 */
export async function unarchiveHorseAction(
  horseId: string,
): Promise<{ error?: string }> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: horse } = await (supabase as any)
    .from("horses")
    .select("id, barn_id")
    .eq("id", horseId)
    .single();
  if (!horse) return { error: "Horse not found" };

  const canEdit = await canUserEditHorse(supabase, user.id, horse.barn_id);
  if (!canEdit) return { error: "No permission" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc("unarchive_horse", {
    p_horse_id: horseId,
  });

  if (error) return { error: error.message };

  revalidatePath(`/breeders-pro/surrogates/${horseId}`);
  revalidatePath(`/breeders-pro/donors/${horseId}`);
  revalidatePath(`/breeders-pro/stallions/${horseId}`);
  revalidatePath("/breeders-pro/surrogates");
  revalidatePath("/breeders-pro/donors");
  revalidatePath("/breeders-pro/stallions");

  return {};
}

// ============================================================
// recordPregnancyLossAction
// ============================================================

/**
 * Record that a pregnancy was lost. Separate from the existing
 * pregnancy-check flow because "we just lost the foal at day 200" is
 * its own event, not a negative result on a scheduled check.
 *
 * Updates pregnancy.status (to lost_early or lost_late based on loss
 * type or gestation day), cascades the embryo to lost, sets the
 * surrogate back to open.
 *
 * Form fields:
 *   loss_type       — "early" | "late" | "aborted"
 *   loss_date       — ISO date (defaults to today)
 *   notes           — optional
 */
export async function recordPregnancyLossAction(
  pregnancyId: string,
  formData: FormData,
): Promise<{ pregnancyId?: string; error?: string }> {
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

  const lossType = String(formData.get("loss_type") ?? "early");
  const statusMap: Record<string, string> = {
    early: "lost_early",
    late: "lost_late",
    aborted: "aborted",
  };
  const newStatus = statusMap[lossType];
  if (!newStatus) return { error: "Invalid loss type" };

  const lossDate =
    String(formData.get("loss_date") ?? "").trim() ||
    new Date().toISOString().slice(0, 10);
  const notes = String(formData.get("notes") ?? "").trim() || null;

  // Update pregnancy. Note: pregnancies has `notes` and `loss_reason`,
  // not `loss_notes` (that column is on embryos). Freeform loss note
  // goes into pregnancies.notes.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: pregErr } = await (supabase as any)
    .from("pregnancies")
    .update({
      status: newStatus,
      loss_date: lossDate,
      notes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", pregnancyId);
  if (pregErr) return { error: pregErr.message };

  // Cascade: embryo → lost
  if (pregnancy.embryo_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("embryos")
      .update({
        status: "lost",
        loss_reason:
          lossType === "early"
            ? "early_pregnancy_loss"
            : lossType === "late"
              ? "late_pregnancy_loss"
              : "aborted",
        loss_date: lossDate,
        updated_at: new Date().toISOString(),
      })
      .eq("id", pregnancy.embryo_id);
  }

  // Cascade: surrogate → open
  if (pregnancy.surrogate_horse_id) {
    await supabase
      .from("horses")
      .update({ reproductive_status: "open" } as Record<string, unknown>)
      .eq("id", pregnancy.surrogate_horse_id);
  }

  revalidatePath(`/breeders-pro/pregnancy/${pregnancyId}`);
  revalidatePath(`/breeders-pro/surrogates/${pregnancy.surrogate_horse_id}`);
  revalidatePath(`/breeders-pro/donors/${pregnancy.donor_horse_id}`);
  revalidatePath("/breeders-pro/pregnancies");
  revalidatePath("/breeders-pro");

  return { pregnancyId };
}
