"use client";

import { useState, useCallback } from "react";
import {
  generateReportData,
  saveReportHistory,
  getNextInvoiceNumber,
  type ReportParams,
  type ReportData,
} from "@/app/(protected)/actions/reports";
import { formatCurrency, formatCurrencyOrDash } from "@/lib/currency";
import { getLogTypeColor } from "@/lib/logTypeColors";

type ReportType = ReportParams["reportType"];

interface BarnMember { id: string; name: string; role: string }
interface BarnHorse { id: string; name: string; breed: string | null }

const REPORT_TYPES: { key: ReportType; label: string; desc: string; icon: string }[] = [
  { key: "horse_summary", label: "Horse Summary", desc: "Activity, costs, and history for one or more horses", icon: "🐴" },
  { key: "trainer_productivity", label: "Trainer Productivity", desc: "Work performed by a trainer or staff member", icon: "📋" },
  { key: "owner_statement", label: "Owner Statement", desc: "Billable activity for a horse owner (invoice-ready)", icon: "💰" },
  { key: "barn_revenue", label: "Barn Revenue", desc: "Activity and revenue across the whole barn", icon: "📊" },
];

const DATE_PRESETS = [
  { label: "This month", value: "this_month" },
  { label: "Last month", value: "last_month" },
  { label: "This quarter", value: "this_quarter" },
  { label: "This year", value: "this_year" },
  { label: "Custom", value: "custom" },
];

