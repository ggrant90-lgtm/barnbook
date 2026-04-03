const SEG = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomSeg(len: number): string {
  let s = "";
  for (let i = 0; i < len; i++) {
    s += SEG[Math.floor(Math.random() * SEG.length)]!;
  }
  return s;
}

/** Format `BK-XXXX-XXXX` or `SK-XXXX-XXXX` (alphanumeric segments). */
export function generateKeyCode(prefix: "BK" | "SK"): string {
  return `${prefix}-${randomSeg(4)}-${randomSeg(4)}`;
}

/** e.g. `BK-****-7F2A` — shows prefix and last segment only. */
export function maskKeyCode(code: string): string {
  const parts = code.trim().split("-").filter(Boolean);
  if (parts.length < 2) return "****";
  const last = parts[parts.length - 1] ?? "";
  return `${parts[0]}-****-${last}`;
}
