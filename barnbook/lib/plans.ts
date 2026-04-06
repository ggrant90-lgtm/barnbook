/**
 * Plan utility functions — pure, work in both server and client.
 * The paywall is currently OFF: DEFAULT_FREE_STALL_CAPACITY = 999.
 * Flip to 5 when ready to enforce the free tier limit.
 */

export const DEFAULT_FREE_STALL_CAPACITY = 999;
export const PLAN_TIERS = ["free", "paid", "comped"] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];

export const STALL_BLOCK_SIZES = [
  { size: 10, label: "10 Stalls", priceCents: 2999, priceLabel: "$29.99/mo" },
  { size: 20, label: "20 Stalls", priceCents: 4999, priceLabel: "$49.99/mo" },
] as const;

export const GRACE_PERIOD_DAYS = 30;

interface BarnCapacity {
  stall_capacity: number;
  plan_tier: string;
  grace_period_ends_at: string | null;
}

/** Does this barn have capacity for one more horse? */
export function canAddHorseToBarn(
  barn: BarnCapacity,
  currentHorseCount: number,
): boolean {
  if (isInGracePeriod(barn)) return false;
  return currentHorseCount < barn.stall_capacity;
}

/** How many stalls remain? */
export function stallsRemaining(
  barn: { stall_capacity: number },
  currentHorseCount: number,
): number {
  return Math.max(0, barn.stall_capacity - currentHorseCount);
}

/** Is this barn over capacity? */
export function isBarnOverCapacity(
  barn: { stall_capacity: number },
  currentHorseCount: number,
): boolean {
  return currentHorseCount > barn.stall_capacity;
}

/** Is this barn currently in a grace period? */
export function isInGracePeriod(
  barn: { grace_period_ends_at: string | null },
): boolean {
  if (!barn.grace_period_ends_at) return false;
  return new Date(barn.grace_period_ends_at) > new Date();
}

/** Days remaining in grace period, or null if no active grace period */
export function graceDaysRemaining(
  barn: { grace_period_ends_at: string | null },
): number | null {
  if (!barn.grace_period_ends_at) return null;
  const end = new Date(barn.grace_period_ends_at);
  const now = new Date();
  if (end <= now) return 0;
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/** Is this barn on the free tier? */
export function isFreeTier(barn: { plan_tier: string }): boolean {
  return barn.plan_tier === "free";
}

/** Capacity percentage (0-100+) */
export function capacityPercent(
  barn: { stall_capacity: number },
  currentHorseCount: number,
): number {
  if (barn.stall_capacity === 0) return 100;
  return Math.round((currentHorseCount / barn.stall_capacity) * 100);
}

/** Capacity color state */
export function capacityColorState(
  barn: { stall_capacity: number },
  currentHorseCount: number,
): "normal" | "warning" | "critical" {
  const pct = capacityPercent(barn, currentHorseCount);
  if (pct >= 100) return "critical";
  if (pct >= 80) return "warning";
  return "normal";
}

/** Plan tier display label */
export function planTierLabel(tier: string): string {
  switch (tier) {
    case "free": return "Free";
    case "paid": return "Pro";
    case "comped": return "Complimentary";
    default: return tier;
  }
}
