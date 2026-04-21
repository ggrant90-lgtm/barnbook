"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  createHorseAction,
} from "@/app/(protected)/actions/horse";
import { recordLiveCoverAction } from "@/app/(protected)/actions/breeding";
import { ErrorDetails } from "@/components/ui/ErrorDetails";
import { WizardShell } from "./WizardShell";
import { WizardBreedingTimeline } from "./WizardBreedingTimeline";

/**
 * Breeders Pro onboarding wizard — 4 steps from "trial activated" to
 * "first mare + first pregnancy + timeline visible." Writes real data
 * at steps 2 and 3; every step except step 1 can be skipped.
 */

interface Props {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
  barnId: string;
  existingMares: Array<{
    id: string;
    name: string;
    breed: string | null;
    photo_url: string | null;
  }>;
}

const STEP_COUNT = 4;

type BreedingMethod = "live_cover" | "ai" | "embryo_transfer";

export function BreedersProOnboarding(props: Props) {
  if (!props.open) return null;
  return <Inner {...props} />;
}

function Inner({
  onClose,
  onComplete,
  barnId,
  existingMares,
}: Props) {
  const [step, setStep] = useState(1);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Mare selection / creation.
  const [mareMode, setMareMode] = useState<"existing" | "new">(
    existingMares.length > 0 ? "existing" : "new",
  );
  const [mareId, setMareId] = useState<string>(existingMares[0]?.id ?? "");
  const [newMareName, setNewMareName] = useState("");
  const [newMareBreed, setNewMareBreed] = useState("");
  const [newMareFoalDate, setNewMareFoalDate] = useState("");

  // Breeding details.
  const [stallionName, setStallionName] = useState("");
  const [breedingDate, setBreedingDate] = useState<string>(todayIso());
  const [method, setMethod] = useState<BreedingMethod>("live_cover");

  const mareDisplayName =
    mareMode === "new"
      ? newMareName.trim()
      : existingMares.find((m) => m.id === mareId)?.name ?? "";

  function advance() {
    setError(null);
    setStep((s) => Math.min(STEP_COUNT, s + 1));
  }
  function back() {
    setError(null);
    setStep((s) => Math.max(1, s - 1));
  }

  // ── Step handlers ─────────────────────────────────────────────────

  function handleStep2() {
    if (mareMode === "new" && !newMareName.trim()) {
      setError("Give your mare a name.");
      return;
    }
    if (mareMode === "existing" && !mareId) {
      setError("Pick a mare from the list.");
      return;
    }
    setError(null);
    startTransition(async () => {
      if (mareMode === "new") {
        const fd = new FormData();
        fd.set("name", newMareName.trim());
        fd.set("sex", "mare");
        fd.set("breeding_role", "donor");
        if (newMareBreed) fd.set("breed", newMareBreed);
        if (newMareFoalDate) fd.set("foal_date", newMareFoalDate);
        const res = await createHorseAction(null, fd);
        if (res?.error || !res?.horseId) {
          setError(res?.error ?? "Couldn't create mare");
          return;
        }
        setMareId(res.horseId);
        setMareMode("existing");
      }
      advance();
    });
  }

  function handleStep3() {
    if (method === "embryo_transfer") {
      // ET needs an embryo record + surrogate — too much for a quick
      // wizard. Send them to the full flow.
      onComplete();
      onClose();
      if (typeof window !== "undefined") {
        window.location.href = "/breeders-pro/breeding/new";
      }
      return;
    }
    if (!mareId) {
      setError("Mare is missing — please go back to step 2.");
      return;
    }
    if (!stallionName.trim()) {
      setError("Give the stallion a name.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("barn_id", barnId);
      fd.set("mare_mode", "existing");
      fd.set("mare_id", mareId);
      // Inline-create external stallion record (breeding_only by default).
      fd.set("sire_mode", "new");
      fd.set("sire_name", stallionName.trim());
      fd.set("breeding_category", method === "ai" ? "ai" : "live_cover");
      fd.set("cover_date", breedingDate);
      if (method === "live_cover") {
        fd.set("cover_method", "hand_cover");
      }
      if (method === "ai") {
        fd.set("semen_type", "ai_fresh");
      }

      const res = await recordLiveCoverAction(fd);
      if ((res as { error?: string }).error) {
        setError((res as { error: string }).error);
        return;
      }
      advance();
    });
  }

  // ── Render ─────────────────────────────────────────────────────────

  let title = "Welcome to Breeders Pro";
  let onPrimary: (() => void) | undefined;
  let primaryLabel = "Continue";
  let onSkip: (() => void) | undefined;
  let onBack: (() => void) | undefined;
  let primaryDisabled = false;

  if (step === 1) {
    onPrimary = advance;
    primaryLabel = "Let's go";
  } else if (step === 2) {
    title = "Pick a mare";
    onPrimary = handleStep2;
    primaryLabel = mareDisplayName
      ? `Continue with ${mareDisplayName}`
      : "Continue";
    onSkip = () => {
      onComplete();
      onClose();
    };
    onBack = back;
    primaryDisabled =
      (mareMode === "new" && !newMareName.trim()) ||
      (mareMode === "existing" && !mareId);
  } else if (step === 3) {
    title = `Breeding details for ${mareDisplayName || "your mare"}`;
    onPrimary = handleStep3;
    primaryLabel =
      method === "embryo_transfer"
        ? "Open full flow"
        : "Save breeding record";
    onSkip = advance;
    onBack = back;
    primaryDisabled =
      method !== "embryo_transfer" && !stallionName.trim();
  } else {
    title = "Your breeding timeline";
    onPrimary = () => {
      onComplete();
      onClose();
    };
    primaryLabel = "Go to Breeders Pro";
    onBack = undefined;
  }

  return (
    <WizardShell
      open={true}
      onClose={onClose}
      title={title}
      stepCount={STEP_COUNT}
      currentStep={step}
      onBack={onBack}
      onSkip={onSkip}
      onPrimary={onPrimary}
      primaryLabel={primaryLabel}
      primaryDisabled={primaryDisabled}
      primaryPending={pending}
    >
      {step === 1 && <Step1 />}
      {step === 2 && (
        <Step2
          existingMares={existingMares}
          mareMode={mareMode}
          setMareMode={setMareMode}
          mareId={mareId}
          setMareId={setMareId}
          newMareName={newMareName}
          setNewMareName={setNewMareName}
          newMareBreed={newMareBreed}
          setNewMareBreed={setNewMareBreed}
          newMareFoalDate={newMareFoalDate}
          setNewMareFoalDate={setNewMareFoalDate}
        />
      )}
      {step === 3 && (
        <Step3
          mareName={mareDisplayName}
          stallionName={stallionName}
          setStallionName={setStallionName}
          breedingDate={breedingDate}
          setBreedingDate={setBreedingDate}
          method={method}
          setMethod={setMethod}
        />
      )}
      {step === 4 && (
        <Step4
          mareName={mareDisplayName}
          breedingDate={breedingDate}
        />
      )}

      {error && (
        <div className="mt-4">
          <ErrorDetails
            title="Couldn't continue"
            message={error}
            extra={{ Step: String(step), BarnId: barnId }}
          />
        </div>
      )}
    </WizardShell>
  );
}

