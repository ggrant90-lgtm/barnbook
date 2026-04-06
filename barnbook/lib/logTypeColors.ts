/** Color palette for log entry types — used by calendar, reports, and charts */
export const LOG_TYPE_COLORS: Record<string, string> = {
  exercise: "#2a4031",
  shoeing: "#8b4a2b",
  worming: "#c9932a",
  vet_visit: "#b8421f",
  feed: "#6b7339",
  medication: "#7a4a6b",
  note: "#4a5055",
  breed_data: "#c9a84c",
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
  shoeing: "Shoeing",
  worming: "Worming",
  vet_visit: "Vet Visit",
  feed: "Feed",
  medication: "Medication",
  note: "Note",
  breed_data: "Breed Data",
};

export function getLogTypeLabel(type: string): string {
  return LOG_TYPE_LABELS[type] ?? type.charAt(0).toUpperCase() + type.slice(1);
}
