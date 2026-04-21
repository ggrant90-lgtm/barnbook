import type { Barn } from "@/lib/types";

export type BarnType = Barn["barn_type"];

export const BARN_TYPES: readonly BarnType[] = [
  "standard",
  "mare_motel",
  "service",
] as const;

export const BARN_TYPE_LABELS: Record<BarnType, string> = {
  standard: "Standard Barn",
  mare_motel: "Mare Motel",
  service: "Service Barn",
};

export const BARN_TYPE_DESCRIPTIONS: Record<BarnType, string> = {
  standard:
    "A regular barn for managing your horses and team.",
  mare_motel:
    "A breeding facility for organizing breeding horses separately.",
  service:
    "A workspace for service providers. Track every horse you work on, at every barn you visit, in one place.",
};

/** Pretty name-placeholder hint for the new-barn form. */
export const BARN_TYPE_NAME_PLACEHOLDERS: Record<BarnType, string> = {
  standard: "e.g. South Pasture",
  mare_motel: "e.g. Mare Motel East",
  service: "e.g. Jake's Farrier Service",
};

export function isServiceBarn(
  barn: { barn_type: BarnType } | null | undefined,
): boolean {
  return barn?.barn_type === "service";
}
