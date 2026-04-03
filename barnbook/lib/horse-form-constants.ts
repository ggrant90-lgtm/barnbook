export const HORSE_SEX_OPTIONS = ["Mare", "Stallion", "Gelding", "Unknown"] as const;

export const HORSE_BREEDS = [
  "Thoroughbred",
  "Quarter Horse",
  "Warmblood",
  "Arabian",
  "Paint",
  "Appaloosa",
  "Morgan",
  "Tennessee Walker",
  "Pony",
  "Draft",
  "Other",
] as const;

export const EXERCISE_SUBTYPES = [
  "gallop",
  "jog",
  "walk",
  "swim",
  "treadmill",
] as const;

export const LOG_TYPES = [
  "exercise",
  "shoeing",
  "worming",
  "vet_visit",
  "feed",
  "medication",
  "note",
] as const;

export type LogType = (typeof LOG_TYPES)[number];

export function isLogType(s: string): s is LogType {
  return (LOG_TYPES as readonly string[]).includes(s);
}

export function logTypeLabel(type: string): string {
  const map: Record<string, string> = {
    exercise: "Exercise",
    shoeing: "Shoeing",
    worming: "Worming",
    vet_visit: "Vet visit",
    feed: "Feed",
    medication: "Medication",
    note: "Note",
  };
  return map[type] ?? type;
}
