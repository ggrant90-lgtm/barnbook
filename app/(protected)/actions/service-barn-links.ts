"use server";

import { revalidatePath } from "next/cache";
import { createServerComponentClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

/**
 * service_barn_links — connect a Service Barn to horses at OTHER barns
 * the user holds a Stall Key for. References only; no data duplication.
 *
 * Access model is enforced both by app-layer checks here and by the
 * RLS policies in migration 20260419000008: the user must own the
 * target Service Barn AND have access to the source horse (via barn
 * ownership or an active user_horse_access row).
 */

export interface LinkResult {
  ok?: true;
  linkId?: string;
  error?: string;
}

export async function linkHorseToServiceBarnAction(input: {
  serviceBarnId: string;
  horseId: string;
  notes?: string | null;
}): Promise<LinkResult> {
  if (!input.serviceBarnId || !input.horseId) {
    return { error: "Missing Service Barn or horse" };
  }

  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Verify Service Barn ownership + type.
  const { data: barn } = await supabase
    .from("barns")
    .select("id, owner_id, barn_type")
    .eq("id", input.serviceBarnId)
    .maybeSingle();
  if (!barn) return { error: "Service Barn not found" };
  if (barn.owner_id !== user.id || barn.barn_type !== "service") {
    return { error: "Only the Service Barn owner can link horses" };
  }

  // Verify horse access — the provider must either own the horse's
  // barn OR hold a Stall Key for it.
  const [{ data: horseRow }, { data: access }] = await Promise.all([
    supabase
      .from("horses")
      .select("id, barn_id")
      .eq("id", input.horseId)
      .maybeSingle(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("user_horse_access")
      .select("id")
      .eq("user_id", user.id)
      .eq("horse_id", input.horseId)
      .maybeSingle(),
  ]);
  if (!horseRow) return { error: "Horse not found" };

  let hasAccess = !!access;
  if (!hasAccess) {
    // Maybe the user owns the horse's barn directly.
    const { data: horseBarn } = await supabase
      .from("barns")
      .select("owner_id")
      .eq("id", horseRow.barn_id)
      .maybeSingle();
    if (horseBarn?.owner_id === user.id) hasAccess = true;
  }
  if (!hasAccess) {
    return {
      error: "You don't have access to this horse, so you can't link it",
    };
  }

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from("service_barn_links")
    .insert({
      service_barn_id: input.serviceBarnId,
      horse_id: input.horseId,
      linked_by_user_id: user.id,
      notes: input.notes?.trim() || null,
    })
    .select("id")
    .single();
  if (error || !data) {
    // Unique-constraint violation = already linked; treat as success.
    if (error?.code === "23505") {
      return { ok: true };
    }
    return { error: error?.message ?? "Couldn't link horse" };
  }

  revalidatePath(`/barn/${input.serviceBarnId}/service`);
  return { ok: true, linkId: data.id as string };
}

export async function unlinkHorseFromServiceBarnAction(
  linkId: string,
): Promise<{ ok?: true; error?: string }> {
  if (!linkId) return { error: "Missing link id" };

  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: link } = await (supabase as any)
    .from("service_barn_links")
    .select("id, service_barn_id")
    .eq("id", linkId)
    .maybeSingle();
  if (!link) return { error: "Link not found" };

  const { data: barn } = await supabase
    .from("barns")
    .select("owner_id")
    .eq("id", link.service_barn_id)
    .maybeSingle();
  if (!barn || barn.owner_id !== user.id) {
    return { error: "Only the Service Barn owner can unlink horses" };
  }

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from("service_barn_links")
    .delete()
    .eq("id", linkId);
  if (error) return { error: error.message };

  revalidatePath(`/barn/${link.service_barn_id}/service`);
  return { ok: true };
}
