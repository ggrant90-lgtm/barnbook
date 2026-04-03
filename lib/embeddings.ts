/** Fixed dimension for placeholder embeddings (matches typical CLIP / face-encoder sizes). */
const EMBEDDING_DIMENSION = 512;

/**
 * Produces a deterministic embedding vector from raw image bytes.
 *
 * @param file - Image file or blob (typically from camera or gallery).
 * @returns A unit-length vector of length {@link EMBEDDING_DIMENSION}.
 */
export async function generateEmbedding(file: File | Blob): Promise<number[]> {
  /*
   * PLACEHOLDER: Replace with real CLIP embedding model via Hugging Face
   * Inference API or TensorFlow.js for production use
   */
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const vec = new Float64Array(EMBEDDING_DIMENSION);

  for (let d = 0; d < EMBEDDING_DIMENSION; d++) {
    let h = 0x811c9dc5 + d * 0x01000193;
    for (let i = 0; i < bytes.length; i++) {
      h ^= bytes[i];
      h = Math.imul(h, 0x01000193);
    }
    h ^= h >>> 16;
    h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13;
    vec[d] = (h / 0x7fffffff) * 2 - 1;
  }

  let sumSq = 0;
  for (let d = 0; d < EMBEDDING_DIMENSION; d++) {
    sumSq += vec[d] * vec[d];
  }
  const inv = 1 / Math.sqrt(sumSq || 1);
  return Array.from(vec, (v) => v * inv);
}

/**
 * Cosine similarity between two vectors of equal length, mapped to **[0, 1]**:
 * identical direction → `1`, orthogonal → `0.5`, opposite → `0`.
 *
 * @param a - First vector (e.g. enrollment embedding).
 * @param b - Second vector (e.g. probe embedding).
 * @returns Similarity in the range **[0, 1]**, or **0** if lengths differ or either vector has zero norm.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) {
    return 0;
  }
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  if (denom === 0) {
    return 0;
  }
  const cos = dot / denom;
  return (cos + 1) / 2;
}
