"use client";

import { useState } from "react";
import { useWizardState } from "@/hooks/useWizardState";
import { BreedersProOnboarding } from "./BreedersProOnboarding";
import type { OnboardingState } from "@/lib/onboarding-query";

/**
 * Thin client shim for the Breeders Pro wizard. Decides whether to
 * auto-open on this visit, then mounts the wizard. Kept out of the
 * module's server page so the heavy data-fetching there isn't tangled
 * with client-side state.
 */
export function BreedersProOnboardingLauncher({
  barnId,
  onboardingState,
  existingMares,
}: {
  barnId: string | null;
  onboardingState: OnboardingState;
  existingMares: Array<{
    id: string;
    name: string;
    breed: string | null;
    photo_url: string | null;
  }>;
}) {
  const wizard = useWizardState("breeders_pro", onboardingState);
  // Lazy initializer decides + claims the session-once flag in one
  // pass. No effect needed.
  const [open, setOpen] = useState<boolean>(() => {
    const should = Boolean(wizard.shouldAutoOpen && barnId);
    if (should) wizard.markAutoOpened();
    return should;
  });

  if (!barnId) return null;

  return (
    <BreedersProOnboarding
      open={open}
      onClose={() => setOpen(false)}
      onComplete={async () => {
        await wizard.markComplete();
      }}
      barnId={barnId}
      existingMares={existingMares}
    />
  );
}
