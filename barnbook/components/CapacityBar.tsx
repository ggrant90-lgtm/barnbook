"use client";

import { capacityPercent, capacityColorState } from "@/lib/plans";

const colorMap = {
  normal: { bar: "bg-brass-gold", text: "text-barn-dark/60" },
  warning: { bar: "bg-amber-500", text: "text-amber-700" },
  critical: { bar: "bg-red-500", text: "text-red-700" },
};

export function CapacityBar({
  stallCapacity,
  horseCount,
  compact = false,
}: {
  stallCapacity: number;
  horseCount: number;
  compact?: boolean;
}) {
  const pct = Math.min(capacityPercent({ stall_capacity: stallCapacity }, horseCount), 100);
  const state = capacityColorState({ stall_capacity: stallCapacity }, horseCount);
  const colors = colorMap[state];

  // Don't show capacity bar if unlimited (999)
  if (stallCapacity >= 999) {
    return compact ? (
      <span className="text-xs text-barn-dark/40">{horseCount} horses</span>
    ) : null;
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 rounded-full bg-barn-dark/8">
          <div
            className={`h-full rounded-full transition-all ${colors.bar}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className={`text-xs font-medium whitespace-nowrap ${colors.text}`}>
          {horseCount}/{stallCapacity}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-barn-dark/60">
          {horseCount} of {stallCapacity} stalls used
        </span>
        <span className={`text-xs font-medium ${colors.text}`}>
          {stallCapacity - horseCount} remaining
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-barn-dark/8">
        <div
          className={`h-full rounded-full transition-all ${colors.bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
