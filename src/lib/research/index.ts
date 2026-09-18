/**
 * Research Provider Factory
 * Returns the correct provider based on environment configuration.
 */

import type { ResearchProvider } from "./provider";
import { MockResearchProvider } from "./mock-provider";
import { FirecrawlProvider } from "./firecrawl-provider";

export { type ResearchProvider } from "./provider";
export { MockResearchProvider } from "./mock-provider";
export { FirecrawlProvider } from "./firecrawl-provider";

let _cachedProvider: ResearchProvider | null = null;

export function getResearchProvider(): ResearchProvider {
  if (_cachedProvider) return _cachedProvider;

  const providerType = process.env.RESEARCH_PROVIDER ?? "mock";

  if (providerType === "real") {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey || apiKey.startsWith("placeholder")) {
      console.warn(
        "[ResearchProvider] RESEARCH_PROVIDER=real but FIRECRAWL_API_KEY is missing. Falling back to mock."
      );
      _cachedProvider = new MockResearchProvider();
    } else {
      _cachedProvider = new FirecrawlProvider(apiKey);
    }
  } else {
    _cachedProvider = new MockResearchProvider();
  }

  return _cachedProvider;
}
