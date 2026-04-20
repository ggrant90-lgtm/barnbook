/**
 * Plan utility functions — pure, work in both server and client.
 *
 * Capacity model: every barn starts with some number of base_stalls (free
 * tier = 5). Owners can add 10-stall blocks via barn_stall_blocks. The
 * *effective* capacity is base_stalls + SUM(active blocks.block_size).
 *
 * The helpers below take `effectiveCapacity` explicitly so they're pure
 * and can be called from anywhere without a second DB round-trip. The
 * server helper that produces that number lives in `lib/plans.server.ts`
 * (see getBarnCapacitySnapshot).
 */

/** Free-tier barns start with this many stalls. */
export const FREE_BASE_STALLS = 5;

/** Every paid expansion adds stalls in blocks of this size. */
export const STALL_BLOCK_SIZE = 10;

/** Post-early-access block price ($25.00 / month). */
export const STALL_BLOCK_PRICE_CENTS = 2500;
export const STALL_BLOCK_PRICE_LABEL = "$25/mo";

export const PLAN_TIERS = ["free", "paid", "comped"] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];

export const GRACE_PERIOD_DAYS = 30;

/** Does this barn have capacity for one more horse? */
export function canAddHorseToBarn(
  barn: { grace_period_ends_at: string | null },
  currentHorseCount: number,
  effectiveCapacity: number,
): boolean {
  if (isInGracePeriod(barn)) return false;
  return currentHorseCount < effectiveCapacity;
}

/** How many stalls remain? */
export function stallsRemaining(
  currentHorseCount: number,
  effectiveCapacity: number,
): number {
  return Math.max(0, effectiveCapacity - currentHorseCount);
}

/** Is this barn over capacity? */
export function isBarnOverCapacity(
  currentHorseCount: number,
  effectiveCapacity: number,
): boolean {
  return currentHorseCount > effectiveCapacity;
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
  currentHorseCount: number,
  effectiveCapacity: number,
): number {
  if (effectiveCapacity <= 0) return 100;
  return Math.round((currentHorseCount / effectiveCapacity) * 100);
}

/** Capacity color state */
export function capacityColorState(
  currentHorseCount: number,
  effectiveCapacity: number,
): "normal" | "warning" | "critical" {
  const pct = capacityPercent(currentHorseCount, effectiveCapacity);
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
