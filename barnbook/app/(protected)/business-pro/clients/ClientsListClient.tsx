"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BusinessProChrome } from "@/components/business-pro/BusinessProChrome";
import { formatCurrency } from "@/lib/currency";

const breadcrumb = [
  { label: "Business Pro", href: "/business-pro" },
  { label: "Clients" },
];

interface Barn {
  id: string;
  name: string;
}

interface ClientRow {
  id: string;
  barn_id: string;
  display_name: string;
  name_key: string;
  email: string | null;
  phone: string | null;
  archived: boolean;
  created_at: string;
}

export function ClientsListClient({
  barns,
  clients,
  horseCounts,
  invoiceStats,
}: {
  barns: Barn[];
  clients: ClientRow[];
  horseCounts: Record<string, number>;
  invoiceStats: Record<string, { openCount: number; outstanding: number }>;
}) {
  const [search, setSearch] = useState("");
  const [selectedBarnIds, setSelectedBarnIds] = useState<string[]>(
    barns.map((b) => b.id),
  );
  const [showArchived, setShowArchived] = useState(false);

  const barnNames: Record<string, string> = useMemo(() => {
    const m: Record<string, string> = {};
    for (const b of barns) m[b.id] = b.name;
    return m;
  }, [barns]);

  const filtered = useMemo(() => {
    const barnSet = new Set(selectedBarnIds);
    const q = search.trim().toLowerCase();
    return clients.filter((c) => {
      if (!barnSet.has(c.barn_id)) return false;
      if (!showArchived && c.archived) return false;
      if (q) {
        const hay = [c.display_name, c.email, c.phone]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [clients, selectedBarnIds, showArchived, search]);

  const summary = useMemo(() => {
    let totalActive = 0;
    let totalOutstanding = 0;
    let topName = "—";
    let topAmount = 0;
    for (const c of clients) {
      if (c.archived) continue;
      if (!selectedBarnIds.includes(c.barn_id)) continue;
      totalActive += 1;
      const stats = invoiceStats[c.id];
      if (stats) {
        totalOutstanding += stats.outstanding;
        if (stats.outstanding > topAmount) {
          topAmount = stats.outstanding;
          topName = c.display_name;
        }
      }
    }
    return { totalActive, totalOutstanding, topName, topAmount };
  }, [clients, selectedBarnIds, invoiceStats]);

  return (
    <BusinessProChrome breadcrumb={breadcrumb}>
      <div className="bp-page-header">
        <h1 className="bp-display" style={{ fontSize: 32 }}>
          Clients
        </h1>
        <p
          style={{
            color: "var(--bp-ink-secondary)",
            fontSize: 13,
            marginTop: 6,
          }}
        >
          Every billable contact in one place — with their horses, invoices,
          balance, and documents.
        </p>
      </div>

      <div style={{ padding: "0 32px 48px", maxWidth: 1200 }}>
        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          <SummaryCard label="Active clients" value={summary.totalActive} />
          <SummaryCard
            label="Total outstanding"
            value={formatCurrency(summary.totalOutstanding)}
          />
          <SummaryCard label="Top balance" value={summary.topName} subtitle={summary.topAmount ? formatCurrency(summary.topAmount) : undefined} />
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
            placeholder="Search name, email, phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bp-input"
            style={{ flex: "1 1 220px", minWidth: 200 }}
          />
          <label className="flex items-center gap-2 text-xs text-barn-dark/70">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Show archived
          </label>
          <Link
            href="/business-pro/clients/new"
            className="rounded-lg bg-brass-gold px-3 py-1.5 text-sm font-semibold text-barn-dark hover:brightness-110"
          >
            + New Client
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
              {clients.length === 0
                ? "No clients yet. Click “New Client” to add one."
                : "No clients match the current filters."}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-barn-dark/10 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-parchment/50 border-b border-barn-dark/10">
                <tr>
                  <Th>Name</Th>
                  {barns.length > 1 && <Th>Barn</Th>}
                  <Th>Email</Th>
                  <Th>Phone</Th>
                  <Th align="right">Horses</Th>
                  <Th align="right">Open invoices</Th>
                  <Th align="right">Outstanding</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const stats = invoiceStats[c.id] ?? {
                    openCount: 0,
                    outstanding: 0,
                  };
                  const hCount = horseCounts[c.id] ?? 0;
                  return (
                    <tr
                      key={c.id}
                      className="border-b border-barn-dark/5 hover:bg-parchment/30"
                    >
                      <td className="px-4 py-2 text-barn-dark">
                        <Link
                          href={`/business-pro/clients/${c.id}`}
                          className="font-medium hover:underline"
                        >
                          {c.display_name}
                        </Link>
                        {c.archived && (
                          <span className="ml-2 text-xs text-barn-dark/50">
                            (archived)
                          </span>
                        )}
                      </td>
                      {barns.length > 1 && (
                        <td className="px-4 py-2 text-barn-dark/70">
                          {barnNames[c.barn_id] ?? "—"}
                        </td>
                      )}
                      <td className="px-4 py-2 text-barn-dark/80">
                        {c.email ?? "—"}
                      </td>
                      <td className="px-4 py-2 text-barn-dark/80">
                        {c.phone ?? "—"}
                      </td>
                      <td className="px-4 py-2 text-right text-barn-dark/80">
                        {hCount}
                      </td>
                      <td className="px-4 py-2 text-right text-barn-dark/80">
                        {stats.openCount || "—"}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-[#c9a84c]">
                        {stats.outstanding > 0
                          ? formatCurrency(stats.outstanding)
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
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
  value: string | number;
  subtitle?: string;
}) {
  return (
    <div
      className="rounded-2xl border border-barn-dark/10 p-4"
      style={{ background: "#f0fdf4" }}
    >
      <div className="text-xs font-medium uppercase tracking-wide text-barn-dark/50">
        {label}
      </div>
      <div
        className="mt-1 font-serif text-2xl font-semibold"
        style={{ color: "#2a4031" }}
      >
        {value}
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
