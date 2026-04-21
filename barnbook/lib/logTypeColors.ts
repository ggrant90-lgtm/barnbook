/** Color palette for log entry types — used by calendar, reports, and charts */
export const LOG_TYPE_COLORS: Record<string, string> = {
  exercise: "#2a4031",
  pony: "#5a7c4c",
  shoeing: "#8b4a2b",
  worming: "#c9932a",
  vet_visit: "#b8421f",
  feed: "#6b7339",
  medication: "#7a4a6b",
  note: "#4a5055",
  breed_data: "#c9a84c",
  // Breed data subtype colors
  heat_detected: "#f59e0b",
  bred_ai: "#22c55e",
  ultrasound: "#3b82f6",
  flush_embryo: "#a855f7",
  embryo_transfer: "#a855f7",
  foaling: "#ec4899",
  // Health record types (alias to match)
  Shoeing: "#8b4a2b",
  Worming: "#c9932a",
  "Vet visit": "#b8421f",
};

export function getLogTypeColor(type: string): string {
  return LOG_TYPE_COLORS[type] ?? LOG_TYPE_COLORS[type.toLowerCase()] ?? "#4a5055";
}

export const LOG_TYPE_LABELS: Record<string, string> = {
  exercise: "Exercise",
  pony: "Pony",
  shoeing: "Shoeing",
  worming: "Worming",
  vet_visit: "Vet Visit",
  feed: "Feed",
  medication: "Medication",
  note: "Note",
  breed_data: "Breed Data",
  heat_detected: "Heat Detected",
  bred_ai: "Bred / AI",
  ultrasound: "Ultrasound",
  flush_embryo: "Flush / Embryo",
  embryo_transfer: "Embryo Transfer",
  foaling: "Foaling",
};

export function getLogTypeLabel(type: string): string {
  return LOG_TYPE_LABELS[type] ?? type.charAt(0).toUpperCase() + type.slice(1);
}
