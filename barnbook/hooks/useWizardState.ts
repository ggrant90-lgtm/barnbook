"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  // Has to be a setState-in-effect — useState's lazy initializer runs
  // during SSR (where sessionStorage isn't available), and React reuses
  // the SSR value on hydration without re-running the init. So we
  // start `false` (matches SSR), then flip to true on the client after
  // mount if eligible. The react-hooks/set-state-in-effect lint rule
  // doesn't account for browser-only state, so it's disabled here.
  const [shouldAutoOpen, setShouldAutoOpen] = useState(false);
  useEffect(() => {
    if (!dbEligible) return;
    let alreadyOpened = false;
    try {
      alreadyOpened = sessionStorage.getItem(sessionKey) === "1";
    } catch {
      /* sessionStorage may throw in iframes — treat as not-opened */
    }
    if (!alreadyOpened) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShouldAutoOpen(true);
    }
  }, [dbEligible, sessionKey]);

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
