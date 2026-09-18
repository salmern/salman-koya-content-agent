// @ts-nocheck
/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Content Generation Service — Step-Based
 *
 * The generation phase is split into single-AI-call steps so it can be
 * driven safely by a worker (Vercel Cron). Each invocation performs exactly
 * ONE step and persists progress to the DB, so a serverless function that is
 * killed mid-pipeline can be resumed instead of losing the whole run.
 *
 * Step map:
 *   PLANNING    → generate + persist content plan        → GENERATING
 *   GENERATING  → generate + persist first draft         → EVALUATING
 *   REVISING    → generate + persist revision draft      → EVALUATING
 *   EVALUATING  → evaluate latest draft
 *                 PASS / REJECT                          → AWAITING_REVIEW
 *                 REVISE (revisions left)                → REVISING
 *                 REVISE (revision cap reached)          → AWAITING_REVIEW
 *
 * `runGeneration()` is a convenience driver that loops the steps to
 * completion — used by the local development inline path.
 */

import { createSupabaseAdminClient } from "@/lib/db/client";
import { getAiProvider } from "@/lib/ai";
import { recordAudit, recordFailure, recordAiUsage } from "@/lib/audit";
import type { ContentPlan, DraftEvaluation } from "@/types";

const MAX_AUTO_REVISIONS = parseInt(process.env.MAX_AUTO_REVISIONS ?? "3");

export interface GenerationInput {
  contentRequestId: string;
  userId: string;
  userEmail: string;
}

export interface GenerationResult {
  planId: string | null;
  draftId: string;
  draftVersion: number;
  evaluationId: string;
  evaluationStatus: "PASS" | "REVISE" | "REJECT";
  revisionsAttempted: number;
  requiresHumanReview: boolean;
  error?: string;
}

export interface GenerationStepResult {
  done: boolean;
  result?: GenerationResult;
}

interface GenerationContext {
  request: any;
  sources: any[];
  plan: ContentPlan | null;
  latestDraft: any | null;
  latestEvaluation: DraftEvaluation | null;
  revisionCount: number;
  nextVersion: number;
}

// Safety cap for the local driver loop. Worst case: 1 plan + 1 draft + 1 eval
// + MAX_AUTO_REVISIONS * (1 draft + 1 eval). With the default cap of 3 that is 9 steps.
const MAX_DRIVER_STEPS = 30;

// ---- Public API -------------------------------------------------

/**
 * Advance the generation pipeline by exactly one step.
 * Returns `done: true` once the request leaves the generation phase.
 */
export async function advanceGenerationStep(input: GenerationInput): Promise<GenerationStepResult> {
  const admin = createSupabaseAdminClient();
  const context = await loadGenerationContext(admin, input.contentRequestId);

  if (!context.request) return { done: true };

  const ai = getAiProvider();

  switch (context.request.status) {
    case "PLANNING":
      return planStep(admin, ai, context, input);
    case "GENERATING":
      return draftStep(admin, ai, context, input, false);
    case "REVISING":
      return draftStep(admin, ai, context, input, true);
    case "EVALUATING":
      return evalStep(admin, ai, context, input);
    default:
      return { done: true };
  }
}

/**
 * Local development driver — loops `advanceGenerationStep` until the
 * generation phase is complete. Safe because the Node dev server keeps
 * the process alive (no platform timeout), which cron replaces in production.
 */
export async function runGeneration(input: GenerationInput): Promise<GenerationResult> {
  for (let i = 0; i < MAX_DRIVER_STEPS; i++) {
    const step = await advanceGenerationStep(input);
    if (step.done) {
      if (step.result) return step.result;
      throw new Error("Generation reached a terminal state without a result");
    }
  }
  throw new Error(`Generation did not complete within ${MAX_DRIVER_STEPS} steps`);
}

// ---- Steps -------------------------------------------------------

