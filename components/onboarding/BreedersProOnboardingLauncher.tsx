"use client";

import { useEffect, useState } from "react";
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
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (wizard.shouldAutoOpen && barnId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(true);
      wizard.markAutoOpened();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizard.shouldAutoOpen, barnId]);

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
