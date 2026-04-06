"use client";

import { planTierLabel } from "@/lib/plans";

const tierStyles: Record<string, string> = {
  free: "bg-barn-dark/8 text-barn-dark/60",
  paid: "bg-brass-gold/15 text-brass-gold",
  comped: "bg-green-100 text-green-700",
};

export function PlanBadge({ tier }: { tier: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${tierStyles[tier] ?? tierStyles.free}`}
    >
      {planTierLabel(tier)}
    </span>
  );
}
