"use client";

import { useEffect, type ReactNode } from "react";

/**
 * Shared chrome for the onboarding wizards. Full-screen overlay modal
 * with a progress-dot header, a content area, and a footer with
 * Back / Skip / Primary buttons. Every wizard in the app uses this —
 * the specific steps come in via `children`.
 *
 * Design system: brass-gold primary, forest-green accents, parchment
 * panel background. Matches StallPurchaseFlow + ScanModal overlays
 * already in use.
 */
interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  stepCount: number;
  /** 1-indexed. */
  currentStep: number;
  /** When present, renders a Back button. Usually null on step 1 and
   *  on the final "Done" step. */
  onBack?: () => void;
  /** When present, renders a Skip link. Usually null on step 1. */
  onSkip?: () => void;
  /** Primary button handler. When null, the primary button is hidden
   *  (used on step 4 of Core where the CTAs live inline). */
  onPrimary?: () => void;
  primaryLabel?: string;
  primaryDisabled?: boolean;
  primaryPending?: boolean;
  children: ReactNode;
}

export function WizardShell(props: Props) {
  if (!props.open) return null;
  // Conditional mount so internal state of step components can reset
  // cleanly when the wizard is reopened.
  return <WizardShellInner {...props} />;
}

function WizardShellInner({
  onClose,
  title,
  stepCount,
  currentStep,
  onBack,
  onSkip,
  onPrimary,
  primaryLabel,
  primaryDisabled,
  primaryPending,
  children,
}: Props) {
  // Esc to close, like the other overlays.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "rgba(42,64,49,0.75)",
        display: "flex",
        alignItems: "stretch",
        justifyContent: "center",
        padding: "env(safe-area-inset-top) 0 env(safe-area-inset-bottom)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="sm:my-8 sm:max-h-[92vh] sm:rounded-2xl"
        style={{
          background: "white",
          width: "100%",
          maxWidth: 620,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          borderRadius: 0,
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "14px 18px",
            borderBottom: "1px solid rgba(0,0,0,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              className="font-serif text-lg font-semibold"
              style={{ color: "#2a4031" }}
            >
              {title}
            </div>
            <div
              className="text-xs mt-0.5"
              style={{ color: "rgba(42,64,49,0.55)" }}
            >
              Step {currentStep} of {stepCount}
            </div>
          </div>
          <ProgressDots total={stepCount} current={currentStep} />
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 hover:bg-parchment"
            style={{ color: "rgba(42,64,49,0.6)" }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body — keyed on step so the fade triggers on step change. */}
        <div
          key={currentStep}
          style={{
            flex: 1,
            overflow: "auto",
            padding: "20px 18px",
            animation: "wizardfade 180ms ease-out",
          }}
        >
          {children}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 18px",
            borderTop: "1px solid rgba(0,0,0,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", gap: 8 }}>
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                disabled={primaryPending}
                className="min-h-[44px] rounded-xl border px-4 py-2 text-sm font-medium disabled:opacity-50"
                style={{
                  borderColor: "rgba(42,64,49,0.15)",
                  color: "#2a4031",
                  background: "white",
                }}
              >
                Back
              </button>
            )}
            {onSkip && (
              <button
                type="button"
                onClick={onSkip}
                disabled={primaryPending}
                className="min-h-[44px] text-sm font-medium underline disabled:opacity-50"
                style={{ color: "rgba(42,64,49,0.55)" }}
              >
                Skip
              </button>
            )}
          </div>
          {onPrimary && primaryLabel && (
            <button
              type="button"
              onClick={onPrimary}
              disabled={primaryDisabled || primaryPending}
              className="min-h-[44px] rounded-xl px-5 py-2.5 font-medium shadow disabled:opacity-60"
              style={{ background: "#c9a84c", color: "#2a4031" }}
            >
              {primaryPending ? "Working…" : primaryLabel}
            </button>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes wizardfade {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function ProgressDots({
  total,
  current,
}: {
  total: number;
  current: number;
}) {
  const dots = Array.from({ length: total }, (_, i) => i + 1);
  return (
    <div
      role="progressbar"
      aria-valuenow={current}
      aria-valuemin={1}
      aria-valuemax={total}
      style={{ display: "flex", gap: 6 }}
    >
      {dots.map((n) => {
        const isDone = n < current;
        const isCurrent = n === current;
        return (
          <span
            key={n}
            aria-hidden="true"
            style={{
              width: isCurrent ? 20 : 8,
              height: 8,
              borderRadius: 4,
              background: isDone
                ? "#2a4031"
                : isCurrent
                  ? "#c9a84c"
                  : "rgba(42,64,49,0.15)",
              transition: "width 180ms ease-out, background 180ms ease-out",
            }}
          />
        );
      })}
    </div>
  );
}
