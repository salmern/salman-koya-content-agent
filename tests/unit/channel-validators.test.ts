import { describe, it, expect } from "vitest";
import {
  validateLinkedIn,
  validateX,
  validateNewsletter,
  validateSeo,
  checkPublishingEligibility,
} from "@/lib/validation/channel-validators";

// ---- LinkedIn Tests -----------------------------------------

describe("validateLinkedIn", () => {
  it("passes a valid LinkedIn post", () => {
    const result = validateLinkedIn({
      content: "A".repeat(200) + " ".repeat(50) + "B".repeat(100),
      hashtags: ["AI", "HRTech"],
      cta: "Read more in the comments →",
    });
    expect(result.valid).toBe(true);
    expect(result.errors.filter((e) => e.severity === "error")).toHaveLength(0);
  });

  it("fails when content exceeds 3000 characters", () => {
    const result = validateLinkedIn({
      content: "A".repeat(3001),
      hashtags: ["AI"],
      cta: "CTA here",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.rule === "max_characters")).toBe(true);
  });

  it("warns when hashtags exceed 5", () => {
    const result = validateLinkedIn({
      content: "This is a valid LinkedIn post with good content for testing purposes.",
      hashtags: ["a", "b", "c", "d", "e", "f"],
      cta: "CTA",
    });
    const hashtagWarning = result.errors.find((e) => e.rule === "max_hashtags");
    expect(hashtagWarning).toBeDefined();
    expect(hashtagWarning?.severity).toBe("warning");
  });

  it("warns when CTA is missing", () => {
    const result = validateLinkedIn({
      content: "Valid content here for a LinkedIn post that is long enough.",
      hashtags: ["AI"],
      cta: null,
    });
    expect(result.errors.some((e) => e.rule === "missing_cta")).toBe(true);
  });
});

// ---- X Tests ------------------------------------------------

describe("validateX", () => {
  it("passes a valid X post under 280 chars", () => {
    const result = validateX({
      content: "This is a short and punchy X post about AI recruitment.",
      hashtags: ["AI"],
    });
    expect(result.valid).toBe(true);
  });

  it("fails when content exceeds 280 characters without thread separator", () => {
    const result = validateX({
      content: "A".repeat(281),
      hashtags: [],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.rule === "max_characters")).toBe(true);
  });

  it("passes a valid thread with separator", () => {
    const part1 = "First tweet — short and punchy hook about AI.";
    const part2 = "Second tweet — adds depth and context for the reader.";
    const result = validateX({
      content: `${part1}\n---\n${part2}`,
      hashtags: ["AI"],
    });
    expect(result.valid).toBe(true);
  });

  it("fails when a thread part exceeds 280 chars", () => {
    const result = validateX({
      content: `Short first part.\n---\n${"A".repeat(281)}`,
      hashtags: [],
    });
    expect(result.valid).toBe(false);
  });

  it("warns when hashtags exceed 2", () => {
    const result = validateX({
      content: "Short post.",
      hashtags: ["a", "b", "c"],
    });
    expect(result.errors.some((e) => e.rule === "max_hashtags")).toBe(true);
  });

  it("fails empty content", () => {
    const result = validateX({ content: "", hashtags: [] });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.rule === "empty_content")).toBe(true);
  });
});

// ---- Newsletter Tests ---------------------------------------

describe("validateNewsletter", () => {
  const goodContent = Array(300).fill("word").join(" ");

  it("passes a valid newsletter", () => {
    const result = validateNewsletter({
      content: goodContent,
      subjectLine: "How AI Is Changing Recruitment",
      cta: "Read the full guide →",
    });
    expect(result.valid).toBe(true);
  });

  it("fails when subject line is missing", () => {
    const result = validateNewsletter({
      content: goodContent,
      subjectLine: null,
      cta: "CTA",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.rule === "missing_subject")).toBe(true);
  });

  it("fails when content is under 250 words", () => {
    const result = validateNewsletter({
      content: Array(100).fill("word").join(" "),
      subjectLine: "Subject",
      cta: "CTA",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.rule === "too_short")).toBe(true);
  });

  it("warns when subject exceeds 60 chars", () => {
    const result = validateNewsletter({
      content: goodContent,
      subjectLine: "A".repeat(61),
      cta: "CTA",
    });
    expect(result.errors.some((e) => e.rule === "subject_too_long" && e.severity === "warning")).toBe(true);
  });
});

