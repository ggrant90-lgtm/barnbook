"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BusinessProChrome } from "@/components/business-pro/BusinessProChrome";
import { formatCurrency } from "@/lib/currency";
import {
  EXPENSE_CATEGORIES,
  PAYMENT_METHOD_LABELS,
  type PaymentMethod,
} from "@/lib/business-pro-constants";
import { deleteBarnExpenseAction } from "@/app/(protected)/actions/barn-expenses";

const breadcrumb = [
  { label: "Business Pro", href: "/business-pro" },
  { label: "Expenses" },
];

interface Barn {
  id: string;
  name: string;
}

interface Expense {
  id: string;
  barn_id: string;
  performed_at: string;
  category: string;
  vendor_name: string | null;
  description: string | null;
  notes: string | null;
  total_cost: number;
  payment_method: PaymentMethod | null;
  payment_reference: string | null;
  payment_status: string | null;
  created_at: string;
}

type DateRange = "this_month" | "last_month" | "ytd" | "all";

export function ExpensesListClient({
  barns,
  expenses,
  barnNames,
  customCategories,
}: {
  barns: Barn[];
  expenses: Expense[];
  barnNames: Record<string, string>;
  customCategories: string[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [selectedBarnIds, setSelectedBarnIds] = useState<string[]>(
    barns.map((b) => b.id),
  );
  const [category, setCategory] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange>("this_month");
  const [search, setSearch] = useState("");

  const allCategoryOptions = useMemo(() => {
    const preset = EXPENSE_CATEGORIES.filter((c) => c !== "Other");
    const merged = [...preset, ...customCategories];
    return Array.from(new Set(merged));
  }, [customCategories]);

  // ── Date range helpers ──
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const firstOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const firstOfYear = new Date(now.getFullYear(), 0, 1);

  const dateFilter = (d: Date): boolean => {
    if (dateRange === "this_month") {
      return d >= firstOfMonth && d < firstOfNextMonth;
    }
    if (dateRange === "last_month") {
      return d >= firstOfLastMonth && d < firstOfMonth;
    }
    if (dateRange === "ytd") {
      return d >= firstOfYear && d < firstOfNextMonth;
    }
    return true;
  };

  const filtered = useMemo(() => {
    const barnSet = new Set(selectedBarnIds);
    const q = search.trim().toLowerCase();
    return expenses.filter((e) => {
      if (!barnSet.has(e.barn_id)) return false;
      if (category !== "all" && e.category !== category) return false;
      if (!dateFilter(new Date(e.performed_at))) return false;
      if (q) {
        const hay = [
          e.description,
          e.vendor_name,
          e.notes,
          e.category,
          e.payment_reference,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [expenses, selectedBarnIds, category, dateRange, search]);

  // ── Summary ──
  const summary = useMemo(() => {
    const sumIn = (from: Date, to: Date) =>
      expenses
        .filter((e) => {
          if (!selectedBarnIds.includes(e.barn_id)) return false;
          const d = new Date(e.performed_at);
          return d >= from && d < to;
        })
        .reduce((s, e) => s + (e.total_cost ?? 0), 0);

    const thisMonth = sumIn(firstOfMonth, firstOfNextMonth);
    const lastMonth = sumIn(firstOfLastMonth, firstOfMonth);
    const ytd = sumIn(firstOfYear, firstOfNextMonth);

    // Category leader this month
    const catTotals: Record<string, number> = {};
    for (const e of expenses) {
      if (!selectedBarnIds.includes(e.barn_id)) continue;
      const d = new Date(e.performed_at);
      if (d < firstOfMonth || d >= firstOfNextMonth) continue;
      catTotals[e.category] = (catTotals[e.category] ?? 0) + (e.total_cost ?? 0);
    }
    const leader = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];

    return {
      thisMonth,
      lastMonth,
      ytd,
      leaderName: leader?.[0] ?? "—",
      leaderAmount: leader?.[1] ?? 0,
    };
  }, [
    expenses,
    selectedBarnIds,
    firstOfMonth,
    firstOfNextMonth,
    firstOfLastMonth,
    firstOfYear,
  ]);

  const filteredTotal = useMemo(
    () => filtered.reduce((s, e) => s + (e.total_cost ?? 0), 0),
    [filtered],
  );

  // ── CSV export ──
  const handleExportCSV = () => {
    const headers = [
      "Date",
      "Barn",
      "Category",
      "Vendor",
      "Description",
      "Payment Method",
      "Reference",
      "Amount",
      "Notes",
    ];
    const escape = (v: unknown): string => {
      if (v == null) return "";
      const s = String(v);
      if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const rows = filtered.map((e) => [
      new Date(e.performed_at).toISOString().slice(0, 10),
      barnNames[e.barn_id] ?? "",
      e.category ?? "",
      e.vendor_name ?? "",
      e.description ?? "",
      e.payment_method ? PAYMENT_METHOD_LABELS[e.payment_method] : "",
      e.payment_reference ?? "",
      (e.total_cost ?? 0).toFixed(2),
      e.notes ?? "",
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map(escape).join(","))
      .join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `expenses-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = (id: string) => {
    if (!confirm("Delete this expense? This cannot be undone.")) return;
    startTransition(async () => {
      const res = await deleteBarnExpenseAction(id);
      if (res.error) {
        alert(`Failed: ${res.error}`);
        return;
      }
      router.refresh();
    });
  };

  return (
    <BusinessProChrome breadcrumb={breadcrumb}>
      <div className="bp-page-header">
        <h1 className="bp-display" style={{ fontSize: 32 }}>
          Expenses
        </h1>
        <p
          style={{
            color: "var(--bp-ink-secondary)",
            fontSize: 13,
            marginTop: 6,
          }}
        >
          Track barn-level operating costs — rent, utilities, feed bills,
          insurance, and more.
        </p>
      </div>

      <div style={{ padding: "0 32px 48px", maxWidth: 1200 }}>
        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <SummaryCard label="This Month" value={summary.thisMonth} />
          <SummaryCard label="Last Month" value={summary.lastMonth} />
          <SummaryCard label="Year to Date" value={summary.ytd} />
          <SummaryCard
            label="Top Category"
            value={summary.leaderAmount}
            subtitle={summary.leaderName}
          />
        </div>

        {/* Toolbar */}
        <div
          className="mb-4 flex flex-wrap items-center gap-3"
          style={{
            padding: "12px 16px",
            background: "white",
            border: "1px solid rgba(0,0,0,0.08)",
            borderRadius: 12,
          }}
        >
          <input
            type="search"
            placeholder="Search description, vendor, reference…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bp-input"
            style={{ flex: "1 1 220px", minWidth: 200 }}
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="bp-select"
          >
            <option value="all">All categories</option>
            {allCategoryOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as DateRange)}
            className="bp-select"
          >
            <option value="this_month">This month</option>
            <option value="last_month">Last month</option>
            <option value="ytd">Year to date</option>
            <option value="all">All time</option>
          </select>
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={filtered.length === 0}
            className="rounded-lg border border-barn-dark/15 bg-white px-3 py-1.5 text-sm font-medium text-barn-dark hover:bg-parchment disabled:opacity-40"
          >
            Export CSV
          </button>
          <Link
            href="/business-pro/expenses/new"
            className="rounded-lg bg-brass-gold px-3 py-1.5 text-sm font-semibold text-barn-dark hover:brightness-110"
          >
            + New Expense
          </Link>
        </div>

        {/* Barn chips */}
        {barns.length > 1 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {barns.map((b) => {
              const isSelected = selectedBarnIds.includes(b.id);
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() =>
                    setSelectedBarnIds((prev) =>
                      isSelected
                        ? prev.filter((id) => id !== b.id)
                        : [...prev, b.id],
                    )
                  }
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

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-barn-dark/10 bg-white p-10 text-center">
            <div className="text-sm text-barn-dark/60">
              {expenses.length === 0
                ? "No expenses yet. Click “New Expense” to log your first barn cost."
                : "No expenses match the current filters."}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-barn-dark/10 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-parchment/50 border-b border-barn-dark/10">
                <tr>
                  <Th>Date</Th>
                  {barns.length > 1 && <Th>Barn</Th>}
                  <Th>Category</Th>
                  <Th>Vendor</Th>
                  <Th>Method · Ref</Th>
                  <Th align="right">Amount</Th>
                  <Th align="right">&nbsp;</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr
                    key={e.id}
                    className="border-b border-barn-dark/5 hover:bg-parchment/30"
                  >
                    <td className="px-4 py-2 whitespace-nowrap text-barn-dark/80">
                      {new Date(e.performed_at).toLocaleDateString(undefined, {
                        year: "2-digit",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    {barns.length > 1 && (
                      <td className="px-4 py-2 text-barn-dark/70">
                        {barnNames[e.barn_id] ?? "—"}
                      </td>
                    )}
                    <td className="px-4 py-2 text-barn-dark">
                      <span
                        className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium"
                        style={{
                          background: "rgba(139,74,43,0.08)",
                          color: "#8b4a2b",
                        }}
                      >
                        {e.category}
                      </span>
                      {e.description && (
                        <div className="text-xs text-barn-dark/60 mt-0.5 truncate max-w-xs">
                          {e.description}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-barn-dark/80">
                      {e.vendor_name ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-barn-dark/70 text-xs">
                      {e.payment_method
                        ? PAYMENT_METHOD_LABELS[e.payment_method]
                        : "—"}
                      {e.payment_reference && (
                        <span className="text-barn-dark/50">
                          {" "}
                          · {e.payment_reference}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-barn-dark">
                      {formatCurrency(e.total_cost ?? 0)}
                    </td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      <Link
                        href={`/business-pro/expenses/${e.id}`}
                        className="text-xs text-barn-dark/70 hover:text-barn-dark mr-2"
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(e.id)}
                        className="text-xs text-barn-dark/60 hover:text-[#b8421f]"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-parchment/30 border-t border-barn-dark/10">
                  <td
                    className="px-4 py-2 text-xs uppercase tracking-wide text-barn-dark/60"
                    colSpan={barns.length > 1 ? 5 : 4}
                  >
                    {filtered.length}{" "}
                    {filtered.length === 1 ? "expense" : "expenses"}
                  </td>
                  <td className="px-4 py-2 text-right font-mono font-semibold text-barn-dark">
                    {formatCurrency(filteredTotal)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </BusinessProChrome>
  );
}

function SummaryCard({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: number;
  subtitle?: string;
}) {
  return (
    <div
      className="rounded-2xl border border-barn-dark/10 p-4"
      style={{ background: "#fef3e2" }}
    >
      <div className="text-xs font-medium uppercase tracking-wide text-barn-dark/50">
        {label}
      </div>
      <div
        className="mt-1 font-serif text-2xl font-semibold"
        style={{ color: "#8b4a2b" }}
      >
        {formatCurrency(value)}
      </div>
      {subtitle && (
        <div className="mt-1 text-xs text-barn-dark/60">{subtitle}</div>
      )}
    </div>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`px-4 py-2 text-xs font-medium uppercase tracking-wide text-barn-dark/60 ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}