async function planStep(admin: any, ai: any, context: GenerationContext, input: GenerationInput): Promise<GenerationStepResult> {
  if (context.plan) {
    // Resumed after a crash between plan insert and status transition.
    await setStatus(admin, input.contentRequestId, "GENERATING");
    return { done: false };
  }

  try {
    const planResult = await ai.generateContentPlan({
      contentIdea: context.request.content_idea,
      targetAudience: context.request.target_audience,
      primaryKeyword: context.request.primary_keyword,
      contentGoal: context.request.content_goal,
      tone: context.request.tone,
      sources: context.sources.map((s: any) => ({
        id: s.id,
        url: s.url,
        summary: s.summary,
        title: s.title,
      })),
    });

    await recordAiUsage({
      contentRequestId: input.contentRequestId,
      operation: "content_plan",
      ...planResult.usage,
    });

    const { data: planRecord } = await admin
      .from("content_plans")
      .insert({
        content_request_id: input.contentRequestId,
        working_title: planResult.data.working_title,
        primary_keyword: planResult.data.primary_keyword,
        secondary_keywords: planResult.data.secondary_keywords,
        search_intent: planResult.data.search_intent,
        target_audience: planResult.data.target_audience,
        content_goal: planResult.data.content_goal,
        outline: planResult.data.outline as unknown as import("@/lib/db/database.types").Json,
        key_points: planResult.data.key_points,
        source_mapping: planResult.data.source_mapping as unknown as import("@/lib/db/database.types").Json,
        recommended_links: planResult.data.recommended_links as unknown as import("@/lib/db/database.types").Json,
        recommended_image_description: planResult.data.recommended_image_description,
      })
      .select()
      .single();

    await recordAudit({
      actor_id: input.userId,
      actor_email: input.userEmail,
      action: "plan_created",
      entity_type: "content_plan",
      entity_id: planRecord.id,
      content_request_id: input.contentRequestId,
      metadata: { working_title: planResult.data.working_title },
    });

    await setStatus(admin, input.contentRequestId, "GENERATING");
    return { done: false };
  } catch (err) {
    await failRequest(input.contentRequestId, "planning", err);
    throw err;
  }
}

async function draftStep(
  admin: any,
  ai: any,
  context: GenerationContext,
  input: GenerationInput,
  isRevision: boolean
): Promise<GenerationStepResult> {
  const latestDraft = context.latestDraft;

  // Resume guard: a draft already exists but was never evaluated (crash happened
  // after the draft insert but before the status transition to EVALUATING).
  // Skip generation and continue to evaluation rather than creating a duplicate version.
  if (latestDraft) {
    const { data: existingEvals } = await admin
      .from("draft_evaluations")
      .select("id")
      .eq("draft_id", latestDraft.id)
      .limit(1);

    if (!existingEvals || existingEvals.length === 0) {
      await setStatus(admin, input.contentRequestId, "EVALUATING");
      return { done: false };
    }
  }

  try {
    const lastEval = context.latestEvaluation;
    const draftResult = await ai.generateArticleDraft({
      plan: context.plan ?? ({} as ContentPlan),
      sources: context.sources.map((s: any) => ({
        id: s.id,
        url: s.url,
        content: s.content ?? "",
        title: s.title,
        summary: s.summary ?? "",
      })),
      tone: context.request.tone,
      additionalInstructions: context.request.additional_instructions,
      revisionInstructions: isRevision && lastEval ? buildRevisionInstructions(lastEval) : null,
      previousDraft: null, // pass instructions, not the full previous draft, to keep tokens bounded
    });

    await recordAiUsage({
      contentRequestId: input.contentRequestId,
      operation: isRevision ? "draft_revision" : "draft_generation",
      ...draftResult.usage,
    });

    const { data: d } = await admin
      .from("content_drafts")
      .insert({
        content_request_id: input.contentRequestId,
        content_plan_id: context.plan?.id ?? null,
        version_number: context.nextVersion,
        parent_version_id: latestDraft?.id ?? null,
        title: draftResult.data.title,
        summary: draftResult.data.summary,
        article: draftResult.data.article,
        primary_keyword: draftResult.data.primary_keyword,
        secondary_keywords: draftResult.data.secondary_keywords,
        source_ids: draftResult.data.source_ids,
        key_claims: draftResult.data.key_claims as unknown as import("@/lib/db/database.types").Json,
        word_count: draftResult.data.word_count,
        reading_time_minutes: draftResult.data.reading_time_minutes,
        change_summary: draftResult.data.change_summary,
        created_by: isRevision ? "ai_revision" : "ai",
        created_by_user_id: null,
      })
      .select()
      .single();

    await recordAudit({
      actor_id: input.userId,
      actor_email: input.userEmail,
      action: isRevision ? "draft_revised" : "draft_generated",
      entity_type: "content_draft",
      entity_id: d.id,
      content_request_id: input.contentRequestId,
      metadata: { version: context.nextVersion, word_count: draftResult.data.word_count },
    });

    if (isRevision && latestDraft) {
      await admin.from("draft_revisions").insert({
        original_draft_id: latestDraft.id,
        revised_draft_id: d.id,
        content_request_id: input.contentRequestId,
        revision_number: context.revisionCount + 1,
        changes_made: lastEval?.recommended_changes ?? [],
        revision_reason: buildRevisionInstructions(lastEval!),
        model: draftResult.usage.model,
        input_tokens: draftResult.usage.inputTokens,
        output_tokens: draftResult.usage.outputTokens,
        estimated_cost_usd: draftResult.usage.estimatedCostUsd,
      });
    }

    await setStatus(admin, input.contentRequestId, "EVALUATING");
    return { done: false };
  } catch (err) {
    await failRequest(input.contentRequestId, isRevision ? "revision" : "generation", err);
    throw err;
  }
}