// ──────────────────────────────────────────────────────────────
// Steps
// ──────────────────────────────────────────────────────────────

function Step1() {
  return (
    <div className="space-y-3">
      <p className="text-sm" style={{ color: "rgba(42,64,49,0.8)", lineHeight: 1.6 }}>
        Let&apos;s get your breeding program started. In about two minutes
        we&apos;ll set up your first mare and build a visual timeline of
        her breeding milestones.
      </p>
      <ul
        className="list-disc pl-5 text-sm space-y-1"
        style={{ color: "rgba(42,64,49,0.7)" }}
      >
        <li>Pick or add a mare</li>
        <li>Record a breeding (live cover or AI)</li>
        <li>See the timeline + upcoming checks</li>
      </ul>
    </div>
  );
}

function Step2({
  existingMares,
  mareMode,
  setMareMode,
  mareId,
  setMareId,
  newMareName,
  setNewMareName,
  newMareBreed,
  setNewMareBreed,
  newMareFoalDate,
  setNewMareFoalDate,
}: {
  existingMares: Array<{
    id: string;
    name: string;
    breed: string | null;
    photo_url: string | null;
  }>;
  mareMode: "existing" | "new";
  setMareMode: (v: "existing" | "new") => void;
  mareId: string;
  setMareId: (v: string) => void;
  newMareName: string;
  setNewMareName: (v: string) => void;
  newMareBreed: string;
  setNewMareBreed: (v: string) => void;
  newMareFoalDate: string;
  setNewMareFoalDate: (v: string) => void;
}) {
  return (
    <div className="space-y-3">
      {existingMares.length > 0 && (
        <div className="flex gap-2 text-sm">
          <button
            type="button"
            onClick={() => setMareMode("existing")}
            className="rounded-lg border px-3 py-1.5"
            style={{
              borderColor: mareMode === "existing" ? "#c9a84c" : "rgba(42,64,49,0.15)",
              background: mareMode === "existing" ? "rgba(201,168,76,0.08)" : "white",
              color: "#2a4031",
            }}
          >
            Pick an existing mare
          </button>
          <button
            type="button"
            onClick={() => setMareMode("new")}
            className="rounded-lg border px-3 py-1.5"
            style={{
              borderColor: mareMode === "new" ? "#c9a84c" : "rgba(42,64,49,0.15)",
              background: mareMode === "new" ? "rgba(201,168,76,0.08)" : "white",
              color: "#2a4031",
            }}
          >
            Add a new mare
          </button>
        </div>
      )}

      {mareMode === "existing" && existingMares.length > 0 ? (
        <ul className="space-y-2">
          {existingMares.map((m) => {
            const selected = m.id === mareId;
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => setMareId(m.id)}
                  aria-pressed={selected}
                  className="w-full rounded-xl border p-3 flex items-center gap-3 text-left"
                  style={{
                    borderColor: selected ? "#c9a84c" : "rgba(42,64,49,0.12)",
                    background: selected ? "rgba(201,168,76,0.08)" : "white",
                  }}
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 8,
                      background: "rgba(163,184,143,0.25)",
                      overflow: "hidden",
                      flexShrink: 0,
                    }}
                  >
                    {m.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.photo_url}
                        alt=""
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium" style={{ color: "#2a4031" }}>
                      {m.name}
                    </div>
                    {m.breed && (
                      <div className="text-xs" style={{ color: "rgba(42,64,49,0.6)" }}>
                        {m.breed}
                      </div>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="space-y-2">
          <LabeledInput
            label="Mare name"
            value={newMareName}
            onChange={setNewMareName}
            autoFocus
          />
          <div className="grid grid-cols-2 gap-3">
            <LabeledInput
              label="Breed (optional)"
              value={newMareBreed}
              onChange={setNewMareBreed}
            />
            <LabeledInput
              label="Foal date (optional)"
              value={newMareFoalDate}
              onChange={setNewMareFoalDate}
              type="date"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Step3({
  mareName,
  stallionName,
  setStallionName,
  breedingDate,
  setBreedingDate,
  method,
  setMethod,
}: {
  mareName: string;
  stallionName: string;
  setStallionName: (v: string) => void;
  breedingDate: string;
  setBreedingDate: (v: string) => void;
  method: BreedingMethod;
  setMethod: (m: BreedingMethod) => void;
}) {
  const due = (() => {
    const d = new Date(breedingDate);
    if (Number.isNaN(d.getTime())) return null;
    d.setDate(d.getDate() + 340);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  })();

  return (
    <div className="space-y-3">
      <p className="text-sm" style={{ color: "rgba(42,64,49,0.8)", lineHeight: 1.6 }}>
        Tell us about {mareName || "your mare"}&apos;s breeding.
      </p>
      <LabeledInput
        label="Stallion name"
        value={stallionName}
        onChange={setStallionName}
        autoFocus
      />
      <div className="grid grid-cols-2 gap-3">
        <LabeledInput
          label="Breeding date"
          value={breedingDate}
          onChange={setBreedingDate}
          type="date"
        />
        <div>
          <span
            className="mb-1.5 block text-sm font-medium"
            style={{ color: "rgba(42,64,49,0.8)" }}
          >
            Method
          </span>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as BreedingMethod)}
            className="w-full rounded-xl border px-3 py-3 outline-none"
            style={{ borderColor: "rgba(42,64,49,0.15)", color: "#2a4031", background: "white" }}
          >
            <option value="live_cover">Live cover</option>
            <option value="ai">AI (artificial insemination)</option>
            <option value="embryo_transfer">Embryo transfer</option>
          </select>
        </div>
      </div>

      {method === "embryo_transfer" ? (
        <div
          className="rounded-xl border px-3 py-2 text-sm"
          style={{
            borderColor: "rgba(201,168,76,0.4)",
            background: "rgba(201,168,76,0.08)",
            color: "#7a5c13",
          }}
        >
          Embryo transfer setup is a bit more involved — we&apos;ll take you
          to the full Breeders Pro flow.
        </div>
      ) : (
        due && (
          <div
            className="rounded-xl border p-3 text-sm"
            style={{
              borderColor: "rgba(42,64,49,0.1)",
              background: "rgba(245,239,228,0.5)",
              color: "#2a4031",
            }}
          >
            <strong>Expected foaling: </strong>
            <span>{due}</span>
            <span
              className="block text-xs mt-0.5"
              style={{ color: "rgba(42,64,49,0.6)" }}
            >
              (~340 days from breeding)
            </span>
          </div>
        )
      )}
    </div>
  );
}

function Step4({
  mareName,
  breedingDate,
}: {
  mareName: string;
  breedingDate: string;
}) {
  return (
    <div className="space-y-4">
      <div
        className="mx-auto inline-flex items-center justify-center rounded-full"
        style={{
          width: 56,
          height: 56,
          background: "rgba(163,184,143,0.3)",
          animation: "brpop 300ms cubic-bezier(.34,1.56,.64,1)",
          marginLeft: "auto",
          marginRight: "auto",
          display: "flex",
        }}
      >
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#2a4031" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <div className="text-center">
        <h3
          className="font-serif text-xl font-semibold"
          style={{ color: "#2a4031" }}
        >
          {mareName || "Your mare"} is in the program
        </h3>
        <p className="text-sm mt-1" style={{ color: "rgba(42,64,49,0.7)" }}>
          We&apos;ll remind you as milestones come up.
        </p>
      </div>
      <WizardBreedingTimeline
        mareName={mareName}
        breedingDate={breedingDate}
      />
      <div className="text-center">
        <Link
          href="/breeders-pro/breeding/new"
          className="text-sm underline"
          style={{ color: "rgba(42,64,49,0.6)" }}
        >
          Or add another mare
        </Link>
      </div>
      <style jsx>{`
        @keyframes brpop {
          0%   { transform: scale(0.6); opacity: 0; }
          100% { transform: scale(1);   opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  type = "text",
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoFocus?: boolean;
}) {
  return (
    <label className="block">
      <span
        className="mb-1.5 block text-sm font-medium"
        style={{ color: "rgba(42,64,49,0.8)" }}
      >
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus}
        className="w-full rounded-xl border px-4 py-3 outline-none"
        style={{ borderColor: "rgba(42,64,49,0.15)", color: "#2a4031", background: "white" }}
      />
    </label>
  );
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
