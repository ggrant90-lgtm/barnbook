"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { BusinessProChrome } from "@/components/business-pro/BusinessProChrome";
import { formatCurrency } from "@/lib/currency";
import { AR_AGING_DAYS } from "@/lib/business-pro-constants";
import {
  markAsPaidAction,
  logPartialPaymentAction,
  waiveChargeAction,
} from "@/app/(protected)/actions/business-pro";

export interface Entry {
  id: string;
  source: "activity" | "health" | "barn_expense";
  /** Present on horse-sourced rows; undefined for barn_expense. */
  horse_id?: string;
  barn_id: string | null;
  performed_at: string | null;
  created_at: string;
  activity_type?: string;
  record_type?: string;
  /** barn_expense rows only: the selected category. */
  category?: string;
  /** barn_expense rows: supplier / counterparty. */
  vendor_name?: string | null;
  /** barn_expense rows: short description/title. */
  description?: string | null;
  notes: string | null;
  total_cost: number | null;
  cost_type: "revenue" | "expense" | "pass_through" | null;
  client_id: string | null;
  billable_to_user_id: string | null;
  billable_to_name: string | null;
  payment_status: "unpaid" | "paid" | "partial" | "waived" | null;
  paid_amount: number | null;
  paid_at: string | null;
}

type AgingFilter = "all" | "current" | "aging" | "overdue";

const breadcrumb = [
  { label: "Business Pro", href: "/business-pro" },
  { label: "Receivables" },
];

function entryDate(e: Entry): Date {
  return new Date(e.performed_at || e.created_at);
}

function entryType(e: Entry): string {
  return e.activity_type || e.record_type || e.category || "other";
}

/** Label for the "horse" column — barn_expense rows don't have a
 *  horse, so we show the vendor/description or fall back to the
 *  category. Horse rows still use horseNames[e.horse_id]. */
function entryCounterpartyLabel(
  e: Entry,
  horseNames: Record<string, string>,
): string {
  if (e.source === "barn_expense") {
    return (
      e.description?.trim() ||
      e.vendor_name?.trim() ||
      e.category ||
      "Barn expense"
    );
  }
  return (e.horse_id && horseNames[e.horse_id]) || "Unknown";
}

function getClientKey(e: {
  client_id?: string | null;
  billable_to_user_id?: string | null;
  billable_to_name?: string | null;
}): string {
  if (e.client_id) return `c:${e.client_id}`;
  if (e.billable_to_user_id) return `u:${e.billable_to_user_id}`;
  if (e.billable_to_name) return `n:${e.billable_to_name.trim().toLowerCase()}`;
  return "unassigned";
}

function getClientDisplay(
  key: string,
  entry: { billable_to_name?: string | null },
  profileNames: Record<string, string>,
  clientNames: Record<string, string>,
): string {
  if (key.startsWith("c:")) {
    const id = key.slice(2);
    return clientNames[id] ?? entry.billable_to_name ?? "Client";
  }
  if (key.startsWith("u:")) {
    const id = key.slice(2);
    return profileNames[id] ?? entry.billable_to_name ?? "Member";
  }
  if (key.startsWith("n:")) {
    return entry.billable_to_name ?? "Unknown";
  }
  return "Unassigned";
}

