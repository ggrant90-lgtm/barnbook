import type { ActivityLog, HealthRecord } from "@/lib/types";

export function getActivitySummary(a: ActivityLog): string {
  const d = a.details as Record<string, unknown> | null;
  if (a.activity_type === "exercise" && d?.subtype) {
    return `${String(d.subtype)}${a.duration_minutes ? ` · ${a.duration_minutes} min` : ""}`;
  }
  if (a.activity_type === "pony") {
    return `Pony${a.duration_minutes ? ` · ${a.duration_minutes} min` : ""}`;
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
  if (a.activity_type === "breed_data" && d?.breed_subtype) {
    const subtypeLabels: Record<string, string> = {
      custom: "Custom Entry",
      heat_detected: "Heat Detected",
      bred_ai: "Bred / AI",
      flush_embryo: "Flush / Embryo Recovery",
      embryo_transfer: "Embryo Transfer",
      ultrasound: "Ultrasound / Pregnancy Check",
      foaling: "Foaling",
    };
    return subtypeLabels[String(d.breed_subtype)] ?? "Breed Data";
  }
  return a.activity_type;
}

export function getHealthSummary(h: HealthRecord): string {
  return h.description ?? h.record_type;
}
