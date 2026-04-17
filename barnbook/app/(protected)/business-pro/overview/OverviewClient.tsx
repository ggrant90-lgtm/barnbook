"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { BusinessProChrome } from "@/components/business-pro/BusinessProChrome";
import { formatCurrency } from "@/lib/currency";
import {
  COST_TYPE_COLORS,
  COST_TYPE_LABELS,
  COST_TYPE_ICONS,
  PAYMENT_STATUS_LABELS,
  AR_AGING_DAYS,
} from "@/lib/business-pro-constants";
import {
  markAsPaidAction,
  logPartialPaymentAction,
  waiveChargeAction,
} from "@/app/(protected)/actions/business-pro";

const breadcrumb = [
  { label: "Business Pro", href: "/business-pro" },
  { label: "Overview" },
];

export interface FinancialEntry {
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
  invoice_id: string | null;
}

interface Barn {
  id: string;
  name: string;
  barn_type: string | null;
  plan_tier: string | null;
}

function entryDate(e: FinancialEntry): Date {
  return new Date(e.performed_at || e.created_at);
}

function entryType(e: FinancialEntry): string {
  return e.activity_type || e.record_type || "other";
}

function getClientKey(e: FinancialEntry): string {
  if (e.billable_to_user_id) return `u:${e.billable_to_user_id}`;
  if (e.billable_to_name) return `n:${e.billable_to_name.trim().toLowerCase()}`;
  return "unassigned";
}

