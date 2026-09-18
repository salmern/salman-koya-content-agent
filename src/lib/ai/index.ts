/**
 * AI Provider Factory
 */

import type { AiProvider } from "./provider";
import { MockAiProvider } from "./mock-provider";
import { ClaudeProvider } from "./claude-provider";

export { type AiProvider } from "./provider";
export { MockAiProvider } from "./mock-provider";
export { ClaudeProvider } from "./claude-provider";

let _cachedProvider: AiProvider | null = null;

export function getAiProvider(): AiProvider {
  if (_cachedProvider) return _cachedProvider;

  const providerType = process.env.AI_PROVIDER ?? "mock";

  if (providerType === "real") {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey.startsWith("placeholder")) {
      console.warn(
        "[AiProvider] AI_PROVIDER=real but ANTHROPIC_API_KEY is missing. Falling back to mock."
      );
      _cachedProvider = new MockAiProvider();
    } else {
      _cachedProvider = new ClaudeProvider(apiKey);
    }
  } else {
    _cachedProvider = new MockAiProvider();
  }

  return _cachedProvider;
}
