import type { ActivityLog, HealthRecord } from "@/lib/types";

export function getActivitySummary(a: ActivityLog): string {
  const d = a.details as Record<string, unknown> | null;
  if (a.activity_type === "exercise" && d?.subtype) {
    return `${String(d.subtype)}${a.duration_minutes ? ` · ${a.duration_minutes} min` : ""}`;
  }
  if (a.activity_type === "feed" && d) {
    return [d.feed_type, d.amount].filter(Boolean).join(" · ") || a.activity_type;
  }
  if (a.activity_type === "medication" && d?.medication_name) {
    return String(d.medication_name);
  }
  if (a.activity_type === "note" && d?.title) {
    return String(d.title);
  }
  return a.activity_type;
}

export function getHealthSummary(h: HealthRecord): string {
  return h.description ?? h.record_type;
}
