/**
 * Helpers for deciding which horse name to show as the primary display
 * name. Driven by the per-horse `primary_name_pref` column:
 *   - 'papered' → horses.name (registered/papered name, default)
 *   - 'barn'    → horses.barn_name (nickname)
 *
 * Deliberately honors the user's choice literally: if they picked
 * 'barn' but barn_name is empty, we show the "Unnamed" placeholder
 * rather than silently falling back to the papered name. That was the
 * product decision for the toggle — don't invent a fallback the user
 * didn't ask for.
 */

export interface HorseNameShape {
  name: string;
  barn_name: string | null;
  primary_name_pref?: "papered" | "barn" | null;
}

const UNNAMED_PLACEHOLDER = "Unnamed";

/** The name that should render as the main label for this horse. */
export function getHorseDisplayName(horse: HorseNameShape): string {
  if (horse.primary_name_pref === "barn") {
    const bn = horse.barn_name?.trim();
    return bn && bn.length > 0 ? bn : UNNAMED_PLACEHOLDER;
  }
  return horse.name;
}

/**
 * The other name to show as a subtitle / alias under the primary.
 * Returns null when there is no secondary to show (e.g. the two names
 * are identical, or the secondary field is empty).
 */
export function getHorseSecondaryName(horse: HorseNameShape): string | null {
  if (horse.primary_name_pref === "barn") {
    const papered = horse.name?.trim();
    if (!papered) return null;
    const bn = horse.barn_name?.trim() ?? "";
    if (papered.toLowerCase() === bn.toLowerCase()) return null;
    return papered;
  }
  const bn = horse.barn_name?.trim();
  if (!bn) return null;
  if (bn.toLowerCase() === horse.name?.trim().toLowerCase()) return null;
  return bn;
}
