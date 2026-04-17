"use client";

import { useState, useEffect } from "react";
import {
  COST_TYPES,
  COST_TYPE_LABELS,
  COST_TYPE_ICONS,
  COST_TYPE_COLORS,
  PAYMENT_STATUSES,
  PAYMENT_STATUS_LABELS,
  DEFAULT_COST_TYPE,
  type CostType,
  type PaymentStatus,
} from "@/lib/business-pro-constants";

interface BarnMember {
  id: string;
  name: string;
  role: string;
}

interface Initial {
  costType?: CostType | null;
  billableToUserId?: string | null;
  billableToName?: string | null;
  paymentStatus?: PaymentStatus | null;
  paidAmount?: number | null;
  paidAt?: string | null;
}

interface Props {
  logType: string;
  totalCost: number; // for auto-filling paid_amount on "paid"
  barnMembers: BarnMember[];
  horseOwnerName?: string | null; // from horses.owner_name
  initial?: Initial;
}

/**
 * Business Pro financial tracking section — renders below the cost input
 * on log entry forms. Only rendered when the user has has_business_pro.
 *
 * Emits hidden inputs that post with the parent form:
 *   - cost_type
 *   - billable_to_user_id | billable_to_name
 *   - payment_status
 *   - paid_amount
 *   - paid_at
 */
