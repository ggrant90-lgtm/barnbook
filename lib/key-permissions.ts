/**
 * Granular key permission levels — applied to both Barn Keys and Stall Keys.
 *
 * view_only        — read-only; cannot create or edit any log entries
 * log_all          — can create any log entry type
 * full_contributor — can create + edit their own log entries (not others')
 * custom           — allowed_log_types[] lists exactly which types
 *
 * NO key holder (regardless of level) can edit horse profiles or
 * delete horses — those are owner-only and enforced by RLS.
 */

export const PERMISSION_LEVELS = [
  "view_only",
  "log_all",
  "full_contributor",
  "custom",
] as const;

export type PermissionLevel = (typeof PERMISSION_LEVELS)[number];

export const PERMISSION_LEVEL_LABELS: Record<PermissionLevel, string> = {
  view_only: "View Only",
  log_all: "Log All",
  full_contributor: "Full Contributor",
  custom: "Custom",
};

export const PERMISSION_LEVEL_DESCRIPTIONS: Record<PermissionLevel, string> = {
  view_only:
    "Can see the horse profile, logs, and records. Cannot create entries.",
  log_all:
    "Can create any type of log entry. Cannot edit horse profiles.",
  full_contributor:
    "Can create and edit their own log entries. Cannot edit horse profiles.",
  custom:
    "Pick exactly which log types this person can create.",
};

export const PERMISSION_LEVEL_EMOJI: Record<PermissionLevel, string> = {
  view_only: "🔍",
  log_all: "📝",
  full_contributor: "⭐",
  custom: "⚙️",
};

/**
 * Badge colors — used across KeyCard, horse profile, dashboard.
 * Slate / forest / brass / saddle — follows the BarnBook palette.
 */
export const PERMISSION_LEVEL_COLORS: Record<
  PermissionLevel,
  { bg: string; fg: string }
> = {
  view_only: { bg: "#e2e8f0", fg: "#475569" },       // slate
  log_all: { bg: "#dcfce7", fg: "#166534" },         // forest
  full_contributor: { bg: "#fef3c7", fg: "#8b4a2b" }, // brass
  custom: { bg: "#f5e6d3", fg: "#8b4a2b" },          // saddle
};

/**
 * Map the four new values to a legacy role for the `barn_members.role`
 * column, so `isEditorPlusRole` and any other legacy consumers keep
 * working during the transition.
 */
export function permissionLevelToLegacyRole(
  level: PermissionLevel,
): "viewer" | "editor" {
  return level === "view_only" ? "viewer" : "editor";
}

/**
 * Does a given permission level allow creating the specified log type?
 * Mirrors the SQL `user_can_log_entry` helper — keep in sync.
 */
export function canCreateLogType(
  level: PermissionLevel | null | undefined,
  allowedTypes: string[] | null | undefined,
  logType: string,
): boolean {
  if (!level) return false;
  if (level === "view_only") return false;
  if (level === "log_all" || level === "full_contributor") return true;
  if (level === "custom") {
    return Array.isArray(allowedTypes) && allowedTypes.includes(logType);
  }
  return false;
}

/**
 * Accept legacy `viewer`/`editor` values at read time and map forward
 * to the new vocabulary. Write paths should always use the new values.
 */
export function normalizePermissionLevel(
  raw: string | null | undefined,
): PermissionLevel | null {
  if (!raw) return null;
  if ((PERMISSION_LEVELS as readonly string[]).includes(raw)) {
    return raw as PermissionLevel;
  }
  if (raw === "viewer") return "view_only";
  if (raw === "editor") return "log_all";
  return null;
}
