/** Join class names; skips falsy entries. */
export function cn(...parts: (string | undefined | false | null)[]): string {
  return parts.filter(Boolean).join(" ");
}
