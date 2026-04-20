"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ErrorDetails } from "@/components/ui/ErrorDetails";
import { StallGrid } from "./StallGrid";
import {
  addStallBlockAction,
  buildNewBarnWithBlockAction,
} from "@/lib/stalls";
import {
  STALL_BLOCK_PRICE_LABEL,
  STALL_BLOCK_SIZE,
} from "@/lib/plans";

/**
 * 4-step Build-A-Barn purchase flow. During early access every block is
 * FREE (original $25/mo struck through). The is_free_promo flag on the
 * persisted row is how we'll later find these users when billing ships.
 *
 * Step 1  Trigger / welcome    — amber "barn full" if launched from capacity
 * Step 2  Choose               — add to existing OR build new
 * Step 3  Select / name        — pick a barn OR type a new name
 * Step 4  Confirm              — stall grid + line-item summary
 * (then   Success              — celebratory)
 */

export interface StallFlowBarnOption {
  id: string;
  name: string;
  horseCount: number;
  effectiveCapacity: number;
}

type Step = 1 | 2 | 3 | 4 | "success";
type Mode = "expand" | "build";

interface Props {
  open: boolean;
  onClose: () => void;
  userBarns: StallFlowBarnOption[];
  /** Barn to pre-select when mode=expand (e.g. the one that just returned
   *  BARN_FULL). Skip step 1's banner if launched from capacity. */
  defaultBarnId?: string;
  /** When launched from "your barn is full", start on step 1 with banner.
   *  When launched from a "+ add stalls" button, skip the welcome and
   *  jump to step 2. */
  launchedFromCapacity?: boolean;
  defaultMode?: Mode;
  onSuccess?: (result: {
    barnId: string;
    blockId?: string;
    action: Mode;
  }) => void;
}

export function StallPurchaseFlow(props: Props) {
  if (!props.open) return null;
  // Conditional mount so all state initializes fresh from the defaults each
  // time the modal opens — no need for a setState-in-effect reset pass.
  return <StallPurchaseFlowInner {...props} />;
}

