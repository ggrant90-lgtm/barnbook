import { cosineSimilarity } from "@/lib/embeddings";

export type BiometricRow = {
  horse_id: string;
  pose_key: string;
  embedding: unknown;
};

/**
 * Normalizes JSONB / API embedding values to a numeric vector.
 */
export function parseStoredEmbedding(raw: unknown): number[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: number[] = [];
  for (let i = 0; i < raw.length; i++) {
    const n = raw[i];
    if (typeof n !== "number" || Number.isNaN(n)) return null;
    out.push(n);
  }
  return out;
}

/**
 * For each horse, keeps the best (highest) similarity across all pose rows.
 * Returns horses sorted by score descending.
 */
export function rankHorsesByProbe(
  probe: number[],
  rows: BiometricRow[],
): { horseId: string; score: number }[] {
  const best = new Map<string, number>();

  for (const row of rows) {
    const vec = parseStoredEmbedding(row.embedding);
    if (!vec || vec.length !== probe.length) continue;
    const score = cosineSimilarity(probe, vec);
    const prev = best.get(row.horse_id);
    if (prev === undefined || score > prev) {
      best.set(row.horse_id, score);
    }
  }

  return [...best.entries()]
    .map(([horseId, score]) => ({ horseId, score }))
    .sort((a, b) => b.score - a.score);
}
