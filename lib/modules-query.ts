import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";
import { createAdminClient } from "@/lib/supabase-admin";

// ──────────────────────────────────────────────────────────────
// Module access model
// ──────────────────────────────────────────────────────────────
//
// A user has access to a premium module if ANY of these is true:
//   1. module_subscriptions row exists with status='active'
//   2. module_trials row exists with status='active' AND expires_at > now()
//   3. profiles.has_<module> is true (admin flag / legacy)
//
// `getModuleAccess` is called from the ModuleGate wrapper on every
// protected-route render for the module's layout. It has one important
// side effect: if a trial row is status='active' but expired, we flip it
// to 'expired' AND set profiles.has_<module>=false so the existing
// server-action gates (business-pro.ts, invoices.ts, etc.) close at the
// API layer. This is the "lazy expiration" path.

export type ModuleId = "breeders_pro" | "business_pro";
export type ModuleAccessType = "none" | "flag" | "trial" | "subscribed";

export interface ModuleAccess {
  module: ModuleId;
  hasAccess: boolean;
  accessType: ModuleAccessType;
  trial: {
    startedAt: string;
    expiresAt: string;
    daysLeft: number;
    expired: boolean;
    converted: boolean;
  } | null;
  subscription: {
    startedAt: string;
    priceCents: number;
  } | null;
  /** Populated only when requested (grey-out panel needs it). */
  dataCount?: ModuleDataCount;
}

export interface ModuleDataCount {
  // Breeders Pro
  flushes?: number;
  foalings?: number;
  // Business Pro
  invoices?: number;
  invoiceRevenueCents?: number;
  expenses?: number;
}

export const MODULE_LABEL: Record<ModuleId, string> = {
  breeders_pro: "Breeders Pro",
  business_pro: "Business Pro",
};

export const MODULE_PRICE_CENTS: Record<ModuleId, number> = {
  breeders_pro: 1500, // $15/mo
  business_pro: 3500, // $35/mo
};

export const MODULE_PRICE_LABEL: Record<ModuleId, string> = {
  breeders_pro: "$15/mo",
  business_pro: "$35/mo",
};

export const MODULE_PROFILE_FLAG: Record<ModuleId, "has_breeders_pro" | "has_business_pro"> = {
  breeders_pro: "has_breeders_pro",
  business_pro: "has_business_pro",
};

export const TRIAL_DURATION_DAYS = 30;

function daysBetween(fromIso: string, toMs: number): number {
  const from = new Date(fromIso).getTime();
  const ms = from - toMs;
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

/**
 * Main access check. Safe to call on every protected render.
 *
 * Parameters:
 *   - supabase: an authenticated server-component client (uses RLS).
 *   - userId: the current user's id.
 *   - module: which premium module to check.
 *   - withDataCount: compute the grey-out data-count numbers. Only the
 *     ModuleGate's expired-trial branch needs them — leave false otherwise.
 */
export async function getModuleAccess(
  supabase: SupabaseClient<Database>,
  userId: string,
  module: ModuleId,
  { withDataCount = false }: { withDataCount?: boolean } = {},
): Promise<ModuleAccess> {
  // Pull subscription + trial + profile flag in parallel.
  const profileFlag = MODULE_PROFILE_FLAG[module];
  const [subRes, trialRes, profileRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("module_subscriptions")
      .select("started_at, price_cents")
      .eq("user_id", userId)
      .eq("module", module)
      .eq("status", "active")
      .maybeSingle(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("module_trials")
      .select("id, started_at, expires_at, status, converted_at")
      .eq("user_id", userId)
      .eq("module", module)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select(profileFlag)
      .eq("id", userId)
      .maybeSingle(),
  ]);

  const sub = subRes.data as
    | { started_at: string; price_cents: number }
    | null
    | undefined;

  const trialRow = trialRes.data as
    | {
        id: string;
        started_at: string;
        expires_at: string;
        status: "active" | "expired" | "converted";
        converted_at: string | null;
      }
    | null
    | undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const flagValue = (profileRes.data as any)?.[profileFlag] === true;

  const nowMs = Date.now();

  // Compute trial state + lazy expiration side effect.
  let trial: ModuleAccess["trial"] = null;
  let trialCurrentlyActive = false;
  if (trialRow) {
    const expired = new Date(trialRow.expires_at).getTime() <= nowMs;
    const converted = trialRow.status === "converted";
    trialCurrentlyActive = trialRow.status === "active" && !expired;
    trial = {
      startedAt: trialRow.started_at,
      expiresAt: trialRow.expires_at,
      daysLeft: daysBetween(trialRow.expires_at, nowMs),
      expired: expired || trialRow.status === "expired",
      converted,
    };

    // Lazy expiration: status is still 'active' but the clock ran out.
    // Flip status and profile flag via the admin client. Don't fail the
    // render if this write errors — we still return the up-to-date
    // view to the caller.
    if (trialRow.status === "active" && expired) {
      try {
        const admin = createAdminClient();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (admin as any)
          .from("module_trials")
          .update({ status: "expired" })
          .eq("id", trialRow.id);
        // Only turn the flag off if no active subscription is keeping
        // access alive.
        if (!sub) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (admin as any)
            .from("profiles")
            .update({ [profileFlag]: false })
            .eq("id", userId);
        }
      } catch {
        /* non-fatal */
      }
    }
  }

  let accessType: ModuleAccessType = "none";
  if (sub) accessType = "subscribed";
  else if (trialCurrentlyActive) accessType = "trial";
  else if (flagValue) accessType = "flag";

  const hasAccess = accessType !== "none";

  const access: ModuleAccess = {
    module,
    hasAccess,
    accessType,
    trial,
    subscription: sub
      ? { startedAt: sub.started_at, priceCents: sub.price_cents }
      : null,
  };

  if (withDataCount) {
    access.dataCount = await countModuleData(supabase, userId, module);
  }

  return access;
}

/**
 * Count the user's module data across all barns they own. Used by
 * ModuleGreyOut's "what you built" messaging. Swallows errors rather
 * than failing the render — worst case we show zero counts.
 */
export async function countModuleData(
  supabase: SupabaseClient<Database>,
  userId: string,
  module: ModuleId,
): Promise<ModuleDataCount> {
  try {
    const { data: barns } = await supabase
      .from("barns")
      .select("id")
      .eq("owner_id", userId);
    const barnIds = (barns ?? []).map((b) => b.id as string);
    if (barnIds.length === 0) return {};

    if (module === "breeders_pro") {
      const [flushesRes, foalingsRes] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from("flushes")
          .select("id", { count: "exact", head: true })
          .in("barn_id", barnIds),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from("foalings")
          .select("id", { count: "exact", head: true })
          .in("barn_id", barnIds),
      ]);
      return {
        flushes: flushesRes.count ?? 0,
        foalings: foalingsRes.count ?? 0,
      };
    }

    // business_pro
    const [invoicesRes, expensesRes] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from("invoices")
        .select("subtotal")
        .in("barn_id", barnIds),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from("barn_expenses")
        .select("id", { count: "exact", head: true })
        .in("barn_id", barnIds),
    ]);
    const invoiceRows = (invoicesRes.data ?? []) as Array<{ subtotal: number | null }>;
    const invoiceRevenueCents = invoiceRows.reduce(
      (sum, r) => sum + (typeof r.subtotal === "number" ? Math.round(r.subtotal * 100) : 0),
      0,
    );
    return {
      invoices: invoiceRows.length,
      invoiceRevenueCents,
      expenses: expensesRes.count ?? 0,
    };
  } catch {
    return {};
  }
}
