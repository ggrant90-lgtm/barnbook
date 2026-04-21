"use server";

import { revalidatePath } from "next/cache";
import { createServerComponentClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { ensureClientForOwnerName } from "@/lib/clients-sync";

/**
 * Quick record = a minimal horse row inside a Service Barn. The
 * provider's own non-BarnBook horse list lives here.
 *
 * App-layer auth: caller must own the target Service Barn. The write
 * uses the admin client to dodge the known auth.uid()-in-server-action
 * RLS flakiness (same pattern as createHorseAction in actions/horse.ts).
 */

function generateQrCode(): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 10);
  return `BB-${ts}-${rand}`;
}

export interface CreateQuickRecordInput {
  serviceBarnId: string;
  name: string;
  ownerName?: string | null;
  ownerPhone?: string | null;
  ownerEmail?: string | null;
  locationName?: string | null;
  color?: string | null;
  notes?: string | null;
}

export interface CreateQuickRecordResult {
  ok?: true;
  horseId?: string;
  error?: string;
}

export async function createQuickRecordAction(
  input: CreateQuickRecordInput,
): Promise<CreateQuickRecordResult> {
  if (!input.serviceBarnId) return { error: "Missing Service Barn" };
  const name = input.name.trim();
  if (!name) return { error: "Horse name is required" };

  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: barn } = await (supabase as any)
    .from("barns")
    .select("id, owner_id, barn_type")
    .eq("id", input.serviceBarnId)
    .maybeSingle();
  if (!barn) return { error: "Barn not found" };
  if (barn.owner_id !== user.id) {
    return { error: "Only the Service Barn owner can add quick records" };
  }
  if (barn.barn_type !== "service") {
    return { error: "Quick records only belong in Service Barns" };
  }

  const ownerName = input.ownerName?.trim() || null;

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: horse, error } = await (admin as any)
    .from("horses")
    .insert({
      barn_id: input.serviceBarnId,
      created_by: user.id,
      name,
      is_quick_record: true,
      owner_contact_name: ownerName,
      owner_contact_phone: input.ownerPhone?.trim() || null,
      owner_contact_email: input.ownerEmail?.trim() || null,
      location_name: input.locationName?.trim() || null,
      color: input.color?.trim() || null,
      // owner_name mirrors owner_contact_name so Business Pro's
      // owner-based reporting (ensureClientForOwnerName) picks up the
      // contact automatically.
      owner_name: ownerName,
      // Notes for the horse go into special_care_notes since quick
      // records don't have a dedicated notes column and the UI for
      // quick records treats special_care_notes as the "notes" field.
      special_care_notes: input.notes?.trim() || null,
      qr_code: generateQrCode(),
    })
    .select("id")
    .single();

  if (error || !horse) {
    return { error: error?.message ?? "Couldn't create quick record" };
  }

  // Auto-sync owner → Business Pro Clients if the provider has BP.
  await ensureClientForOwnerName(admin, input.serviceBarnId, ownerName);

  revalidatePath(`/barn/${input.serviceBarnId}/service`);
  revalidatePath("/dashboard");
  return { ok: true, horseId: horse.id as string };
}

export interface UpdateQuickRecordInput {
  horseId: string;
  name?: string;
  ownerName?: string | null;
  ownerPhone?: string | null;
  ownerEmail?: string | null;
  locationName?: string | null;
  color?: string | null;
  notes?: string | null;
}

export async function updateQuickRecordAction(
  input: UpdateQuickRecordInput,
): Promise<{ ok?: true; error?: string }> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: horse } = await (supabase as any)
    .from("horses")
    .select("id, barn_id, is_quick_record")
    .eq("id", input.horseId)
    .maybeSingle();
  if (!horse) return { error: "Quick record not found" };
  if (!horse.is_quick_record) {
    return { error: "This horse isn't a quick record" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: barn } = await (supabase as any)
    .from("barns")
    .select("owner_id")
    .eq("id", horse.barn_id)
    .maybeSingle();
  if (!barn || barn.owner_id !== user.id) {
    return { error: "Only the Service Barn owner can edit this record" };
  }

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patch: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };
  if (input.name !== undefined) {
    const n = input.name.trim();
    if (!n) return { error: "Horse name is required" };
    patch.name = n;
  }
  if (input.ownerName !== undefined) {
    const v = input.ownerName?.trim() || null;
    patch.owner_contact_name = v;
    patch.owner_name = v; // keep in sync for BP reporting
  }
  if (input.ownerPhone !== undefined)
    patch.owner_contact_phone = input.ownerPhone?.trim() || null;
  if (input.ownerEmail !== undefined)
    patch.owner_contact_email = input.ownerEmail?.trim() || null;
  if (input.locationName !== undefined)
    patch.location_name = input.locationName?.trim() || null;
  if (input.color !== undefined)
    patch.color = input.color?.trim() || null;
  if (input.notes !== undefined)
    patch.special_care_notes = input.notes?.trim() || null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from("horses")
    .update(patch)
    .eq("id", input.horseId);
  if (error) return { error: error.message };

  revalidatePath(`/horses/${input.horseId}`);
  revalidatePath(`/barn/${horse.barn_id}/service`);
  return { ok: true };
}
