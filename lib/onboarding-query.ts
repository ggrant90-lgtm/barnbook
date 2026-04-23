import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";

// ──────────────────────────────────────────────────────────────
// Onboarding wizard state helpers (pure / server-component safe).
// ──────────────────────────────────────────────────────────────
//
// Three wizards each track their own "done" flag on profiles:
//   - onboarding_core_completed
//   - onboarding_business_pro_completed
//   - onboarding_breeders_pro_completed
//
// The Core wizard also has:
//   - onboarding_core_dismissed_at (non-null = "don't auto-open again")
//   - onboarding_core_step (resume from this step if reopened)

export type WizardId = "core" | "business_pro" | "breeders_pro";

export interface OnboardingState {
  core: {
    completed: boolean;
    dismissedAt: string | null;
    currentStep: number;
  };
  businessPro: { completed: boolean };
  breedersPro: { completed: boolean };
}

const DEFAULT_STATE: OnboardingState = {
  core: { completed: false, dismissedAt: null, currentStep: 1 },
  businessPro: { completed: false },
  breedersPro: { completed: false },
};

/**
 * Fetch the three onboarding flags for a user. Safe to call on every
 * dashboard/module page render — it's one profile row.
 */
export async function getOnboardingState(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<OnboardingState> {
  const { data } = await supabase
    .from("profiles")
    .select(
      "onboarding_core_completed, onboarding_business_pro_completed, onboarding_breeders_pro_completed, onboarding_core_dismissed_at, onboarding_core_step",
    )
    .eq("id", userId)
    .maybeSingle();

  if (!data) return DEFAULT_STATE;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = data as any;
  return {
    core: {
      completed: !!row.onboarding_core_completed,
      dismissedAt: (row.onboarding_core_dismissed_at as string | null) ?? null,
      currentStep:
        typeof row.onboarding_core_step === "number" && row.onboarding_core_step > 0
          ? row.onboarding_core_step
          : 1,
    },
    businessPro: { completed: !!row.onboarding_business_pro_completed },
    breedersPro: { completed: !!row.onboarding_breeders_pro_completed },
  };
}

/**
 * Should we auto-open the Core wizard on this dashboard load?
 *
 * Three gates:
 *   1. Not yet completed.
 *   2. User has not dismissed it permanently (onboarding_core_dismissed_at).
 *   3. (session-storage check for "already opened this tab" happens client-
 *      side; this function returns DB-layer eligibility.)
 */
export function shouldAutoOpenCore(core: OnboardingState["core"]): boolean {
  if (core.completed) return false;
  if (core.dismissedAt) return false;
  return true;
}

/** Convenience: has the user completed the wizard for this module? */
export function isModuleOnboardingComplete(
  state: OnboardingState,
  wizard: "business_pro" | "breeders_pro",
): boolean {
  return wizard === "business_pro"
    ? state.businessPro.completed
    : state.breedersPro.completed;
}
