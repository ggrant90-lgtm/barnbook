export const HORSE_BREEDS = [
  "Thoroughbred",
  "Quarter Horse",
  "Arabian",
  "Warmblood",
  "Paint",
  "Appaloosa",
  "Morgan",
  "Andalusian",
  "Friesian",
  "Draft",
  "Pony",
  "Other",
] as const;

export const HORSE_SEX_OPTIONS = [
  "Mare",
  "Stallion",
  "Gelding",
  "Colt",
  "Filly",
  "Unknown",
] as const;

export const HORSE_INPUT_CLASS =
  "mt-1.5 w-full rounded-lg border border-border-warm bg-white px-3 py-2.5 text-barn-dark shadow-sm outline-none focus:border-brass focus:ring-2 focus:ring-brass/25";

export function breedSelectOptions(current: string | null): string[] {
  const base: string[] = [...HORSE_BREEDS];
  if (current && !base.includes(current)) base.push(current);
  return base;
}