function getClientDisplay(
  key: string,
  entry: FinancialEntry,
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

interface UnpaidInvoice {
  id: string;
  barn_id: string;
  invoice_number: string;
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

interface LineItemForRevenue {
  id: string;
  amount: number;
  issue_date: string;
  barn_id: string | null;
}

export function OverviewClient({
  barns,
  horseCountByBarn,
  allEntries,
  profileNames,
  horseNames,
  unpaidInvoices,
  lineItemsForRevenue,
}: {
  barns: Barn[];
  horseCountByBarn: Record<string, number>;
  allEntries: FinancialEntry[];
  profileNames: Record<string, string>;
  horseNames: Record<string, string>;
  unpaidInvoices: UnpaidInvoice[];
  lineItemsForRevenue: LineItemForRevenue[];
}) {
  const [selectedBarnIds, setSelectedBarnIds] = useState<string[]>(barns.map((b) => b.id));
  const [, startTransition] = useTransition();

  // Filter by selected barns
  const entries = useMemo(() => {
    const set = new Set(selectedBarnIds);
    return allEntries.filter((e) => e.barn_id && set.has(e.barn_id));
  }, [allEntries, selectedBarnIds]);

  const invoices = useMemo(() => {
    const set = new Set(selectedBarnIds);
    return unpaidInvoices.filter((inv) => set.has(inv.barn_id));
  }, [unpaidInvoices, selectedBarnIds]);

  const lineItems = useMemo(() => {
    const set = new Set(selectedBarnIds);
    return lineItemsForRevenue.filter((li) => li.barn_id && set.has(li.barn_id));
  }, [lineItemsForRevenue, selectedBarnIds]);

  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const firstOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  // ── Money Pulse ──
  const pulse = useMemo(() => {
    const inRange = (e: FinancialEntry, from: Date, to: Date) => {
      const d = entryDate(e);
      return d >= from && d < to;
    };
    const thisMonth = entries.filter((e) => inRange(e, firstOfMonth, firstOfNextMonth));
    const lastMonth = entries.filter((e) => inRange(e, firstOfLastMonth, firstOfMonth));

    const sum = (arr: FinancialEntry[], types: Array<FinancialEntry["cost_type"]>) =>
      arr
        .filter((e) => types.includes(e.cost_type))
        .reduce((s, e) => s + (e.total_cost ?? 0), 0);

    // Invoice line items count as revenue at invoice issue_date
    // (board, training, hauling, etc. — things that aren't log entries)
    const lineItemsInRange = (from: Date, to: Date) =>
      lineItems
        .filter((li) => {
          const d = new Date(li.issue_date);
          return d >= from && d < to;
        })
        .reduce((s, li) => s + (li.amount ?? 0), 0);

    // Revenue: true revenue entries + invoice line items (at issue_date)
    const revThis = sum(thisMonth, ["revenue"]) + lineItemsInRange(firstOfMonth, firstOfNextMonth);
    const revLast = sum(lastMonth, ["revenue"]) + lineItemsInRange(firstOfLastMonth, firstOfMonth);

    // Expenses: only true expense entries (what the barn spent out of pocket)
    const expThis = sum(thisMonth, ["expense"]);
    const expLast = sum(lastMonth, ["expense"]);

    // Pass-through: charges the barn paid on behalf of owners — billable,
    // not yet invoiced. Once invoiced, the charge is tracked via the invoice
    // in Outstanding, so exclude invoiced entries here to avoid double-count.
    const passThroughThis = sum(
      thisMonth.filter((e) => !e.invoice_id),
      ["pass_through"],
    );
    const passThroughLast = sum(
      lastMonth.filter((e) => !e.invoice_id),
      ["pass_through"],
    );

    // Net: Revenue − Expenses (pass-throughs are not in P&L)
    // revThis/revLast already include invoice line items
    const netThis = revThis - expThis;
    const netLast = revLast - expLast;

    // Outstanding = loose entries outstanding + invoice outstanding
    const looseOutstanding = entries
      .filter(
        (e) =>
          (e.cost_type === "revenue" || e.cost_type === "pass_through") &&
          (e.payment_status === "unpaid" || e.payment_status === "partial"),
      )
      .reduce((s, e) => s + ((e.total_cost ?? 0) - (e.paid_amount ?? 0)), 0);
    const looseCount = entries.filter(
      (e) =>
        (e.cost_type === "revenue" || e.cost_type === "pass_through") &&
        (e.payment_status === "unpaid" || e.payment_status === "partial"),
    ).length;
    const invoiceOutstanding = invoices.reduce(
      (s, inv) => s + (inv.subtotal ?? 0) - (inv.paid_amount ?? 0),
      0,
    );
    const outstanding = looseOutstanding + invoiceOutstanding;
    const outstandingCount = looseCount + invoices.length;

    const pct = (curr: number, prev: number): number | null => {
      if (prev === 0) return null;
      return Math.round(((curr - prev) / Math.abs(prev)) * 100);
    };

    return {
      revThis, revLast, revPct: pct(revThis, revLast),
      expThis, expLast, expPct: pct(expThis, expLast),
      passThroughThis, passThroughLast, passThroughPct: pct(passThroughThis, passThroughLast),
      netThis, netLast, netPct: pct(netThis, netLast),
      outstanding, outstandingCount,
    };
  }, [entries, invoices, lineItems, firstOfMonth, firstOfNextMonth, firstOfLastMonth]);

  // ── Accounts Receivable, grouped by client (invoices + loose entries) ──
  const receivables = useMemo(() => {
    const unpaid = entries.filter(
      (e) =>
        (e.cost_type === "revenue" || e.cost_type === "pass_through") &&
        (e.payment_status === "unpaid" || e.payment_status === "partial"),
    );

    const groups: Record<
      string,
      {
        clientKey: string;
        name: string;
        entries: FinancialEntry[];
        invoices: UnpaidInvoice[];
        outstanding: number;
        oldestDate: Date;
      }
    > = {};

    const ensureGroup = (key: string, displayName: string, refDate: Date) => {
      if (!groups[key]) {
        groups[key] = {
          clientKey: key,
          name: displayName,
          entries: [],
          invoices: [],
          outstanding: 0,
          oldestDate: refDate,
        };
      }
    };

    // Loose entries (not invoiced)
    for (const e of unpaid) {
      const key = getClientKey(e);
      ensureGroup(key, getClientDisplay(key, e, profileNames), entryDate(e));
      groups[key].entries.push(e);
      groups[key].outstanding += (e.total_cost ?? 0) - (e.paid_amount ?? 0);
      const d = entryDate(e);
      if (d < groups[key].oldestDate) groups[key].oldestDate = d;
    }

    // Invoices
    for (const inv of invoices) {
      const key = inv.billable_to_user_id
        ? `u:${inv.billable_to_user_id}`
        : inv.billable_to_name
          ? `n:${inv.billable_to_name.trim().toLowerCase()}`
          : "unassigned";
      const name = inv.billable_to_user_id
        ? profileNames[inv.billable_to_user_id] ?? inv.billable_to_name ?? "Member"
        : inv.billable_to_name ?? "Unassigned";
      const invDate = new Date(inv.issue_date);
      ensureGroup(key, name, invDate);
      groups[key].invoices.push(inv);
      groups[key].outstanding += (inv.subtotal ?? 0) - (inv.paid_amount ?? 0);
      if (invDate < groups[key].oldestDate) groups[key].oldestDate = invDate;
    }

    return Object.values(groups).sort((a, b) => b.outstanding - a.outstanding);
  }, [entries, invoices, profileNames]);

  // ── Recent transactions (last 20 sorted desc) ──
  const recentTransactions = useMemo(() => {
    return [...entries]
      .sort((a, b) => entryDate(b).getTime() - entryDate(a).getTime())
      .slice(0, 20);
  }, [entries]);

  // ── Trends: revenue vs expenses, 6 months ──
  const trendsData = useMemo(() => {
    const months: { key: string; label: string; start: Date; end: Date }[] = [];
    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const label = start.toLocaleDateString(undefined, { month: "short" });
      months.push({ key: `${start.getFullYear()}-${start.getMonth()}`, label, start, end });
    }
    return months.map((m) => {
      const inMonth = entries.filter((e) => {
        const d = entryDate(e);
        return d >= m.start && d < m.end;
      });
      const entryRevenue = inMonth
        .filter((e) => e.cost_type === "revenue")
        .reduce((s, e) => s + (e.total_cost ?? 0), 0);
      const lineItemRevenue = lineItems
        .filter((li) => {
          const d = new Date(li.issue_date);
          return d >= m.start && d < m.end;
        })
        .reduce((s, li) => s + (li.amount ?? 0), 0);
      const revenue = entryRevenue + lineItemRevenue;
      const expenses = inMonth
        .filter((e) => e.cost_type === "expense")
        .reduce((s, e) => s + (e.total_cost ?? 0), 0);
      return { month: m.label, revenue: Math.round(revenue), expenses: Math.round(expenses) };
    });
  }, [entries, lineItems, now]);

  // ── Revenue by category (this month) ──
  const categoryData = useMemo(() => {
    const thisMonth = entries.filter((e) => {
      const d = entryDate(e);
      return d >= firstOfMonth && d < firstOfNextMonth;
    });
    const rev = thisMonth.filter((e) => e.cost_type === "revenue");
    const byType: Record<string, number> = {};
    for (const e of rev) {
      const t = entryType(e);
      byType[t] = (byType[t] ?? 0) + (e.total_cost ?? 0);
    }
    return Object.entries(byType)
      .map(([name, value]) => ({ name: name.replace(/_/g, " "), value: Math.round(value) }))
      .sort((a, b) => b.value - a.value);
  }, [entries, firstOfMonth, firstOfNextMonth]);

  // ── Per-barn breakdown ──
  const perBarn = useMemo(() => {
    return barns.map((b) => {
      const barnEntries = entries.filter((e) => e.barn_id === b.id);
      const thisMonth = barnEntries.filter((e) => {
        const d = entryDate(e);
        return d >= firstOfMonth && d < firstOfNextMonth;
      });
      const entryRevenue = thisMonth
        .filter((e) => e.cost_type === "revenue")
        .reduce((s, e) => s + (e.total_cost ?? 0), 0);
      const lineItemRevenue = lineItems
        .filter((li) => {
          if (li.barn_id !== b.id) return false;
          const d = new Date(li.issue_date);
          return d >= firstOfMonth && d < firstOfNextMonth;
        })
        .reduce((s, li) => s + (li.amount ?? 0), 0);
      const revenue = entryRevenue + lineItemRevenue;
      const expenses = thisMonth
        .filter((e) => e.cost_type === "expense")
        .reduce((s, e) => s + (e.total_cost ?? 0), 0);
      const net = revenue - expenses;
      const outstanding = barnEntries
        .filter(
          (e) =>
            (e.cost_type === "revenue" || e.cost_type === "pass_through") &&
            (e.payment_status === "unpaid" || e.payment_status === "partial"),
        )
        .reduce((s, e) => s + ((e.total_cost ?? 0) - (e.paid_amount ?? 0)), 0);

      return {
        id: b.id,
        name: b.name,
        horseCount: horseCountByBarn[b.id] ?? 0,
        revenue,
        expenses,
        net,
        outstanding,
      };
    });
  }, [barns, entries, firstOfMonth, firstOfNextMonth, horseCountByBarn]);

  const handleMarkPaid = (entryId: string, source: "activity" | "health") => {
    startTransition(async () => {
      await markAsPaidAction(entryId, source);
    });
  };

  const handleWaive = (entryId: string, source: "activity" | "health") => {
    if (!confirm("Waive this charge? This will mark it as forgiven / written off.")) return;
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

  return (
    <BusinessProChrome breadcrumb={breadcrumb}>
      <div className="bp-page-header">
        <h1 className="bp-display" style={{ fontSize: 32 }}>
          Overview
        </h1>
        <p style={{ color: "var(--bp-ink-secondary)", fontSize: 13, marginTop: 6 }}>
          Financial snapshot across {barns.length} barn{barns.length !== 1 ? "s" : ""}.
        </p>
      </div>

      <div style={{ padding: "0 32px 48px", maxWidth: 1100 }}>

        {/* Barn filter */}
        {barns.length > 1 && (
          <div className="mb-6 flex flex-wrap gap-2">
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
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    isSelected
                      ? "bg-brass-gold text-barn-dark"
                      : "bg-white text-barn-dark/60 border border-barn-dark/15"
                  }`}
                >
                  {b.name}
                </button>
              );
            })}
          </div>
        )}

        {/* ════════ SECTION 1: Money Pulse ════════ */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
          <MoneyPulseCard
            label="Revenue This Month"
            value={pulse.revThis}
            pct={pulse.revPct}
            color="#2a4031"
            bg="#f0fdf4"
          />
          <MoneyPulseCard
            label="Expenses This Month"
            value={pulse.expThis}
            pct={pulse.expPct}
            color="#8b4a2b"
            bg="#fef3e2"
            invertPct
          />
          <MoneyPulseCard
            label="Net This Month"
            value={pulse.netThis}
            pct={pulse.netPct}
            color={pulse.netThis >= 0 ? "#2a4031" : "#b8421f"}
            bg={pulse.netThis >= 0 ? "#f0fdf4" : "#fef2f2"}
          />
          <MoneyPulseCard
            label="Pass-through"
            value={pulse.passThroughThis}
            pct={pulse.passThroughPct}
            subtitle="Billable — not yet invoiced"
            color="#a16207"
            bg="#fef3c7"
            noPct
          />
          <MoneyPulseCard
            label="Outstanding"
            value={pulse.outstanding}
            subtitle={`${pulse.outstandingCount} unpaid ${pulse.outstandingCount === 1 ? "item" : "items"}`}
            color="#c9a84c"
            bg="#fefce8"
            noPct
          />
        </div>

        {/* ════════ SECTION 2: Accounts Receivable ════════ */}
        <section className="mb-10">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <h2 className="font-serif text-xl font-semibold text-barn-dark">
              Who Owes Me
            </h2>
            <Link
              href="/business-pro/receivables"
              style={{
                fontSize: 12,
                color: "var(--bp-accent)",
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              See all →
            </Link>
          </div>
          {receivables.length === 0 ? (
            <div className="rounded-2xl border border-barn-dark/10 bg-white p-8 text-center text-sm text-barn-dark/60">
              No outstanding balances. Great job!
            </div>
          ) : (
            <div className="space-y-2">
              {receivables.map((r) => {
                const daysOld = Math.floor(
                  (now.getTime() - r.oldestDate.getTime()) / (1000 * 60 * 60 * 24),
                );
                let agingColor = "#22c55e"; // green
                let agingLabel = "Current";
                if (daysOld >= AR_AGING_DAYS.aging) {
                  agingColor = "#ef4444";
                  agingLabel = "60+ days";
                } else if (daysOld >= AR_AGING_DAYS.current) {
                  agingColor = "#f59e0b";
                  agingLabel = "30-60 days";
                }

                return (
                  <ReceivableRow
                    key={r.clientKey}
                    name={r.name}
                    outstanding={r.outstanding}
                    count={r.entries.length + r.invoices.length}
                    daysOld={daysOld}
                    agingColor={agingColor}
                    agingLabel={agingLabel}
                    entries={r.entries}
                    invoices={r.invoices}
                    horseNames={horseNames}
                    onMarkPaid={handleMarkPaid}
                    onPartial={handlePartial}
                    onWaive={handleWaive}
                  />
                );
              })}
            </div>
          )}
        </section>

        {/* ════════ SECTION 3: Recent Transactions ════════ */}
        <section className="mb-10">
          <h2 className="font-serif text-xl font-semibold text-barn-dark mb-3">
            Recent Transactions
          </h2>
          {recentTransactions.length === 0 ? (
            <div className="rounded-2xl border border-barn-dark/10 bg-white p-8 text-center text-sm text-barn-dark/60">
              No transactions yet. Categorize log entries with a cost type to see them here.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-barn-dark/10 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-parchment/50 border-b border-barn-dark/10">
                  <tr>
                    <th className="text-left px-4 py-2 text-xs font-medium uppercase tracking-wide text-barn-dark/60">Date</th>
                    <th className="text-left px-4 py-2 text-xs font-medium uppercase tracking-wide text-barn-dark/60">Horse</th>
                    <th className="text-left px-4 py-2 text-xs font-medium uppercase tracking-wide text-barn-dark/60">Type</th>
                    <th className="text-left px-4 py-2 text-xs font-medium uppercase tracking-wide text-barn-dark/60">Direction</th>
                    <th className="text-left px-4 py-2 text-xs font-medium uppercase tracking-wide text-barn-dark/60">Status</th>
                    <th className="text-right px-4 py-2 text-xs font-medium uppercase tracking-wide text-barn-dark/60">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTransactions.map((t) => (
                    <tr key={`${t.source}-${t.id}`} className="border-b border-barn-dark/5 hover:bg-parchment/30">
                      <td className="px-4 py-2 text-barn-dark/80">
                        {entryDate(t).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </td>
                      <td className="px-4 py-2">
                        <Link href={`/horses/${t.horse_id}`} className="text-barn-dark hover:underline">
                          {horseNames[t.horse_id] ?? "Unknown"}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-barn-dark/80">{entryType(t).replace(/_/g, " ")}</td>
                      <td className="px-4 py-2">
                        {t.cost_type && (
                          <span
                            className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium"
                            style={{
                              background: `${COST_TYPE_COLORS[t.cost_type]}15`,
                              color: COST_TYPE_COLORS[t.cost_type],
                            }}
                          >
                            {COST_TYPE_ICONS[t.cost_type]} {COST_TYPE_LABELS[t.cost_type]}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        {t.payment_status && (
                          <span className="text-xs text-barn-dark/70 capitalize">
                            {PAYMENT_STATUS_LABELS[t.payment_status]}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-barn-dark">
                        {formatCurrency(t.total_cost ?? 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ════════ SECTION 4: Trends ════════ */}
        <section className="mb-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-barn-dark/10 bg-white p-5">
            <h3 className="font-serif text-base font-semibold text-barn-dark mb-3">
              Revenue vs Expenses (6 months)
            </h3>
            <div style={{ width: "100%", height: 260 }}>
              <ResponsiveContainer>
                <LineChart data={trendsData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0e8d8" />
                  <XAxis dataKey="month" stroke="#8a7f70" style={{ fontSize: 11 }} />
                  <YAxis stroke="#8a7f70" style={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value: unknown) => formatCurrency(Number(value))}
                    contentStyle={{ borderRadius: 8, border: "1px solid #e5d9c3" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="revenue" stroke="#2a4031" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="expenses" stroke="#8b4a2b" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="rounded-2xl border border-barn-dark/10 bg-white p-5">
            <h3 className="font-serif text-base font-semibold text-barn-dark mb-3">
              Revenue by Category (this month)
            </h3>
            {categoryData.length === 0 ? (
              <div className="py-16 text-center text-sm text-barn-dark/50">
                No revenue this month.
              </div>
            ) : (
              <div style={{ width: "100%", height: 260 }}>
                <ResponsiveContainer>
                  <BarChart data={categoryData} layout="vertical" margin={{ top: 10, right: 30, bottom: 0, left: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0e8d8" horizontal={false} />
                    <XAxis type="number" stroke="#8a7f70" style={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" stroke="#8a7f70" style={{ fontSize: 11 }} width={80} />
                    <Tooltip
                      formatter={(value: unknown) => formatCurrency(Number(value))}
                      contentStyle={{ borderRadius: 8, border: "1px solid #e5d9c3" }}
                    />
                    <Bar dataKey="value" fill="#c9a84c">
                      {categoryData.map((_, i) => (
                        <Cell key={i} fill="#c9a84c" />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </section>

        {/* ════════ SECTION 5: Per-Barn Breakdown ════════ */}
        {barns.length > 1 && (
          <section>
            <h2 className="font-serif text-xl font-semibold text-barn-dark mb-3">
              Per-Barn Breakdown
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {perBarn.map((b) => (
                <Link
                  key={b.id}
                  href={`/barn/${b.id}`}
                  className="rounded-2xl border border-barn-dark/10 bg-white p-4 hover:border-brass-gold transition"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-barn-dark">{b.name}</span>
                    <span className="text-xs text-barn-dark/50">{b.horseCount} horses</span>
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-barn-dark/60">Revenue</span>
                      <span className="font-mono text-[#2a4031]">{formatCurrency(b.revenue)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-barn-dark/60">Expenses</span>
                      <span className="font-mono text-[#8b4a2b]">{formatCurrency(b.expenses)}</span>
                    </div>
                    <div className="flex justify-between border-t border-barn-dark/10 pt-1 mt-1">
                      <span className="text-barn-dark/60">Net</span>
                      <span className={`font-mono font-medium ${b.net >= 0 ? "text-[#2a4031]" : "text-[#b8421f]"}`}>
                        {formatCurrency(b.net)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-barn-dark/60">Outstanding</span>
                      <span className="font-mono text-[#c9a84c]">{formatCurrency(b.outstanding)}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </BusinessProChrome>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────────────────

function MoneyPulseCard({
  label,
  value,
  pct,
  subtitle,
  color,
  bg,
  invertPct,
  noPct,
}: {
  label: string;
  value: number;
  pct?: number | null;
  subtitle?: string;
  color: string;
  bg: string;
  invertPct?: boolean;
  noPct?: boolean;
}) {
  let arrow: string | null = null;
  let pctColor = "#6b7280";
  if (!noPct && pct != null) {
    const isUp = pct > 0;
    // For expenses, "up" is bad (red); for revenue/net, "up" is good (green)
    const isGood = invertPct ? !isUp : isUp;
    arrow = isUp ? "↑" : pct < 0 ? "↓" : "·";
    pctColor = pct === 0 ? "#6b7280" : isGood ? "#22c55e" : "#ef4444";
  }

  return (
    <div className="rounded-2xl border border-barn-dark/10 p-4" style={{ background: bg }}>
      <div className="text-xs font-medium uppercase tracking-wide text-barn-dark/50">{label}</div>
      <div className="mt-1 font-serif text-2xl font-semibold" style={{ color }}>
        {formatCurrency(value)}
      </div>
      {subtitle ? (
        <div className="mt-1 text-xs text-barn-dark/60">{subtitle}</div>
      ) : !noPct && pct != null ? (
        <div className="mt-1 text-xs" style={{ color: pctColor }}>
          {arrow} {Math.abs(pct)}% vs last month
        </div>
      ) : !noPct ? (
        <div className="mt-1 text-xs text-barn-dark/40">—</div>
      ) : null}
    </div>
  );
}

function ReceivableRow({
  name,
  outstanding,
  count,
  daysOld,
  agingColor,
  agingLabel,
  entries,
  invoices,
  horseNames,
  onMarkPaid,
  onPartial,
  onWaive,
}: {
  name: string;
  outstanding: number;
  count: number;
  daysOld: number;
  agingColor: string;
  agingLabel: string;
  entries: FinancialEntry[];
  invoices: UnpaidInvoice[];
  horseNames: Record<string, string>;
  onMarkPaid: (id: string, source: "activity" | "health") => void;
  onPartial: (id: string, source: "activity" | "health") => void;
  onWaive: (id: string, source: "activity" | "health") => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-2xl border border-barn-dark/10 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-parchment/30 transition"
      >
        <div className="flex items-center gap-3">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: agingColor }}
          />
          <div className="text-left">
            <div className="font-medium text-barn-dark">{name}</div>
            <div className="text-xs text-barn-dark/50">
              {count} unpaid {count === 1 ? "entry" : "entries"} · Oldest {daysOld}d ({agingLabel})
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="font-mono font-semibold text-[#c9a84c] text-lg">
            {formatCurrency(outstanding)}
          </div>
          <span className="text-barn-dark/40 text-sm">
            {expanded ? "▾" : "▸"}
          </span>
        </div>
      </button>
      {expanded && (
        <div className="border-t border-barn-dark/10 divide-y divide-barn-dark/5">
          {/* Invoices first — they represent bundled AR */}
          {invoices.map((inv) => {
            const remaining = (inv.subtotal ?? 0) - (inv.paid_amount ?? 0);
            return (
              <Link
                key={`inv-${inv.id}`}
                href={`/business-pro/invoicing/${inv.id}`}
                className="px-4 py-3 flex items-center justify-between gap-3 text-sm hover:bg-parchment/30 transition"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-barn-dark flex items-center gap-2">
                    <span className="font-mono text-xs text-barn-dark/50">
                      {new Date(inv.issue_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </span>
                    <span className="font-mono font-medium">{inv.invoice_number}</span>
                    <span
                      className="font-mono"
                      style={{
                        fontSize: 9,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: inv.display_status === "overdue" ? "#fee2e2" : "#dbeafe",
                        color: inv.display_status === "overdue" ? "#991b1b" : "#1e40af",
                      }}
                    >
                      {inv.display_status === "overdue" ? "Overdue" : inv.display_status === "partial" ? "Partial" : "Sent"}
                    </span>
                  </div>
                  {inv.due_date && (
                    <div className="text-xs text-barn-dark/60 mt-0.5">
                      Due {new Date(inv.due_date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" })}
                    </div>
                  )}
                </div>
                <span className="font-mono text-sm text-[#c9a84c] font-semibold">
                  {formatCurrency(remaining)}
                </span>
                <span className="text-xs text-barn-dark/40">→</span>
              </Link>
            );
          })}

          {entries.map((e) => {
            const remaining = (e.total_cost ?? 0) - (e.paid_amount ?? 0);
            const d = entryDate(e);
            return (
              <div key={`${e.source}-${e.id}`} className="px-4 py-3 flex items-center justify-between gap-3 text-sm">
                <div className="flex-1 min-w-0">
                  <div className="text-barn-dark">
                    <span className="font-mono text-xs text-barn-dark/50 mr-2">
                      {d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </span>
                    <Link href={`/horses/${e.horse_id}`} className="hover:underline">
                      {horseNames[e.horse_id] ?? "Unknown"}
                    </Link>
                    <span className="text-barn-dark/50 text-xs ml-2">
                      · {entryType(e).replace(/_/g, " ")}
                    </span>
                  </div>
                  {e.notes && (
                    <div className="text-xs text-barn-dark/60 truncate mt-0.5">{e.notes}</div>
                  )}
                </div>
                <div className="font-mono text-sm text-[#c9a84c]">{formatCurrency(remaining)}</div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => onMarkPaid(e.id, e.source)}
                    className="px-2 py-1 text-xs font-medium bg-brass-gold text-barn-dark rounded hover:brightness-110"
                  >
                    Paid
                  </button>
                  <button
                    type="button"
                    onClick={() => onPartial(e.id, e.source)}
                    className="px-2 py-1 text-xs font-medium bg-white text-barn-dark border border-barn-dark/15 rounded hover:bg-parchment"
                  >
                    Partial
                  </button>
                  <button
                    type="button"
                    onClick={() => onWaive(e.id, e.source)}
                    className="px-2 py-1 text-xs font-medium text-barn-dark/60 hover:text-barn-dark"
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
