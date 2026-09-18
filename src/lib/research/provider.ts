/**
 * Research Provider Abstraction
 *
 * All research implementations must satisfy this interface.
 * This allows swapping Firecrawl for another provider without
 * touching business logic.
 */

export interface RetrievedSource {
  url: string;
  title: string | null;
  domain: string | null;
  author: string | null;
  publishedAt: string | null;
  content: string; // cleaned main text content
  wordCount: number;
  contentHash: string;
  retrievalStatus: "retrieved" | "failed" | "paywall" | "empty" | "too_large";
  errorMessage?: string;
  httpStatus?: number;
}

export interface ResearchProviderError {
  url: string;
  reason:
    | "invalid_url"
    | "http_error"
    | "timeout"
    | "paywall"
    | "empty"
    | "too_large"
    | "provider_error"
    | "rate_limited";
  message: string;
  httpStatus?: number;
  retryable: boolean;
}

export interface ResearchProvider {
  readonly name: string;

  /**
   * Retrieve and extract content from a single URL.
   * Never throws — returns a result object with status.
   */
  retrieveUrl(url: string): Promise<RetrievedSource>;

  /**
   * Check whether this provider is healthy / configured.
   */
  isAvailable(): Promise<boolean>;
}
