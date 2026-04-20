"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTrialAction } from "@/lib/modules";
import {
  MODULE_LABEL,
  MODULE_PRICE_LABEL,
  TRIAL_DURATION_DAYS,
  type ModuleAccess,
  type ModuleId,
} from "@/lib/modules-query";
import { TrialBadge } from "./TrialBadge";
import { SubscribeModal } from "./SubscribeModal";

/**
 * Dashboard "Premium" card for one module. Shows the right state +
 * entry point based on the user's access:
 *   - Subscribed / admin flag: a quiet "Active" card linking into the module.
 *   - Trial active: badge + days left + Subscribe CTA.
 *   - Trial expired: prominent "Trial ended — subscribe to restore".
 *   - Nothing yet: "Start 30-day free trial" primary CTA.
 */
export function ModulePremiumCard({
  module,
  access,
  moduleHref,
}: {
  module: ModuleId;
  access: ModuleAccess;
  moduleHref: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [subscribeOpen, setSubscribeOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const label = MODULE_LABEL[module];
  const price = MODULE_PRICE_LABEL[module];

  function startTrial() {
    setErr(null);
    startTransition(async () => {
      const res = await startTrialAction(module);
      if (res.error) {
        setErr(res.error);
        return;
      }
      router.refresh();
    });
  }

  // Layout container is shared; inner content switches on state.
  const cardBase =
    "rounded-2xl border bg-white p-5 shadow-sm flex flex-col gap-3 min-h-[180px]";

  // State: Subscribed or admin flag → "Active"
  if (
    access.accessType === "subscribed" ||
    access.accessType === "flag"
  ) {
    return (
      <Link
        href={moduleHref}
        className={cardBase + " hover:border-brass-gold transition"}
        style={{ borderColor: "rgba(42,64,49,0.1)" }}
      >
        <div className="flex items-center justify-between">
          <div className="font-serif text-lg font-semibold text-barn-dark">
            {label}
          </div>
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{ background: "rgba(163,184,143,0.3)", color: "#2a4031" }}
          >
            Active
          </span>
        </div>
        <p className="text-sm text-barn-dark/60">Open {label} →</p>
      </Link>
    );
  }

  // State: Trial active
  if (access.accessType === "trial" && access.trial) {
    return (
      <div className={cardBase} style={{ borderColor: "rgba(42,64,49,0.1)" }}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="font-serif text-lg font-semibold text-barn-dark">
            {label}
          </div>
          <TrialBadge daysLeft={access.trial.daysLeft} />
        </div>
        <p className="text-sm text-barn-dark/60 flex-1">
          You&apos;re {access.trial.daysLeft === 1 ? "on your last day" : `${access.trial.daysLeft} days in`}.
          Subscribe to keep full access at {price}.
        </p>
        <div className="flex gap-2 flex-wrap">
          <Link
            href={moduleHref}
            className="inline-flex min-h-[40px] items-center rounded-lg border px-4 py-2 text-sm font-medium text-barn-dark hover:bg-parchment"
            style={{ borderColor: "rgba(42,64,49,0.15)" }}
          >
            Open {label}
          </Link>
          <button
            type="button"
            onClick={() => setSubscribeOpen(true)}
            className="inline-flex min-h-[40px] items-center rounded-lg px-4 py-2 text-sm font-semibold text-white"
            style={{ background: "#0f6e56" }}
          >
            Subscribe
          </button>
        </div>
        <SubscribeModal
          open={subscribeOpen}
          onClose={() => setSubscribeOpen(false)}
          module={module}
        />
      </div>
    );
  }

  // State: Trial expired
  if (access.trial?.expired && !access.hasAccess) {
    return (
      <div
        className={cardBase}
        style={{
          borderColor: "rgba(201,168,76,0.45)",
          background: "rgba(201,168,76,0.05)",
        }}
      >
        <div className="flex items-center justify-between">
          <div className="font-serif text-lg font-semibold text-barn-dark">
            {label}
          </div>
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{ background: "rgba(201,168,76,0.3)", color: "#7a5c13" }}
          >
            Trial ended
          </span>
        </div>
        <p className="text-sm text-barn-dark/60 flex-1">
          Your data is safe. Subscribe for {price} to restore full access.
        </p>
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setSubscribeOpen(true)}
            className="inline-flex min-h-[40px] items-center rounded-lg px-4 py-2 text-sm font-semibold text-white"
            style={{ background: "#0f6e56" }}
          >
            Subscribe — {price}
          </button>
          <Link
            href={moduleHref}
            className="inline-flex min-h-[40px] items-center rounded-lg border px-4 py-2 text-sm font-medium text-barn-dark hover:bg-parchment"
            style={{ borderColor: "rgba(42,64,49,0.15)" }}
          >
            See my data
          </Link>
        </div>
        <SubscribeModal
          open={subscribeOpen}
          onClose={() => setSubscribeOpen(false)}
          module={module}
        />
      </div>
    );
  }

  // State: No trial ever
  return (
    <div className={cardBase} style={{ borderColor: "rgba(201,168,76,0.4)", background: "rgba(201,168,76,0.05)" }}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="font-serif text-lg font-semibold text-barn-dark">
          {label}
        </div>
        <span
          className="rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide"
          style={{ background: "rgba(201,168,76,0.25)", color: "#7a5c13" }}
        >
          {TRIAL_DURATION_DAYS} days free
        </span>
      </div>
      <p className="text-sm text-barn-dark/60 flex-1">
        Try {label} for {TRIAL_DURATION_DAYS} days, no card required. Then {price}.
      </p>
      {err && (
        <p className="text-xs text-red-600">
          {err}
        </p>
      )}
      <button
        type="button"
        onClick={startTrial}
        disabled={pending}
        className="min-h-[44px] rounded-lg px-4 py-2 text-sm font-semibold shadow disabled:opacity-60"
        style={{ background: "#c9a84c", color: "#2a4031" }}
      >
        {pending ? "Starting trial…" : "Start free trial"}
      </button>
    </div>
  );
}
