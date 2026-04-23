"use client";

import { getLogTypeLabel, getLogTypeColor } from "@/lib/logTypeColors";

interface Horse { id: string; name: string }
interface BarnMember { id: string; name: string; role: string }

interface Filters {
  horses: string[];
  types: string[];
  performers: string[];
  minCost?: number;
  maxCost?: number;
  hasNotes: boolean;
  hasCost: boolean;
  scheduled: "all" | "scheduled" | "completed";
  keyword: string;
}

function Chip({
  label,
  color,
  onRemove,
}: {
  label: string;
  color?: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-barn-dark/10 bg-white px-2.5 py-1 text-xs text-barn-dark/70 shadow-sm">
      {color && (
        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
      )}
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 text-barn-dark/30 hover:text-red-500 transition"
      >
        ✕
      </button>
    </span>
  );
}

export function FilterChips({
  filters,
  horses,
  barnMembers,
  onRemove,
  onClearAll,
}: {
  filters: Filters;
  horses: Horse[];
  barnMembers: BarnMember[];
  onRemove: (key: string, value?: string) => void;
  onClearAll: () => void;
}) {
  const chips: React.ReactNode[] = [];

  const horseNameMap = new Map(horses.map((h) => [h.id, h.name]));
  const memberNameMap = new Map(barnMembers.map((m) => [m.id, m.name]));

  for (const h of filters.horses) {
    chips.push(
      <Chip key={`h-${h}`} label={horseNameMap.get(h) ?? "Horse"} onRemove={() => onRemove("horses", h)} />,
    );
  }
  for (const t of filters.types) {
    chips.push(
      <Chip
        key={`t-${t}`}
        label={getLogTypeLabel(t)}
        color={getLogTypeColor(t)}
        onRemove={() => onRemove("types", t)}
      />,
    );
  }
  for (const p of filters.performers) {
    chips.push(
      <Chip key={`p-${p}`} label={memberNameMap.get(p) ?? "Member"} onRemove={() => onRemove("performers", p)} />,
    );
  }
  if (filters.minCost !== undefined) {
    chips.push(
      <Chip key="minCost" label={`Min $${filters.minCost}`} onRemove={() => onRemove("minCost")} />,
    );
  }
  if (filters.maxCost !== undefined) {
    chips.push(
      <Chip key="maxCost" label={`Max $${filters.maxCost}`} onRemove={() => onRemove("maxCost")} />,
    );
  }
  if (filters.hasNotes) {
    chips.push(<Chip key="hasNotes" label="Has notes" onRemove={() => onRemove("hasNotes")} />);
  }
  if (filters.hasCost) {
    chips.push(<Chip key="hasCost" label="Has cost" onRemove={() => onRemove("hasCost")} />);
  }
  if (filters.scheduled !== "all") {
    chips.push(
      <Chip
        key="scheduled"
        label={filters.scheduled === "scheduled" ? "Scheduled" : "Completed"}
        onRemove={() => onRemove("scheduled")}
      />,
    );
  }
  if (filters.keyword) {
    chips.push(
      <Chip key="keyword" label={`"${filters.keyword}"`} onRemove={() => onRemove("keyword")} />,
    );
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips}
      <button
        type="button"
        onClick={onClearAll}
        className="text-xs text-barn-dark/40 hover:text-red-500 transition ml-1"
      >
        Clear all
      </button>
    </div>
  );
}
