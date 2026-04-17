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
  source: "activity" | "health";
  horse_id: string;
  barn_id: string | null;
  performed_at: string | null;
  created_at: string;
  activity_type?: string;
  record_type?: string;
  notes: string | null;
  total_cost: number | null;
  cost_type: "revenue" | "expense" | "pass_through" | null;
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
  return e.activity_type || e.record_type || "other";
}

function getClientKey(e: Entry): string {
  if (e.billable_to_user_id) return `u:${e.billable_to_user_id}`;
  if (e.billable_to_name) return `n:${e.billable_to_name.trim().toLowerCase()}`;
  return "unassigned";
}

function getClientDisplay(
  key: string,
  entry: Entry,
  profileNames: Record<string, string>,
): string {
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

export function ReceivablesClient({
  barns,
  entries,
  horseNames,
  profileNames,
  barnNames,
}: {
  barns: { id: string; name: string }[];
  entries: Entry[];
  horseNames: Record<string, string>;
  profileNames: Record<string, string>;
  barnNames: Record<string, string>;
}) {
  const now = new Date();
  const [, startTransition] = useTransition();

  // Filters
  const [filter, setFilter] = useState<AgingFilter>("all");
  const [selectedBarnIds, setSelectedBarnIds] = useState<string[]>(barns.map((b) => b.id));
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Apply filters to entries
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
        const horse = (horseNames[e.horse_id] ?? "").toLowerCase();
        const type = entryType(e).toLowerCase();
        const notes = (e.notes ?? "").toLowerCase();
        const client = e.billable_to_user_id
          ? (profileNames[e.billable_to_user_id] ?? "").toLowerCase()
          : (e.billable_to_name ?? "").toLowerCase();
        if (
          !horse.includes(s) &&
          !type.includes(s) &&
          !notes.includes(s) &&
          !client.includes(s)
        ) return false;
      }
      return true;
    });
  }, [entries, filter, selectedBarnIds, search, horseNames, profileNames, now]);

  // Summary stats
  const stats = useMemo(() => {
    const totalAR = filteredEntries.reduce(
      (s, e) => s + ((e.total_cost ?? 0) - (e.paid_amount ?? 0)),
      0,
    );
    const days = filteredEntries.map((e) => daysSince(entryDate(e), now));
    const avgDays = days.length > 0
      ? Math.round(days.reduce((s, d) => s + d, 0) / days.length)
      : 0;

    // Biggest client
    const byClient: Record<string, number> = {};
    for (const e of filteredEntries) {
      const key = getClientKey(e);
      byClient[key] = (byClient[key] ?? 0) + ((e.total_cost ?? 0) - (e.paid_amount ?? 0));
    }
    const topEntry = Object.entries(byClient).sort((a, b) => b[1] - a[1])[0];
    const topClientAmount = topEntry?.[1] ?? 0;
    const topClientName = topEntry
      ? getClientDisplay(
          topEntry[0],
          filteredEntries.find((e) => getClientKey(e) === topEntry[0])!,
          profileNames,
        )
      : "—";

    // Aging counts across unfiltered (full list) for tab badges
    const unfilteredByBarn = entries.filter((e) => {
      return e.barn_id && selectedBarnIds.includes(e.barn_id);
    });
    const buckets = { current: 0, aging: 0, overdue: 0 };
    for (const e of unfilteredByBarn) {
      const days = daysSince(entryDate(e), now);
      const b = agingBucket(days);
      if (b !== "all") buckets[b]++;
    }

    return {
      totalAR,
      avgDays,
      entryCount: filteredEntries.length,
      topClientName,
      topClientAmount,
      buckets,
      allCount: unfilteredByBarn.length,
    };
  }, [filteredEntries, entries, selectedBarnIds, profileNames, now]);

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
          name: getClientDisplay(key, e, profileNames),
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
  }, [filteredEntries, profileNames]);

  // Handlers
  const handleMarkPaid = (entryId: string, source: "activity" | "health") => {
    startTransition(async () => {
      await markAsPaidAction(entryId, source);
    });
  };

  const handleWaive = (entryId: string, source: "activity" | "health") => {
    if (!confirm("Waive this charge? This marks it as forgiven / written off.")) return;
    startTransition(async () => {
      await waiveChargeAction(entryId, source);
    });
  };

  const handlePartial = (entryId: string, source: "activity" | "health") => {
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
        await markAsPaidAction(id, source as "activity" | "health");
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
          horseNames[e.horse_id] ?? "",
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
          <StatCard label="Unpaid Entries" value={String(stats.entryCount)} color="var(--bp-ink)" />
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

        {/* ════════ Grouped receivables list ════════ */}
        {groups.length === 0 ? (
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
            {entries.length === 0
              ? "No outstanding balances. You're all caught up!"
              : "No receivables match the current filters."}
          </div>
        ) : (
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
  onMarkPaid: (id: string, source: "activity" | "health") => void;
  onPartial: (id: string, source: "activity" | "health") => void;
  onWaive: (id: string, source: "activity" | "health") => void;
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
                <Link
                  href={`/horses/${e.horse_id}`}
                  style={{
                    color: "var(--bp-ink)",
                    textDecoration: "none",
                    fontWeight: 500,
                    minWidth: 100,
                  }}
                >
                  {horseNames[e.horse_id] ?? "Unknown"}
                </Link>
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
