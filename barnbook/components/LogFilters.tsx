"use client";

import { logTypeLabel } from "@/lib/horse-form-constants";

interface LogFiltersProps {
  types: string[];
  selectedType: string | null;
  onTypeChange: (type: string | null) => void;
  dateRange: string;
  onDateRangeChange: (range: string) => void;
}

const DATE_RANGES = [
  { value: "all", label: "All time" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "year", label: "This year" },
];

export function LogFilters({
  types,
  selectedType,
  onTypeChange,
  dateRange,
  onDateRangeChange,
}: LogFiltersProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onTypeChange(null)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition ${
            selectedType === null
              ? "bg-brass-gold text-barn-dark"
              : "bg-barn-dark/5 text-barn-dark/60 hover:bg-barn-dark/10"
          }`}
        >
          All
        </button>
        {types.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onTypeChange(t === selectedType ? null : t)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              selectedType === t
                ? "bg-brass-gold text-barn-dark"
                : "bg-barn-dark/5 text-barn-dark/60 hover:bg-barn-dark/10"
            }`}
          >
            {logTypeLabel(t)}
          </button>
        ))}
      </div>
      <select
        value={dateRange}
        onChange={(e) => onDateRangeChange(e.target.value)}
        className="rounded-lg border border-barn-dark/15 bg-white px-3 py-1.5 text-xs text-barn-dark"
      >
        {DATE_RANGES.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>
    </div>
  );
}
