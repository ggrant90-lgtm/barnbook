"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createBarnLogAction,
  updateBarnLogAction,
  deleteBarnLogAction,
  type BarnLogInput,
} from "@/app/(protected)/actions/barn-logs";
import { BARN_LOG_CATEGORIES } from "@/lib/business-pro-constants";
import { FinancialsSection } from "@/components/business-pro/FinancialsSection";
import { ReceiptBlock } from "@/components/barn-logs/ReceiptBlock";
import { ErrorDetails } from "@/components/ui/ErrorDetails";

/**
 * Shared barn-log form — used for both create and edit. Degrades
 * gracefully: non-BP users see a minimal form (date, category,
 * description, notes, vendor, cost). BP users also see the full
 * FinancialsSection so the same entry can be tracked as revenue,
 * expense, or pass-through with billable-to + payment status.
 *
 * Zero-cost entries are fine — the form does NOT require a cost.
 * This is the main distinction from BP's ExpenseForm, which
 * validates `amount > 0`.
 */

interface BarnMember {
  id: string;
  name: string;
  role: string;
}

interface BarnClient {
  id: string;
  display_name: string;
  user_id: string | null;
  name_key: string;
}

export interface BarnLogInitial {
  id: string;
  performed_at: string;
  category: string;
  total_cost: number | null;
  vendor_name: string | null;
  description: string | null;
  notes: string | null;
  cost_type: "expense" | "revenue" | "pass_through" | null;
  billable_to_user_id: string | null;
  billable_to_name: string | null;
  payment_status: "unpaid" | "paid" | "partial" | "waived" | null;
  paid_amount: number | null;
  paid_at: string | null;
  client_id?: string | null;
  /** Pointer to a receipt already attached to this log. Used by BP
   *  users to render the receipt block; non-BP users never see the
   *  image even when this is set. */
  receipt_file_path?: string | null;
  receipt_file_name?: string | null;
  receipt_mime_type?: string | null;
}