function StallPurchaseFlowInner({
  onClose,
  userBarns,
  defaultBarnId,
  launchedFromCapacity = false,
  defaultMode,
  onSuccess,
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(launchedFromCapacity ? 1 : 2);
  const [mode, setMode] = useState<Mode>(defaultMode ?? "expand");
  const [selectedBarnId, setSelectedBarnId] = useState<string>(
    defaultBarnId ?? userBarns[0]?.id ?? "",
  );
  const [newBarnName, setNewBarnName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resultBarnId, setResultBarnId] = useState<string | null>(null);
  const [resultBlockId, setResultBlockId] = useState<string | undefined>(undefined);
  const [pending, startTransition] = useTransition();

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const selectedBarn = userBarns.find((b) => b.id === selectedBarnId) ?? null;

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      if (mode === "expand") {
        if (!selectedBarnId) {
          setError("Pick a barn to expand.");
          return;
        }
        const res = await addStallBlockAction(selectedBarnId, {
          isFreePromo: true,
        });
        if (res.error || !res.ok) {
          setError(res.error ?? "Couldn't claim stalls. Please try again.");
          return;
        }
        setResultBarnId(selectedBarnId);
        setResultBlockId(res.blockId);
        setStep("success");
      } else {
        const name = newBarnName.trim();
        if (!name) {
          setError("Give your new barn a name.");
          return;
        }
        const res = await buildNewBarnWithBlockAction({
          name,
          isFreePromo: true,
        });
        if (!res.ok || !res.barnId) {
          setError(res.error ?? "Couldn't build barn. Please try again.");
          return;
        }
        setResultBarnId(res.barnId);
        setResultBlockId(res.blockId);
        setStep("success");
        // Even if block failed, res.error can carry a message — surface
        // non-fatally on the success screen.
        if (res.error) setError(res.error);
      }
    });
  }

  function handleFinish() {
    if (resultBarnId) {
      onSuccess?.({
        barnId: resultBarnId,
        blockId: resultBlockId,
        action: mode,
      });
    }
    router.refresh();
    onClose();
  }

  const stepLabel =
    step === "success"
      ? "Done"
      : step === 1
        ? "Barn full"
        : step === 2
          ? "Choose expansion"
          : step === 3
            ? mode === "expand" ? "Pick a barn" : "Name your barn"
            : "Confirm";

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Build-A-Barn"
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
          maxWidth: 560,
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
            padding: "14px 16px",
            borderBottom: "1px solid rgba(0,0,0,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <div className="font-serif text-lg font-semibold text-barn-dark">
              Build-A-Barn
            </div>
            <div className="text-xs text-barn-dark/60 mt-0.5">{stepLabel}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-barn-dark/60 hover:bg-parchment"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: 20,
            transition: "opacity 200ms ease",
          }}
        >
          {step === 1 && (
            <TriggerStep
              barn={selectedBarn}
              onContinue={() => setStep(2)}
              onDismiss={onClose}
            />
          )}
          {step === 2 && (
            <ChooseStep mode={mode} setMode={setMode} />
          )}
          {step === 3 && (
            <>
              {mode === "expand" ? (
                <SelectBarnStep
                  barns={userBarns}
                  selectedBarnId={selectedBarnId}
                  setSelectedBarnId={setSelectedBarnId}
                />
              ) : (
                <NameBarnStep value={newBarnName} onChange={setNewBarnName} />
              )}
            </>
          )}
          {step === 4 && (
            <ConfirmStep
              mode={mode}
              selectedBarn={selectedBarn}
              newBarnName={newBarnName}
            />
          )}
          {step === "success" && (
            <SuccessStep
              mode={mode}
              // Non-fatal partial error (e.g. build-new succeeded but block insert failed)
              warning={error}
            />
          )}

          {error && step !== "success" && (
            <div className="mt-4">
              <ErrorDetails
                title="Couldn't complete"
                message={error}
                extra={{ Mode: mode, Step: String(step) }}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 16px",
            borderTop: "1px solid rgba(0,0,0,0.08)",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <FooterNav
            step={step}
            mode={mode}
            canContinue={
              step === 3
                ? mode === "expand"
                  ? !!selectedBarnId
                  : newBarnName.trim().length > 0
                : true
            }
            pending={pending}
            onBack={() => {
              if (step === 2) setStep(launchedFromCapacity ? 1 : 2);
              else if (step === 3) setStep(2);
              else if (step === 4) setStep(3);
            }}
            onNext={() => {
              if (step === 1) setStep(2);
              else if (step === 2) setStep(3);
              else if (step === 3) setStep(4);
              else if (step === 4) handleConfirm();
            }}
            onFinish={handleFinish}
            onDismiss={onClose}
          />
          <p className="text-[11px] text-barn-dark/50 text-center">
            You&apos;re on early access pricing. We&apos;ll give you at least 30 days notice before any changes.
          </p>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Steps
// ──────────────────────────────────────────────────────────────

function TriggerStep({
  barn,
  onContinue,
  onDismiss,
}: {
  barn: StallFlowBarnOption | null;
  onContinue: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="space-y-4">
      <div
        className="rounded-xl px-4 py-3 text-sm"
        style={{
          background: "#fef3c7",
          border: "1px solid #fde68a",
          color: "#92400e",
        }}
      >
        <strong>Your barn is full!</strong>
        {barn && (
          <>
            {" "}You&apos;re using {barn.horseCount} of {barn.effectiveCapacity} stalls.
          </>
        )}
      </div>
      <PriceCard />
      <div className="flex flex-col gap-2 pt-2">
        <button
          type="button"
          onClick={onContinue}
          className="min-h-[48px] rounded-xl bg-brass-gold px-4 py-3 font-medium text-barn-dark shadow hover:brightness-110"
        >
          Claim my free stalls
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="min-h-[44px] rounded-xl border border-barn-dark/15 bg-white px-4 py-2.5 text-sm font-medium text-barn-dark hover:bg-parchment"
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}

function ChooseStep({
  mode,
  setMode,
}: {
  mode: Mode;
  setMode: (m: Mode) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-barn-dark/70">
        How do you want to use these {STALL_BLOCK_SIZE} stalls?
      </p>
      <RadioCard
        checked={mode === "expand"}
        onClick={() => setMode("expand")}
        title="Add to an existing barn"
        body="Expand a barn you already have. More stalls, same barn."
      />
      <RadioCard
        checked={mode === "build"}
        onClick={() => setMode("build")}
        title="Build a new barn"
        body="Create a separate barn on your dashboard. Great for a second location or a different use."
      />
    </div>
  );
}

function RadioCard({
  checked,
  onClick,
  title,
  body,
}: {
  checked: boolean;
  onClick: () => void;
  title: string;
  body: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={checked}
      className="w-full text-left rounded-xl border px-4 py-3 transition"
      style={{
        borderColor: checked ? "#c9a84c" : "rgba(42,64,49,0.12)",
        background: checked ? "rgba(201,168,76,0.08)" : "white",
      }}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 20,
            height: 20,
            marginTop: 2,
            borderRadius: "50%",
            border: checked ? "6px solid #c9a84c" : "2px solid rgba(42,64,49,0.35)",
            flexShrink: 0,
          }}
        />
        <div className="min-w-0">
          <div className="font-medium text-barn-dark">{title}</div>
          <div className="text-xs text-barn-dark/60 mt-0.5">{body}</div>
        </div>
      </div>
    </button>
  );
}

function SelectBarnStep({
  barns,
  selectedBarnId,
  setSelectedBarnId,
}: {
  barns: StallFlowBarnOption[];
  selectedBarnId: string;
  setSelectedBarnId: (id: string) => void;
}) {
  if (barns.length === 0) {
    return (
      <div className="rounded-xl border border-barn-dark/10 bg-parchment/40 p-4 text-sm text-barn-dark/70">
        You don&apos;t have any barns yet. Pick &ldquo;Build a new barn&rdquo; on the previous step.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-sm text-barn-dark/70">
        Which barn gets the {STALL_BLOCK_SIZE} new stalls?
      </p>
      <ul className="space-y-2">
        {barns.map((b) => {
          const pct = b.effectiveCapacity
            ? Math.round((b.horseCount / b.effectiveCapacity) * 100)
            : 0;
          const selected = b.id === selectedBarnId;
          return (
            <li key={b.id}>
              <button
                type="button"
                onClick={() => setSelectedBarnId(b.id)}
                aria-pressed={selected}
                className="w-full text-left rounded-xl border px-4 py-3 transition"
                style={{
                  borderColor: selected ? "#c9a84c" : "rgba(42,64,49,0.12)",
                  background: selected ? "rgba(201,168,76,0.08)" : "white",
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-barn-dark truncate">{b.name}</div>
                    <div className="text-xs text-barn-dark/60">
                      {b.horseCount} of {b.effectiveCapacity} stalls used
                    </div>
                  </div>
                  <span className="text-xs text-barn-dark/55">{pct}%</span>
                </div>
                <div
                  style={{
                    height: 6,
                    borderRadius: 3,
                    background: "rgba(42,64,49,0.08)",
                    marginTop: 8,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${Math.min(100, pct)}%`,
                      height: "100%",
                      background:
                        pct >= 100 ? "#b8421f" : pct >= 80 ? "#c9a84c" : "#a3b88f",
                    }}
                  />
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function NameBarnStep({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-barn-dark/70">Give your new barn a name.</p>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-barn-dark/80">
          Barn name
        </span>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. South pasture barn"
          autoFocus
          maxLength={80}
          className="w-full rounded-xl border border-barn-dark/15 bg-white px-4 py-3 text-barn-dark outline-none focus:border-brass-gold focus:ring-2 focus:ring-brass-gold/25"
        />
      </label>
    </div>
  );
}

function ConfirmStep({
  mode,
  selectedBarn,
  newBarnName,
}: {
  mode: Mode;
  selectedBarn: StallFlowBarnOption | null;
  newBarnName: string;
}) {
  const baseCount = mode === "expand" ? (selectedBarn?.effectiveCapacity ?? 0) : 0;
  const lineLabel =
    mode === "expand" ? "10-stall expansion" : "New 10-stall barn";
  const heading =
    mode === "expand"
      ? `Expanding ${selectedBarn?.name ?? ""}`
      : `Building ${newBarnName.trim()}`;

  return (
    <div className="space-y-4">
      <div className="font-serif text-lg font-semibold text-barn-dark">
        {heading}
      </div>

      <StallGrid baseCount={baseCount} newCount={STALL_BLOCK_SIZE} />

      <div className="rounded-xl border border-barn-dark/10 bg-parchment/40 p-4 space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-barn-dark/80">{lineLabel}</span>
          <span className="text-barn-dark/70 line-through">
            {STALL_BLOCK_PRICE_LABEL}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-barn-dark/80">Early access discount</span>
          <span style={{ color: "#2f855a" }}>
            −$25.00
          </span>
        </div>
        <div
          className="flex items-center justify-between pt-2 font-semibold"
          style={{ borderTop: "1px solid rgba(42,64,49,0.1)" }}
        >
          <span className="text-barn-dark">Your cost today</span>
          <span style={{ color: "#2f855a" }}>FREE</span>
        </div>
      </div>
    </div>
  );
}

function SuccessStep({
  mode,
  warning,
}: {
  mode: Mode;
  warning: string | null;
}) {
  return (
    <div className="flex flex-col items-center py-6 text-center">
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          background: "rgba(163,184,143,0.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          animation: "stall-pop 320ms cubic-bezier(.34,1.56,.64,1)",
        }}
      >
        <svg
          width="36"
          height="36"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#2a4031"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <div className="mt-4 font-serif text-xl font-semibold text-barn-dark">
        {mode === "expand" ? "Barn expanded!" : "Barn built!"}
      </div>
      <div className="mt-1 text-sm text-barn-dark/70">
        Your {STALL_BLOCK_SIZE} new stalls are ready.
      </div>
      {warning && (
        <div className="mt-4 w-full">
          <ErrorDetails title="Heads up" message={warning} />
        </div>
      )}
      <style jsx>{`
        @keyframes stall-pop {
          0%   { transform: scale(0.6); opacity: 0; }
          100% { transform: scale(1);   opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function PriceCard() {
  return (
    <div
      className="rounded-xl border p-4 text-center"
      style={{
        borderColor: "rgba(201,168,76,0.4)",
        background: "rgba(201,168,76,0.06)",
      }}
    >
      <div className="text-xs font-medium uppercase tracking-wide text-barn-dark/60">
        10-stall block
      </div>
      <div className="mt-1 text-2xl font-serif font-semibold text-barn-dark line-through">
        {STALL_BLOCK_PRICE_LABEL}
      </div>
      <div className="mt-0.5 text-3xl font-serif font-semibold" style={{ color: "#2f855a" }}>
        FREE
      </div>
      <div
        className="mt-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide"
        style={{
          background: "rgba(201,168,76,0.2)",
          color: "#7a5c13",
        }}
      >
        Early access — limited time
      </div>
    </div>
  );
}

function FooterNav({
  step,
  mode,
  canContinue,
  pending,
  onBack,
  onNext,
  onFinish,
  onDismiss,
}: {
  step: Step;
  mode: Mode;
  canContinue: boolean;
  pending: boolean;
  onBack: () => void;
  onNext: () => void;
  onFinish: () => void;
  onDismiss: () => void;
}) {
  if (step === "success") {
    return (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onFinish}
          className="min-h-[44px] rounded-xl bg-brass-gold px-5 py-2.5 font-medium text-barn-dark shadow hover:brightness-110"
        >
          Done
        </button>
      </div>
    );
  }
  if (step === 1) {
    // TriggerStep renders its own buttons; nothing here.
    return null;
  }

  const canGoBack = step === 3 || step === 4;
  const nextLabel =
    step === 4
      ? mode === "expand"
        ? "Claim free stalls"
        : "Claim free barn"
      : "Continue";
  const isConfirm = step === 4;

  return (
    <div className="flex items-center justify-between gap-2">
      {canGoBack ? (
        <button
          type="button"
          onClick={onBack}
          disabled={pending}
          className="min-h-[44px] rounded-xl border border-barn-dark/15 bg-white px-4 py-2 text-sm font-medium text-barn-dark hover:bg-parchment disabled:opacity-50"
        >
          Back
        </button>
      ) : (
        <button
          type="button"
          onClick={onDismiss}
          disabled={pending}
          className="min-h-[44px] rounded-xl border border-barn-dark/15 bg-white px-4 py-2 text-sm font-medium text-barn-dark hover:bg-parchment disabled:opacity-50"
        >
          Cancel
        </button>
      )}
      <button
        type="button"
        onClick={onNext}
        disabled={pending || !canContinue}
        className="min-h-[44px] rounded-xl px-5 py-2.5 font-medium shadow hover:brightness-110 disabled:opacity-50"
        style={{
          background: isConfirm ? "#2f855a" : "#c9a84c",
          color: isConfirm ? "white" : "#2a4031",
        }}
      >
        {pending ? "Working…" : nextLabel}
      </button>
    </div>
  );
}
