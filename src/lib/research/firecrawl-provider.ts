/**
 * Firecrawl Research Provider
 *
 * Production implementation using the Firecrawl API.
 * Server-side only — API key is never exposed to the browser.
 */

import crypto from "crypto";
import type { ResearchProvider, RetrievedSource } from "./provider";

const MAX_CONTENT_LENGTH = 50_000; // ~50k chars before truncation
const REQUEST_TIMEOUT_MS = 30_000;

export class FirecrawlProvider implements ResearchProvider {
  readonly name = "firecrawl";

  constructor(private readonly apiKey: string) {
    if (!apiKey) {
      throw new Error("FirecrawlProvider requires an API key");
    }
  }

  async retrieveUrl(url: string): Promise<RetrievedSource> {
    const domain = this.extractDomain(url);

    try {
      // Dynamic import — Firecrawl SDK is server-only
      const { default: FirecrawlApp } = await import("@mendable/firecrawl-js");
      const app = new FirecrawlApp({ apiKey: this.apiKey });

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      let result: Awaited<ReturnType<typeof app.scrapeUrl>>;
      try {
        result = await app.scrapeUrl(url, {
          formats: ["markdown"],
          onlyMainContent: true,
        });
      } finally {
        clearTimeout(timeout);
      }

      if (!result.success) {
        const errorResult = result as { error?: string };
        const message = errorResult.error ?? "Firecrawl returned an unsuccessful response";

        // Detect paywall / access issues
        if (message.toLowerCase().includes("paywall") || message.toLowerCase().includes("subscribe")) {
          return this.failureResult(url, domain, "paywall", message);
        }

        return this.failureResult(url, domain, "failed", message);
      }

      const content = (result.markdown ?? "").slice(0, MAX_CONTENT_LENGTH);

      if (!content.trim()) {
        return this.failureResult(url, domain, "empty", "Page retrieved but no usable content found.");
      }

      const wordCount = content.split(/\s+/).filter(Boolean).length;
      const wasTruncated = (result.markdown ?? "").length > MAX_CONTENT_LENGTH;

      return {
        url,
        title: result.metadata?.title ?? null,
        domain,
        author: result.metadata?.author ?? null,
        publishedAt: result.metadata?.publishedTime ?? null,
        content: wasTruncated ? content + "\n\n[Content truncated — original was too long]" : content,
        wordCount,
        contentHash: crypto.createHash("sha256").update(content).digest("hex"),
        retrievalStatus: wasTruncated ? "too_large" : "retrieved",
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown error during retrieval";

      const isTimeout = message.includes("abort") || message.includes("timeout");

      return this.failureResult(
        url,
        domain,
        "failed",
        isTimeout ? "Request timed out after 30 seconds." : `Retrieval failed: ${message}`
      );
    }
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(this.apiKey && this.apiKey.length > 0);
  }

  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname.replace("www.", "");
    } catch {
      return "unknown";
    }
  }

  private failureResult(
    url: string,
    domain: string,
    status: RetrievedSource["retrievalStatus"],
    errorMessage: string
  ): RetrievedSource {
    return {
      url,
      title: null,
      domain,
      author: null,
      publishedAt: null,
      content: "",
      wordCount: 0,
      contentHash: "",
      retrievalStatus: status,
      errorMessage,
    };
  }
}