export function FinancialsSection({
  logType,
  totalCost,
  barnMembers,
  horseOwnerName,
  initial,
}: Props) {
  const defaultType = DEFAULT_COST_TYPE[logType] ?? null;

  const [costType, setCostType] = useState<CostType | null>(
    initial?.costType ?? defaultType,
  );

  // Billable To — three modes:
  //   "owner"  — horse's owner_name (auto-filled, one-click)
  //   "member" — pick a barn member (registered user)
  //   "other"  — free-text name
  const hasHorseOwner = !!horseOwnerName?.trim();

  const initBillableMode: "owner" | "member" | "other" = (() => {
    // If the existing entry was billed to the horse owner, restore that mode
    if (
      initial?.billableToName &&
      hasHorseOwner &&
      initial.billableToName.trim().toLowerCase() === horseOwnerName!.trim().toLowerCase()
    ) return "owner";
    if (initial?.billableToUserId) return "member";
    if (initial?.billableToName) return "other";
    // New entry: default to owner if horse has one, else member
    return hasHorseOwner ? "owner" : "member";
  })();

  const [billableMode, setBillableMode] = useState<"owner" | "member" | "other">(initBillableMode);
  const [billableUserId, setBillableUserId] = useState(initial?.billableToUserId ?? "");
  const [billableName, setBillableName] = useState(initial?.billableToName ?? "");

  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(
    initial?.paymentStatus ?? "unpaid",
  );
  const [paidAmount, setPaidAmount] = useState<string>(
    initial?.paidAmount != null ? String(initial.paidAmount) : "",
  );
  const [paidAt, setPaidAt] = useState<string>(
    initial?.paidAt ? initial.paidAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
  );

  // When status flips to "paid", auto-fill paid_amount = total_cost
  useEffect(() => {
    if (paymentStatus === "paid" && totalCost > 0 && !paidAmount) {
      setPaidAmount(String(totalCost));
    }
  }, [paymentStatus, totalCost, paidAmount]);

  const showBillable = costType === "revenue" || costType === "pass_through";
  const showPaidFields = showBillable && (paymentStatus === "paid" || paymentStatus === "partial");

  return (
    <div className="mt-6 rounded-2xl border border-barn-dark/10 bg-parchment/60 p-5">
      <h3 className="mb-3 font-serif text-base font-semibold text-barn-dark">
        Financials
      </h3>

      {/* Cost type toggle */}
      <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-barn-dark/60">
        Transaction Type
      </label>
      <div className="flex flex-wrap gap-2 mb-4">
        {COST_TYPES.map((type) => {
          const isActive = costType === type;
          const color = COST_TYPE_COLORS[type];
          return (
            <button
              key={type}
              type="button"
              onClick={() => setCostType(isActive ? null : type)}
              className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition"
              style={{
                background: isActive ? `${color}15` : "white",
                borderColor: isActive ? color : "rgba(42, 64, 49, 0.15)",
                color: isActive ? color : "var(--barn-dark, #2a4031)",
              }}
            >
              <span>{COST_TYPE_ICONS[type]}</span>
              <span>{COST_TYPE_LABELS[type]}</span>
            </button>
          );
        })}
      </div>

      {/* Billable To — only for revenue/pass_through */}
      {showBillable && (
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-barn-dark/60">
            Billable To
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {hasHorseOwner && (
              <button
                type="button"
                onClick={() => {
                  setBillableMode("owner");
                  setBillableUserId("");
                  setBillableName(horseOwnerName!);
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  billableMode === "owner"
                    ? "bg-brass-gold text-barn-dark"
                    : "bg-white text-barn-dark/60 border border-barn-dark/15"
                }`}
              >
                🐴 Horse Owner
              </button>
            )}
            <button
              type="button"
              onClick={() => setBillableMode("member")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                billableMode === "member"
                  ? "bg-brass-gold text-barn-dark"
                  : "bg-white text-barn-dark/60 border border-barn-dark/15"
              }`}
            >
              Barn Member
            </button>
            <button
              type="button"
              onClick={() => setBillableMode("other")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                billableMode === "other"
                  ? "bg-brass-gold text-barn-dark"
                  : "bg-white text-barn-dark/60 border border-barn-dark/15"
              }`}
            >
              Other
            </button>
          </div>

          {billableMode === "owner" && hasHorseOwner ? (
            <div className="rounded-xl border border-brass-gold/40 bg-brass-gold/10 px-4 py-2.5 text-sm text-barn-dark">
              <div className="flex items-center gap-2">
                <span className="font-medium">{horseOwnerName}</span>
                <span className="text-xs text-barn-dark/50">
                  (from this horse&apos;s owner)
                </span>
              </div>
            </div>
          ) : billableMode === "member" ? (
            <select
              value={billableUserId}
              onChange={(e) => { setBillableUserId(e.target.value); setBillableName(""); }}
              className="w-full rounded-xl border border-barn-dark/15 bg-white px-4 py-2.5 text-sm text-barn-dark"
            >
              <option value="">Select a barn member...</option>
              {barnMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} — {m.role}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={billableName}
              onChange={(e) => { setBillableName(e.target.value); setBillableUserId(""); }}
              placeholder="Client name (e.g., John Smith)"
              className="w-full rounded-xl border border-barn-dark/15 bg-white px-4 py-2.5 text-sm text-barn-dark"
            />
          )}
        </div>
      )}

      {/* Payment status pills */}
      {showBillable && (
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-barn-dark/60">
            Payment Status
          </label>
          <div className="flex flex-wrap gap-2">
            {PAYMENT_STATUSES.map((status) => {
              const isActive = paymentStatus === status;
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => setPaymentStatus(status)}
                  className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
                    isActive
                      ? "bg-barn-dark text-parchment"
                      : "bg-white text-barn-dark/70 border border-barn-dark/15"
                  }`}
                >
                  {PAYMENT_STATUS_LABELS[status]}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Paid amount + date for partial/paid */}
      {showPaidFields && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-barn-dark/60">
              Amount Received
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={paidAmount}
              onChange={(e) => setPaidAmount(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-xl border border-barn-dark/15 bg-white px-4 py-2.5 text-sm text-barn-dark"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-barn-dark/60">
              Date Received
            </label>
            <input
              type="date"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              className="w-full rounded-xl border border-barn-dark/15 bg-white px-4 py-2.5 text-sm text-barn-dark"
            />
          </div>
        </div>
      )}

      {/* Hidden inputs for form submission */}
      {costType && <input type="hidden" name="cost_type" value={costType} />}
      {showBillable && billableMode === "member" && billableUserId && (
        <input type="hidden" name="billable_to_user_id" value={billableUserId} />
      )}
      {showBillable && billableMode === "owner" && horseOwnerName && (
        <input type="hidden" name="billable_to_name" value={horseOwnerName} />
      )}
      {showBillable && billableMode === "other" && billableName.trim() && (
        <input type="hidden" name="billable_to_name" value={billableName.trim()} />
      )}
      {showBillable && (
        <input type="hidden" name="payment_status" value={paymentStatus} />
      )}
      {showPaidFields && paidAmount && (
        <>
          <input type="hidden" name="paid_amount" value={paidAmount} />
          <input type="hidden" name="paid_at" value={paidAt} />
        </>
      )}
    </div>
  );
}
