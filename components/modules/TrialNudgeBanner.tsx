"use client";

import { useState } from "react";
import {
  MODULE_LABEL,
  MODULE_PRICE_LABEL,
  type ModuleId,
} from "@/lib/modules-query";
import { SubscribeModal } from "./SubscribeModal";

/**
 * Top-of-module banner shown at 5 days and 1 day remaining. Session-
 * storage dismissal so it goes away for the rest of the tab's life
 * (reappears on reload so users aren't trapped if they lose track).
 */
export function TrialNudgeBanner({
  module,
  daysLeft,
}: {
  module: ModuleId;
  daysLeft: number;
}) {
  // Banner shows at <=5 days. A separate, more prominent variant at <=1.
  const variant: "five" | "one" | null =
    daysLeft <= 1 ? "one" : daysLeft <= 5 ? "five" : null;

  // Persist dismissal per-variant per-session so the 5-day banner and the
  // 1-day banner each get their own dismissal. Lazy initializer reads
  // sessionStorage once without a setState-in-effect pass.
  const storageKey = `barnbook:trial-nudge-dismissed:${module}:${variant}`;
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (!variant || typeof window === "undefined") return false;
    try {
      return sessionStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  });
  const [subscribeOpen, setSubscribeOpen] = useState(false);

  if (!variant || dismissed) return null;

  const onDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(storageKey, "1");
    } catch {
      /* ignore */
    }
  };

  const title =
    variant === "one"
      ? `Your trial ends tomorrow.`
      : `Your ${MODULE_LABEL[module]} trial ends in ${daysLeft} days.`;

  const sub =
    variant === "one"
      ? "Your data will be preserved, but access will be paused."
      : "Want to keep your data? Subscribe to keep full access.";

  return (
    <>
      <div
        role="status"
        className="rounded-xl px-4 py-3 text-sm"
        style={{
          background: variant === "one" ? "#fef3c7" : "#fef9e7",
          border: "1px solid #fde68a",
          color: "#92400e",
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600 }}>{title}</div>
          <div style={{ fontSize: 12, marginTop: 2 }}>{sub}</div>
        </div>
        <button
          type="button"
          onClick={() => setSubscribeOpen(true)}
          className="min-h-[40px] rounded-lg px-4 py-2 text-sm font-semibold"
          style={{ background: "#0f6e56", color: "white" }}
        >
          {variant === "one"
            ? "Subscribe — don't lose access"
            : `Subscribe — ${MODULE_PRICE_LABEL[module]}`}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs underline"
          style={{ color: "rgba(146,64,14,0.8)" }}
        >
          {variant === "one" ? "Dismiss" : "Remind me later"}
        </button>
      </div>
      <SubscribeModal
        open={subscribeOpen}
        onClose={() => setSubscribeOpen(false)}
        module={module}
      />
    </>
  );
}
