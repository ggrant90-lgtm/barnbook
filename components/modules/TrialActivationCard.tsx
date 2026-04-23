"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startTrialAction } from "@/lib/modules";
import {
  MODULE_LABEL,
  MODULE_PRICE_LABEL,
  TRIAL_DURATION_DAYS,
  type ModuleId,
} from "@/lib/modules-query";
import { ErrorDetails } from "@/components/ui/ErrorDetails";

/**
 * "Start free trial" CTA rendered on a module's upsell / no-access page.
 * Coexists with the existing Calendly walkthrough link.
 */
export function TrialActivationCard({
  module,
  description,
}: {
  module: ModuleId;
  description: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onStart() {
    setError(null);
    startTransition(async () => {
      const res = await startTrialAction(module);
      if (res.error) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div
      className="rounded-2xl border p-6 text-left"
      style={{
        borderColor: "rgba(201,168,76,0.35)",
        background: "rgba(201,168,76,0.06)",
        maxWidth: 520,
        margin: "0 auto",
      }}
    >
      <div
        className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide"
        style={{
          background: "rgba(201,168,76,0.25)",
          color: "#7a5c13",
        }}
      >
        {TRIAL_DURATION_DAYS} days free — no credit card
      </div>
      <h2
        className="mt-3 font-serif text-2xl font-semibold"
        style={{ color: "#2a4031" }}
      >
        Try {MODULE_LABEL[module]} free
      </h2>
      <p
        className="mt-2 text-sm"
        style={{ color: "rgba(42,64,49,0.7)", lineHeight: 1.6 }}
      >
        {description}
      </p>
      <p
        className="mt-3 text-xs"
        style={{ color: "rgba(42,64,49,0.55)" }}
      >
        Then {MODULE_PRICE_LABEL[module]}. Cancel anytime, and your data stays
        with you.
      </p>
      <button
        type="button"
        onClick={onStart}
        disabled={pending}
        className="mt-4 min-h-[48px] w-full rounded-xl px-5 py-3 font-medium shadow disabled:opacity-60"
        style={{ background: "#c9a84c", color: "#2a4031" }}
      >
        {pending ? "Starting your trial…" : "Start free trial"}
      </button>
      {error && (
        <div className="mt-3">
          <ErrorDetails
            title="Couldn't start trial"
            message={error}
            extra={{ Module: module }}
          />
        </div>
      )}
    </div>
  );
}
