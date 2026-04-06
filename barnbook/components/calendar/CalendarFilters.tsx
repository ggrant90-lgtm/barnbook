"use client";

import { useState } from "react";
import { getLogTypeColor, getLogTypeLabel } from "@/lib/logTypeColors";

interface Horse { id: string; name: string }
interface BarnMember { id: string; name: string; role: string }

interface Filters {
  horses: string[];
  types: string[];
  performers: string[];
  minCost: number | undefined;
  maxCost: number | undefined;
  hasNotes: boolean;
  hasCost: boolean;
  scheduled: "all" | "scheduled" | "completed";
  keyword: string;
}

interface Props {
  horses: Horse[];
  logTypes: string[];
  barnMembers: BarnMember[];
  filters: Filters;
  onFiltersChange: (f: Filters) => void;
  hasActiveFilters: boolean;
  onClearAll: () => void;
}

function MultiSelect({
  label,
  options,
  selected,
  onChange,
  renderOption,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
  renderOption?: (opt: { value: string; label: string }) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  const displayLabel =
    selected.length === 0
      ? `All ${label.toLowerCase()}`
      : selected.length === 1
        ? options.find((o) => o.value === selected[0])?.label ?? "1 selected"
        : `${selected.length} ${label.toLowerCase()}`;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition ${
          selected.length > 0
            ? "border-brass-gold bg-brass-gold/10 text-barn-dark font-medium"
            : "border-barn-dark/15 bg-white text-barn-dark/70 hover:border-barn-dark/30"
        }`}
      >
        {displayLabel}
        <svg className="h-3.5 w-3.5 opacity-50" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-1 max-h-64 w-56 overflow-y-auto rounded-xl border border-barn-dark/10 bg-white shadow-lg">
            {options.map((opt) => {
              const checked = selected.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(
                      checked
                        ? selected.filter((v) => v !== opt.value)
                        : [...selected, opt.value],
                    );
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-parchment transition"
                >
                  <div
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      checked ? "border-brass-gold bg-brass-gold" : "border-barn-dark/20"
                    }`}
                  >
                    {checked && (
                      <svg className="h-3 w-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  {renderOption ? renderOption(opt) : <span>{opt.label}</span>}
                </button>
              );
            })}
            {selected.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="w-full border-t border-barn-dark/5 px-3 py-2 text-left text-xs text-barn-dark/50 hover:text-barn-dark transition"
              >
                Clear selection
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function CalendarFilters({
  horses,
  logTypes,
  barnMembers,
  filters,
  onFiltersChange,
  hasActiveFilters,
  onClearAll,
}: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const update = (partial: Partial<Filters>) => {
    onFiltersChange({ ...filters, ...partial });
  };

  return (
    <div className="space-y-3">
      {/* Primary filter row */}
      <div className="flex flex-wrap items-center gap-2">
        <MultiSelect
          label="Horses"
          options={horses.map((h) => ({ value: h.id, label: h.name }))}
          selected={filters.horses}
          onChange={(horses) => update({ horses })}
        />

        <MultiSelect
          label="Types"
          options={logTypes.map((t) => ({ value: t, label: getLogTypeLabel(t) }))}
          selected={filters.types}
          onChange={(types) => update({ types })}
          renderOption={(opt) => (
            <span className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: getLogTypeColor(opt.value) }}
              />
              {opt.label}
            </span>
          )}
        />

        <MultiSelect
          label="Performers"
          options={barnMembers.map((m) => ({
            value: m.id,
            label: `${m.name} — ${m.role}`,
          }))}
          selected={filters.performers}
          onChange={(performers) => update({ performers })}
        />

        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition ${
            showAdvanced
              ? "border-brass-gold bg-brass-gold/10 text-barn-dark"
              : "border-barn-dark/15 bg-white text-barn-dark/50 hover:border-barn-dark/30"
          }`}
        >
          More filters
          <svg
            className={`h-3.5 w-3.5 transition ${showAdvanced ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
          </svg>
        </button>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClearAll}
            className="rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Advanced filters row */}
      {showAdvanced && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-barn-dark/10 bg-parchment/30 p-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-barn-dark/50">Min $</label>
            <input
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={filters.minCost ?? ""}
              onChange={(e) =>
                update({ minCost: e.target.value ? Number(e.target.value) : undefined })
              }
              className="w-20 rounded-lg border border-barn-dark/15 bg-white px-2 py-1.5 text-sm outline-none focus:border-brass-gold"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-barn-dark/50">Max $</label>
            <input
              type="number"
              inputMode="decimal"
              placeholder="∞"
              value={filters.maxCost ?? ""}
              onChange={(e) =>
                update({ maxCost: e.target.value ? Number(e.target.value) : undefined })
              }
              className="w-20 rounded-lg border border-barn-dark/15 bg-white px-2 py-1.5 text-sm outline-none focus:border-brass-gold"
            />
          </div>

          <label className="flex items-center gap-1.5 text-sm text-barn-dark/60 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.hasNotes}
              onChange={(e) => update({ hasNotes: e.target.checked })}
              className="rounded accent-brass-gold"
            />
            Has notes
          </label>

          <label className="flex items-center gap-1.5 text-sm text-barn-dark/60 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.hasCost}
              onChange={(e) => update({ hasCost: e.target.checked })}
              className="rounded accent-brass-gold"
            />
            Has cost
          </label>

          <div className="flex rounded-lg border border-barn-dark/15 bg-white overflow-hidden">
            {(["all", "scheduled", "completed"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => update({ scheduled: s })}
                className={`px-2.5 py-1.5 text-xs font-medium capitalize transition ${
                  filters.scheduled === s
                    ? "bg-brass-gold text-barn-dark"
                    : "text-barn-dark/50 hover:bg-parchment"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <input
            type="text"
            placeholder="Search notes…"
            value={filters.keyword}
            onChange={(e) => update({ keyword: e.target.value })}
            className="w-40 rounded-lg border border-barn-dark/15 bg-white px-3 py-1.5 text-sm outline-none focus:border-brass-gold placeholder:text-barn-dark/30"
          />
        </div>
      )}
    </div>
  );
}
