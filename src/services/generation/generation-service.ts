// @ts-nocheck
/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Content Generation Service
 *
 * Orchestrates: Planning → Generation → Evaluation → Revision (up to MAX_REVISIONS)
 * Never creates infinite loops. Hard revision limit enforced.
 */

import { createSupabaseAdminClient } from "@/lib/db/client";
import { getAiProvider } from "@/lib/ai";
import { recordAudit, recordFailure, recordAiUsage } from "@/lib/audit";
import { RevisionLimitError } from "@/lib/errors";
import type { ContentPlan, DraftEvaluation } from "@/types";

const MAX_AUTO_REVISIONS = parseInt(process.env.MAX_AUTO_REVISIONS ?? "3");

export interface GenerationInput {
  contentRequestId: string;
  userId: string;
  userEmail: string;
}

export interface GenerationResult {
  planId: string;
  draftId: string;
  draftVersion: number;
  evaluationId: string;
  evaluationStatus: "PASS" | "REVISE" | "REJECT";
  revisionsAttempted: number;
  requiresHumanReview: boolean;
  error?: string;
}

export async function runGeneration(input: GenerationInput): Promise<GenerationResult> {
  const admin = createSupabaseAdminClient();
  const ai = getAiProvider();

  // ---- Load request + sources --------------------------------
  const { data: request } = await admin
    .from("content_requests")
    .select("*")
    .eq("id", input.contentRequestId)
    .single();

  if (!request) throw new Error("Content request not found");

  const { data: sources } = await admin
    .from("content_sources")
    .select("*")
    .eq("content_request_id", input.contentRequestId)
    .eq("selected", true);

  const selectedSources = (sources ?? []).map((s: any) => ({
    id: s.id,
    url: s.url,
    content: s.content ?? "",
    title: s.title,
    summary: s.summary ?? "",
  }));

  // ---- PLANNING --------------------------------------------
  await admin
    .from("content_requests")
    .update({ status: "PLANNING" })
    .eq("id", input.contentRequestId);

  let plan: ContentPlan;
  try {
    const planResult = await ai.generateContentPlan({
      contentIdea: request.content_idea,
      targetAudience: request.target_audience,
      primaryKeyword: request.primary_keyword,
      contentGoal: request.content_goal,
      tone: request.tone,
      sources: selectedSources.map((s: any) => ({
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

    plan = planRecord as unknown as ContentPlan;
  } catch (err) {
    await failRequest(input.contentRequestId, "planning", err);
    throw err;
  }

  // ---- GENERATION → EVALUATION → REVISION LOOP -------------
  await admin
    .from("content_requests")
    .update({ status: "GENERATING" })
    .eq("id", input.contentRequestId);

  let currentVersion = await getNextVersionNumber(input.contentRequestId);
  let previousDraftId: string | null = null;
  let revisionsAttempted = 0;
  let lastEvaluation: DraftEvaluation | null = null;
  let _lastDraftId: string | null = null;

  for (let attempt = 0; attempt <= MAX_AUTO_REVISIONS; attempt++) {
    const isRevision = attempt > 0;

    if (isRevision) {
      await admin
        .from("content_requests")
        .update({ status: "REVISING" })
        .eq("id", input.contentRequestId);
      revisionsAttempted++;
    }

    // ---- Generate draft ---
    let draftRecord: any;
    try {
      const draftResult = await ai.generateArticleDraft({
        plan,
        sources: selectedSources,
        tone: request.tone,
        additionalInstructions: request.additional_instructions,
        revisionInstructions: isRevision && lastEvaluation
          ? buildRevisionInstructions(lastEvaluation)
          : null,
        previousDraft: null, // We pass instructions, not the full previous draft to keep tokens bounded
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
          content_plan_id: plan.id,
          version_number: currentVersion,
          parent_version_id: previousDraftId,
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

      draftRecord = d;

      await recordAudit({
        actor_id: null,
        actor_email: null,
        action: isRevision ? "draft_revised" : "draft_generated",
        entity_type: "content_draft",
        entity_id: draftRecord!.id,
        content_request_id: input.contentRequestId,
        metadata: { version: currentVersion, word_count: draftResult.data.word_count },
      });

      if (isRevision && previousDraftId) {
        await admin.from("draft_revisions").insert({
          original_draft_id: previousDraftId,
          revised_draft_id: draftRecord!.id,
          content_request_id: input.contentRequestId,
          revision_number: revisionsAttempted,
          changes_made: lastEvaluation?.recommended_changes ?? [],
          revision_reason: buildRevisionInstructions(lastEvaluation!),
          model: draftResult.usage.model,
          input_tokens: draftResult.usage.inputTokens,
          output_tokens: draftResult.usage.outputTokens,
          estimated_cost_usd: draftResult.usage.estimatedCostUsd,
        });
      }
    } catch (err) {
      await failRequest(input.contentRequestId, "generation", err);
      throw err;
    }

    previousDraftId = draftRecord!.id;
    _lastDraftId = draftRecord!.id;

    // ---- Evaluate draft ---
    await admin
      .from("content_requests")
      .update({ status: "EVALUATING" })
      .eq("id", input.contentRequestId);

    let evalRecord;
    try {
      const evalResult = await ai.evaluateDraft({
        draft: {
          title: draftRecord!.title,
          summary: draftRecord!.summary,
          article: draftRecord!.article,
          primary_keyword: draftRecord!.primary_keyword,
          secondary_keywords: draftRecord!.secondary_keywords,
          source_ids: draftRecord!.source_ids,
          key_claims: draftRecord!.key_claims as any,
          word_count: draftRecord!.word_count,
          reading_time_minutes: draftRecord!.reading_time_minutes,
          change_summary: draftRecord!.change_summary,
        },
        sources: selectedSources.map((s: any) => ({
          id: s.id,
          url: s.url,
          summary: s.summary,
          title: s.title,
        })),
        targetAudience: request.target_audience,
        contentGoal: request.content_goal,
        primaryKeyword: plan.primary_keyword,
        requestedChannels: request.requested_channels,
      });

      await recordAiUsage({
        contentRequestId: input.contentRequestId,
        operation: "draft_evaluation",
        ...evalResult.usage,
      });

      const { data: e } = await admin
        .from("draft_evaluations")
        .insert({
          draft_id: draftRecord!.id,
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
      lastEvaluation = e as unknown as DraftEvaluation;

      await recordAudit({
        actor_id: null,
        actor_email: null,
        action: "draft_evaluated",
        entity_type: "draft_evaluation",
        entity_id: evalRecord!.id,
        content_request_id: input.contentRequestId,
        metadata: {
          overall_status: evalResult.data.overall_status,
          overall_score: evalResult.data.scores.overall,
          version: currentVersion,
        },
      });
    } catch (err) {
      await failRequest(input.contentRequestId, "evaluation", err);
      throw err;
    }

    // ---- Decision: PASS → human review, REVISE → try again, REJECT → stop ---
    if (evalRecord!.overall_status === "PASS") {
      // Move to human review
      await admin
        .from("content_requests")
        .update({ status: "AWAITING_REVIEW" })
        .eq("id", input.contentRequestId);

      await recordAudit({
        actor_id: null,
        actor_email: null,
        action: "review_requested",
        entity_type: "content_request",
        entity_id: input.contentRequestId,
        content_request_id: input.contentRequestId,
        metadata: { draft_version: currentVersion },
      });

      return {
        planId: plan.id,
        draftId: draftRecord!.id,
        draftVersion: currentVersion,
        evaluationId: evalRecord!.id,
        evaluationStatus: "PASS",
        revisionsAttempted,
        requiresHumanReview: true,
      };
    }

    if (evalRecord!.overall_status === "REJECT") {
      await admin
        .from("content_requests")
        .update({ status: "AWAITING_REVIEW" })
        .eq("id", input.contentRequestId);

      return {
        planId: plan.id,
        draftId: draftRecord!.id,
        draftVersion: currentVersion,
        evaluationId: evalRecord!.id,
        evaluationStatus: "REJECT",
        revisionsAttempted,
        requiresHumanReview: true,
      };
    }

    // REVISE — check limit
    if (attempt >= MAX_AUTO_REVISIONS) {
      // Hit the hard limit
      await admin
        .from("content_requests")
        .update({ status: "AWAITING_REVIEW" })
        .eq("id", input.contentRequestId);

      await recordAudit({
        actor_id: null,
        actor_email: null,
        action: "review_requested",
        entity_type: "content_request",
        entity_id: input.contentRequestId,
        content_request_id: input.contentRequestId,
        metadata: {
          reason: "revision_limit_reached",
          max_revisions: MAX_AUTO_REVISIONS,
          draft_version: currentVersion,
        },
      });

      return {
        planId: plan.id,
        draftId: draftRecord!.id,
        draftVersion: currentVersion,
        evaluationId: evalRecord!.id,
        evaluationStatus: "REVISE",
        revisionsAttempted,
        requiresHumanReview: true,
        error: `Automatic revision limit (${MAX_AUTO_REVISIONS}) reached. Human review required.`,
      };
    }

    // Increment version for next attempt
    currentVersion++;
  }

  // Should never reach here, but satisfy TypeScript
  throw new RevisionLimitError(MAX_AUTO_REVISIONS);
}

// ---- Helpers ------------------------------------------------

async function getNextVersionNumber(contentRequestId: string): Promise<number> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("content_drafts")
    .select("version_number")
    .eq("content_request_id", contentRequestId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data?.version_number ?? 0) + 1;
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
