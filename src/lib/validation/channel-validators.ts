/**
 * Deterministic Channel Content Validators
 *
 * These are pure functions — no AI involved.
 * They enforce hard rules for each channel before publishing.
 */

import type { ChannelValidationError } from "@/types";

export interface ValidationResult {
  valid: boolean;
  errors: ChannelValidationError[];
}

// ---- LinkedIn Validator -------------------------------------

const LINKEDIN_MAX_CHARS = 3000;
const LINKEDIN_MAX_HASHTAGS = 5;
const LINKEDIN_MIN_WORDS = 50;

export function validateLinkedIn(params: {
  content: string;
  hashtags: string[];
  cta: string | null;
}): ValidationResult {
  const errors: ChannelValidationError[] = [];
  const charCount = params.content.length;
  const wordCount = params.content.split(/\s+/).filter(Boolean).length;

  if (charCount > LINKEDIN_MAX_CHARS) {
    errors.push({
      rule: "max_characters",
      message: `LinkedIn posts must be under ${LINKEDIN_MAX_CHARS} characters. Current: ${charCount}.`,
      severity: "error",
    });
  }

  if (wordCount < LINKEDIN_MIN_WORDS) {
    errors.push({
      rule: "min_words",
      message: `LinkedIn posts should be at least ${LINKEDIN_MIN_WORDS} words. Current: ${wordCount}.`,
      severity: "warning",
    });
  }

  if (params.hashtags.length > LINKEDIN_MAX_HASHTAGS) {
    errors.push({
      rule: "max_hashtags",
      message: `LinkedIn posts should use at most ${LINKEDIN_MAX_HASHTAGS} hashtags. Current: ${params.hashtags.length}.`,
      severity: "warning",
    });
  }

  // Check for hashtags embedded in content (shouldn't be duplicated)
  const hashtagsInContent = (params.content.match(/#\w+/g) ?? []).length;
  if (hashtagsInContent > LINKEDIN_MAX_HASHTAGS) {
    errors.push({
      rule: "embedded_hashtags",
      message: `Found ${hashtagsInContent} hashtags embedded in content. Use the hashtags field instead.`,
      severity: "warning",
    });
  }

  if (!params.cta || params.cta.trim().length === 0) {
    errors.push({
      rule: "missing_cta",
      message: "LinkedIn posts should include a call-to-action.",
      severity: "warning",
    });
  }

  return { valid: errors.filter((e) => e.severity === "error").length === 0, errors };
}

// ---- X (Twitter) Validator ----------------------------------

const X_MAX_CHARS = 280;
const X_MAX_HASHTAGS = 2;
const X_THREAD_SEPARATOR = "---";

export function validateX(params: {
  content: string;
  hashtags: string[];
}): ValidationResult {
  const errors: ChannelValidationError[] = [];

  // Check if it's a thread
  const isThread = params.content.includes(X_THREAD_SEPARATOR);

  if (!isThread && params.content.length > X_MAX_CHARS) {
    errors.push({
      rule: "max_characters",
      message: `X posts must be under ${X_MAX_CHARS} characters (or use thread format with '---' separators). Current: ${params.content.length}.`,
      severity: "error",
    });
  }

  if (isThread) {
    const parts = params.content.split(X_THREAD_SEPARATOR);
    parts.forEach((part, i) => {
      if (part.trim().length > X_MAX_CHARS) {
        errors.push({
          rule: "thread_part_too_long",
          message: `Thread part ${i + 1} exceeds ${X_MAX_CHARS} characters (${part.trim().length} chars).`,
          severity: "error",
        });
      }
    });
  }

  if (params.hashtags.length > X_MAX_HASHTAGS) {
    errors.push({
      rule: "max_hashtags",
      message: `X posts should use at most ${X_MAX_HASHTAGS} hashtags. Current: ${params.hashtags.length}.`,
      severity: "warning",
    });
  }

  if (params.content.trim().length === 0) {
    errors.push({
      rule: "empty_content",
      message: "X post content cannot be empty.",
      severity: "error",
    });
  }

  return { valid: errors.filter((e) => e.severity === "error").length === 0, errors };
}

// ---- Newsletter Validator ------------------------------------

const NEWSLETTER_MIN_WORDS = 250;
const NEWSLETTER_MAX_WORDS = 600;
const NEWSLETTER_MAX_SUBJECT_CHARS = 60;

export function validateNewsletter(params: {
  content: string;
  subjectLine: string | null;
  cta: string | null;
}): ValidationResult {
  const errors: ChannelValidationError[] = [];
  const wordCount = params.content.split(/\s+/).filter(Boolean).length;

  if (!params.subjectLine || params.subjectLine.trim().length === 0) {
    errors.push({
      rule: "missing_subject",
      message: "Newsletter must have a subject line.",
      severity: "error",
    });
  } else if (params.subjectLine.length > NEWSLETTER_MAX_SUBJECT_CHARS) {
    errors.push({
      rule: "subject_too_long",
      message: `Subject line should be under ${NEWSLETTER_MAX_SUBJECT_CHARS} characters. Current: ${params.subjectLine.length}.`,
      severity: "warning",
    });
  }

  if (wordCount < NEWSLETTER_MIN_WORDS) {
    errors.push({
      rule: "too_short",
      message: `Newsletter should be at least ${NEWSLETTER_MIN_WORDS} words. Current: ${wordCount}.`,
      severity: "error",
    });
  }

  if (wordCount > NEWSLETTER_MAX_WORDS) {
    errors.push({
      rule: "too_long",
      message: `Newsletter should be under ${NEWSLETTER_MAX_WORDS} words. Current: ${wordCount}. Consider condensing.`,
      severity: "warning",
    });
  }

  if (!params.cta || params.cta.trim().length === 0) {
    errors.push({
      rule: "missing_cta",
      message: "Newsletter should include a call-to-action.",
      severity: "warning",
    });
  }

  return { valid: errors.filter((e) => e.severity === "error").length === 0, errors };
}

// ---- SEO Validator ------------------------------------------

export interface SeoValidationResult {
  valid: boolean;
  score: number; // 0-100
  issues: { rule: string; message: string; severity: "error" | "warning" | "info" }[];
}

export function validateSeo(params: {
  title: string;
  article: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
}): SeoValidationResult {
  const issues: SeoValidationResult["issues"] = [];
  const { title, article, primaryKeyword } = params;

  const lower = article.toLowerCase();
  const kwLower = primaryKeyword.toLowerCase();

  // H1 check
  const h1Matches = (article.match(/^#\s+.+/gm) ?? []).length;
  if (h1Matches === 0) {
    issues.push({ rule: "missing_h1", message: "Article must have exactly one H1 heading.", severity: "error" });
  } else if (h1Matches > 1) {
    issues.push({ rule: "multiple_h1", message: `Article has ${h1Matches} H1 headings. Use exactly one.`, severity: "error" });
  }

  // Primary keyword in title
  if (!title.toLowerCase().includes(kwLower)) {
    issues.push({ rule: "keyword_not_in_title", message: `Primary keyword "${primaryKeyword}" not found in title.`, severity: "warning" });
  }

  // Primary keyword in first 100 words
  const first100Words = article.split(/\s+/).slice(0, 100).join(" ").toLowerCase();
  if (!first100Words.includes(kwLower)) {
    issues.push({ rule: "keyword_not_in_intro", message: `Primary keyword "${primaryKeyword}" not found in the first 100 words.`, severity: "warning" });
  }

  // H2 headings
  const h2Matches = (article.match(/^##\s+.+/gm) ?? []).length;
  if (h2Matches < 2) {
    issues.push({ rule: "insufficient_h2", message: "Article should have at least 2 H2 headings for good structure.", severity: "warning" });
  }

  // Secondary keywords
  const missedSecondary = params.secondaryKeywords.filter(
    (kw) => !lower.includes(kw.toLowerCase())
  );
  if (missedSecondary.length > 0 && params.secondaryKeywords.length > 0) {
    issues.push({
      rule: "missing_secondary_keywords",
      message: `Secondary keywords not found in article: ${missedSecondary.join(", ")}`,
      severity: "info",
    });
  }

  // Word count
  const wordCount = article.split(/\s+/).filter(Boolean).length;
  if (wordCount < 400) {
    issues.push({ rule: "too_short", message: `Article is ${wordCount} words. Aim for at least 400 words.`, severity: "warning" });
  }

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  const score = Math.max(0, 100 - errorCount * 20 - warningCount * 10);

  return {
    valid: errorCount === 0,
    score,
    issues,
  };
}

// ---- Publishing Eligibility Check ---------------------------

export interface PublishingEligibility {
  canPublish: boolean;
  blockers: string[];
}

export function checkPublishingEligibility(params: {
  status: string;
  humanApproved: boolean;
  approvedVersion: number | null;
  currentVersion: number | null;
  isApprovalStale: boolean;
  idempotencyKey: string;
  alreadyPublished: boolean;
}): PublishingEligibility {
  const blockers: string[] = [];

  if (!params.humanApproved) {
    blockers.push("Content has not been approved by a human reviewer.");
  }

  if (params.isApprovalStale) {
    blockers.push(
      `The approval was for version ${params.approvedVersion} but the current version is ${params.currentVersion}. The new version must be approved before publishing.`
    );
  }

  if (params.alreadyPublished) {
    blockers.push("This exact version has already been published to this channel.");
  }

  if (params.status === "REJECTED") {
    blockers.push("Rejected content cannot be published.");
  }

  return { canPublish: blockers.length === 0, blockers };
}
