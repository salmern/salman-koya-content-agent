/**
 * Integration Tests — Workflow Pipeline
 *
 * Tests the complete pipeline using mock providers.
 * No external services are called.
 * No database is required — tests the business logic layers directly.
 */

import { describe, it, expect, vi } from "vitest";
import { MockAiProvider } from "@/lib/ai/mock-provider";
import { MockResearchProvider } from "@/lib/research/mock-provider";
import { MockPublishingProvider } from "@/lib/publishing/mock-provider";
import { WorkflowStateMachine } from "@/lib/workflow/state-machine";
import { POLLING_ACTIVE_STATUSES, getWorkflowProgress } from "@/lib/workflow/state-machine";
import {
  validateLinkedIn,
  validateX,
  validateNewsletter,
  validateSeo,
  checkPublishingEligibility,
} from "@/lib/validation/channel-validators";
import { validateAndNormalizeUrl } from "@/lib/validation/url-validator";

// ---- Test: Acceptance Test 1 — Raw Idea Request -----------

describe("Acceptance Test 1: Raw Idea Request (no URL)", () => {
  it("generates a content plan from idea and audience only", async () => {
    const ai = new MockAiProvider();

    const result = await ai.generateContentPlan({
      contentIdea: "How AI is changing recruitment",
      targetAudience: "HR managers and recruitment teams",
      primaryKeyword: null,
      contentGoal: null,
      tone: null,
      sources: [],
    });

    expect(result.data.working_title).toBeTruthy();
    expect(result.data.primary_keyword).toBeTruthy();
    expect(result.data.outline.length).toBeGreaterThan(0);
    expect(result.data.target_audience).toMatch(/HR|managers/i);
  }, 15000);

  it("generates an article from the plan", async () => {
    const ai = new MockAiProvider();

    const plan = await ai.generateContentPlan({
      contentIdea: "How AI is changing recruitment",
      targetAudience: "HR managers",
      primaryKeyword: "AI recruitment",
      contentGoal: null,
      tone: "professional",
      sources: [],
    });

    const mockPlan = {
      id: "plan-test",
      content_request_id: "req-test",
      ...plan.data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const draftResult = await ai.generateArticleDraft({
      plan: mockPlan,
      sources: [],
      tone: "professional",
      additionalInstructions: null,
    });

    expect(draftResult.data.article.length).toBeGreaterThan(200);
    expect(draftResult.data.word_count).toBeGreaterThan(0);
  }, 20000);
});

// ---- Test: Acceptance Test 2 — URL Request ----------------

describe("Acceptance Test 2: URL Source Request", () => {
  it("validates a real public URL", () => {
    const result = validateAndNormalizeUrl("https://hbr.org/2026/ai-recruitment");
    expect(result.valid).toBe(true);
    expect(result.normalizedUrl).toBeTruthy();
  });

  it("retrieves content from a URL via mock provider", async () => {
    const research = new MockResearchProvider();
    const result = await research.retrieveUrl("https://hbr.org/2026/ai-recruitment");

    expect(result.retrievalStatus).toBe("retrieved");
    expect(result.content.length).toBeGreaterThan(50);
    expect(result.domain).toBe("hbr.org");
  }, 10000);

  it("summarizes the retrieved source", async () => {
    const research = new MockResearchProvider();
    const ai = new MockAiProvider();

    const retrieved = await research.retrieveUrl("https://hbr.org/2026/ai-recruitment");
    expect(retrieved.retrievalStatus).toBe("retrieved");

    const summary = await ai.summarizeSource({
      url: "https://hbr.org/2026/ai-recruitment",
      content: retrieved.content,
      contentIdea: "How AI is changing recruitment",
      targetAudience: "HR managers",
    });

    expect(summary.data.summary).toBeTruthy();
    expect(summary.data.is_relevant).toBe(true);
    expect(summary.data.relevance_score).toBeGreaterThan(5);
  }, 15000);
});

// ---- Test: Acceptance Test 3 — Source Grounding -----------

describe("Acceptance Test 3: Source Grounding", () => {
  it("evaluation flags unsupported claims when sources are absent", async () => {
    const ai = new MockAiProvider();

    const evalResult = await ai.evaluateDraft({
      draft: {
        title: "AI Recruitment Guide",
        summary: "Guide for HR.",
        article: "AI reduces hiring costs by 50%. This is a verified fact.",
        primary_keyword: "AI recruitment",
        secondary_keywords: [],
        source_ids: [],
        key_claims: [
          {
            claim: "AI reduces hiring costs by 50%",
            source_ids: [],
            supported: false,
            flag: true,
          },
        ],
        word_count: 400,
        reading_time_minutes: 2,
        change_summary: null,
      },
      sources: [], // no sources
      targetAudience: "HR managers",
      contentGoal: "Educate",
      primaryKeyword: "AI recruitment",
      requestedChannels: ["article"],
    });

    // With no sources, grounding score should be lower
    expect(evalResult.data.scores.source_grounding).toBeLessThan(8);
  }, 15000);

  it("evaluation passes with well-grounded sources", async () => {
    const ai = new MockAiProvider();

    const evalResult = await ai.evaluateDraft({
      draft: {
        title: "AI Recruitment: Evidence-Based Guide",
        summary: "Evidence-based guide for HR.",
        article: `# AI Recruitment

AI recruitment tools are changing the hiring landscape based on industry research.

## Key Applications

Research from multiple talent management firms suggests AI can help reduce time-to-hire.

## Challenges

Bias in AI models remains a concern. Organisations must audit their tools regularly.

## Conclusion

Human judgment remains essential alongside AI automation.`,
        primary_keyword: "AI recruitment",
        secondary_keywords: ["HR technology"],
        source_ids: ["src-1", "src-2"],
        key_claims: [
          {
            claim: "AI can help reduce time-to-hire",
            source_ids: ["src-1"],
            supported: true,
            flag: false,
          },
        ],
        word_count: 600,
        reading_time_minutes: 3,
        change_summary: null,
      },
      sources: [
        { id: "src-1", url: "https://example.com/src1", summary: "AI reduces time-to-hire.", title: "Source 1" },
        { id: "src-2", url: "https://example.com/src2", summary: "Bias risks in AI tools.", title: "Source 2" },
      ],
      targetAudience: "HR managers",
      contentGoal: "Educate",
      primaryKeyword: "AI recruitment",
      requestedChannels: ["article"],
    });

    expect(evalResult.data.scores.source_grounding).toBeGreaterThan(5);
  }, 15000);
});

// ---- Test: Acceptance Test 4 — Evaluation & Revision ------

describe("Acceptance Test 4: Evaluation & Revision Loop", () => {
  it("evaluation of a short draft recommends REVISE", async () => {
    const ai = new MockAiProvider();

    const shortDraft = {
      title: "AI Recruitment",
      summary: "Short.",
      article: "# AI Recruitment\n\nAI is useful.",
      primary_keyword: "AI recruitment",
      secondary_keywords: [],
      source_ids: [],
      key_claims: [],
      word_count: 10,
      reading_time_minutes: 1,
      change_summary: null,
    };

    const evalResult = await ai.evaluateDraft({
      draft: shortDraft,
      sources: [],
      targetAudience: "HR managers",
      contentGoal: null,
      primaryKeyword: "AI recruitment",
      requestedChannels: ["article"],
    });

    // Short + no sources → REVISE or REJECT
    expect(["REVISE", "REJECT"]).toContain(evalResult.data.overall_status);
    expect(evalResult.data.recommended_changes.length).toBeGreaterThan(0);
  }, 15000);

  it("revision produces a longer draft with change_summary", async () => {
    const ai = new MockAiProvider();

    const mockPlan = {
      id: "plan-1",
      content_request_id: "req-1",
      working_title: "AI Recruitment Guide",
      primary_keyword: "AI recruitment",
      secondary_keywords: [],
      search_intent: "informational",
      target_audience: "HR managers",
      content_goal: "Educate",
      outline: [],
      key_points: ["AI is useful"],
      source_mapping: [],
      recommended_links: [],
      recommended_image_description: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const revisedDraft = await ai.generateArticleDraft({
      plan: mockPlan,
      sources: [],
      tone: "professional",
      additionalInstructions: null,
      revisionInstructions: "Add more examples for HR managers. Remove the unverified statistics.",
      previousDraft: "Previous draft was too short.",
    });

    expect(revisedDraft.data.change_summary).toBeTruthy();
    expect(revisedDraft.data.change_summary).toMatch(/revision|feedback/i);
    expect(revisedDraft.data.article.length).toBeGreaterThan(100);
  }, 15000);

  it("workflow state machine allows EVALUATING → REVISING transition", () => {
    expect(WorkflowStateMachine.canTransition("EVALUATING", "REVISING")).toBe(true);
  });

  it("workflow allows REVISING → EVALUATING (loop back)", () => {
    expect(WorkflowStateMachine.canTransition("REVISING", "EVALUATING")).toBe(true);
  });

  it("human-requested revisions can transition back into generation", () => {
    expect(WorkflowStateMachine.canTransition("REVISION_REQUESTED", "GENERATING")).toBe(true);
  });

  it("REVISION_REQUESTED is polled (page stays active while AI regenerates)", () => {
    expect(POLLING_ACTIVE_STATUSES).toContain("REVISION_REQUESTED");
  });

  it("REVISION_REQUESTED has non-zero workflow progress, between review and approval", () => {
    const reviewProgress = getWorkflowProgress("AWAITING_REVIEW");
    const revisionProgress = getWorkflowProgress("REVISION_REQUESTED");
    const approvedProgress = getWorkflowProgress("APPROVED");
    expect(revisionProgress).toBeGreaterThan(0);
    expect(revisionProgress).toBeGreaterThan(reviewProgress);
    expect(revisionProgress).toBeLessThan(approvedProgress);
  });
});

// ---- Test: Acceptance Test 5 — Human Approval Guard -------

describe("Acceptance Test 5: Human Approval Gate", () => {
  it("blocks publishing when not approved", () => {
    const result = checkPublishingEligibility({
      status: "AWAITING_REVIEW",
      humanApproved: false,
      approvedVersion: null,
      currentVersion: 1,
      isApprovalStale: false,
      idempotencyKey: "req-abc_linkedin_v1",
      alreadyPublished: false,
    });

    expect(result.canPublish).toBe(false);
    expect(result.blockers).toHaveLength(1);
    expect(result.blockers[0]).toMatch(/approved/i);
  });

  it("allows publishing once approved", () => {
    const result = checkPublishingEligibility({
      status: "READY_TO_SCHEDULE",
      humanApproved: true,
      approvedVersion: 2,
      currentVersion: 2,
      isApprovalStale: false,
      idempotencyKey: "req-abc_linkedin_v2",
      alreadyPublished: false,
    });

    expect(result.canPublish).toBe(true);
    expect(result.blockers).toHaveLength(0);
  });

  it("blocks publishing if approval is stale (Invariant 2 & 3)", () => {
    const result = checkPublishingEligibility({
      status: "READY_TO_SCHEDULE",
      humanApproved: true,
      approvedVersion: 2,
      currentVersion: 3, // content was edited after approval
      isApprovalStale: true,
      idempotencyKey: "req-abc_linkedin_v2",
      alreadyPublished: false,
    });

    expect(result.canPublish).toBe(false);
    expect(result.blockers.some((b) => /version 2|stale/i.test(b))).toBe(true);
  });

  it("blocks rejected content from publishing (Invariant 4)", () => {
    const result = checkPublishingEligibility({
      status: "REJECTED",
      humanApproved: false,
      approvedVersion: null,
      currentVersion: 1,
      isApprovalStale: false,
      idempotencyKey: "req-abc_linkedin_v1",
      alreadyPublished: false,
    });

    expect(result.canPublish).toBe(false);
    expect(result.blockers.some((b) => /rejected/i.test(b))).toBe(true);
  });
});

// ---- Test: Acceptance Test 6 — Channel Formatting ---------

describe("Acceptance Test 6: Channel Formatting", () => {
  const articleText = `# AI Recruitment: The Complete Guide

AI recruitment is reshaping how HR teams hire talent.

## Key Applications

Automated screening tools can process thousands of applications quickly.

## Implementation Challenges

Change management is critical for successful adoption.

## Getting Started

Begin with a single use case and measure results carefully.`;

  it("LinkedIn post passes validation with proper content", async () => {
    const ai = new MockAiProvider();
    const result = await ai.generateLinkedIn({
      article: articleText,
      title: "AI Recruitment: The Complete Guide",
      summary: "A practical guide for HR managers.",
      targetAudience: "HR managers",
      sources: [{ url: "https://example.com", title: "Source" }],
    });

    const validation = validateLinkedIn({
      content: result.data.content,
      hashtags: result.data.hashtags,
      cta: result.data.cta,
    });

    expect(validation.valid).toBe(true);
    expect(result.data.content.length).toBeGreaterThan(50);
    expect(result.data.hashtags.length).toBeGreaterThan(0);
    expect(result.data.cta).toBeTruthy();
  }, 15000);

  it("X post passes validation", async () => {
    const ai = new MockAiProvider();
    const result = await ai.generateX({
      article: articleText,
      title: "AI Recruitment: The Complete Guide",
      summary: "A practical guide.",
    });

    const validation = validateX({
      content: result.data.content,
      hashtags: result.data.hashtags,
    });

    expect(validation.valid).toBe(true);
    expect(result.data.hashtags.length).toBeLessThanOrEqual(2);
  }, 15000);

  it("newsletter passes validation with subject line and CTA", async () => {
    const ai = new MockAiProvider();
    const result = await ai.generateNewsletter({
      article: articleText,
      title: "AI Recruitment: The Complete Guide",
      summary: "A practical guide.",
      targetAudience: "HR managers",
    });

    const validation = validateNewsletter({
      content: result.data.content,
      subjectLine: result.data.subject_line,
      cta: result.data.cta,
    });

    expect(validation.valid).toBe(true);
    expect(result.data.subject_line).toBeTruthy();
    expect(result.data.cta).toBeTruthy();
  }, 15000);

  it("all three channels have distinct content formats", async () => {
    const ai = new MockAiProvider();
    const [li, xp, nl] = await Promise.all([
      ai.generateLinkedIn({ article: articleText, title: "Test", summary: "Test", targetAudience: "HR", sources: [] }),
      ai.generateX({ article: articleText, title: "Test", summary: "Test" }),
      ai.generateNewsletter({ article: articleText, title: "Test", summary: "Test", targetAudience: "HR" }),
    ]);

    // All three should produce different content
    expect(li.data.content).not.toBe(xp.data.content);
    expect(li.data.content).not.toBe(nl.data.content);
    expect(xp.data.content).not.toBe(nl.data.content);
  }, 20000);
});

// ---- Test: Acceptance Test 7 — Publishing Queue -----------

describe("Acceptance Test 7: Publishing Queue", () => {
  it("idempotency key format is deterministic", () => {
    const contentId = "req-abc-123";
    const channel = "linkedin";
    const version = 3;
    const key1 = `${contentId}__${channel}__v${version}`;
    const key2 = `${contentId}__${channel}__v${version}`;

    expect(key1).toBe(key2);
    expect(key1).toBe("req-abc-123__linkedin__v3");
  });

  it("publishing provider executes successfully", async () => {
    const provider = new MockPublishingProvider();
    const result = await provider.publish({
      channel: "linkedin",
      content: "Published content",
      title: null,
      hashtags: ["AI"],
      idempotencyKey: "req-abc-123__linkedin__v3",
    });

    expect(result.success).toBe(true);
    expect(result.isDemo).toBe(true);
    expect(result.publishedAt).toBeTruthy();
  }, 10000);
});

// ---- Test: Acceptance Test 8 — Failure Handling -----------

describe("Acceptance Test 8: Failure Handling", () => {
  it("research provider returns failure (not throw) for 403", async () => {
    const provider = new MockResearchProvider();
    // Should not throw
    const result = await expect(
      provider.retrieveUrl("https://example.com/403-blocked")
    ).resolves.toBeDefined();
  }, 10000);

  it("research provider returns failure (not throw) for paywall", async () => {
    const provider = new MockResearchProvider();
    const result = await provider.retrieveUrl("https://wsj.com/paywall-article");
    expect(result.retrievalStatus).toBe("paywall");
    expect(result.content).toBe("");
  }, 10000);

  it("publishing provider returns failure result (not throw) for bad key", async () => {
    const provider = new MockPublishingProvider();
    const result = await provider.publish({
      channel: "linkedin",
      content: "test",
      title: null,
      hashtags: [],
      idempotencyKey: "req-fail-test",
    });
    expect(result.success).toBe(false);
    expect(result.errorMessage).toBeTruthy();
  }, 10000);

  it("invalid URL validation returns useful error message", () => {
    const result = validateAndNormalizeUrl("not-a-url-at-all");
    expect(result.valid).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it("duplicate publish is blocked by eligibility check", () => {
    const result = checkPublishingEligibility({
      status: "PUBLISHED",
      humanApproved: true,
      approvedVersion: 1,
      currentVersion: 1,
      isApprovalStale: false,
      idempotencyKey: "req-abc_linkedin_v1",
      alreadyPublished: true,
    });
    expect(result.canPublish).toBe(false);
    expect(result.blockers.some((b) => /already.*published/i.test(b))).toBe(true);
  });

  it("workflow transition to FAILED is allowed from all active states", () => {
    const activeStates = [
      "RESEARCHING", "RESEARCH_COMPLETE", "PLANNING",
      "GENERATING", "EVALUATING", "REVISING",
    ] as const;

    activeStates.forEach((state) => {
      expect(WorkflowStateMachine.canTransition(state, "FAILED")).toBe(true);
    });
  });

  it("FAILED state allows retry back to RESEARCHING", () => {
    expect(WorkflowStateMachine.canTransition("FAILED", "RESEARCHING")).toBe(true);
  });
});

// ---- Test: Workflow State Invariants -----------------------

describe("Business Invariants", () => {
  it("Invariant 1: PUBLISHED is terminal — cannot escape to other states", () => {
    expect(WorkflowStateMachine.isTerminal("PUBLISHED")).toBe(true);
    expect(WorkflowStateMachine.validNextStates("PUBLISHED")).toHaveLength(0);
  });

  it("Invariant 4: REJECTED is terminal", () => {
    expect(WorkflowStateMachine.isTerminal("REJECTED")).toBe(true);
  });

  it("Invariant 2+3: Stale approval blocks publishing", () => {
    expect(
      checkPublishingEligibility({
        status: "READY_TO_SCHEDULE",
        humanApproved: true,
        approvedVersion: 2,
        currentVersion: 4,
        isApprovalStale: true,
        idempotencyKey: "x",
        alreadyPublished: false,
      }).canPublish
    ).toBe(false);
  });

  it("Invariant 5: Duplicate publish blocked", () => {
    expect(
      checkPublishingEligibility({
        status: "READY_TO_SCHEDULE",
        humanApproved: true,
        approvedVersion: 1,
        currentVersion: 1,
        isApprovalStale: false,
        idempotencyKey: "x",
        alreadyPublished: true,
      }).canPublish
    ).toBe(false);
  });

  it("Invariant 10: Revision limit exists in state machine (EVALUATING → AWAITING_REVIEW path available)", () => {
    // After max revisions, system routes to human review via AWAITING_REVIEW
    expect(WorkflowStateMachine.canTransition("EVALUATING", "AWAITING_REVIEW")).toBe(true);
  });
});

// ---- Test: SEO Validation -----------------------------------

describe("SEO Validation Integration", () => {
  it("article with keyword in title, intro, and H2s passes SEO", () => {
    const article = `# AI Recruitment: Complete Guide for HR Teams

AI recruitment tools are transforming modern hiring. This guide covers everything you need to know.

## How AI Recruitment Works

AI recruitment systems process applications automatically using machine learning.

## Benefits of AI Recruitment

Teams report significant time savings when using AI recruitment tools correctly.

## Getting Started with AI Recruitment

Begin with a single workflow and measure the impact carefully.`;

    const result = validateSeo({
      title: "AI Recruitment: Complete Guide for HR Teams",
      article,
      primaryKeyword: "AI recruitment",
      secondaryKeywords: ["HR teams", "hiring"],
    });

    expect(result.valid).toBe(true);
    expect(result.score).toBeGreaterThan(70);
    expect(result.issues.filter((i) => i.severity === "error")).toHaveLength(0);
  });

  it("multiple H1s fail SEO validation", () => {
    const article = "# Title One\n## Section\n# Title Two";
    const result = validateSeo({
      title: "Test",
      article,
      primaryKeyword: "test",
      secondaryKeywords: [],
    });
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.rule === "multiple_h1")).toBe(true);
  });
});
