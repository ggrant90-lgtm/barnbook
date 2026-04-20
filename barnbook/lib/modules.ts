"use server";

import { revalidatePath } from "next/cache";
import { createServerComponentClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  MODULE_PRICE_CENTS,
  MODULE_PROFILE_FLAG,
  TRIAL_DURATION_DAYS,
  type ModuleId,
} from "@/lib/modules-query";

export interface StartTrialResult {
  ok?: true;
  alreadyActive?: boolean;
  expiresAt?: string;
  error?: string;
}

/**
 * Start a 30-day free trial of the given module. Idempotent against the
 * unique (user_id, module) constraint — if a row already exists we
 * return its state without creating a duplicate.
 *
 * Flips profiles.has_<module>=true so the existing server-action gates
 * (business-pro.ts, invoices.ts, etc.) and page-level flag reads all
 * work through the trial period without code changes.
 */
export async function startTrialAction(
  module: ModuleId,
): Promise<StartTrialResult> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();

  // Check for an existing row first so we can return a friendly state
  // instead of relying on the INSERT ... ON CONFLICT path which would
  // eat useful info (like "you already had one and it expired").
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (admin as any)
    .from("module_trials")
    .select("id, status, expires_at")
    .eq("user_id", user.id)
    .eq("module", module)
    .maybeSingle();

  if (existing) {
    if (existing.status === "active") {
      return {
        ok: true,
        alreadyActive: true,
        expiresAt: existing.expires_at as string,
      };
    }
    // Expired or converted — do NOT re-grant. User must subscribe.
    return {
      error:
        existing.status === "converted"
          ? "You already have this module."
          : "Your free trial for this module has already ended.",
    };
  }

  const expiresAt = new Date(
    Date.now() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insErr } = await (admin as any).from("module_trials").insert({
    user_id: user.id,
    module,
    expires_at: expiresAt,
    status: "active",
  });
  if (insErr) return { error: insErr.message };

  // Dual-write the profile flag so existing checks work.
  const flag = MODULE_PROFILE_FLAG[module];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any)
    .from("profiles")
    .update({ [flag]: true })
    .eq("id", user.id);

  revalidatePath(module === "breeders_pro" ? "/breeders-pro" : "/business-pro");
  revalidatePath("/dashboard");

  return { ok: true, expiresAt };
}

export interface SubscribeResult {
  ok?: true;
  error?: string;
}

/**
 * Convert a trial to a subscription (or start a subscription without
 * a prior trial). Idempotent against the unique (user_id, module)
 * constraint on module_subscriptions.
 *
 * Writes: module_subscriptions row + sets module_trials.status='converted'
 * (if present) + flips profile flag to true.
 *
 * No payment — this is a database record only until we ship Stripe.
 */
export async function subscribeToModuleAction(
  module: ModuleId,
): Promise<SubscribeResult> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();
  const priceCents = MODULE_PRICE_CENTS[module];

  // Upsert the subscription row (ignore conflict — if they already have
  // one we still want the side effects below to run).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: subErr } = await (admin as any)
    .from("module_subscriptions")
    .upsert(
      {
        user_id: user.id,
        module,
        price_cents: priceCents,
        status: "active",
      },
      { onConflict: "user_id,module", ignoreDuplicates: false },
    );
  if (subErr) return { error: subErr.message };

  // Mark any existing trial as converted (no-op if none).
  const nowIso = new Date().toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any)
    .from("module_trials")
    .update({ status: "converted", converted_at: nowIso })
    .eq("user_id", user.id)
    .eq("module", module);

  // Flip profile flag for back-compat.
  const flag = MODULE_PROFILE_FLAG[module];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any)
    .from("profiles")
    .update({ [flag]: true })
    .eq("id", user.id);

  revalidatePath(module === "breeders_pro" ? "/breeders-pro" : "/business-pro");
  revalidatePath("/dashboard");

  return { ok: true };
}

export interface RequestExportResult {
  ok?: true;
  error?: string;
}

/**
 * File a data-export request. Writes to data_export_requests; admin is
 * expected to follow up out-of-band (no CSV generator yet).
 */
export async function requestDataExportAction(
  module: ModuleId,
): Promise<RequestExportResult> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("data_export_requests")
    .insert({
      user_id: user.id,
      module,
    });
  if (error) return { error: error.message };

  return { ok: true };
}