async function evalStep(admin: any, ai: any, context: GenerationContext, input: GenerationInput): Promise<GenerationStepResult> {
  const draft = context.latestDraft;
  if (!draft) {
    // Nothing to evaluate yet — an interrupted run may have reset before inserting.
    await setStatus(admin, input.contentRequestId, "GENERATING");
    return { done: false };
  }

  let evalRecord: any;
  try {
    // Resume guard: evaluation already exists for this draft (crash after insert).
    const { data: existing } = await admin
      .from("draft_evaluations")
      .select("*")
      .eq("draft_id", draft.id)
      .limit(1);

    if (existing && existing.length > 0) {
      evalRecord = existing[0];
    } else {
      const evalResult = await ai.evaluateDraft({
        draft: {
          title: draft.title,
          summary: draft.summary,
          article: draft.article,
          primary_keyword: draft.primary_keyword,
          secondary_keywords: draft.secondary_keywords,
          source_ids: draft.source_ids,
          key_claims: draft.key_claims ?? [],
          word_count: draft.word_count,
          reading_time_minutes: draft.reading_time_minutes,
          change_summary: draft.change_summary,
        },
        sources: context.sources.map((s: any) => ({
          id: s.id,
          url: s.url,
          summary: s.summary,
          title: s.title,
        })),
        targetAudience: context.request.target_audience,
        contentGoal: context.request.content_goal,
        primaryKeyword: context.plan?.primary_keyword ?? "",
        requestedChannels: context.request.requested_channels,
      });

      await recordAiUsage({
        contentRequestId: input.contentRequestId,
        operation: "draft_evaluation",
        ...evalResult.usage,
      });

      const { data: e } = await admin
        .from("draft_evaluations")
        .insert({
          draft_id: draft.id,
          content_request_id: input.contentRequestId,
          overall_status: evalResult.data.overall_status,
          scores: evalResult.data.scores as unknown as import("@/lib/db/database.types").Json,
          unsupported_claims: evalResult.data.unsupported_claims as unknown as import("@/lib/db/database.types").Json,
          weak_sections: evalResult.data.weak_sections as unknown as import("@/lib/db/database.types").Json,
          recommended_changes: evalResult.data.recommended_changes,
          summary: evalResult.data.summary,
          model: evalResult.usage.model,
          input_tokens: evalResult.usage.inputTokens,
          output_tokens: evalResult.usage.outputTokens,
          estimated_cost_usd: evalResult.usage.estimatedCostUsd,
        })
        .select()
        .single();

      evalRecord = e;

      await recordAudit({
        actor_id: input.userId,
        actor_email: input.userEmail,
        action: "draft_evaluated",
        entity_type: "draft_evaluation",
        entity_id: evalRecord.id,
        content_request_id: input.contentRequestId,
        metadata: {
          overall_status: evalResult.data.overall_status,
          overall_score: evalResult.data.scores.overall,
          version: draft.version_number,
        },
      });
    }
  } catch (err) {
    await failRequest(input.contentRequestId, "evaluation", err);
    throw err;
  }

  const overallStatus = evalRecord.overall_status;

  // PASS / REJECT → human review. REVISE: continue while revisions remain.
  if (overallStatus === "REVISE" && context.revisionCount < MAX_AUTO_REVISIONS) {
    await setStatus(admin, input.contentRequestId, "REVISING");
    return { done: false };
  }

  await setStatus(admin, input.contentRequestId, "AWAITING_REVIEW");

  await recordAudit({
    actor_id: input.userId,
    actor_email: input.userEmail,
    action: "review_requested",
    entity_type: "content_request",
    entity_id: input.contentRequestId,
    content_request_id: input.contentRequestId,
    metadata:
      overallStatus === "REVISE"
        ? { reason: "revision_limit_reached", max_revisions: MAX_AUTO_REVISIONS, draft_version: draft.version_number }
        : { draft_version: draft.version_number },
  });

  return {
    done: true,
    result: {
      planId: context.plan?.id ?? null,
      draftId: draft.id,
      draftVersion: draft.version_number,
      evaluationId: evalRecord.id,
      evaluationStatus: overallStatus,
      revisionsAttempted: context.revisionCount,
      requiresHumanReview: true,
      error:
        overallStatus === "REVISE"
          ? `Automatic revision limit (${MAX_AUTO_REVISIONS}) reached. Human review required.`
          : undefined,
    },
  };
}

