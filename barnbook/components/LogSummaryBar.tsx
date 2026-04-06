"use client";

interface LogSummaryBarProps {
  entryCount: number;
  totalCost: number | null;
  dateRange: { earliest: string; latest: string } | null;
}

function formatCurrency(val: number): string {
  return val.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function LogSummaryBar({
  entryCount,
  totalCost,
  dateRange,
}: LogSummaryBarProps) {
  if (entryCount === 0) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-barn-dark/8 bg-parchment/40 px-4 py-2 text-xs text-barn-dark/55">
      <span>
        <span className="font-medium text-barn-dark/70">{entryCount}</span>{" "}
        {entryCount === 1 ? "entry" : "entries"}
      </span>

      {totalCost != null && totalCost > 0 && (
        <>
          <span className="text-barn-dark/20">·</span>
          <span>
            <span className="font-medium text-barn-dark/70">
              {formatCurrency(totalCost)}
            </span>{" "}
            total
          </span>
        </>
      )}

      {dateRange && (
        <>
          <span className="text-barn-dark/20">·</span>
          <span>
            {formatShortDate(dateRange.earliest)}
            {dateRange.earliest !== dateRange.latest
              ? ` – ${formatShortDate(dateRange.latest)}`
              : ""}
          </span>
        </>
      )}
    </div>
  );
}
