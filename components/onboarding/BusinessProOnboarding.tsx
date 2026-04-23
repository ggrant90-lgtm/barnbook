"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  createClientAction,
  type ClientInput,
} from "@/app/(protected)/actions/clients";
import { createInvoiceAction } from "@/app/(protected)/actions/invoices";
import {
  saveServicePresetsAction,
  updateBarnBusinessSettingsAction,
} from "@/lib/onboarding";
import type { InvoiceServicePreset } from "@/lib/types";
import { ErrorDetails } from "@/components/ui/ErrorDetails";
import { WizardShell } from "./WizardShell";
import { WizardInvoicePreview } from "./WizardInvoicePreview";

/**
 * Business Pro onboarding wizard — 4 steps from "I just activated BP"
 * to "I have company branding set, service presets saved, and a first
 * invoice created." Every step INSERTs or UPDATEs real data.
 */

interface Props {
  open: boolean;
  onClose: () => void;
  onComplete: () => void | Promise<void>;
  barnId: string;
  /** Prefill for step 1. */
  initialCompany: {
    name: string;
    phone: string | null;
    email: string | null;
  };
  /** Optional: existing barn_clients for the dropdown in step 3. */
  existingClients: Array<{ id: string; display_name: string }>;
}

const STEP_COUNT = 4;

const SERVICE_PRESETS: Array<InvoiceServicePreset & { key: string }> = [
  { key: "board", label: "Monthly board", priceCents: 50000 },
  { key: "training", label: "Training ride", priceCents: 5000 },
  { key: "lesson", label: "Lesson", priceCents: 7500 },
  { key: "farrier", label: "Farrier (full shoe)", priceCents: 20000 },
  { key: "hauling", label: "Hauling", priceCents: 15000 },
];

export function BusinessProOnboarding(props: Props) {
  if (!props.open) return null;
  return <Inner {...props} />;
}

