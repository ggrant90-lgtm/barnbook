"use client";

import { useMemo, useState } from "react";
import {
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHOD_NEEDS_REF,
  type PaymentMethod,
} from "@/lib/business-pro-constants";

export interface ExpenseFormValues {
  barnId: string;
  performed_at: string; // YYYY-MM-DD
  category: string;
  total_cost: number;
  vendor_name: string;
  description: string;
  notes: string;
  payment_method: PaymentMethod | "";
  payment_reference: string;
}

export function ExpenseForm({
  barns,
  customCategories,
  initial,
  submitLabel,
  pending,
  lockBarn,
  onSubmit,
}: {
  barns: { id: string; name: string }[];
  customCategories: string[];
  initial?: Partial<ExpenseFormValues>;
  submitLabel: string;
  pending: boolean;
  lockBarn?: boolean;
  onSubmit: (values: ExpenseFormValues) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);

  const [barnId, setBarnId] = useState(initial?.barnId ?? barns[0]?.id ?? "");
  const [performedAt, setPerformedAt] = useState(
    initial?.performed_at ?? today,
  );
  const [category, setCategory] = useState(initial?.category ?? "Feed");
  const [otherCategory, setOtherCategory] = useState("");
  const [amount, setAmount] = useState<string>(
    initial?.total_cost != null ? String(initial.total_cost) : "",
  );
  const [vendorName, setVendorName] = useState(initial?.vendor_name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">(
    initial?.payment_method ?? "",
  );
  const [paymentReference, setPaymentReference] = useState(
    initial?.payment_reference ?? "",
  );

  const allCategoryOptions = useMemo(() => {
    const preset = EXPENSE_CATEGORIES.filter((c) => c !== "Other");
    const merged = [...preset, ...customCategories];
    return Array.from(new Set(merged));
  }, [customCategories]);

  const isOther = category === "__other__";
  const resolvedCategory = isOther ? otherCategory.trim() : category;

  const needsRef =
    paymentMethod !== "" ? PAYMENT_METHOD_NEEDS_REF[paymentMethod] : false;

  const amountNum = parseFloat(amount);
  const canSubmit =
    !!barnId &&
    !!resolvedCategory &&
    Number.isFinite(amountNum) &&
    amountNum > 0 &&
    !pending;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({
      barnId,
      performed_at: performedAt,
      category: resolvedCategory,
      total_cost: amountNum,
      vendor_name: vendorName.trim(),
      description: description.trim(),
      notes: notes.trim(),
      payment_method: paymentMethod,
      payment_reference: paymentReference.trim(),
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
        {/* Barn */}
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

        {/* Date */}
        <Field label="Date">
          <input
            type="date"
            value={performedAt}
            onChange={(e) => setPerformedAt(e.target.value)}
            className="bp-input w-full"
          />
        </Field>

        {/* Category */}
        <Field label="Category">
          <select
            value={
              isOther || allCategoryOptions.includes(category)
                ? category
                : category
                  ? "__other__"
                  : "Feed"
            }
            onChange={(e) => {
              const v = e.target.value;
              if (v === "__other__") {
                setOtherCategory(category && !allCategoryOptions.includes(category) ? category : "");
                setCategory("__other__");
              } else {
                setCategory(v);
                setOtherCategory("");
              }
            }}
            className="bp-select w-full"
          >
            {allCategoryOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            <option value="__other__">Other…</option>
          </select>
          {isOther && (
            <input
              type="text"
              value={otherCategory}
              onChange={(e) => setOtherCategory(e.target.value)}
              placeholder="Enter category name"
              className="bp-input w-full mt-2"
            />
          )}
        </Field>

        {/* Amount */}
        <Field label="Amount ($)">
          <input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="bp-input w-full"
          />
        </Field>

        {/* Vendor */}
        <Field label="Paid to (vendor)">
          <input
            type="text"
            value={vendorName}
            onChange={(e) => setVendorName(e.target.value)}
            placeholder="e.g. Tractor Supply"
            className="bp-input w-full"
          />
        </Field>

        {/* Payment method */}
        <Field label="Payment method">
          <select
            value={paymentMethod}
            onChange={(e) =>
              setPaymentMethod(e.target.value as PaymentMethod | "")
            }
            className="bp-select w-full"
          >
            <option value="">—</option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABELS[m]}
              </option>
            ))}
          </select>
        </Field>

        {/* Reference (conditional) */}
        {needsRef && (
          <Field
            label={
              paymentMethod === "check"
                ? "Check #"
                : paymentMethod === "card"
                  ? "Card last-4 / ref"
                  : "Reference / trace ID"
            }
            span={2}
          >
            <input
              type="text"
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
              className="bp-input w-full"
            />
          </Field>
        )}

        {/* Description */}
        <Field label="Description" span={2}>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short label, e.g. 'February electric bill'"
            className="bp-input w-full"
          />
        </Field>

        {/* Notes */}
        <Field label="Notes" span={2}>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="bp-input w-full"
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
