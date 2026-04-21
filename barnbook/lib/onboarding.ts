"use server";

import { revalidatePath } from "next/cache";
import { createServerComponentClient } from "@/lib/supabase-server";
import type { WizardId } from "@/lib/onboarding-query";
import type { InvoiceServicePreset } from "@/lib/types";

// ──────────────────────────────────────────────────────────────
// Wizard completion / dismissal / resumption
// ──────────────────────────────────────────────────────────────

export interface MarkWizardResult {
  ok?: true;
  error?: string;
}

const COMPLETION_COLUMN: Record<WizardId, string> = {
  core: "onboarding_core_completed",
  business_pro: "onboarding_business_pro_completed",
  breeders_pro: "onboarding_breeders_pro_completed",
};

/**
 * Mark the given wizard as completed for the current user.
 * Idempotent: re-calls just set the flag to true again.
 */
export async function markWizardCompleteAction(
  wizard: WizardId,
): Promise<MarkWizardResult> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const column = COMPLETION_COLUMN[wizard];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("profiles")
    .update({ [column]: true })
    .eq("id", user.id);
  if (error) return { error: error.message };

  // Revalidate the entry points that read these flags.
  revalidatePath("/dashboard");
  if (wizard === "business_pro") revalidatePath("/business-pro");
  if (wizard === "breeders_pro") revalidatePath("/breeders-pro");

  return { ok: true };
}

/**
 * Permanently dismiss the Core wizard. Sets
 * profiles.onboarding_core_dismissed_at. Won't auto-open again until
 * that column is cleared (via DB edit or a future "restart onboarding"
 * button).
 */
export async function dismissCoreOnboardingAction(): Promise<MarkWizardResult> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("profiles")
    .update({ onboarding_core_dismissed_at: new Date().toISOString() })
    .eq("id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Save the Core wizard's current step so resumption works if the user
 * closes the modal mid-way. Fire-and-forget from the client.
 */
export async function saveCoreStepAction(
  step: number,
): Promise<MarkWizardResult> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const clamped = Math.max(1, Math.min(5, Math.floor(step)));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("profiles")
    .update({ onboarding_core_step: clamped })
    .eq("id", user.id);
  if (error) return { error: error.message };

  return { ok: true };
}

// ──────────────────────────────────────────────────────────────
// Core wizard writes
// ──────────────────────────────────────────────────────────────

/**
 * Narrow rename so the Core wizard's step 1 doesn't go through
 * updateBarnProfileAction (which null-outs every other profile field
 * when it receives a partial FormData). Just the name, nothing else.
 */
export async function renameBarnAction(
  barnId: string,
  name: string,
): Promise<MarkWizardResult> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Barn name is required" };
  if (!barnId) return { error: "Barn is required" };

  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: barn } = await supabase
    .from("barns")
    .select("id, owner_id")
    .eq("id", barnId)
    .maybeSingle();
  if (!barn) return { error: "Barn not found" };
  if (barn.owner_id !== user.id) {
    return { error: "Only the barn owner can rename this barn" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("barns")
    .update({ name: trimmed, updated_at: new Date().toISOString() })
    .eq("id", barnId);
  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  revalidatePath(`/barn/${barnId}`);
  return { ok: true };
}

// ──────────────────────────────────────────────────────────────
// Business Pro wizard writes
// ──────────────────────────────────────────────────────────────

export interface UpdateBarnBusinessSettingsInput {
  barnId: string;
  company_name?: string | null;
  company_phone?: string | null;
  company_email?: string | null;
}

/**
 * Narrow server action for the Business Pro wizard step 1. Writes the
 * invoice-branding fields without going through the bigger barn-profile
 * update flow. Barn owner required.
 */
export async function updateBarnBusinessSettingsAction(
  input: UpdateBarnBusinessSettingsInput,
): Promise<MarkWizardResult> {
  if (!input.barnId) return { error: "Barn is required" };

  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: barn } = await supabase
    .from("barns")
    .select("id, owner_id")
    .eq("id", input.barnId)
    .maybeSingle();
  if (!barn) return { error: "Barn not found" };
  if (barn.owner_id !== user.id) {
    return { error: "Only the barn owner can change business settings" };
  }

  const patch = {
    company_name: input.company_name?.trim() || null,
    company_phone: input.company_phone?.trim() || null,
    company_email: input.company_email?.trim() || null,
    updated_at: new Date().toISOString(),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("barns")
    .update(patch)
    .eq("id", input.barnId);
  if (error) return { error: error.message };

  revalidatePath("/business-pro");
  revalidatePath(`/barn/${input.barnId}/edit`);
  return { ok: true };
}

export interface SaveServicePresetsResult {
  ok?: true;
  error?: string;
}

/**
 * Replace the barn's invoice_service_presets JSON with the given list.
 * Idempotent: always overwrites. Barn owner required.
 */
export async function saveServicePresetsAction(
  barnId: string,
  presets: InvoiceServicePreset[],
): Promise<SaveServicePresetsResult> {
  if (!barnId) return { error: "Barn is required" };

  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: barn } = await supabase
    .from("barns")
    .select("id, owner_id")
    .eq("id", barnId)
    .maybeSingle();
  if (!barn) return { error: "Barn not found" };
  if (barn.owner_id !== user.id) {
    return { error: "Only the barn owner can save services" };
  }

  // Normalize: drop empty labels, clamp prices, trim strings.
  const clean: InvoiceServicePreset[] = (presets ?? [])
    .map((p) => ({
      label: (p.label ?? "").trim(),
      priceCents: Math.max(0, Math.round(Number(p.priceCents) || 0)),
    }))
    .filter((p) => p.label.length > 0)
    .slice(0, 50);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("barns")
    .update({
      invoice_service_presets: clean,
      updated_at: new Date().toISOString(),
    })
    .eq("id", barnId);
  if (error) return { error: error.message };

  revalidatePath("/business-pro");
  return { ok: true };
}
