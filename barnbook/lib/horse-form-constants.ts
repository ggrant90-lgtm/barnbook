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
  "breed_data",
] as const;

export const BREED_DATA_SUBTYPES = [
  "custom",
  "heat_detected",
  "bred_ai",
  "flush_embryo",
  "embryo_transfer",
  "ultrasound",
  "foaling",
] as const;

export type BreedDataSubtype = (typeof BREED_DATA_SUBTYPES)[number];

export const BREED_DATA_SUBTYPE_LABELS: Record<BreedDataSubtype, string> = {
  custom: "Custom Entry",
  heat_detected: "Heat Detected",
  bred_ai: "Bred / AI",
  flush_embryo: "Flush / Embryo Recovery",
  embryo_transfer: "Embryo Transfer",
  ultrasound: "Ultrasound / Pregnancy Check",
  foaling: "Foaling",
};

export const BREEDING_METHODS = [
  "Live Cover",
  "AI Fresh",
  "AI Cooled",
  "AI Frozen",
] as const;

export const ULTRASOUND_RESULTS = [
  "Open",
  "Bred Confirmed",
  "Pregnancy Confirmed",
  "Loss Detected",
  "Inconclusive",
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
    breed_data: "Breed Data",
  };
  return map[type] ?? type;
}
