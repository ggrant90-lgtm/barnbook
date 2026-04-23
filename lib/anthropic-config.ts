/**
 * Server-only Anthropic API key resolver.
 *
 * IMPORTANT: This file must never be imported from a client component.
 * The env var intentionally lacks the NEXT_PUBLIC_ prefix so it stays on
 * the server. Any client-side import will resolve to an empty string and
 * fail at runtime — which is the intended failure mode.
 */
export function getAnthropicApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY ?? "";
  if (!key) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Configure it in your Vercel env or .env.local.",
    );
  }
  return key;
}

/**
 * Default vision model for document extraction.
 *
 * Pinned behind a constant so future model upgrades are a one-line change.
 * Can be overridden via env var `CLAUDE_VISION_MODEL` for cost tuning
 * (e.g. `claude-sonnet-4-6` is ~60% cheaper for similar extraction quality).
 */
export function getClaudeVisionModel(): string {
  return process.env.CLAUDE_VISION_MODEL || "claude-opus-4-6";
}
