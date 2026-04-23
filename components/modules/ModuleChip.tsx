"use client";

import Link from "next/link";
import { useState } from "react";
import {
  MODULE_LABEL,
  TRIAL_DURATION_DAYS,
  type ModuleAccess,
  type ModuleId,
} from "@/lib/modules-query";
import { startTrialAction } from "@/lib/modules";

/**
 * Quiet one-line entry for a premium module on the dashboard.
 *
 *   - Active access (subscription / admin flag / trial): renders a
 *     simple chip link into the module. If the trial is ≤5 days out,
 *     shows a small countdown pill alongside — otherwise zero chrome
 *     so active trialists aren't nagged.
 *   - Trial expired: chip reads "Trial ended — {module}" and links to
 *     the module (the grey-out covers the subscribe ask inside).
 *   - Never started: chip reads "Try {module} · 30 days free" and
 *     starts the trial on tap.
 */
export function ModuleChip({
  module,
  access,
  moduleHref,
}: {
  module: ModuleId;
  access: ModuleAccess;
  moduleHref: string;
}) {
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const label = MODULE_LABEL[module];

  // --- active trial / subscribed / admin flag ---
  if (access.hasAccess) {
    const daysLeft = access.trial?.daysLeft;
    const showCountdown =
      access.accessType === "trial" &&
      typeof daysLeft === "number" &&
      daysLeft <= 5;
    return (
      <Link
        href={moduleHref}
        className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium text-barn-dark hover:bg-parchment"
        style={{ borderColor: "rgba(42,64,49,0.15)", background: "white" }}
      >
        <span>{label}</span>
        {showCountdown && (
          <span
            className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
            style={{
              background: "rgba(201,168,76,0.2)",
              color: "#7a5c13",
            }}
            title={`Trial ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`}
          >
            {daysLeft}d left
          </span>
        )}
      </Link>
    );
  }

  // --- trial expired (never-accessed but has an expired trial row) ---
  if (access.trial?.expired) {
    return (
      <Link
        href={moduleHref}
        className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium hover:brightness-105"
        style={{
          borderColor: "rgba(201,168,76,0.45)",
          background: "rgba(201,168,76,0.08)",
          color: "#7a5c13",
        }}
      >
        {label} · resubscribe
      </Link>
    );
  }

  // --- never started ---
  async function onStart() {
    setErr(null);
    setPending(true);
    try {
      const res = await startTrialAction(module);
      if (res.error) {
        setErr(res.error);
        return;
      }
      // Best-effort client refresh so the chip rerenders as active.
      if (typeof window !== "undefined") window.location.reload();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onStart}
      disabled={pending}
      title={err ?? undefined}
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium hover:brightness-105 disabled:opacity-60"
      style={{
        borderColor: "rgba(201,168,76,0.4)",
        background: "rgba(201,168,76,0.06)",
        color: "#2a4031",
      }}
    >
      {pending ? "Starting…" : `Try ${label} · ${TRIAL_DURATION_DAYS} days free`}
    </button>
  );
}