function Inner({
  onClose,
  onComplete,
  barnId,
  initialCompany,
  existingClients,
}: Props) {
  const [step, setStep] = useState(1);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Step 1 accumulator.
  const [companyName, setCompanyName] = useState(initialCompany.name);
  const [companyPhone, setCompanyPhone] = useState(initialCompany.phone ?? "");
  const [companyEmail, setCompanyEmail] = useState(initialCompany.email ?? "");

  // Step 2 accumulator.
  const [services, setServices] = useState<InvoiceServicePreset[]>([]);
  const [customLabel, setCustomLabel] = useState("");
  const [customPrice, setCustomPrice] = useState("");

  // Step 3 accumulator.
  const [clientMode, setClientMode] = useState<"existing" | "new">(
    existingClients.length > 0 ? "existing" : "new",
  );
  const [existingClientId, setExistingClientId] = useState<string>(
    existingClients[0]?.id ?? "",
  );
  const [newClientName, setNewClientName] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [lineDesc, setLineDesc] = useState("");
  const [lineQty, setLineQty] = useState(1);
  const [linePriceCents, setLinePriceCents] = useState(0);
  const [createdInvoiceId, setCreatedInvoiceId] = useState<string | null>(null);

  // Auto-select first saved service as the initial line item.
  if (services.length > 0 && !lineDesc && linePriceCents === 0) {
    setLineDesc(services[0].label);
    setLinePriceCents(services[0].priceCents);
  }

  const clientName = (() => {
    if (clientMode === "existing") {
      return (
        existingClients.find((c) => c.id === existingClientId)?.display_name ??
        ""
      );
    }
    return newClientName;
  })();

  function advance() {
    setError(null);
    setStep((s) => Math.min(STEP_COUNT, s + 1));
  }
  function back() {
    setError(null);
    setStep((s) => Math.max(1, s - 1));
  }

  // ── Step handlers ─────────────────────────────────────────────────

  function handleStep1() {
    setError(null);
    startTransition(async () => {
      const res = await updateBarnBusinessSettingsAction({
        barnId,
        company_name: companyName,
        company_phone: companyPhone || null,
        company_email: companyEmail || null,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      advance();
    });
  }

  function handleStep2() {
    setError(null);
    startTransition(async () => {
      const res = await saveServicePresetsAction(barnId, services);
      if (res.error) {
        setError(res.error);
        return;
      }
      advance();
    });
  }

  function handleStep3() {
    setError(null);
    if (!lineDesc.trim()) {
      setError("Add a description for the invoice line.");
      return;
    }
    startTransition(async () => {
      let clientId = clientMode === "existing" ? existingClientId : null;

      // Create client inline if needed.
      if (clientMode === "new" && newClientName.trim()) {
        const input: ClientInput = {
          barnId,
          display_name: newClientName.trim(),
          email: newClientEmail.trim() || null,
        };
        const created = await createClientAction(input);
        if (created.error || !created.clientId) {
          setError(created.error ?? "Couldn't create client");
          return;
        }
        clientId = created.clientId;
      }

      const res = await createInvoiceAction({
        barnId,
        client_id: clientId,
        billable_to_name: clientMode === "new" ? newClientName.trim() : null,
        entryIds: [],
        lineItems: [
          {
            description: lineDesc.trim(),
            quantity: Math.max(1, Math.round(lineQty)),
            unit_price: linePriceCents / 100,
            horse_id: null,
          },
        ],
      });
      if (res.error || !res.invoiceId) {
        setError(res.error ?? "Couldn't create invoice");
        return;
      }
      setCreatedInvoiceId(res.invoiceId);
      advance();
    });
  }

  // ── Render ─────────────────────────────────────────────────────────

  let title = "Welcome to Business Pro";
  let onPrimary: (() => void) | undefined;
  let primaryLabel = "Continue";
  let onSkip: (() => void) | undefined;
  let onBack: (() => void) | undefined;
  let primaryDisabled = false;

  if (step === 1) {
    onPrimary = handleStep1;
    primaryLabel = "Set up my business";
    primaryDisabled = !companyName.trim();
  } else if (step === 2) {
    title = "Your services";
    onPrimary = handleStep2;
    primaryLabel = "Continue";
    onSkip = advance;
    onBack = back;
  } else if (step === 3) {
    title = "Create your first invoice";
    onPrimary = handleStep3;
    primaryLabel = "Create invoice";
    onSkip = async () => {
      // Await completion so the flag flip lands BEFORE the modal
      // unmounts — otherwise the wizard can reopen on the next visit
      // if the DB write didn't finish in time.
      await onComplete();
      onClose();
    };
    onBack = back;
    primaryDisabled =
      (clientMode === "new" && !newClientName.trim()) ||
      (clientMode === "existing" && !existingClientId) ||
      !lineDesc.trim();
  } else {
    title = "Your business is set up";
    onPrimary = async () => {
      await onComplete();
      onClose();
    };
    primaryLabel = "Go to Business Pro";
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
      {step === 1 && (
        <Step1
          companyName={companyName}
          setCompanyName={setCompanyName}
          companyPhone={companyPhone}
          setCompanyPhone={setCompanyPhone}
          companyEmail={companyEmail}
          setCompanyEmail={setCompanyEmail}
        />
      )}
      {step === 2 && (
        <Step2
          services={services}
          setServices={setServices}
          customLabel={customLabel}
          setCustomLabel={setCustomLabel}
          customPrice={customPrice}
          setCustomPrice={setCustomPrice}
        />
      )}
      {step === 3 && (
        <Step3
          services={services}
          existingClients={existingClients}
          clientMode={clientMode}
          setClientMode={setClientMode}
          existingClientId={existingClientId}
          setExistingClientId={setExistingClientId}
          newClientName={newClientName}
          setNewClientName={setNewClientName}
          newClientEmail={newClientEmail}
          setNewClientEmail={setNewClientEmail}
          lineDesc={lineDesc}
          setLineDesc={setLineDesc}
          lineQty={lineQty}
          setLineQty={setLineQty}
          linePriceCents={linePriceCents}
          setLinePriceCents={setLinePriceCents}
          companyName={companyName}
          companyPhone={companyPhone}
          companyEmail={companyEmail}
          clientName={clientName}
        />
      )}
      {step === 4 && (
        <Step4
          companyName={companyName}
          invoiceId={createdInvoiceId}
          totalCents={lineQty * linePriceCents}
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

function Step1({
  companyName,
  setCompanyName,
  companyPhone,
  setCompanyPhone,
  companyEmail,
  setCompanyEmail,
}: {
  companyName: string;
  setCompanyName: (v: string) => void;
  companyPhone: string;
  setCompanyPhone: (v: string) => void;
  companyEmail: string;
  setCompanyEmail: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: "rgba(42,64,49,0.8)", lineHeight: 1.6 }}>
        These show up on every invoice you send. You can change them later
        in barn settings.
      </p>
      <LabeledInput
        label="Business name"
        value={companyName}
        onChange={setCompanyName}
        autoFocus
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <LabeledInput
          label="Business phone (optional)"
          value={companyPhone}
          onChange={setCompanyPhone}
          type="tel"
        />
        <LabeledInput
          label="Business email (optional)"
          value={companyEmail}
          onChange={setCompanyEmail}
          type="email"
        />
      </div>
    </div>
  );
}

function Step2({
  services,
  setServices,
  customLabel,
  setCustomLabel,
  customPrice,
  setCustomPrice,
}: {
  services: InvoiceServicePreset[];
  setServices: (v: InvoiceServicePreset[]) => void;
  customLabel: string;
  setCustomLabel: (v: string) => void;
  customPrice: string;
  setCustomPrice: (v: string) => void;
}) {
  function addPreset(p: InvoiceServicePreset) {
    // Avoid duplicates by label.
    if (services.some((s) => s.label.toLowerCase() === p.label.toLowerCase())) return;
    setServices([...services, p]);
  }
  function removeAt(i: number) {
    setServices(services.filter((_, idx) => idx !== i));
  }
  function addCustom() {
    const label = customLabel.trim();
    const cents = Math.max(0, Math.round(parseFloat(customPrice || "0") * 100));
    if (!label) return;
    setServices([...services, { label, priceCents: cents }]);
    setCustomLabel("");
    setCustomPrice("");
  }

  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: "rgba(42,64,49,0.8)", lineHeight: 1.6 }}>
        What do you charge for? Tap any that apply — we&apos;ll save them so
        they&apos;re one tap away when you create an invoice.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {SERVICE_PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => addPreset({ label: p.label, priceCents: p.priceCents })}
            className="rounded-xl border px-3 py-2 text-left transition"
            style={{
              borderColor: "rgba(42,64,49,0.12)",
              background: "white",
              color: "#2a4031",
            }}
          >
            <div className="text-sm font-medium">{p.label}</div>
            <div className="text-xs" style={{ color: "rgba(42,64,49,0.55)" }}>
              ${(p.priceCents / 100).toFixed(2)}
            </div>
          </button>
        ))}
      </div>

      <div
        className="rounded-xl border p-3"
        style={{
          borderColor: "rgba(42,64,49,0.1)",
          background: "rgba(245,239,228,0.5)",
        }}
      >
        <div className="text-xs font-medium mb-2" style={{ color: "rgba(42,64,49,0.7)" }}>
          Something else
        </div>
        <div className="grid grid-cols-[1fr_100px_auto] gap-2">
          <input
            type="text"
            value={customLabel}
            onChange={(e) => setCustomLabel(e.target.value)}
            placeholder="Label"
            className="rounded-lg border px-3 py-2 text-sm outline-none"
            style={{ borderColor: "rgba(42,64,49,0.15)", color: "#2a4031", background: "white" }}
          />
          <input
            type="number"
            step="0.01"
            min="0"
            value={customPrice}
            onChange={(e) => setCustomPrice(e.target.value)}
            placeholder="$"
            className="rounded-lg border px-3 py-2 text-sm outline-none"
            style={{ borderColor: "rgba(42,64,49,0.15)", color: "#2a4031", background: "white" }}
          />
          <button
            type="button"
            onClick={addCustom}
            disabled={!customLabel.trim()}
            className="rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50"
            style={{ background: "#c9a84c", color: "#2a4031" }}
          >
            Add
          </button>
        </div>
      </div>

      {services.length > 0 && (
        <div>
          <div className="text-xs font-medium mb-2" style={{ color: "rgba(42,64,49,0.7)" }}>
            Your services
          </div>
          <ul className="space-y-1">
            {services.map((s, i) => (
              <li
                key={`${s.label}-${i}`}
                className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: "rgba(42,64,49,0.1)", background: "white" }}
              >
                <span style={{ color: "#2a4031" }}>{s.label}</span>
                <span className="flex items-center gap-3">
                  <span style={{ color: "rgba(42,64,49,0.6)" }}>
                    ${(s.priceCents / 100).toFixed(2)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAt(i)}
                    className="text-xs underline"
                    style={{ color: "rgba(42,64,49,0.5)" }}
                  >
                    Remove
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Step3({
  services,
  existingClients,
  clientMode,
  setClientMode,
  existingClientId,
  setExistingClientId,
  newClientName,
  setNewClientName,
  newClientEmail,
  setNewClientEmail,
  lineDesc,
  setLineDesc,
  lineQty,
  setLineQty,
  linePriceCents,
  setLinePriceCents,
  companyName,
  companyPhone,
  companyEmail,
  clientName,
}: {
  services: InvoiceServicePreset[];
  existingClients: Array<{ id: string; display_name: string }>;
  clientMode: "existing" | "new";
  setClientMode: (v: "existing" | "new") => void;
  existingClientId: string;
  setExistingClientId: (v: string) => void;
  newClientName: string;
  setNewClientName: (v: string) => void;
  newClientEmail: string;
  setNewClientEmail: (v: string) => void;
  lineDesc: string;
  setLineDesc: (v: string) => void;
  lineQty: number;
  setLineQty: (v: number) => void;
  linePriceCents: number;
  setLinePriceCents: (v: number) => void;
  companyName: string;
  companyPhone: string;
  companyEmail: string;
  clientName: string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-[1fr_280px]">
      <div className="space-y-3">
        <div>
          <div className="text-xs font-medium mb-1.5" style={{ color: "rgba(42,64,49,0.7)" }}>
            Bill to
          </div>
          {existingClients.length > 0 && (
            <div className="flex gap-2 mb-2 text-sm">
              <button
                type="button"
                onClick={() => setClientMode("existing")}
                className="rounded-lg border px-3 py-1.5"
                style={{
                  borderColor: clientMode === "existing" ? "#c9a84c" : "rgba(42,64,49,0.15)",
                  background: clientMode === "existing" ? "rgba(201,168,76,0.08)" : "white",
                  color: "#2a4031",
                }}
              >
                Existing client
              </button>
              <button
                type="button"
                onClick={() => setClientMode("new")}
                className="rounded-lg border px-3 py-1.5"
                style={{
                  borderColor: clientMode === "new" ? "#c9a84c" : "rgba(42,64,49,0.15)",
                  background: clientMode === "new" ? "rgba(201,168,76,0.08)" : "white",
                  color: "#2a4031",
                }}
              >
                New client
              </button>
            </div>
          )}
          {clientMode === "existing" && existingClients.length > 0 ? (
            <select
              value={existingClientId}
              onChange={(e) => setExistingClientId(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
              style={{ borderColor: "rgba(42,64,49,0.15)", color: "#2a4031", background: "white" }}
            >
              {existingClients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.display_name}
                </option>
              ))}
            </select>
          ) : (
            <div className="space-y-2">
              <input
                type="text"
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                placeholder="Client name"
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                style={{ borderColor: "rgba(42,64,49,0.15)", color: "#2a4031", background: "white" }}
              />
              <input
                type="email"
                value={newClientEmail}
                onChange={(e) => setNewClientEmail(e.target.value)}
                placeholder="Email (optional)"
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                style={{ borderColor: "rgba(42,64,49,0.15)", color: "#2a4031", background: "white" }}
              />
            </div>
          )}
        </div>
        <div>
          <div className="text-xs font-medium mb-1.5" style={{ color: "rgba(42,64,49,0.7)" }}>
            Line item
          </div>
          {services.length > 0 && (
            <select
              value={lineDesc}
              onChange={(e) => {
                setLineDesc(e.target.value);
                const svc = services.find((s) => s.label === e.target.value);
                if (svc) setLinePriceCents(svc.priceCents);
              }}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none mb-2"
              style={{ borderColor: "rgba(42,64,49,0.15)", color: "#2a4031", background: "white" }}
            >
              <option value="">Pick a service…</option>
              {services.map((s, i) => (
                <option key={i} value={s.label}>
                  {s.label} — ${(s.priceCents / 100).toFixed(2)}
                </option>
              ))}
            </select>
          )}
          <div className="grid grid-cols-[1fr_80px_100px] gap-2">
            <input
              type="text"
              value={lineDesc}
              onChange={(e) => setLineDesc(e.target.value)}
              placeholder="Description"
              className="rounded-lg border px-3 py-2 text-sm outline-none"
              style={{ borderColor: "rgba(42,64,49,0.15)", color: "#2a4031", background: "white" }}
            />
            <input
              type="number"
              min="1"
              value={lineQty}
              onChange={(e) => setLineQty(Math.max(1, Number(e.target.value) || 1))}
              className="rounded-lg border px-3 py-2 text-sm outline-none"
              style={{ borderColor: "rgba(42,64,49,0.15)", color: "#2a4031", background: "white" }}
            />
            <input
              type="number"
              step="0.01"
              min="0"
              value={(linePriceCents / 100).toFixed(2)}
              onChange={(e) =>
                setLinePriceCents(Math.max(0, Math.round(parseFloat(e.target.value || "0") * 100)))
              }
              className="rounded-lg border px-3 py-2 text-sm outline-none"
              style={{ borderColor: "rgba(42,64,49,0.15)", color: "#2a4031", background: "white" }}
            />
          </div>
        </div>
      </div>
      <div>
        <div className="text-xs mb-1.5" style={{ color: "rgba(42,64,49,0.6)" }}>
          Live preview
        </div>
        <WizardInvoicePreview
          companyName={companyName}
          companyPhone={companyPhone || null}
          companyEmail={companyEmail || null}
          clientName={clientName}
          invoiceNumber="DRAFT"
          lineItems={
            lineDesc
              ? [
                  {
                    description: lineDesc,
                    quantity: lineQty,
                    unitPriceCents: linePriceCents,
                  },
                ]
              : []
          }
        />
      </div>
    </div>
  );
}

function Step4({
  companyName,
  invoiceId,
  totalCents,
}: {
  companyName: string;
  invoiceId: string | null;
  totalCents: number;
}) {
  return (
    <div className="space-y-4 text-center">
      <div
        className="mx-auto inline-flex items-center justify-center rounded-full"
        style={{
          width: 64,
          height: 64,
          background: "rgba(163,184,143,0.3)",
          animation: "bppop 300ms cubic-bezier(.34,1.56,.64,1)",
        }}
      >
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2a4031" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <h3 className="font-serif text-xl font-semibold" style={{ color: "#2a4031" }}>
        {companyName.trim() || "Your business"} is set up!
      </h3>
      <div className="text-sm" style={{ color: "rgba(42,64,49,0.7)" }}>
        You&apos;ve invoiced{" "}
        <strong style={{ color: "#2a4031" }}>
          ${(totalCents / 100).toFixed(2)}
        </strong>
        . As you log records in BarnBook, services can flow into your
        financials automatically.
      </div>
      {invoiceId && (
        <Link
          href={`/business-pro/invoicing/${invoiceId}`}
          className="inline-block text-sm underline"
          style={{ color: "#c9a84c" }}
        >
          View the invoice you just created →
        </Link>
      )}
      <div>
        <Link
          href="/business-pro/invoicing/new"
          className="text-sm underline"
          style={{ color: "rgba(42,64,49,0.6)" }}
        >
          Or create another invoice
        </Link>
      </div>
      <style jsx>{`
        @keyframes bppop {
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
