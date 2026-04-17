"use client";

import { useState } from "react";

export interface ClientFormValues {
  barnId: string;
  display_name: string;
  email: string;
  phone: string;
  address_line1: string;
  address_line2: string;
  address_city: string;
  address_state: string;
  address_postal: string;
  address_country: string;
  notes: string;
}

export function ClientForm({
  barns,
  initial,
  submitLabel,
  pending,
  lockBarn,
  onSubmit,
}: {
  barns: { id: string; name: string }[];
  initial?: Partial<ClientFormValues>;
  submitLabel: string;
  pending: boolean;
  lockBarn?: boolean;
  onSubmit: (values: ClientFormValues) => void;
}) {
  const [barnId, setBarnId] = useState(initial?.barnId ?? barns[0]?.id ?? "");
  const [displayName, setDisplayName] = useState(initial?.display_name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [line1, setLine1] = useState(initial?.address_line1 ?? "");
  const [line2, setLine2] = useState(initial?.address_line2 ?? "");
  const [city, setCity] = useState(initial?.address_city ?? "");
  const [state, setState] = useState(initial?.address_state ?? "");
  const [postal, setPostal] = useState(initial?.address_postal ?? "");
  const [country, setCountry] = useState(initial?.address_country ?? "US");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [addressOpen, setAddressOpen] = useState(
    !!(initial?.address_line1 || initial?.address_city),
  );

  const canSubmit = !!barnId && !!displayName.trim() && !pending;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({
      barnId,
      display_name: displayName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      address_line1: line1.trim(),
      address_line2: line2.trim(),
      address_city: city.trim(),
      address_state: state.trim(),
      address_postal: postal.trim(),
      address_country: country.trim() || "US",
      notes: notes.trim(),
    });
  };

  return (
    <div
      style={{
        background: "white",
        borderRadius: 16,
        border: "1px solid rgba(0,0,0,0.08)",
        padding: 24,
        maxWidth: 720,
      }}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Barn">
          <select
            value={barnId}
            onChange={(e) => setBarnId(e.target.value)}
            className="bp-select w-full"
            disabled={!!lockBarn}
          >
            {barns.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Display name" span={1}>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Sam Huston"
            className="bp-input w-full"
          />
        </Field>

        <Field label="Email">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="sam@example.com"
            className="bp-input w-full"
          />
        </Field>

        <Field label="Phone">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(555) 555-5555"
            className="bp-input w-full"
          />
        </Field>

        <div style={{ gridColumn: "1 / -1" }}>
          <button
            type="button"
            onClick={() => setAddressOpen((v) => !v)}
            className="text-sm text-barn-dark/70 hover:text-barn-dark"
          >
            {addressOpen ? "▾" : "▸"} Billing address
          </button>
        </div>

        {addressOpen && (
          <>
            <Field label="Address line 1" span={2}>
              <input
                type="text"
                value={line1}
                onChange={(e) => setLine1(e.target.value)}
                className="bp-input w-full"
              />
            </Field>
            <Field label="Address line 2" span={2}>
              <input
                type="text"
                value={line2}
                onChange={(e) => setLine2(e.target.value)}
                className="bp-input w-full"
              />
            </Field>
            <Field label="City">
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="bp-input w-full"
              />
            </Field>
            <Field label="State / Region">
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="bp-input w-full"
              />
            </Field>
            <Field label="Postal code">
              <input
                type="text"
                value={postal}
                onChange={(e) => setPostal(e.target.value)}
                className="bp-input w-full"
              />
            </Field>
            <Field label="Country">
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="bp-input w-full"
              />
            </Field>
          </>
        )}

        <Field label="Notes" span={2}>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="bp-input w-full"
            placeholder="Private notes — billing quirks, preferences, etc."
          />
        </Field>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 8,
          marginTop: 24,
        }}
      >
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="rounded-lg bg-brass-gold px-4 py-2 text-sm font-semibold text-barn-dark hover:brightness-110 disabled:opacity-40"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  span,
}: {
  label: string;
  children: React.ReactNode;
  span?: 1 | 2;
}) {
  return (
    <div
      style={{
        gridColumn: span === 2 ? "1 / -1" : undefined,
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <label className="text-xs font-medium uppercase tracking-wide text-barn-dark/60">
        {label}
      </label>
      {children}
    </div>
  );
}
