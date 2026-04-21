"use client";

import { useEffect, useState } from "react";
import { useWizardState } from "@/hooks/useWizardState";
import { BusinessProOnboarding } from "./BusinessProOnboarding";
import type { OnboardingState } from "@/lib/onboarding-query";

/**
 * Thin client shim that decides whether to open the Business Pro
 * onboarding wizard on this visit, then renders it. Kept separate from
 * OverviewClient so we don't have to thread wizard props through the
 * big financial dashboard component.
 */
export function BusinessProOnboardingLauncher({
  barnId,
  onboardingState,
  initialCompany,
  existingClients,
}: {
  barnId: string | null;
  onboardingState: OnboardingState;
  initialCompany: {
    name: string;
    phone: string | null;
    email: string | null;
  };
  existingClients: Array<{ id: string; display_name: string }>;
}) {
  const wizard = useWizardState("business_pro", onboardingState);
  // Open state must default to false (matches SSR) and only flip true
  // after mount if eligible — useWizardState's shouldAutoOpen is
  // browser-only (reads sessionStorage), so it's false until effects run.
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (wizard.shouldAutoOpen && barnId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(true);
      wizard.markAutoOpened();
    }
    // shouldAutoOpen + barnId are stable for a given mount; we
    // intentionally only fire this once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizard.shouldAutoOpen, barnId]);

  if (!barnId) return null;

  return (
    <BusinessProOnboarding
      open={open}
      onClose={() => setOpen(false)}
      onComplete={async () => {
        await wizard.markComplete();
      }}
      barnId={barnId}
      initialCompany={initialCompany}
      existingClients={existingClients}
    />
  );
}
