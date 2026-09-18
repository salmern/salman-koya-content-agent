/**
 * AI Provider Abstraction
 *
 * All AI implementations must satisfy this interface.
 * Structured outputs are used wherever possible to avoid
 * parsing unpredictable free-form responses.
 */

import type { ContentPlan, EvaluationScores } from "@/types";

// ---- Shared types -------------------------------------------

export interface AiUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
}

export interface AiResult<T> {
  data: T;
  usage: AiUsage;
}

// ---- Content Plan Output ------------------------------------

export interface ContentPlanOutput {
  working_title: string;
  primary_keyword: string;
  secondary_keywords: string[];
  search_intent: string;
  target_audience: string;
  content_goal: string;
  outline: {
    level: "h1" | "h2" | "h3";
    title: string;
    notes: string | null;
    source_ids: string[];
  }[];
  key_points: string[];
  source_mapping: {
    source_id: string;
    usage: string;
    sections: string[];
  }[];
  recommended_links: {
    url: string;
    anchor_text: string;
    type: "internal" | "external";
  }[];
  recommended_image_description: string | null;
}

// ---- Article Draft Output -----------------------------------

export interface ArticleDraftOutput {
  title: string;
  summary: string;
  article: string; // full markdown
  primary_keyword: string;
  secondary_keywords: string[];
  source_ids: string[];
  key_claims: {
    claim: string;
    source_ids: string[];
    supported: boolean;
    flag: boolean;
  }[];
  word_count: number;
  reading_time_minutes: number;
  change_summary: string | null;
}

// ---- Evaluation Output --------------------------------------

export interface EvaluationOutput {
  overall_status: "PASS" | "REVISE" | "REJECT";
  scores: EvaluationScores;
  unsupported_claims: {
    claim: string;
    location: string;
    recommendation: string;
  }[];
  weak_sections: {
    section: string;
    issue: string;
    recommendation: string;
  }[];
  recommended_changes: string[];
  summary: string;
}

// ---- Channel Content Outputs --------------------------------

export interface LinkedInOutput {
  content: string;
  hashtags: string[];
  cta: string;
  image_suggestion: string | null;
}

export interface XOutput {
  content: string;
  hashtags: string[];
}

export interface NewsletterOutput {
  subject_line: string;
  content: string;
  cta: string;
}

// ---- Summary Output -----------------------------------------

export interface SourceSummaryOutput {
  summary: string;
  key_points: string[];
  relevance_score: number; // 0-10
  selection_reason: string;
  is_relevant: boolean;
}

// ---- AI Provider Interface ----------------------------------

export interface AiProvider {
  readonly name: string;
  readonly model: string;

  /**
   * Generate a content plan from a content request and its sources.
   * Uses structured JSON output.
   */
  generateContentPlan(params: {
    contentIdea: string;
    targetAudience: string;
    primaryKeyword: string | null;
    contentGoal: string | null;
    tone: string | null;
    sources: { id: string; url: string; summary: string; title: string | null }[];
  }): Promise<AiResult<ContentPlanOutput>>;

  /**
   * Generate an article draft from a content plan and sources.
   * Uses structured JSON output.
   */
  generateArticleDraft(params: {
    plan: ContentPlan;
    sources: { id: string; url: string; content: string; title: string | null; summary: string }[];
    tone: string | null;
    additionalInstructions: string | null;
    revisionInstructions?: string | null;
    previousDraft?: string | null;
  }): Promise<AiResult<ArticleDraftOutput>>;

  /**
   * Evaluate a draft against its sources and plan.
   * Uses structured JSON output.
   */
  evaluateDraft(params: {
    draft: ArticleDraftOutput;
    sources: { id: string; url: string; summary: string; title: string | null }[];
    targetAudience: string;
    contentGoal: string | null;
    primaryKeyword: string;
    requestedChannels: string[];
  }): Promise<AiResult<EvaluationOutput>>;

  /**
   * Generate LinkedIn post from approved article.
   */
  generateLinkedIn(params: {
    article: string;
    title: string;
    summary: string;
    targetAudience: string;
    sources: { url: string; title: string | null }[];
  }): Promise<AiResult<LinkedInOutput>>;

  /**
   * Generate X (Twitter) post from approved article.
   */
  generateX(params: {
    article: string;
    title: string;
    summary: string;
  }): Promise<AiResult<XOutput>>;

  /**
   * Generate email newsletter from approved article.
   */
  generateNewsletter(params: {
    article: string;
    title: string;
    summary: string;
    targetAudience: string;
  }): Promise<AiResult<NewsletterOutput>>;

  /**
   * Summarize a source document and assess relevance.
   * Uses structured JSON output.
   */
  summarizeSource(params: {
    url: string;
    content: string;
    contentIdea: string;
    targetAudience: string;
  }): Promise<AiResult<SourceSummaryOutput>>;

  /**
   * Check whether the provider is configured and healthy.
   */
  isAvailable(): Promise<boolean>;
}
