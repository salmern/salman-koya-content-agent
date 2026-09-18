/**
 * Mock Provider Tests
 *
 * Verify that mock providers return valid structured outputs
 * matching the interfaces expected by the services.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { MockResearchProvider } from "@/lib/research/mock-provider";
import { MockAiProvider } from "@/lib/ai/mock-provider";
import { MockPublishingProvider } from "@/lib/publishing/mock-provider";

// ---- Mock Research Provider ---------------------------------

describe("MockResearchProvider", () => {
  let provider: MockResearchProvider;

  beforeEach(() => {
    provider = new MockResearchProvider();
  });

  it("is always available", async () => {
    expect(await provider.isAvailable()).toBe(true);
  });

  it("retrieves a URL and returns structured content", async () => {
    const result = await provider.retrieveUrl("https://example.com/article");

    expect(result.url).toBe("https://example.com/article");
    expect(result.retrievalStatus).toBe("retrieved");
    expect(typeof result.content).toBe("string");
    expect(result.content.length).toBeGreaterThan(0);
    expect(result.wordCount).toBeGreaterThan(0);
    expect(result.contentHash).toBeTruthy();
    expect(result.domain).toBe("example.com");
  }, 10000);

  it("returns a failure for 403 URL", async () => {
    const result = await provider.retrieveUrl("https://example.com/403-test");
    expect(result.retrievalStatus).toBe("failed");
    expect(result.errorMessage).toBeTruthy();
    expect(result.content).toBe("");
  }, 10000);

  it("returns paywall status for paywall URL", async () => {
    const result = await provider.retrieveUrl("https://example.com/paywall-article");
    expect(result.retrievalStatus).toBe("paywall");
    expect(result.content).toBe("");
  }, 10000);

  it("returns empty status for empty-content URL", async () => {
    const result = await provider.retrieveUrl("https://example.com/empty-page");
    expect(result.retrievalStatus).toBe("empty");
  }, 10000);

  it("returns failed status for timeout URL", async () => {
    const result = await provider.retrieveUrl("https://example.com/timeout-endpoint");
    expect(result.retrievalStatus).toBe("failed");
  }, 10000);

  it("extracts domain correctly", async () => {
    const result = await provider.retrieveUrl("https://www.blog.example.org/post");
    expect(result.domain).toBe("blog.example.org");
  }, 10000);
});

// ---- Mock AI Provider ---------------------------------------

describe("MockAiProvider", () => {
  let provider: MockAiProvider;

  const mockSources = [
    {
      id: "src-1",
      url: "https://example.com/source1",
      summary: "AI recruitment trends for HR managers.",
      title: "AI in Recruitment 2026",
    },
    {
      id: "src-2",
      url: "https://example.com/source2",
      summary: "Automation strategies for talent acquisition teams.",
      title: "Talent Automation Guide",
    },
  ];

  const mockSourcesWithContent = mockSources.map((s) => ({
    ...s,
    content: "This is the full content of the source article. ".repeat(20),
  }));

  beforeEach(() => {
    provider = new MockAiProvider();
  });

  it("is always available", async () => {
    expect(await provider.isAvailable()).toBe(true);
  });

  // ---- Content Plan --

  it("generates a valid content plan", async () => {
    const result = await provider.generateContentPlan({
      contentIdea: "How AI is changing recruitment",
      targetAudience: "HR managers",
      primaryKeyword: "AI recruitment",
      contentGoal: "Educate HR teams",
      tone: "professional",
      sources: mockSources,
    });

    expect(result.data.working_title).toBeTruthy();
    expect(result.data.primary_keyword).toBeTruthy();
    expect(Array.isArray(result.data.secondary_keywords)).toBe(true);
    expect(Array.isArray(result.data.outline)).toBe(true);
    expect(result.data.outline.length).toBeGreaterThan(0);
    expect(Array.isArray(result.data.key_points)).toBe(true);
    expect(Array.isArray(result.data.source_mapping)).toBe(true);
    expect(["informational", "commercial", "navigational"]).toContain(
      result.data.search_intent
    );
    // Usage tracking
    expect(result.usage.model).toBeTruthy();
    expect(result.usage.inputTokens).toBeGreaterThan(0);
    expect(result.usage.outputTokens).toBeGreaterThan(0);
    expect(result.usage.estimatedCostUsd).toBeGreaterThan(0);
  }, 15000);

  it("generates a plan with no sources", async () => {
    const result = await provider.generateContentPlan({
      contentIdea: "Blockchain in supply chain",
      targetAudience: "Operations managers",
      primaryKeyword: null,
      contentGoal: null,
      tone: null,
      sources: [],
    });
    expect(result.data.working_title).toBeTruthy();
    expect(result.data.source_mapping).toHaveLength(0);
  }, 15000);

  // ---- Article Draft --

  it("generates a valid article draft", async () => {
    const mockPlan = {
      id: "plan-1",
      content_request_id: "req-1",
      working_title: "AI Recruitment Guide",
      primary_keyword: "AI recruitment",
      secondary_keywords: ["HR technology", "talent acquisition"],
      search_intent: "informational",
      target_audience: "HR managers",
      content_goal: "Educate about AI tools",
      outline: [
        { level: "h1" as const, title: "AI Recruitment Guide", notes: null, source_ids: [] },
        { level: "h2" as const, title: "Key Applications", notes: null, source_ids: ["src-1"] },
        { level: "h2" as const, title: "Challenges", notes: null, source_ids: ["src-2"] },
      ],
      key_points: ["AI reduces screening time", "Bias risks must be managed"],
      source_mapping: [{ source_id: "src-1", usage: "Background", sections: ["Key Applications"] }],
      recommended_links: [],
      recommended_image_description: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const result = await provider.generateArticleDraft({
      plan: mockPlan,
      sources: mockSourcesWithContent,
      tone: "professional",
      additionalInstructions: null,
    });

    expect(result.data.title).toBeTruthy();
    expect(result.data.summary).toBeTruthy();
    expect(result.data.article.length).toBeGreaterThan(100);
    expect(result.data.primary_keyword).toBeTruthy();
    expect(Array.isArray(result.data.key_claims)).toBe(true);
    expect(typeof result.data.word_count).toBe("number");
    expect(result.data.word_count).toBeGreaterThan(0);
    expect(result.data.reading_time_minutes).toBeGreaterThan(0);
  }, 15000);

  it("flags revision context when revisionInstructions provided", async () => {
    const mockPlan = {
      id: "plan-1",
      content_request_id: "req-1",
      working_title: "Test",
      primary_keyword: "test",
      secondary_keywords: [],
      search_intent: "informational",
      target_audience: "developers",
      content_goal: "test",
      outline: [],
      key_points: [],
      source_mapping: [],
      recommended_links: [],
      recommended_image_description: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const result = await provider.generateArticleDraft({
      plan: mockPlan,
      sources: [],
      tone: null,
      additionalInstructions: null,
      revisionInstructions: "Remove the unsupported statistics",
      previousDraft: "Previous draft content here",
    });
    // change_summary should reference the revision
    expect(result.data.change_summary).toBeTruthy();
  }, 15000);

  // ---- Evaluation --

  it("returns a valid evaluation", async () => {
    const mockDraft = {
      title: "AI Recruitment: A Practical Guide",
      summary: "A guide for HR teams.",
      article: "# AI Recruitment\n\nAI recruitment is growing.\n\n## Applications\n\nTools help HR teams.\n\n## Challenges\n\nBias is a risk.",
      primary_keyword: "AI recruitment",
      secondary_keywords: ["HR tech"],
      source_ids: ["src-1"],
      key_claims: [{ claim: "AI reduces time by 40%", source_ids: [], supported: false, flag: true }],
      word_count: 500,
      reading_time_minutes: 3,
      change_summary: null,
    };

    const result = await provider.evaluateDraft({
      draft: mockDraft,
      sources: mockSources,
      targetAudience: "HR managers",
      contentGoal: "Educate",
      primaryKeyword: "AI recruitment",
      requestedChannels: ["article", "linkedin"],
    });

    expect(["PASS", "REVISE", "REJECT"]).toContain(result.data.overall_status);
    expect(result.data.scores.overall).toBeGreaterThanOrEqual(0);
    expect(result.data.scores.overall).toBeLessThanOrEqual(10);
    expect(typeof result.data.summary).toBe("string");
    expect(result.data.summary.length).toBeGreaterThan(10);
    expect(Array.isArray(result.data.recommended_changes)).toBe(true);
    // All 9 score dimensions present
    const expectedDimensions = [
      "topic_relevance", "source_grounding", "factual_consistency",
      "audience_fit", "tone", "seo_fit", "channel_fit", "clarity", "completeness",
    ];
    expectedDimensions.forEach((dim) => {
      expect(dim in result.data.scores).toBe(true);
    });
  }, 15000);

  // ---- Channel generation --

  it("generates valid LinkedIn post", async () => {
    const result = await provider.generateLinkedIn({
      article: "Article content...",
      title: "AI Recruitment Guide",
      summary: "A practical guide for HR managers.",
      targetAudience: "HR managers",
      sources: [{ url: "https://example.com", title: "Source" }],
    });
    expect(result.data.content).toBeTruthy();
    expect(Array.isArray(result.data.hashtags)).toBe(true);
    expect(result.data.hashtags.length).toBeLessThanOrEqual(5);
    expect(result.data.cta).toBeTruthy();
  }, 10000);

  it("generates valid X post", async () => {
    const result = await provider.generateX({
      article: "Article content...",
      title: "AI Recruitment Guide",
      summary: "A practical guide.",
    });
    expect(result.data.content).toBeTruthy();
    expect(Array.isArray(result.data.hashtags)).toBe(true);
    expect(result.data.hashtags.length).toBeLessThanOrEqual(2);
  }, 10000);

  it("generates valid newsletter", async () => {
    const result = await provider.generateNewsletter({
      article: "Article content...",
      title: "AI Recruitment Guide",
      summary: "A practical guide.",
      targetAudience: "HR managers",
    });
    expect(result.data.subject_line).toBeTruthy();
    expect(result.data.content).toBeTruthy();
    expect(result.data.cta).toBeTruthy();
  }, 10000);

  it("summarizes a source", async () => {
    const result = await provider.summarizeSource({
      url: "https://example.com/article",
      content: "AI is transforming recruitment. ".repeat(30),
      contentIdea: "How AI is changing recruitment",
      targetAudience: "HR managers",
    });

    expect(result.data.summary).toBeTruthy();
    expect(Array.isArray(result.data.key_points)).toBe(true);
    expect(result.data.relevance_score).toBeGreaterThanOrEqual(0);
    expect(result.data.relevance_score).toBeLessThanOrEqual(10);
    expect(typeof result.data.is_relevant).toBe("boolean");
    expect(result.data.selection_reason).toBeTruthy();
  }, 10000);

  it("marks short/empty source content as not relevant", async () => {
    const result = await provider.summarizeSource({
      url: "https://example.com/article",
      content: "Too short.",
      contentIdea: "How AI is changing recruitment",
      targetAudience: "HR managers",
    });
    expect(result.data.is_relevant).toBe(false);
    expect(result.data.relevance_score).toBeLessThan(5);
  }, 10000);
});

// ---- Mock Publishing Provider --------------------------------

describe("MockPublishingProvider", () => {
  let provider: MockPublishingProvider;

  beforeEach(() => {
    provider = new MockPublishingProvider();
  });

  it("is marked as demo", () => {
    expect(provider.isDemo).toBe(true);
  });

  it("is always available", async () => {
    expect(await provider.isAvailable()).toBe(true);
  });

  it("publishes successfully and returns a provider post ID", async () => {
    const result = await provider.publish({
      channel: "linkedin",
      content: "Test LinkedIn post content for publishing.",
      title: null,
      hashtags: ["AI", "HR"],
      idempotencyKey: "req-123_linkedin_v3",
    });

    expect(result.success).toBe(true);
    expect(result.providerPostId).toBeTruthy();
    expect(result.publishedAt).toBeTruthy();
    expect(result.isDemo).toBe(true);
    expect(result.errorMessage).toBeNull();
  }, 10000);

  it("simulates failure when idempotency key contains 'fail'", async () => {
    const result = await provider.publish({
      channel: "linkedin",
      content: "Test content",
      title: null,
      hashtags: [],
      idempotencyKey: "req-fail-123_linkedin_v1",
    });

    expect(result.success).toBe(false);
    expect(result.errorMessage).toBeTruthy();
    expect(result.providerPostId).toBeNull();
  }, 10000);

  it("schedules content successfully", async () => {
    const scheduledAt = new Date(Date.now() + 86400000).toISOString();
    const result = await provider.schedule({
      channel: "newsletter",
      content: "Test newsletter content",
      title: null,
      hashtags: [],
      scheduledAt,
      idempotencyKey: "req-456_newsletter_v1",
    });

    expect(result.success).toBe(true);
    expect(result.scheduledAt).toBe(scheduledAt);
    expect(result.errorMessage).toBeNull();
  }, 10000);

  it("cancels successfully", async () => {
    const result = await provider.cancel({
      providerPostId: "demo_linkedin_12345",
      channel: "linkedin",
    });
    expect(result.success).toBe(true);
  }, 5000);
});
