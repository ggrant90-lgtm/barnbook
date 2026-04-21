"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { OnboardingState, WizardId } from "@/lib/onboarding-query";
import { shouldAutoOpenCore } from "@/lib/onboarding-query";
import {
  dismissCoreOnboardingAction,
  markWizardCompleteAction,
  saveCoreStepAction,
} from "@/lib/onboarding";

/**
 * Thin client-side hook to decide whether a wizard should auto-open
 * on this visit and to provide action callbacks for completion /
 * dismissal / step persistence.
 *
 * Auto-open eligibility is DB state (wizard not completed, not
 * permanently dismissed) intersected with a session-storage "already
 * opened this tab" flag — so refreshing mid-session doesn't keep
 * popping the wizard back up after the user closes it.
 *
 * Parent components still OWN the open state. This hook only reports
 * whether auto-open should happen on first mount. Parents call
 * `markAutoOpened()` to flip the session flag.
 */
export function useWizardState(
  wizard: WizardId,
  initialState: OnboardingState,
) {
  const router = useRouter();

  // Decide "should we auto-open" based on DB state ONLY. Session-flag
  // check happens in an effect below so SSR and first client render
  // match.
  const dbEligible = useMemo(() => {
    if (wizard === "core") return shouldAutoOpenCore(initialState.core);
    if (wizard === "business_pro") return !initialState.businessPro.completed;
    return !initialState.breedersPro.completed;
  }, [wizard, initialState]);

  const sessionKey = `barnbook:onboarding-auto-opened:${wizard}`;
  // Lazy initializer reads sessionStorage once during the first client
  // render — no setState-in-effect pass. Returns false during SSR so
  // the first client render matches.
  const [shouldAutoOpen] = useState<boolean>(() => {
    if (!dbEligible) return false;
    if (typeof window === "undefined") return false;
    try {
      return sessionStorage.getItem(sessionKey) !== "1";
    } catch {
      // sessionStorage may throw in embedded contexts (iframes, etc.).
      // Falling back to "yes auto-open" is fine — the worst that happens
      // is the wizard pops once after a dismiss within the same tab.
      return true;
    }
  });

  const markAutoOpened = useCallback(() => {
    try {
      sessionStorage.setItem(sessionKey, "1");
    } catch {
      /* ignore */
    }
  }, [sessionKey]);

  const markComplete = useCallback(async () => {
    const res = await markWizardCompleteAction(wizard);
    if (!res.error) router.refresh();
    return res;
  }, [wizard, router]);

  const dismissCore = useCallback(async () => {
    if (wizard !== "core") return { error: "Only core can be dismissed" as const };
    const res = await dismissCoreOnboardingAction();
    if (!res.error) router.refresh();
    return res;
  }, [wizard, router]);

  const saveCoreStep = useCallback(
    async (step: number) => {
      if (wizard !== "core") return { error: "Only core tracks step" as const };
      return saveCoreStepAction(step);
    },
    [wizard],
  );

  return {
    shouldAutoOpen,
    markAutoOpened,
    markComplete,
    dismissCore,
    saveCoreStep,
  };
}
