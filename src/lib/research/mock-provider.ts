/**
 * Mock Research Provider
 *
 * Used in development and testing.
 * Returns realistic-looking scraped content without calling Firecrawl.
 */

import crypto from "crypto";
import type { ResearchProvider, RetrievedSource } from "./provider";

const MOCK_CONTENT: Record<string, Partial<RetrievedSource>> = {
  default: {
    title: "How AI Is Transforming Modern Recruitment",
    domain: "hrblog.example.com",
    author: "Jane Smith",
    publishedAt: "2026-06-01T00:00:00Z",
    content: `
# How AI Is Transforming Modern Recruitment

Artificial intelligence is reshaping how organizations find and hire talent. 
From automated screening to predictive analytics, AI-powered tools are helping 
HR teams process more candidates in less time while improving match quality.

## Key Applications

### Automated Resume Screening
AI systems can process thousands of resumes in seconds, filtering candidates 
based on skills, experience, and role requirements. Studies from several HR 
technology vendors suggest screening time reductions of 40-75% compared to 
manual review processes.

### Predictive Analytics
By analyzing historical hiring data, AI models can predict candidate success 
rates. This allows recruiters to focus attention on the most promising applicants 
rather than spreading effort evenly.

### Chatbot-Driven Initial Interviews
Conversational AI handles first-round screening, asking standardized questions 
and evaluating responses. This ensures consistency and reduces scheduling burden 
for both recruiters and candidates.

## Implementation Challenges

Organizations adopting AI recruitment tools face several practical hurdles:

- **Bias risk**: AI models trained on historical data may perpetuate past biases
- **Candidate experience**: Impersonal automated interactions can deter top talent
- **Integration complexity**: Connecting AI tools with existing ATS platforms
- **Regulatory compliance**: Data protection requirements vary by jurisdiction

## The Human Element

Despite automation advances, experienced recruiters remain essential for 
assessing culture fit, handling complex negotiations, and building relationships 
with passive candidates. AI augments rather than replaces human judgment.

## Looking Ahead

The next generation of recruitment AI promises more sophisticated capabilities 
including real-time skills gap analysis, internal mobility matching, and 
hyper-personalized candidate outreach at scale.
    `.trim(),
  },
};

// Simulate specific failure scenarios by URL pattern
const FAILURE_PATTERNS: Record<
  string,
  { status: RetrievedSource["retrievalStatus"]; httpStatus?: number; message: string }
> = {
  "403": { status: "failed", httpStatus: 403, message: "The website returned HTTP 403 Forbidden. Access is denied." },
  "404": { status: "failed", httpStatus: 404, message: "The page was not found (HTTP 404)." },
  "429": { status: "failed", httpStatus: 429, message: "The server is rate limiting requests. Try again later." },
  paywall: { status: "paywall", message: "This article is behind a paywall and could not be retrieved." },
  empty: { status: "empty", message: "The page was retrieved but contained no usable content." },
  timeout: { status: "failed", message: "The request timed out after 30 seconds." },
};

export class MockResearchProvider implements ResearchProvider {
  readonly name = "mock";

  async retrieveUrl(url: string): Promise<RetrievedSource> {
    // Simulate network delay
    await new Promise((r) => setTimeout(r, 300 + Math.random() * 400));

    // Check for forced failure patterns in URL
    for (const [pattern, failure] of Object.entries(FAILURE_PATTERNS)) {
      if (url.includes(pattern)) {
        return {
          url,
          title: null,
          domain: this.extractDomain(url),
          author: null,
          publishedAt: null,
          content: "",
          wordCount: 0,
          contentHash: "",
          retrievalStatus: failure.status,
          errorMessage: failure.message,
          httpStatus: failure.httpStatus,
        };
      }
    }

    // Return mock content
    const mock = MOCK_CONTENT.default;
    const content = mock.content!;

    return {
      url,
      title: mock.title ?? "Retrieved Article",
      domain: this.extractDomain(url),
      author: mock.author ?? null,
      publishedAt: mock.publishedAt ?? null,
      content,
      wordCount: content.split(/\s+/).filter(Boolean).length,
      contentHash: crypto.createHash("sha256").update(content).digest("hex"),
      retrievalStatus: "retrieved",
    };
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname.replace("www.", "");
    } catch {
      return "unknown";
    }
  }
}
