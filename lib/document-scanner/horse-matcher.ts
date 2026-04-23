import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExtractedHorseData } from "@/lib/document-extraction-prompt";

export interface MatchedHorse {
  id: string;
  name: string;
  barn_id: string;
  breed: string | null;
  sex: string | null;
  color: string | null;
  registration_number: string | null;
  photo_url: string | null;
  owner_name: string | null;
}

export type MatchStatus =
  | "exact_match"
  | "possible_match"
  | "multiple_matches"
  | "no_match";

export interface MatchResult {
  status: MatchStatus;
  matched_horse: MatchedHorse | null;
  possible_horses: MatchedHorse[] | null;
  match_confidence: "high" | "medium" | "low";
  match_reason: string;
}

async function accessibleBarnIds(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string,
): Promise<string[]> {
  // Owned + membership barns.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [{ data: owned }, { data: members }] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from("barns").select("id").eq("owner_id", userId),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("barn_members")
      .select("barn_id")
      .eq("user_id", userId),
  ]);
  const ids = new Set<string>();
  for (const b of (owned ?? []) as { id: string }[]) ids.add(b.id);
  for (const m of (members ?? []) as { barn_id: string }[]) ids.add(m.barn_id);
  return [...ids];
}

const HORSE_COLS =
  "id, name, barn_id, breed, sex, color, registration_number, photo_url, owner_name";

/**
 * Match an extracted horse against the user's accessible horses.
 *
 * Strategy (in priority order, short-circuits on confident hit):
 *   1. Exact registration_number match
 *   2. Exact name match (case-insensitive)
 *   3. Fuzzy name match (substring both directions)
 *   4. Attribute fallback (breed + color + sex)
 *   5. No match
 */
export async function matchExtractedHorse(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string,
  extracted: ExtractedHorseData,
): Promise<MatchResult> {
  const barnIds = await accessibleBarnIds(supabase, userId);
  if (barnIds.length === 0) {
    return {
      status: "no_match",
      matched_horse: null,
      possible_horses: null,
      match_confidence: "low",
      match_reason: "No accessible barns.",
    };
  }

  // 1. Registration number — highest signal.
  if (extracted.registration_number) {
    const reg = extracted.registration_number.trim();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("horses")
      .select(HORSE_COLS)
      .in("barn_id", barnIds)
      .eq("archived", false)
      .eq("registration_number", reg)
      .limit(5);
    const rows = (data ?? []) as MatchedHorse[];
    if (rows.length === 1) {
      return {
        status: "exact_match",
        matched_horse: rows[0],
        possible_horses: null,
        match_confidence: "high",
        match_reason: `Registration number ${reg} matches.`,
      };
    }
    if (rows.length > 1) {
      return {
        status: "multiple_matches",
        matched_horse: null,
        possible_horses: rows,
        match_confidence: "medium",
        match_reason: `Multiple horses share registration number ${reg}.`,
      };
    }
  }

  // 2. Exact name match.
  const rawName = extracted.horse_name?.trim();
  if (rawName) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("horses")
      .select(HORSE_COLS)
      .in("barn_id", barnIds)
      .eq("archived", false)
      .ilike("name", rawName)
      .limit(10);
    const rows = (data ?? []) as MatchedHorse[];
    if (rows.length === 1) {
      return {
        status: "exact_match",
        matched_horse: rows[0],
        possible_horses: null,
        match_confidence: "high",
        match_reason: `Name "${rawName}" matches.`,
      };
    }
    if (rows.length > 1) {
      return {
        status: "multiple_matches",
        matched_horse: null,
        possible_horses: rows,
        match_confidence: "medium",
        match_reason: `Multiple horses named "${rawName}" in your barns.`,
      };
    }
  }

  // 3. Fuzzy name match — substring both directions.
  if (rawName) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("horses")
      .select(HORSE_COLS)
      .in("barn_id", barnIds)
      .eq("archived", false)
      .limit(500);
    const lower = rawName.toLowerCase();
    const fuzzy = ((data ?? []) as MatchedHorse[]).filter((h) => {
      const n = h.name.toLowerCase();
      return n.includes(lower) || lower.includes(n);
    });
    if (fuzzy.length === 1) {
      return {
        status: "possible_match",
        matched_horse: fuzzy[0],
        possible_horses: null,
        match_confidence: "medium",
        match_reason: `Fuzzy name match to "${fuzzy[0].name}".`,
      };
    }
    if (fuzzy.length > 1) {
      return {
        status: "multiple_matches",
        matched_horse: null,
        possible_horses: fuzzy.slice(0, 10),
        match_confidence: "medium",
        match_reason: `Multiple name-similar matches for "${rawName}".`,
      };
    }
  }

  // 4. Attribute fallback — breed + color + sex.
  if (extracted.breed && extracted.color && extracted.sex) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("horses")
      .select(HORSE_COLS)
      .in("barn_id", barnIds)
      .eq("archived", false)
      .ilike("breed", extracted.breed)
      .ilike("color", extracted.color)
      .ilike("sex", extracted.sex)
      .limit(10);
    const rows = (data ?? []) as MatchedHorse[];
    if (rows.length > 0) {
      return {
        status: "multiple_matches",
        matched_horse: null,
        possible_horses: rows,
        match_confidence: "low",
        match_reason: `Attribute match on breed + color + sex.`,
      };
    }
  }

  return {
    status: "no_match",
    matched_horse: null,
    possible_horses: null,
    match_confidence: "low",
    match_reason: "No horse in your barns matches this document.",
  };
}