function getDateRange(preset: string): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (preset) {
    case "last_month": {
      const first = new Date(y, m - 1, 1);
      const last = new Date(y, m, 0);
      return { from: first.toISOString().slice(0, 10), to: last.toISOString().slice(0, 10) };
    }
    case "this_quarter": {
      const qStart = new Date(y, Math.floor(m / 3) * 3, 1);
      return { from: qStart.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
    }
    case "this_year":
      return { from: `${y}-01-01`, to: now.toISOString().slice(0, 10) };
    default: { // this_month
      const first = new Date(y, m, 1);
      return { from: first.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
    }
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function capitalizeType(t: string): string {
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ReportsClient({
  barnId,
  barnMembers,
  barnHorses,
  userRole,
}: {
  barnId: string;
  barnMembers: BarnMember[];
  barnHorses: BarnHorse[];
  userRole: string;
}) {
  const [selectedType, setSelectedType] = useState<ReportType | null>(null);
  const [datePreset, setDatePreset] = useState("this_month");
  const [dateFrom, setDateFrom] = useState(() => getDateRange("this_month").from);
  const [dateTo, setDateTo] = useState(() => getDateRange("this_month").to);
  const [horseIds, setHorseIds] = useState<string[]>([]);
  const [performerId, setPerformerId] = useState("");
  const [groupBy, setGroupBy] = useState<"type" | "performer" | "horse">("type");
  const [includeLineItems, setIncludeLineItems] = useState(true);
  const [includeNotes, setIncludeNotes] = useState(true);
  const [billToName, setBillToName] = useState("");
  const [billToAddress, setBillToAddress] = useState("");
  const [generating, setGenerating] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePresetChange = useCallback((preset: string) => {
    setDatePreset(preset);
    if (preset !== "custom") {
      const range = getDateRange(preset);
      setDateFrom(range.from);
      setDateTo(range.to);
    }
  }, []);

  const handleGenerate = async () => {
    if (!selectedType) return;
    setGenerating(true);
    setError(null);

    const params: ReportParams = {
      reportType: selectedType,
      barnId,
      dateFrom,
      dateTo,
      horseIds: horseIds.length > 0 ? horseIds : undefined,
      performerUserId: performerId || undefined,
      groupBy: selectedType === "barn_revenue" ? groupBy : undefined,
      includeLineItems,
      includeNotes,
      billToName: billToName || undefined,
      billToAddress: billToAddress || undefined,
    };

    if (selectedType === "owner_statement") {
      const inv = await getNextInvoiceNumber(barnId);
      params.invoiceNumber = inv;
    }

    const result = await generateReportData(params);

    if ("error" in result) {
      setError(result.error);
      setGenerating(false);
      return;
    }

    setReportData(result);
    await saveReportHistory(barnId, selectedType, params as unknown as Record<string, unknown>);
    setGenerating(false);
  };

  const handleDownloadCSV = useCallback(() => {
    if (!reportData) return;
    const rows: string[][] = [];

    // Header
    rows.push(["Date", "Horse", "Type", "Performed By", "Notes", "Cost", "Line Item", "Amount"]);

    for (const e of reportData.entries) {
      const base = [
        formatDate(e.performed_at),
        e.horse_name,
        capitalizeType(e.type),
        e.performer_display,
        e.notes ?? "",
        e.total_cost != null ? e.total_cost.toFixed(2) : "",
        "",
        "",
      ];

      if (e.line_items.length > 0) {
        rows.push(base);
        for (const li of e.line_items) {
          rows.push(["", "", "", "", "", "", li.description, li.amount.toFixed(2)]);
        }
      } else {
        rows.push(base);
      }
    }

    // Totals row
    rows.push([]);
    rows.push(["", "", "", "", "TOTAL", reportData.totalCost.toFixed(2), "", ""]);

    const csvContent = "\uFEFF" + rows.map((r) =>
      r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    ).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${reportData.barnName.toLowerCase().replace(/\s+/g, "-")}-${selectedType?.replace(/_/g, "-")}-${dateFrom}-to-${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [reportData, selectedType, dateFrom, dateTo]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const canSeeOwnerStatement = userRole === "owner" || userRole === "manager";
  const visibleTypes = REPORT_TYPES.filter(
    (t) => t.key !== "owner_statement" || canSeeOwnerStatement,
  );

  const inputClass = "w-full rounded-xl border border-barn-dark/15 bg-white px-4 py-3 text-barn-dark outline-none focus:border-brass-gold focus:ring-2 focus:ring-brass-gold/25";

  return (
    <div>
      {/* Report type selector */}
      {!reportData && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {visibleTypes.map((rt) => (
              <button
                key={rt.key}
                type="button"
                onClick={() => setSelectedType(rt.key)}
                className={`rounded-2xl border p-5 text-left transition hover:-translate-y-px hover:shadow-md ${
                  selectedType === rt.key
                    ? "border-brass-gold bg-brass-gold/10 shadow-sm"
                    : "border-barn-dark/10 bg-white"
                }`}
              >
                <span className="text-2xl">{rt.icon}</span>
                <h3 className="mt-2 font-serif text-lg font-semibold text-barn-dark">{rt.label}</h3>
                <p className="mt-1 text-xs text-barn-dark/55 leading-relaxed">{rt.desc}</p>
              </button>
            ))}
          </div>

          {/* Parameters panel */}
          {selectedType && (
            <div className="mt-6 rounded-2xl border border-barn-dark/10 bg-white p-5 shadow-sm">
              <h3 className="font-serif text-lg font-semibold text-barn-dark mb-4">Parameters</h3>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Date range preset */}
                <div>
                  <label className="mb-1.5 block text-sm text-barn-dark/75">Date range</label>
                  <select
                    value={datePreset}
                    onChange={(e) => handlePresetChange(e.target.value)}
                    className={inputClass}
                  >
                    {DATE_PRESETS.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>

                {datePreset === "custom" && (
                  <>
                    <div>
                      <label className="mb-1.5 block text-sm text-barn-dark/75">From</label>
                      <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputClass} />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm text-barn-dark/75">To</label>
                      <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputClass} />
                    </div>
                  </>
                )}

                {/* Horse selector — for Horse Summary and Owner Statement */}
                {(selectedType === "horse_summary" || selectedType === "owner_statement") && (
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-sm text-barn-dark/75">Horses (leave empty for all)</label>
                    <select
                      multiple
                      value={horseIds}
                      onChange={(e) => setHorseIds(Array.from(e.target.selectedOptions, (o) => o.value))}
                      className={`${inputClass} min-h-[80px]`}
                    >
                      {barnHorses.map((h) => (
                        <option key={h.id} value={h.id}>{h.name}{h.breed ? ` (${h.breed})` : ""}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Performer selector — for Trainer Productivity */}
                {selectedType === "trainer_productivity" && (
                  <div>
                    <label className="mb-1.5 block text-sm text-barn-dark/75">Performer</label>
                    <select value={performerId} onChange={(e) => setPerformerId(e.target.value)} className={inputClass}>
                      <option value="">All performers</option>
                      {barnMembers.map((m) => (
                        <option key={m.id} value={m.id}>{m.name} — {m.role}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Group by — for Barn Revenue */}
                {selectedType === "barn_revenue" && (
                  <div>
                    <label className="mb-1.5 block text-sm text-barn-dark/75">Group by</label>
                    <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as "type" | "performer" | "horse")} className={inputClass}>
                      <option value="type">Log type</option>
                      <option value="performer">Performer</option>
                      <option value="horse">Horse</option>
                    </select>
                  </div>
                )}

                {/* Owner Statement bill-to */}
                {selectedType === "owner_statement" && (
                  <>
                    <div>
                      <label className="mb-1.5 block text-sm text-barn-dark/75">Bill to (name)</label>
                      <input value={billToName} onChange={(e) => setBillToName(e.target.value)} className={inputClass} placeholder="Horse owner name" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm text-barn-dark/75">Bill to (address)</label>
                      <input value={billToAddress} onChange={(e) => setBillToAddress(e.target.value)} className={inputClass} placeholder="Address" />
                    </div>
                  </>
                )}
              </div>

              {/* Toggles */}
              <div className="mt-4 flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm text-barn-dark/70 cursor-pointer">
                  <input type="checkbox" checked={includeLineItems} onChange={(e) => setIncludeLineItems(e.target.checked)} className="rounded border-barn-dark/20" />
                  Include line items
                </label>
                <label className="flex items-center gap-2 text-sm text-barn-dark/70 cursor-pointer">
                  <input type="checkbox" checked={includeNotes} onChange={(e) => setIncludeNotes(e.target.checked)} className="rounded border-barn-dark/20" />
                  Include notes
                </label>
              </div>

              {error && (
                <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200">{error}</div>
              )}

              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating}
                className="mt-5 flex min-h-[48px] w-full items-center justify-center rounded-xl bg-brass-gold px-4 py-3 font-medium text-barn-dark shadow hover:brightness-110 transition disabled:opacity-50"
              >
                {generating ? "Generating…" : "Generate Report"}
              </button>
            </div>
          )}
        </>
      )}

      {/* Report preview */}
      {reportData && (
        <div>
          {/* Action bar */}
          <div className="mb-4 flex flex-wrap items-center gap-3 print:hidden">
            <button
              type="button"
              onClick={() => setReportData(null)}
              className="rounded-lg border border-barn-dark/15 bg-white px-4 py-2 text-sm text-barn-dark/70 hover:border-barn-dark/30 transition"
            >
              ← Back
            </button>
            <div className="flex-1" />
            <button
              type="button"
              onClick={handleDownloadCSV}
              className="rounded-lg border border-barn-dark/15 bg-white px-4 py-2 text-sm text-barn-dark hover:border-barn-dark/30 transition"
            >
              Download CSV
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="rounded-lg bg-brass-gold px-4 py-2 text-sm font-medium text-barn-dark shadow-sm hover:brightness-110 transition"
            >
              Print / Save PDF
            </button>
          </div>

          {/* Report document */}
          <div className="rounded-2xl border border-barn-dark/10 bg-white p-6 shadow-sm print:border-0 print:shadow-none print:p-0" id="report-preview">
            {/* Header */}
            <div className="mb-6 border-b border-barn-dark/10 pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-serif text-sm text-barn-dark/50">BarnBook</h2>
                  <h1 className="font-serif text-2xl font-semibold text-barn-dark">{reportData.barnName}</h1>
                  {reportData.barnAddress && <p className="text-xs text-barn-dark/50">{reportData.barnAddress}</p>}
                </div>
                <div className="text-right text-xs text-barn-dark/40">
                  <p>Generated {formatDate(reportData.generatedAt)}</p>
                  <p>by {reportData.generatedBy}</p>
                </div>
              </div>
              <h3 className="mt-3 text-center font-serif text-xl text-barn-dark">
                {REPORT_TYPES.find((t) => t.key === selectedType)?.label}
              </h3>
              <p className="text-center text-sm text-barn-dark/50">
                {formatDate(reportData.params.dateFrom)} — {formatDate(reportData.params.dateTo)}
              </p>
              {selectedType === "owner_statement" && reportData.params.invoiceNumber && (
                <p className="text-center text-xs text-barn-dark/40 mt-1">
                  Invoice #{reportData.params.invoiceNumber}
                  {billToName && ` • Bill to: ${billToName}`}
                </p>
              )}
            </div>

            {/* Summary stats */}
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl bg-parchment p-3">
                <p className="text-xs text-barn-dark/50 uppercase tracking-wider">Entries</p>
                <p className="mt-1 font-serif text-xl font-semibold text-barn-dark">{reportData.totalEntries}</p>
              </div>
              <div className="rounded-xl bg-parchment p-3">
                <p className="text-xs text-barn-dark/50 uppercase tracking-wider">Total Cost</p>
                <p className="mt-1 font-serif text-xl font-semibold text-barn-dark">{formatCurrency(reportData.totalCost) || "$0.00"}</p>
              </div>
              <div className="rounded-xl bg-parchment p-3">
                <p className="text-xs text-barn-dark/50 uppercase tracking-wider">Horses</p>
                <p className="mt-1 font-serif text-xl font-semibold text-barn-dark">{reportData.uniqueHorses}</p>
              </div>
              <div className="rounded-xl bg-parchment p-3">
                <p className="text-xs text-barn-dark/50 uppercase tracking-wider">Performers</p>
                <p className="mt-1 font-serif text-xl font-semibold text-barn-dark">{reportData.uniquePerformers}</p>
              </div>
            </div>

            {/* Activity table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-barn-dark/15 text-left text-xs text-barn-dark/50 uppercase tracking-wider">
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 pr-3">Horse</th>
                    <th className="py-2 pr-3">Type</th>
                    <th className="py-2 pr-3">Performed By</th>
                    {includeNotes && <th className="py-2 pr-3">Notes</th>}
                    <th className="py-2 text-right">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.entries.map((e) => (
                    <tr key={`${e.source}-${e.id}`} className="border-b border-barn-dark/5">
                      <td className="py-2.5 pr-3 whitespace-nowrap text-barn-dark/70">{formatDate(e.performed_at)}</td>
                      <td className="py-2.5 pr-3 font-medium text-barn-dark">{e.horse_name}</td>
                      <td className="py-2.5 pr-3">
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium text-white"
                          style={{ backgroundColor: getLogTypeColor(e.type) }}
                        >
                          {capitalizeType(e.type)}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-barn-dark/60">{e.performer_display}</td>
                      {includeNotes && (
                        <td className="py-2.5 pr-3 text-barn-dark/50 max-w-[200px] truncate">{e.notes ?? "—"}</td>
                      )}
                      <td className="py-2.5 text-right font-medium text-barn-dark">
                        {formatCurrencyOrDash(e.total_cost)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Line items detail (if any entries have them and toggle is on) */}
            {includeLineItems && reportData.entries.some((e) => e.line_items.length > 0) && (
              <div className="mt-6">
                <h4 className="font-serif text-sm font-semibold text-barn-dark/50 uppercase tracking-wider mb-3">Line Item Detail</h4>
                {reportData.entries
                  .filter((e) => e.line_items.length > 0)
                  .map((e) => (
                    <div key={`li-${e.source}-${e.id}`} className="mb-3 rounded-lg bg-parchment/50 p-3">
                      <p className="text-xs font-medium text-barn-dark/60 mb-1">
                        {formatDate(e.performed_at)} — {capitalizeType(e.type)} — {e.horse_name}
                      </p>
                      {e.line_items.map((li, i) => (
                        <div key={i} className="flex justify-between text-sm text-barn-dark/70 pl-3">
                          <span>{i === e.line_items.length - 1 ? "└" : "├"} {li.description}</span>
                          <span className="font-medium">{formatCurrency(li.amount)}</span>
                        </div>
                      ))}
                    </div>
                  ))}
              </div>
            )}

            {/* Cost by type summary */}
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <h4 className="font-serif text-sm font-semibold text-barn-dark/50 uppercase tracking-wider mb-2">By Type</h4>
                <div className="rounded-xl border border-barn-dark/10 overflow-hidden">
                  {Object.entries(reportData.costByType).map(([type, data]) => (
                    <div key={type} className="flex items-center justify-between border-b border-barn-dark/5 px-3 py-2 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: getLogTypeColor(type) }} />
                        <span className="text-sm text-barn-dark">{capitalizeType(type)}</span>
                        <span className="text-xs text-barn-dark/40">({data.count})</span>
                      </div>
                      <span className="text-sm font-medium text-barn-dark">{formatCurrency(data.total) || "—"}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-serif text-sm font-semibold text-barn-dark/50 uppercase tracking-wider mb-2">By Horse</h4>
                <div className="rounded-xl border border-barn-dark/10 overflow-hidden">
                  {Object.entries(reportData.costByHorse).map(([, data]) => (
                    <div key={data.name} className="flex items-center justify-between border-b border-barn-dark/5 px-3 py-2 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-barn-dark">{data.name}</span>
                        <span className="text-xs text-barn-dark/40">({data.count})</span>
                      </div>
                      <span className="text-sm font-medium text-barn-dark">{formatCurrency(data.total) || "—"}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Grand total */}
            <div className="mt-6 flex justify-end border-t-2 border-barn-dark/20 pt-3">
              <div className="text-right">
                <p className="text-xs text-barn-dark/50 uppercase tracking-wider">Grand Total</p>
                <p className="font-serif text-2xl font-semibold text-barn-dark">{formatCurrency(reportData.totalCost) || "$0.00"}</p>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-8 border-t border-barn-dark/10 pt-3 text-center text-xs text-barn-dark/30">
              Generated by BarnBook · barnbook.us
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
