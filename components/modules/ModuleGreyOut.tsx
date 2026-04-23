"use client";

import { useState, useTransition } from "react";
import {
  MODULE_LABEL,
  MODULE_PRICE_LABEL,
  type ModuleDataCount,
  type ModuleId,
} from "@/lib/modules-query";
import { requestDataExportAction } from "@/lib/modules";
import { SubscribeModal } from "./SubscribeModal";

/**
 * Full-module grey-out overlay shown when a trial has expired.
 *
 * Critical UX invariant (per spec): the underlying module pages still
 * render with real data behind this overlay, so the user can literally
 * see what they built. This component just covers it with a
 * semi-transparent backdrop + a centered "subscribe to restore" card.
 *
 * Data counts ("You tracked 8 breeding records") come from ModuleGate's
 * withDataCount: true getModuleAccess call.
 */
export function ModuleGreyOut({
  module,
  dataCount,
}: {
  module: ModuleId;
  dataCount?: ModuleDataCount;
}) {
  // Tertiary "Not right now" hides the overlay for this tab only.
  // Reappears on reload so user has to keep making the choice. Lazy
  // initializer so we read sessionStorage exactly once without a
  // setState-in-effect reset pass.
  const storageKey = `barnbook:greyout-dismissed:${module}`;
  const [dismissedForSession, setDismissedForSession] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return sessionStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  });
  const [subscribeOpen, setSubscribeOpen] = useState(false);
  const [exportState, setExportState] = useState<"idle" | "sent" | "error">("idle");
  const [pending, startTransition] = useTransition();

  function onDismiss() {
    setDismissedForSession(true);
    try {
      sessionStorage.setItem(storageKey, "1");
    } catch {
      /* ignore */
    }
  }

  function onExport() {
    startTransition(async () => {
      const res = await requestDataExportAction(module);
      setExportState(res.error ? "error" : "sent");
    });
  }

  if (dismissedForSession) return null;

  const summary = buildDataSummary(module, dataCount);

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${MODULE_LABEL[module]} trial ended`}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 70,
          background: "rgba(42,64,49,0.45)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
          // Backdrop blur lets the data behind show through clearly while
          // clearly signalling "not interactive right now."
          backdropFilter: "blur(2px)",
        }}
      >
        <div
          className="rounded-2xl bg-white shadow-xl"
          style={{ width: "100%", maxWidth: 480, padding: 28 }}
        >
          <div
            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide"
            style={{
              background: "rgba(201,168,76,0.2)",
              color: "#7a5c13",
            }}
          >
            Trial ended
          </div>
          <h2
            className="mt-3 font-serif text-2xl font-semibold"
            style={{ color: "#2a4031" }}
          >
            Your {MODULE_LABEL[module]} trial has ended
          </h2>
          <p
            className="mt-2 text-sm"
            style={{ color: "rgba(42,64,49,0.75)", lineHeight: 1.55 }}
          >
            Your data is safe and waiting for you.
          </p>
          {summary && (
            <p
              className="mt-3 rounded-xl p-3 text-sm"
              style={{
                background: "rgba(163,184,143,0.18)",
                color: "#2a4031",
              }}
            >
              {summary}
            </p>
          )}

          <div className="mt-5 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setSubscribeOpen(true)}
              className="min-h-[48px] rounded-xl px-5 py-3 text-sm font-semibold shadow"
              style={{ background: "#0f6e56", color: "white" }}
            >
              Subscribe — {MODULE_PRICE_LABEL[module]}
            </button>
            <button
              type="button"
              onClick={onExport}
              disabled={pending || exportState === "sent"}
              className="min-h-[44px] rounded-xl border px-4 py-2 text-sm font-medium"
              style={{
                borderColor: "rgba(42,64,49,0.15)",
                color: "#2a4031",
                background: "white",
                opacity: pending || exportState === "sent" ? 0.6 : 1,
              }}
            >
              {exportState === "sent"
                ? "Export requested — we'll email you"
                : exportState === "error"
                  ? "Export request failed — try again"
                  : pending
                    ? "Requesting…"
                    : "Export my data"}
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="mt-1 text-xs underline"
              style={{ color: "rgba(42,64,49,0.55)" }}
            >
              Not right now
            </button>
          </div>
        </div>
      </div>

      <SubscribeModal
        open={subscribeOpen}
        onClose={() => setSubscribeOpen(false)}
        module={module}
      />
    </>
  );
}

function buildDataSummary(
  module: ModuleId,
  dc: ModuleDataCount | undefined,
): string | null {
  if (!dc) return null;
  if (module === "breeders_pro") {
    const f = dc.flushes ?? 0;
    const l = dc.foalings ?? 0;
    if (f === 0 && l === 0) return null;
    const parts: string[] = [];
    if (f > 0) parts.push(`${f} breeding record${f === 1 ? "" : "s"}`);
    if (l > 0) parts.push(`${l} foaling${l === 1 ? "" : "s"}`);
    return `You tracked ${parts.join(" and ")} during your trial.`;
  }
  // business_pro
  const inv = dc.invoices ?? 0;
  const rev = dc.invoiceRevenueCents ?? 0;
  const exp = dc.expenses ?? 0;
  if (inv === 0 && exp === 0) return null;
  const parts: string[] = [];
  if (inv > 0) {
    const revDollars = rev > 0 ? `, tracking $${(rev / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "";
    parts.push(`${inv} invoice${inv === 1 ? "" : "s"}${revDollars}`);
  }
  if (exp > 0) parts.push(`${exp} expense${exp === 1 ? "" : "s"}`);
  return `You created ${parts.join(" and ")} during your trial.`;
}
