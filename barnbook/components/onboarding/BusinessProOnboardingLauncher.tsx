"use client";

import { useState } from "react";
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
  // Lazy initializer decides + claims the session-once flag in one
  // pass. No effect needed; component never re-opens itself after a
  // close, which is the desired behavior.
  const [open, setOpen] = useState<boolean>(() => {
    const should = Boolean(wizard.shouldAutoOpen && barnId);
    if (should) wizard.markAutoOpened();
    return should;
  });

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