export function BarnLogForm({
  barnId,
  barnName,
  hasBusinessPro,
  barnMembers,
  barnClients,
  customCategories,
  initial,
  onClose,
  externalSave,
  externalSavePending,
  externalSaveLabel,
  hideDelete,
}: {
  barnId: string;
  barnName: string;
  hasBusinessPro: boolean;
  barnMembers: BarnMember[];
  barnClients: BarnClient[];
  /** Distinct categories already used on this barn's existing rows —
   *  appended to the preset list so once a user types "Trailer repair"
   *  as a custom category, it shows up on future forms. */
  customCategories: string[];
  /** When set with a non-empty `id`, the form renders in edit mode.
   *  When set with an empty `id`, fields are pre-populated but the
   *  save path stays in create-mode — used by the receipt scan flow. */
  initial?: BarnLogInitial;
  onClose: () => void;
  /** Override the default submit path (createBarnLogAction / update).
   *  When provided, submitting calls this with the current field values
   *  wrapped as a BarnLogInitial. Used by ReceiptScanModal so the
   *  scan flow can create the row AND upload+attach the receipt in
   *  one operation. */
  externalSave?: (prefill: BarnLogInitial) => void;
  /** Disable the submit button when the parent is mid-save. */
  externalSavePending?: boolean;
  /** Label override for the submit button (e.g. "Save receipt"). */
  externalSaveLabel?: string;
  /** Hide the delete button even in edit mode — used by the scan
   *  flow where delete doesn't apply (no row exists yet). */
  hideDelete?: boolean;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  // True only when `initial` represents a real existing row. Empty-id
  // initials are pre-populated create flows (receipt scan).
  const isEdit = !!initial && !!initial.id;

  const [date, setDate] = useState<string>(
    initial?.performed_at
      ? initial.performed_at.slice(0, 10)
      : new Date().toISOString().slice(0, 10),
  );
  const [category, setCategory] = useState<string>(initial?.category ?? "Cleaning");
  const [customCategoryMode, setCustomCategoryMode] = useState(
    !!initial?.category &&
      !(BARN_LOG_CATEGORIES as readonly string[]).includes(initial.category) &&
      !customCategories.includes(initial.category),
  );
  const [customCategoryText, setCustomCategoryText] = useState<string>(
    customCategoryMode ? initial!.category : "",
  );
  const [description, setDescription] = useState(initial?.description ?? "");
  const [vendor, setVendor] = useState(initial?.vendor_name ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [cost, setCost] = useState<string>(
    initial?.total_cost != null && initial.total_cost > 0
      ? String(initial.total_cost)
      : "",
  );

  const [pending, startTransition] = useTransition();
  const [deleting, startDeleteTransition] = useTransition();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mergedCategories = [
    ...BARN_LOG_CATEGORIES,
    ...customCategories.filter(
      (c) => !(BARN_LOG_CATEGORIES as readonly string[]).includes(c),
    ),
  ];

  const effectiveCategory = customCategoryMode
    ? customCategoryText.trim()
    : category;

  const costNumber = cost.trim() ? parseFloat(cost.trim()) : 0;
  const showFinancials = hasBusinessPro && costNumber > 0;

  function buildInput(): BarnLogInput {
    // Pull BP fields from the form's FormData — FinancialsSection emits
    // hidden inputs when active. Falls back to plain fields otherwise.
    const fd = formRef.current ? new FormData(formRef.current) : new FormData();
    const costType = (fd.get("cost_type") as string | null) || null;
    const billable_to_user_id = (fd.get("billable_to_user_id") as string | null) || null;
    const billable_to_name = (fd.get("billable_to_name") as string | null) || null;
    const client_id = (fd.get("client_id") as string | null) || null;
    const payment_status = (fd.get("payment_status") as string | null) || null;
    const paidAmountRaw = (fd.get("paid_amount") as string | null) || null;
    const paid_amount =
      paidAmountRaw && !Number.isNaN(parseFloat(paidAmountRaw))
        ? parseFloat(paidAmountRaw)
        : null;
    const paid_at = (fd.get("paid_at") as string | null) || null;

    return {
      barnId,
      performed_at: new Date(`${date}T12:00:00Z`).toISOString(),
      category: effectiveCategory,
      total_cost: costNumber,
      vendor_name: vendor.trim() || null,
      description: description.trim() || null,
      notes: notes.trim() || null,
      cost_type: costType as BarnLogInput["cost_type"],
      billable_to_user_id,
      billable_to_name,
      client_id,
      payment_status: payment_status as BarnLogInput["payment_status"],
      paid_amount,
      paid_at,
    };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!effectiveCategory) {
      setError("Pick a category.");
      return;
    }
    if (!description.trim()) {
      setError("Add a short description.");
      return;
    }

    // Receipt-scan flow hands submit back to the parent so it can
    // orchestrate create + upload + attach. Wrap the current field
    // state as a BarnLogInitial-shaped object so the parent can read
    // whatever the user corrected during review.
    if (externalSave) {
      const input = buildInput();
      externalSave({
        id: initial?.id ?? "",
        performed_at: input.performed_at,
        category: input.category,
        total_cost: input.total_cost ?? null,
        vendor_name: input.vendor_name ?? null,
        description: input.description ?? null,
        notes: input.notes ?? null,
        cost_type: input.cost_type ?? null,
        billable_to_user_id: input.billable_to_user_id ?? null,
        billable_to_name: input.billable_to_name ?? null,
        payment_status: input.payment_status ?? null,
        paid_amount: input.paid_amount ?? null,
        paid_at: input.paid_at ?? null,
        client_id: input.client_id ?? null,
      });
      return;
    }

    startTransition(async () => {
      const input = buildInput();
      const res = isEdit
        ? await updateBarnLogAction(initial!.id, input)
        : await createBarnLogAction(input);
      if (res.error) {
        setError(res.error);
        return;
      }
      onClose();
      router.refresh();
    });
  }

  function handleDelete() {
    if (!isEdit) return;
    setError(null);
    startDeleteTransition(async () => {
      const res = await deleteBarnLogAction(initial!.id);
      if (res.error) {
        setError(res.error);
        return;
      }
      onClose();
      router.refresh();
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        background: "rgba(42,64,49,0.75)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
      className="sm:items-center"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="sm:my-8 sm:rounded-2xl"
        style={{
          background: "white",
          width: "100%",
          maxWidth: 560,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          maxHeight: "100dvh",
        }}
      >
        <div
          style={{
            padding: "14px 16px",
            borderBottom: "1px solid rgba(0,0,0,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div className="font-serif text-lg font-semibold text-barn-dark">
              {externalSave
                ? "Review receipt"
                : isEdit
                  ? "Edit barn log"
                  : "New barn log"}
            </div>
            <div className="text-xs text-barn-dark/55 mt-0.5">{barnName}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-barn-dark/60 hover:bg-parchment"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form
          ref={formRef}
          onSubmit={handleSubmit}
          style={{ flex: 1, overflow: "auto", padding: 16 }}
          className="space-y-3"
        >
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-barn-dark/80">
              Date
            </span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border px-4 py-3 outline-none"
              style={{
                borderColor: "rgba(42,64,49,0.15)",
                color: "#2a4031",
                background: "white",
              }}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-barn-dark/80">
              Category
            </span>
            {customCategoryMode ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customCategoryText}
                  onChange={(e) => setCustomCategoryText(e.target.value)}
                  placeholder="Custom category"
                  className="flex-1 rounded-xl border px-4 py-3 outline-none"
                  style={{ borderColor: "rgba(42,64,49,0.15)" }}
                />
                <button
                  type="button"
                  onClick={() => {
                    setCustomCategoryMode(false);
                    setCustomCategoryText("");
                  }}
                  className="rounded-xl border px-3 py-3 text-xs text-barn-dark/65"
                  style={{ borderColor: "rgba(42,64,49,0.15)" }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <select
                value={category}
                onChange={(e) => {
                  if (e.target.value === "__custom__") {
                    setCustomCategoryMode(true);
                    setCustomCategoryText("");
                  } else {
                    setCategory(e.target.value);
                  }
                }}
                className="w-full rounded-xl border px-4 py-3 outline-none"
                style={{
                  borderColor: "rgba(42,64,49,0.15)",
                  color: "#2a4031",
                  background: "white",
                }}
              >
                {mergedCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option value="__custom__">+ Custom…</option>
              </select>
            )}
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-barn-dark/80">
              Description
            </span>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What happened?"
              className="w-full rounded-xl border px-4 py-3 outline-none"
              style={{
                borderColor: "rgba(42,64,49,0.15)",
                color: "#2a4031",
                background: "white",
              }}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-barn-dark/80">
                Vendor / From (optional)
              </span>
              <input
                type="text"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                placeholder="Hay supplier, etc."
                className="w-full rounded-xl border px-4 py-3 outline-none"
                style={{ borderColor: "rgba(42,64,49,0.15)" }}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-barn-dark/80">
                Cost (optional)
              </span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="$"
                className="w-full rounded-xl border px-4 py-3 outline-none"
                style={{ borderColor: "rgba(42,64,49,0.15)" }}
              />
              <span className="mt-1 block text-[11px] text-barn-dark/55">
                Leave blank for an activity-only log.
              </span>
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-barn-dark/80">
              Notes (optional)
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-xl border px-4 py-3 outline-none"
              style={{
                borderColor: "rgba(42,64,49,0.15)",
                color: "#2a4031",
                background: "white",
              }}
            />
          </label>

          {showFinancials && (
            <FinancialsSection
              logType="barn_log"
              totalCost={costNumber}
              barnMembers={barnMembers}
              clients={barnClients}
              initial={{
                costType: initial?.cost_type ?? null,
                billableToUserId: initial?.billable_to_user_id ?? null,
                billableToName: initial?.billable_to_name ?? null,
                clientId: initial?.client_id ?? null,
                paymentStatus: initial?.payment_status ?? null,
                paidAmount: initial?.paid_amount ?? null,
                paidAt: initial?.paid_at ?? null,
              }}
            />
          )}

          {isEdit && initial?.receipt_file_path && hasBusinessPro && (
            <ReceiptBlock
              barnLogId={initial.id}
              hasBusinessPro={hasBusinessPro}
              fileName={initial.receipt_file_name}
            />
          )}

          {error && (
            <ErrorDetails
              title="Couldn't save"
              message={error}
              extra={{ Barn: barnId, Category: effectiveCategory }}
            />
          )}
        </form>

        <div
          style={{
            padding: "12px 16px",
            borderTop: "1px solid rgba(0,0,0,0.08)",
            display: "flex",
            gap: 8,
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div>
            {isEdit && !hideDelete && !confirmingDelete && (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                disabled={pending || deleting}
                className="text-sm text-red-500/70 hover:text-red-600 disabled:opacity-50"
              >
                Delete
              </button>
            )}
            {isEdit && !hideDelete && confirmingDelete && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-barn-dark/60">Delete this log?</span>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? "Deleting…" : "Yes"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  disabled={deleting}
                  className="rounded-lg border px-3 py-1.5 text-xs text-barn-dark/70"
                  style={{ borderColor: "rgba(42,64,49,0.15)" }}
                >
                  No
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={pending || deleting}
              className="rounded-xl border px-4 py-2 text-sm font-medium text-barn-dark hover:bg-parchment disabled:opacity-50"
              style={{ borderColor: "rgba(42,64,49,0.15)" }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={(e) => handleSubmit(e)}
              disabled={pending || deleting || externalSavePending}
              className="rounded-xl px-5 py-2 text-sm font-semibold shadow disabled:opacity-60"
              style={{ background: "#c9a84c", color: "#2a4031" }}
            >
              {externalSavePending
                ? "Saving…"
                : pending
                  ? "Saving…"
                  : externalSaveLabel
                    ? externalSaveLabel
                    : isEdit
                      ? "Save"
                      : "Add log"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