// ---- SEO Tests ----------------------------------------------

describe("validateSeo", () => {
  const goodArticle = `# AI Recruitment: The Complete Guide

AI recruitment is transforming how companies hire. This guide covers everything HR managers need to know.

## Key Applications

AI recruitment tools help teams process more candidates in less time.

## Implementation

Start with a single use case before expanding.

## Challenges

Change management is critical for successful adoption.

## Conclusion

AI recruitment augments human judgment.`;

  it("passes a well-structured article", () => {
    const result = validateSeo({
      title: "AI Recruitment: The Complete Guide",
      article: goodArticle,
      primaryKeyword: "AI recruitment",
      secondaryKeywords: ["HR managers", "hiring"],
    });
    expect(result.valid).toBe(true);
    expect(result.score).toBeGreaterThan(70);
  });

  it("fails when H1 is missing", () => {
    const result = validateSeo({
      title: "Test Title",
      article: "## Section\nContent without H1.",
      primaryKeyword: "test",
      secondaryKeywords: [],
    });
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.rule === "missing_h1")).toBe(true);
  });

  it("warns when primary keyword not in title", () => {
    const result = validateSeo({
      title: "Something Else Entirely",
      article: goodArticle,
      primaryKeyword: "AI recruitment",
      secondaryKeywords: [],
    });
    expect(result.issues.some((i) => i.rule === "keyword_not_in_title")).toBe(true);
  });

  it("fails with multiple H1 headings", () => {
    const result = validateSeo({
      title: "Test",
      article: "# First H1\n## Section\n# Second H1",
      primaryKeyword: "test",
      secondaryKeywords: [],
    });
    expect(result.issues.some((i) => i.rule === "multiple_h1")).toBe(true);
  });
});

// ---- Publishing Eligibility Tests ---------------------------

describe("checkPublishingEligibility", () => {
  const baseParams = {
    status: "READY_TO_SCHEDULE",
    humanApproved: true,
    approvedVersion: 3,
    currentVersion: 3,
    isApprovalStale: false,
    idempotencyKey: "abc-linkedin-v3",
    alreadyPublished: false,
  };

  it("allows publishing when all conditions met", () => {
    const result = checkPublishingEligibility(baseParams);
    expect(result.canPublish).toBe(true);
    expect(result.blockers).toHaveLength(0);
  });

  it("blocks when not approved", () => {
    const result = checkPublishingEligibility({
      ...baseParams,
      humanApproved: false,
    });
    expect(result.canPublish).toBe(false);
    expect(result.blockers.some((b) => b.includes("not been approved"))).toBe(true);
  });

  it("blocks when approval is stale", () => {
    const result = checkPublishingEligibility({
      ...baseParams,
      isApprovalStale: true,
      approvedVersion: 3,
      currentVersion: 4,
    });
    expect(result.canPublish).toBe(false);
    expect(result.blockers.some((b) => b.includes("stale") || b.includes("version 3"))).toBe(true);
  });

  it("blocks duplicate publishing", () => {
    const result = checkPublishingEligibility({
      ...baseParams,
      alreadyPublished: true,
    });
    expect(result.canPublish).toBe(false);
    expect(result.blockers.some((b) => b.includes("already been published"))).toBe(true);
  });

  it("blocks rejected content", () => {
    const result = checkPublishingEligibility({
      ...baseParams,
      status: "REJECTED",
    });
    expect(result.canPublish).toBe(false);
    expect(result.blockers.some((b) => b.includes("Rejected"))).toBe(true);
  });

  it("accumulates multiple blockers", () => {
    const result = checkPublishingEligibility({
      ...baseParams,
      humanApproved: false,
      alreadyPublished: true,
      status: "REJECTED",
    });
    expect(result.canPublish).toBe(false);
    expect(result.blockers.length).toBeGreaterThanOrEqual(2);
  });
});