// ---- Helpers ----------------------------------------------------

async function loadGenerationContext(admin: any, contentRequestId: string): Promise<GenerationContext> {
  const { data: request } = await admin
    .from("content_requests")
    .select("*")
    .eq("id", contentRequestId)
    .single();

  if (!request) {
    return {
      request: null,
      sources: [],
      plan: null,
      latestDraft: null,
      latestEvaluation: null,
      revisionCount: 0,
      nextVersion: 1,
    };
  }

  const { data: sources } = await admin
    .from("content_sources")
    .select("*")
    .eq("content_request_id", contentRequestId)
    .eq("selected", true);

  const { data: plans } = await admin
    .from("content_plans")
    .select("*")
    .eq("content_request_id", contentRequestId)
    .order("created_at", { ascending: false })
    .limit(1);

  const { data: drafts } = await admin
    .from("content_drafts")
    .select("*")
    .eq("content_request_id", contentRequestId)
    .order("version_number", { ascending: false })
    .limit(1);

  const latestDraft = drafts?.[0] ?? null;

  let latestEvaluation: DraftEvaluation | null = null;
  if (latestDraft) {
    const { data: evals } = await admin
      .from("draft_evaluations")
      .select("*")
      .eq("draft_id", latestDraft.id)
      .order("created_at", { ascending: false })
      .limit(1);
    latestEvaluation = (evals?.[0] ?? null) as DraftEvaluation | null;
  }

  const { data: revisions } = await admin
    .from("draft_revisions")
    .select("id")
    .eq("content_request_id", contentRequestId);

  const { data: latestVersion } = await admin
    .from("content_drafts")
    .select("version_number")
    .eq("content_request_id", contentRequestId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    request,
    sources: sources ?? [],
    plan: (plans?.[0] ?? null) as ContentPlan | null,
    latestDraft,
    latestEvaluation,
    revisionCount: revisions?.length ?? 0,
    nextVersion: (latestVersion?.version_number ?? 0) + 1,
  };
}

async function setStatus(admin: any, contentRequestId: string, status: string): Promise<void> {
  await admin.from("content_requests").update({ status }).eq("id", contentRequestId);
}

function buildRevisionInstructions(evaluation: DraftEvaluation): string {
  const parts: string[] = ["Please revise the article to address these issues:"];

  if (evaluation.unsupported_claims?.length > 0) {
    parts.push(
      `\nUnsupported claims to fix:\n${evaluation.unsupported_claims
        .map((c: any) => `- "${c.claim}": ${c.recommendation}`)
        .join("\n")}`
    );
  }

  if (evaluation.weak_sections?.length > 0) {
    parts.push(
      `\nWeak sections to improve:\n${evaluation.weak_sections
        .map((s: any) => `- ${s.section}: ${s.recommendation}`)
        .join("\n")}`
    );
  }

  if (evaluation.recommended_changes?.length > 0) {
    parts.push(`\nRecommended changes:\n${evaluation.recommended_changes.map((c: string) => `- ${c}`).join("\n")}`);
  }

  return parts.join("\n");
}

async function failRequest(
  contentRequestId: string,
  operation: string,
  error: unknown
): Promise<void> {
  const admin = createSupabaseAdminClient();
  const message = error instanceof Error ? error.message : "Unknown error";

  await admin
    .from("content_requests")
    .update({ status: "FAILED" })
    .eq("id", contentRequestId);

  await recordFailure({
    contentRequestId,
    operation,
    errorType: "AI_GENERATION_FAILED",
    message,
    stackTrace: error instanceof Error ? error.stack : null,
    isRetryable: true,
  });
}