"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BarnLogForm, type BarnLogInitial } from "@/components/barn-logs/BarnLogForm";
import { switchBarnAction } from "@/app/(protected)/actions/switch-barn";

/**
 * Client-side renderer for /logs. Shows a compact barn picker (when
 * the user has >1 writable barn), a log list, and mounts
 * `BarnLogForm` for create/edit.
 */

interface LogRow {
  id: string;
  barn_id: string;
  performed_at: string;
  category: string;
  total_cost: number;
  vendor_name: string | null;
  description: string | null;
  notes: string | null;
  cost_type: "expense" | "revenue" | "pass_through" | null;
  billable_to_user_id: string | null;
  billable_to_name: string | null;
  payment_status: "unpaid" | "paid" | "partial" | "waived" | null;
  paid_amount: number | null;
  paid_at: string | null;
  receipt_file_path?: string | null;
  receipt_file_name?: string | null;
  receipt_mime_type?: string | null;
}

export function BarnLogsClient({
  scopedBarn,
  writableBarns,
  logs,
  hasBusinessPro,
  barnMembers,
  barnClients,
  customCategories,
}: {
  scopedBarn: { id: string; name: string };
  writableBarns: Array<{ id: string; name: string }>;
  logs: LogRow[];
  hasBusinessPro: boolean;
  barnMembers: Array<{ id: string; name: string; role: string }>;
  barnClients: Array<{
    id: string;
    display_name: string;
    user_id: string | null;
    name_key: string;
  }>;
  customCategories: string[];
}) {
  const router = useRouter();
  const [switching, startSwitch] = useTransition();
  const [formMode, setFormMode] = useState<
    | { kind: "closed" }
    | { kind: "new" }
    | { kind: "edit"; initial: BarnLogInitial }
  >({ kind: "closed" });

  function handleBarnSwitch(barnId: string) {
    if (barnId === scopedBarn.id) return;
    startSwitch(async () => {
      await switchBarnAction(barnId);
      router.refresh();
    });
  }

  // Split into activity-only (no cost) and financial (cost > 0) so
  // users can scan the two sides of the ledger quickly. Both lists
  // share the same row component.
  const totalCost = logs.reduce((sum, l) => sum + (l.total_cost ?? 0), 0);
  const unpaidCount = logs.filter(
    (l) => l.payment_status === "unpaid" || l.payment_status === "partial",
  ).length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-barn-dark">
            Barn Logs
          </h1>
          <p className="mt-1 text-sm text-barn-dark/60">
            Track the work and expenses that live at the barn — hay
            deliveries, cleaning, maintenance, utilities.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFormMode({ kind: "new" })}
          className="rounded-xl px-4 py-2 text-sm font-semibold shadow"
          style={{ background: "#c9a84c", color: "#2a4031" }}
        >
          + Add log
        </button>
      </div>

      {writableBarns.length > 1 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs text-barn-dark/55">Barn:</span>
          {writableBarns.map((b) => {
            const active = b.id === scopedBarn.id;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => handleBarnSwitch(b.id)}
                disabled={switching || active}
                className="rounded-full border px-3 py-1 text-xs font-medium disabled:opacity-100"
                style={{
                  background: active ? "rgba(201,168,76,0.2)" : "white",
                  borderColor: active ? "#c9a84c" : "rgba(42,64,49,0.15)",
                  color: active ? "#7a5c13" : "#2a4031",
                }}
              >
                {b.name}
              </button>
            );
          })}
        </div>
      )}

      <div
        className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-1 rounded-lg border bg-white px-3 py-2 text-sm"
        style={{ borderColor: "rgba(42,64,49,0.1)" }}
      >
        <InlineStat label="Logs" value={logs.length.toString()} />
        <InlineStat label="Total cost" value={formatCurrency(totalCost)} />
        {hasBusinessPro && (
          <InlineStat label="Unpaid" value={unpaidCount.toString()} />
        )}
      </div>

      {logs.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-barn-dark/10 bg-white p-8 text-center shadow-sm">
          <p className="font-serif text-lg text-barn-dark">No logs yet</p>
          <p className="mt-2 text-sm text-barn-dark/60">
            Record your first barn log — hay delivery, cleaning, repair,
            or anything else that happens at {scopedBarn.name}.
          </p>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-barn-dark/10 rounded-2xl border border-barn-dark/10 bg-white">
          {logs.map((l) => (
            <li key={l.id}>
              <button
                type="button"
                onClick={() =>
                  setFormMode({
                    kind: "edit",
                    initial: {
                      id: l.id,
                      performed_at: l.performed_at,
                      category: l.category,
                      total_cost: l.total_cost,
                      vendor_name: l.vendor_name,
                      description: l.description,
                      notes: l.notes,
                      cost_type: l.cost_type,
                      billable_to_user_id: l.billable_to_user_id,
                      billable_to_name: l.billable_to_name,
                      payment_status: l.payment_status,
                      paid_amount: l.paid_amount,
                      paid_at: l.paid_at,
                      receipt_file_path: l.receipt_file_path ?? null,
                      receipt_file_name: l.receipt_file_name ?? null,
                      receipt_mime_type: l.receipt_mime_type ?? null,
                    },
                  })
                }
                className="w-full text-left px-4 py-3 hover:bg-parchment/60"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                    style={{
                      background: "rgba(42,64,49,0.08)",
                      color: "#2a4031",
                    }}
                  >
                    {l.category}
                  </span>
                  <span className="font-medium text-barn-dark">
                    {l.description ?? "(no description)"}
                  </span>
                  {l.vendor_name && (
                    <span className="text-xs text-barn-dark/55">
                      · {l.vendor_name}
                    </span>
                  )}
                  <span className="ml-auto flex items-center gap-3 text-xs text-barn-dark/55">
                    {l.total_cost > 0 && (
                      <span className="font-semibold text-barn-dark">
                        {formatCurrency(l.total_cost)}
                      </span>
                    )}
                    {hasBusinessPro && l.payment_status && l.total_cost > 0 && (
                      <PaymentBadge status={l.payment_status} />
                    )}
                    <time dateTime={l.performed_at}>
                      {new Date(l.performed_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year:
                          new Date(l.performed_at).getFullYear() !==
                          new Date().getFullYear()
                            ? "numeric"
                            : undefined,
                      })}
                    </time>
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {formMode.kind !== "closed" && (
        <BarnLogForm
          barnId={scopedBarn.id}
          barnName={scopedBarn.name}
          hasBusinessPro={hasBusinessPro}
          barnMembers={barnMembers}
          barnClients={barnClients}
          customCategories={customCategories}
          initial={formMode.kind === "edit" ? formMode.initial : undefined}
          onClose={() => setFormMode({ kind: "closed" })}
        />
      )}
    </div>
  );
}

function InlineStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span
        className="text-[10px] font-semibold uppercase tracking-wide"
        style={{ color: "rgba(42,64,49,0.55)" }}
      >
        {label}
      </span>
      <span className="font-semibold text-barn-dark">{value}</span>
    </div>
  );
}

function PaymentBadge({
  status,
}: {
  status: "unpaid" | "paid" | "partial" | "waived";
}) {
  const map: Record<
    "unpaid" | "paid" | "partial" | "waived",
    { label: string; bg: string; fg: string }
  > = {
    unpaid: { label: "Unpaid", bg: "rgba(184,66,31,0.15)", fg: "#b8421f" },
    paid: { label: "Paid", bg: "rgba(42,64,49,0.1)", fg: "#2a4031" },
    partial: { label: "Partial", bg: "rgba(201,168,76,0.25)", fg: "#7a5c13" },
    waived: { label: "Waived", bg: "rgba(75,100,121,0.15)", fg: "#4b6479" },
  };
  const cfg = map[status];
  return (
    <span
      className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
      style={{ background: cfg.bg, color: cfg.fg }}
    >
      {cfg.label}
    </span>
  );
}

function formatCurrency(n: number): string {
  if (!n || n === 0) return "$0";
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}
