import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicApiKey } from "./anthropic-config";

/**
 * Server-only Anthropic client factory. Do not import from a client component.
 */
export function createAnthropicClient(): Anthropic {
  return new Anthropic({ apiKey: getAnthropicApiKey() });
}