function daysSince(d: Date, now: Date): number {
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function agingColor(days: number): string {
  if (days >= AR_AGING_DAYS.aging) return "#ef4444";
  if (days >= AR_AGING_DAYS.current) return "#f59e0b";
  return "#22c55e";
}

function agingLabel(days: number): string {
  if (days >= AR_AGING_DAYS.aging) return "60+ days";
  if (days >= AR_AGING_DAYS.current) return "30-60 days";
  return "Current";
}

function agingBucket(days: number): AgingFilter {
  if (days >= AR_AGING_DAYS.aging) return "overdue";
  if (days >= AR_AGING_DAYS.current) return "aging";
  return "current";
}

interface UnpaidInvoice {
  id: string;
  barn_id: string;
  invoice_number: string;
  client_id: string | null;
  billable_to_user_id: string | null;
  billable_to_name: string | null;
  issue_date: string;
  due_date: string | null;
  status: string;
  display_status: string;
  subtotal: number;
  paid_amount: number;
  created_at: string;
}

export function ReceivablesClient({
  barns,
  entries,
  horseNames,
  profileNames,
  clientNames,
  barnNames,
  invoices,
}: {
  barns: { id: string; name: string }[];
  entries: Entry[];
  horseNames: Record<string, string>;
  profileNames: Record<string, string>;
  clientNames: Record<string, string>;
  barnNames: Record<string, string>;
  invoices: UnpaidInvoice[];
}) {
  const now = new Date();
  const [, startTransition] = useTransition();

  // Filters
  const [filter, setFilter] = useState<AgingFilter>("all");
  const [selectedBarnIds, setSelectedBarnIds] = useState<string[]>(barns.map((b) => b.id));
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Apply filters to entries
  // Filter invoices by selected barns + search (filter tab is applied
  // for loose entries only — invoices use their own due-date aging)
  const filteredInvoices = useMemo(() => {
    const barnSet = new Set(selectedBarnIds);
    const s = search.trim().toLowerCase();
    return invoices.filter((inv) => {
      if (!barnSet.has(inv.barn_id)) return false;
      if (filter === "current" || filter === "aging" || filter === "overdue") {
        const issue = new Date(inv.issue_date);
        const days = daysSince(issue, now);
        if (agingBucket(days) !== filter) return false;
      }
      if (s) {
        const clientStr = (
          (inv.client_id ? clientNames[inv.client_id] : null) ??
          (inv.billable_to_user_id ? profileNames[inv.billable_to_user_id] : null) ??
          inv.billable_to_name ??
          ""
        ).toLowerCase();
        const num = inv.invoice_number.toLowerCase();
        if (!clientStr.includes(s) && !num.includes(s)) return false;
      }
      return true;
    });
  }, [invoices, selectedBarnIds, search, filter, profileNames, clientNames, now]);

  const filteredEntries = useMemo(() => {
    const barnSet = new Set(selectedBarnIds);
    const s = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (!e.barn_id || !barnSet.has(e.barn_id)) return false;
      if (filter !== "all") {
        const days = daysSince(entryDate(e), now);
        if (agingBucket(days) !== filter) return false;
      }
      if (s) {
        const horse = entryCounterpartyLabel(e, horseNames).toLowerCase();
        const type = entryType(e).toLowerCase();
        const notes = (e.notes ?? "").toLowerCase();
        const clientStr = (
          (e.client_id ? clientNames[e.client_id] : null) ??
          (e.billable_to_user_id ? profileNames[e.billable_to_user_id] : null) ??
          e.billable_to_name ??
          ""
        ).toLowerCase();
        if (
          !horse.includes(s) &&
          !type.includes(s) &&
          !notes.includes(s) &&
          !clientStr.includes(s)
        ) return false;
      }
      return true;
    });
  }, [entries, filter, selectedBarnIds, search, horseNames, profileNames, clientNames, now]);

  // Summary stats (combine loose entries + invoices)
  const stats = useMemo(() => {
    const entriesAR = filteredEntries.reduce(
      (s, e) => s + ((e.total_cost ?? 0) - (e.paid_amount ?? 0)),
      0,
    );
    const invoicesAR = filteredInvoices.reduce(
      (s, inv) => s + (inv.subtotal ?? 0) - (inv.paid_amount ?? 0),
      0,
    );
    const totalAR = entriesAR + invoicesAR;

    const entryDays = filteredEntries.map((e) => daysSince(entryDate(e), now));
    const invDays = filteredInvoices.map((inv) => daysSince(new Date(inv.issue_date), now));
    const allDays = [...entryDays, ...invDays];
    const avgDays = allDays.length > 0
      ? Math.round(allDays.reduce((s, d) => s + d, 0) / allDays.length)
      : 0;

    // Biggest client (across entries + invoices)
    const byClient: Record<string, number> = {};
    for (const e of filteredEntries) {
      const key = getClientKey(e);
      byClient[key] = (byClient[key] ?? 0) + ((e.total_cost ?? 0) - (e.paid_amount ?? 0));
    }
    for (const inv of filteredInvoices) {
      const key = getClientKey(inv);
      byClient[key] = (byClient[key] ?? 0) + ((inv.subtotal ?? 0) - (inv.paid_amount ?? 0));
    }
    const topEntry = Object.entries(byClient).sort((a, b) => b[1] - a[1])[0];
    const topClientAmount = topEntry?.[1] ?? 0;
    const getName = (key: string) => {
      const entry = filteredEntries.find((e) => getClientKey(e) === key);
      if (entry) return getClientDisplay(key, entry, profileNames, clientNames);
      const inv = filteredInvoices.find((i) => getClientKey(i) === key);
      if (inv) return getClientDisplay(key, inv, profileNames, clientNames);
      return "—";
    };
    const topClientName = topEntry ? getName(topEntry[0]) : "—";

    // Aging counts across unfiltered (full list) for tab badges
    const unfilteredEntries = entries.filter(
      (e) => e.barn_id && selectedBarnIds.includes(e.barn_id),
    );
    const unfilteredInvoices = invoices.filter((inv) =>
      selectedBarnIds.includes(inv.barn_id),
    );
    const buckets = { current: 0, aging: 0, overdue: 0 };
    for (const e of unfilteredEntries) {
      const days = daysSince(entryDate(e), now);
      const b = agingBucket(days);
      if (b !== "all") buckets[b]++;
    }
    for (const inv of unfilteredInvoices) {
      const days = daysSince(new Date(inv.issue_date), now);
      const b = agingBucket(days);
      if (b !== "all") buckets[b]++;
    }

    return {
      totalAR,
      avgDays,
      entryCount: filteredEntries.length + filteredInvoices.length,
      topClientName,
      topClientAmount,
      buckets,
      allCount: unfilteredEntries.length + unfilteredInvoices.length,
    };
  }, [filteredEntries, filteredInvoices, entries, invoices, selectedBarnIds, profileNames, clientNames, now]);

  // Group filtered entries by client
  const groups = useMemo(() => {
    const groupMap: Record<
      string,
      {
        clientKey: string;
        name: string;
        entries: Entry[];
        outstanding: number;
        oldestDate: Date;
      }
    > = {};
    for (const e of filteredEntries) {
      const key = getClientKey(e);
      if (!groupMap[key]) {
        groupMap[key] = {
          clientKey: key,
          name: getClientDisplay(key, e, profileNames, clientNames),
          entries: [],
          outstanding: 0,
          oldestDate: entryDate(e),
        };
      }
      groupMap[key].entries.push(e);
      groupMap[key].outstanding += (e.total_cost ?? 0) - (e.paid_amount ?? 0);
      const d = entryDate(e);
      if (d < groupMap[key].oldestDate) groupMap[key].oldestDate = d;
    }
    return Object.values(groupMap).sort((a, b) => b.outstanding - a.outstanding);
  }, [filteredEntries, profileNames, clientNames]);

  // Handlers
  const handleMarkPaid = (entryId: string, source: "activity" | "health" | "barn_expense") => {
    startTransition(async () => {
      await markAsPaidAction(entryId, source);
    });
  };

  const handleWaive = (entryId: string, source: "activity" | "health" | "barn_expense") => {
    if (!confirm("Waive this charge? This marks it as forgiven / written off.")) return;
    startTransition(async () => {
      await waiveChargeAction(entryId, source);
    });
  };

  const handlePartial = (entryId: string, source: "activity" | "health" | "barn_expense") => {
    const amtStr = prompt("Amount received:");
    if (!amtStr) return;
    const amt = parseFloat(amtStr);
    if (!(amt > 0)) return;
    const today = new Date().toISOString().slice(0, 10);
    const dateStr = prompt("Date received (YYYY-MM-DD):", today) ?? today;
    startTransition(async () => {
      await logPartialPaymentAction(entryId, source, amt, dateStr);
    });
  };

  const handleBulkMarkPaid = () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Mark ${selectedIds.size} entries as paid?`)) return;
    startTransition(async () => {
      for (const compoundId of selectedIds) {
        const [source, id] = compoundId.split(":");
        await markAsPaidAction(id, source as "activity" | "health" | "barn_expense");
      }
      setSelectedIds(new Set());
    });
  };

  const toggleSelect = (compoundId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(compoundId)) next.delete(compoundId);
      else next.add(compoundId);
      return next;
    });
  };

  const selectAllVisible = () => {
    const allIds = new Set<string>();
    for (const g of groups) {
      for (const e of g.entries) {
        allIds.add(`${e.source}:${e.id}`);
      }
    }
    if (selectedIds.size === allIds.size) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(allIds);
    }
  };

  const exportCSV = () => {
    const rows: string[][] = [
      ["Client", "Date", "Barn", "Horse", "Type", "Notes", "Total Cost", "Paid", "Outstanding", "Status", "Days Old"],
    ];
    for (const g of groups) {
      for (const e of g.entries) {
        const remaining = (e.total_cost ?? 0) - (e.paid_amount ?? 0);
        const days = daysSince(entryDate(e), now);
        rows.push([
          g.name,
          entryDate(e).toISOString().slice(0, 10),
          barnNames[e.barn_id ?? ""] ?? "",
          entryCounterpartyLabel(e, horseNames),
          entryType(e).replace(/_/g, " "),
          (e.notes ?? "").replace(/\n/g, " ").replace(/,/g, ";"),
          (e.total_cost ?? 0).toFixed(2),
          (e.paid_amount ?? 0).toFixed(2),
          remaining.toFixed(2),
          e.payment_status ?? "",
          String(days),
        ]);
      }
    }
    const csv = rows
      .map((r) => r.map((c) => (c.includes(",") ? `"${c}"` : c)).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `receivables-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <BusinessProChrome breadcrumb={breadcrumb}>
      <div className="bp-page-header">
        <h1 className="bp-display" style={{ fontSize: 32 }}>
          Receivables
        </h1>
        <p style={{ color: "var(--bp-ink-secondary)", fontSize: 13, marginTop: 6 }}>
          All outstanding balances across your barns.
        </p>
      </div>

      <div style={{ padding: "0 32px 48px", maxWidth: 1200 }}>
        {/* ════════ Summary stats ════════ */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 12,
            marginBottom: 24,
          }}
        >
          <StatCard label="Total Outstanding" value={formatCurrency(stats.totalAR)} color="#c9a84c" />
          <StatCard label="Unpaid Items" value={String(stats.entryCount)} color="var(--bp-ink)" />
          <StatCard label="Avg Days Outstanding" value={`${stats.avgDays}d`} color="var(--bp-ink)" />
          <StatCard label="Top Client" value={stats.topClientName} subtitle={formatCurrency(stats.topClientAmount)} color="#8b4a2b" />
        </div>

        {/* ════════ Filter bar ════════ */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          {/* Aging tabs */}
          <div style={{ display: "flex", gap: 4, background: "var(--bp-bg)", padding: 4, borderRadius: 8 }}>
            {([
              { id: "all", label: `All (${stats.allCount})` },
              { id: "current", label: `Current (${stats.buckets.current})`, color: "#22c55e" },
              { id: "aging", label: `30-60d (${stats.buckets.aging})`, color: "#f59e0b" },
              { id: "overdue", label: `60+ (${stats.buckets.overdue})`, color: "#ef4444" },
            ] as const).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                style={{
                  background: filter === tab.id ? "var(--bp-bg-elevated)" : "transparent",
                  border: filter === tab.id ? "1px solid var(--bp-border)" : "1px solid transparent",
                  borderRadius: 6,
                  padding: "6px 12px",
                  fontSize: 12,
                  fontWeight: filter === tab.id ? 500 : 400,
                  color: tab.id !== "all" && "color" in tab ? tab.color : "var(--bp-ink)",
                  cursor: "pointer",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search client, horse, notes..."
            className="bp-input"
            style={{ flex: 1, minWidth: 200, maxWidth: 320, fontSize: 12 }}
          />

          {/* Export */}
          <button
            type="button"
            onClick={exportCSV}
            className="bp-btn"
            style={{ fontSize: 12 }}
          >
            Export CSV
          </button>
        </div>

        {/* Barn filter (if multiple barns) */}
        {barns.length > 1 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
            {barns.map((b) => {
              const isSelected = selectedBarnIds.includes(b.id);
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => {
                    setSelectedBarnIds((prev) =>
                      isSelected ? prev.filter((id) => id !== b.id) : [...prev, b.id],
                    );
                  }}
                  className={`bp-chip ${isSelected ? "bp-active" : ""}`}
                  style={{ fontSize: 11 }}
                >
                  {b.name}
                </button>
              );
            })}
          </div>
        )}

        {/* Bulk actions bar */}
        {selectedIds.size > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "#fef3c7",
              border: "1px solid #f59e0b",
              borderRadius: 8,
              padding: "10px 14px",
              marginBottom: 16,
            }}
          >
            <span style={{ fontSize: 13, color: "#92400e" }}>
              {selectedIds.size} {selectedIds.size === 1 ? "entry" : "entries"} selected
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="bp-btn"
                style={{ fontSize: 11 }}
              >
                Clear
              </button>
              <button
                type="button"
                onClick={handleBulkMarkPaid}
                className="bp-btn bp-primary"
                style={{ fontSize: 11 }}
              >
                Mark All Paid
              </button>
            </div>
          </div>
        )}

        {/* ════════ Unpaid Invoices ════════ */}
        {filteredInvoices.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--bp-ink-tertiary)", marginBottom: 8 }}>
              Unpaid Invoices ({filteredInvoices.length})
            </div>
            <div style={{ background: "var(--bp-bg-elevated)", border: "1px solid var(--bp-border)", borderRadius: 8, overflow: "hidden" }}>
              {filteredInvoices
                .slice()
                .sort((a, b) => new Date(a.issue_date).getTime() - new Date(b.issue_date).getTime())
                .map((inv, i, arr) => {
                  const remaining = (inv.subtotal ?? 0) - (inv.paid_amount ?? 0);
                  const days = daysSince(new Date(inv.issue_date), now);
                  const color = agingColor(days);
                  const clientName = inv.billable_to_user_id
                    ? profileNames[inv.billable_to_user_id] ?? inv.billable_to_name ?? "Member"
                    : inv.billable_to_name ?? "Unassigned";
                  const statusBg = inv.display_status === "overdue" ? "#fee2e2"
                    : inv.display_status === "partial" ? "#fef3c7"
                    : "#dbeafe";
                  const statusFg = inv.display_status === "overdue" ? "#991b1b"
                    : inv.display_status === "partial" ? "#92400e"
                    : "#1e40af";
                  return (
                    <a
                      key={inv.id}
                      href={`/business-pro/invoicing/${inv.id}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "12px 16px",
                        borderBottom: i < arr.length - 1 ? "1px solid var(--bp-border)" : "none",
                        textDecoration: "none",
                        color: "inherit",
                        fontSize: 13,
                      }}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                      <span className="bp-mono" style={{ fontWeight: 600, minWidth: 120 }}>
                        {inv.invoice_number}
                      </span>
                      <span style={{ flex: 1, fontWeight: 500 }}>{clientName}</span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 500,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          padding: "2px 8px",
                          borderRadius: 4,
                          background: statusBg,
                          color: statusFg,
                        }}
                      >
                        {inv.display_status === "overdue" ? "Overdue" : inv.display_status === "partial" ? "Partial" : "Sent"}
                      </span>
                      <span style={{ fontSize: 11, color: "var(--bp-ink-tertiary)", minWidth: 100, textAlign: "right" }}>
                        {inv.due_date ? `Due ${new Date(inv.due_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : `${days}d old`}
                      </span>
                      <span className="bp-mono" style={{ fontSize: 15, fontWeight: 600, color: "#c9a84c", minWidth: 100, textAlign: "right" }}>
                        {formatCurrency(remaining)}
                      </span>
                      <span style={{ color: "var(--bp-ink-tertiary)", fontSize: 14 }}>→</span>
                    </a>
                  );
                })}
            </div>
          </div>
        )}

        {/* ════════ Uninvoiced Charges (loose entries not yet on an invoice) ════════ */}
        {groups.length > 0 && (
          <div style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--bp-ink-tertiary)", marginBottom: 8 }}>
            Uninvoiced Charges ({groups.length} {groups.length === 1 ? "client" : "clients"})
          </div>
        )}
        {groups.length === 0 && filteredInvoices.length === 0 ? (
          <div
            style={{
              background: "var(--bp-bg-elevated)",
              border: "1px solid var(--bp-border)",
              borderRadius: 8,
              padding: "48px 24px",
              textAlign: "center",
              color: "var(--bp-ink-tertiary)",
              fontSize: 14,
            }}
          >
            {entries.length === 0 && invoices.length === 0
              ? "No outstanding balances. You're all caught up!"
              : "No receivables match the current filters."}
          </div>
        ) : groups.length === 0 ? null : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Header row with select all */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0 4px",
                fontSize: 11,
                color: "var(--bp-ink-tertiary)",
              }}
            >
              <button
                type="button"
                onClick={selectAllVisible}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--bp-accent)",
                  cursor: "pointer",
                  fontSize: 11,
                  fontWeight: 500,
                  textDecoration: "underline",
                }}
              >
                {selectedIds.size > 0 ? "Deselect all" : "Select all visible"}
              </button>
              <span>{groups.length} {groups.length === 1 ? "client" : "clients"}</span>
            </div>

            {groups.map((g) => (
              <ClientGroup
                key={g.clientKey}
                name={g.name}
                outstanding={g.outstanding}
                entries={g.entries}
                now={now}
                horseNames={horseNames}
                barnNames={barnNames}
                selectedIds={selectedIds}
                toggleSelect={toggleSelect}
                onMarkPaid={handleMarkPaid}
                onPartial={handlePartial}
                onWaive={handleWaive}
              />
            ))}
          </div>
        )}
      </div>
    </BusinessProChrome>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  subtitle,
  color,
}: {
  label: string;
  value: string;
  subtitle?: string;
  color: string;
}) {
  return (
    <div
      style={{
        background: "var(--bp-bg-elevated)",
        border: "1px solid var(--bp-border)",
        borderRadius: 8,
        padding: "14px 16px",
      }}
    >
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--bp-ink-tertiary)" }}>
        {label}
      </div>
      <div
        className="bp-mono"
        style={{ fontSize: 22, fontWeight: 600, color, marginTop: 4, lineHeight: 1.1 }}
      >
        {value}
      </div>
      {subtitle && (
        <div style={{ fontSize: 11, color: "var(--bp-ink-tertiary)", marginTop: 2 }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}

function ClientGroup({
  name,
  outstanding,
  entries,
  now,
  horseNames,
  barnNames,
  selectedIds,
  toggleSelect,
  onMarkPaid,
  onPartial,
  onWaive,
}: {
  name: string;
  outstanding: number;
  entries: Entry[];
  now: Date;
  horseNames: Record<string, string>;
  barnNames: Record<string, string>;
  selectedIds: Set<string>;
  toggleSelect: (id: string) => void;
  onMarkPaid: (id: string, source: "activity" | "health" | "barn_expense") => void;
  onPartial: (id: string, source: "activity" | "health" | "barn_expense") => void;
  onWaive: (id: string, source: "activity" | "health" | "barn_expense") => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => entryDate(a).getTime() - entryDate(b).getTime()),
    [entries],
  );
  const oldest = sortedEntries[0];
  const oldestDays = oldest ? daysSince(entryDate(oldest), now) : 0;
  const color = agingColor(oldestDays);

  return (
    <div
      style={{
        background: "var(--bp-bg-elevated)",
        border: "1px solid var(--bp-border)",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 16px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--bp-ink)" }}>{name}</div>
            <div style={{ fontSize: 11, color: "var(--bp-ink-tertiary)", marginTop: 2 }}>
              {entries.length} unpaid {entries.length === 1 ? "entry" : "entries"} · Oldest {oldestDays}d ({agingLabel(oldestDays)})
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            className="bp-mono"
            style={{ fontSize: 18, fontWeight: 600, color: "#c9a84c" }}
          >
            {formatCurrency(outstanding)}
          </div>
          <span style={{ color: "var(--bp-ink-tertiary)", fontSize: 14 }}>
            {expanded ? "▾" : "▸"}
          </span>
        </div>
      </button>

      {expanded && (
        <div style={{ borderTop: "1px solid var(--bp-border)" }}>
          {sortedEntries.map((e) => {
            const remaining = (e.total_cost ?? 0) - (e.paid_amount ?? 0);
            const d = entryDate(e);
            const days = daysSince(d, now);
            const compoundId = `${e.source}:${e.id}`;
            const selected = selectedIds.has(compoundId);

            return (
              <div
                key={compoundId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 16px",
                  borderBottom: "1px solid var(--bp-border)",
                  background: selected ? "var(--bp-bg)" : "transparent",
                  fontSize: 13,
                }}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => toggleSelect(compoundId)}
                  style={{ cursor: "pointer", flexShrink: 0 }}
                />
                <span
                  className="bp-mono"
                  style={{ fontSize: 11, color: "var(--bp-ink-tertiary)", minWidth: 60 }}
                >
                  {d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" })}
                </span>
                <span style={{ fontSize: 10, color: "var(--bp-ink-quaternary)", minWidth: 40 }}>
                  {days}d
                </span>
                {e.source === "barn_expense" ? (
                  <span
                    style={{
                      color: "var(--bp-ink)",
                      fontWeight: 500,
                      minWidth: 100,
                    }}
                  >
                    {entryCounterpartyLabel(e, horseNames)}
                  </span>
                ) : (
                  <Link
                    href={`/horses/${e.horse_id}`}
                    style={{
                      color: "var(--bp-ink)",
                      textDecoration: "none",
                      fontWeight: 500,
                      minWidth: 100,
                    }}
                  >
                    {entryCounterpartyLabel(e, horseNames)}
                  </Link>
                )}
                <span
                  className="bp-mono"
                  style={{
                    fontSize: 9,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "var(--bp-ink-tertiary)",
                    minWidth: 80,
                  }}
                >
                  {entryType(e).replace(/_/g, " ")}
                </span>
                {e.barn_id && (
                  <span style={{ fontSize: 11, color: "var(--bp-ink-tertiary)", minWidth: 80 }}>
                    {barnNames[e.barn_id] ?? ""}
                  </span>
                )}
                <span
                  style={{
                    flex: 1,
                    fontSize: 11,
                    color: "var(--bp-ink-tertiary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    minWidth: 0,
                  }}
                >
                  {e.notes ?? ""}
                </span>
                <span
                  className="bp-mono"
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#c9a84c",
                    minWidth: 80,
                    textAlign: "right",
                  }}
                >
                  {formatCurrency(remaining)}
                </span>
                {e.payment_status === "partial" && (
                  <span
                    style={{
                      fontSize: 9,
                      color: "#f59e0b",
                      fontWeight: 500,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    Partial
                  </span>
                )}
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => onMarkPaid(e.id, e.source)}
                    className="bp-btn bp-primary"
                    style={{ fontSize: 10, padding: "4px 8px" }}
                  >
                    Paid
                  </button>
                  <button
                    type="button"
                    onClick={() => onPartial(e.id, e.source)}
                    className="bp-btn"
                    style={{ fontSize: 10, padding: "4px 8px" }}
                  >
                    Partial
                  </button>
                  <button
                    type="button"
                    onClick={() => onWaive(e.id, e.source)}
                    style={{
                      fontSize: 10,
                      padding: "4px 8px",
                      background: "transparent",
                      border: "none",
                      color: "var(--bp-ink-tertiary)",
                      cursor: "pointer",
                    }}
                  >
                    Waive
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
