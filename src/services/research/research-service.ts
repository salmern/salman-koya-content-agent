// @ts-nocheck
/**
 * Research Service
 *
 * Orchestrates the full research pipeline:
 * URL retrieval → content extraction → AI summarization →
 * relevance scoring → source selection
 *
 * Uses service role for DB writes so it works in background operations.
 */

import crypto from "crypto";
import { createSupabaseAdminClient } from "@/lib/db/client";
import { getResearchProvider } from "@/lib/research";
import { getAiProvider } from "@/lib/ai";
import { recordAudit, recordFailure, recordAiUsage } from "@/lib/audit";
import { SourceUrlSchema } from "@/schemas/content-request";

const MAX_CONTENT_SOURCES = 5;
const RELEVANCE_THRESHOLD = 5.0;

export interface ResearchInput {
  contentRequestId: string;
  userId: string;
  userEmail: string;
  contentIdea: string;
  targetAudience: string;
  sourceUrl: string | null;
  supportingMaterial: string | null;
}

export interface ResearchResult {
  researchRunId: string;
  sourcesFound: number;
  sourcesSelected: number;
  error?: string;
}

export async function runResearch(input: ResearchInput): Promise<ResearchResult> {
  const admin = createSupabaseAdminClient();
  const researchProvider = getResearchProvider();
  const aiProvider = getAiProvider();

  // ---- 1. Create research run record -------------------------
  const { data: run, error: runError } = await admin
    .from("research_runs")
    .insert({
      content_request_id: input.contentRequestId,
      status: "running",
      source_count: 0,
      selected_source_count: 0,
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (runError || !run) {
    throw new Error("Failed to create research run record");
  }

  // ---- 2. Transition content request to RESEARCHING ----------
  await admin
    .from("content_requests")
    .update({ status: "RESEARCHING" })
    .eq("id", input.contentRequestId);

  await recordAudit({
    actor_id: input.userId,
    actor_email: input.userEmail,
    action: "research_started",
    entity_type: "research_run",
    entity_id: run.id,
    content_request_id: input.contentRequestId,
    metadata: { research_run_id: run.id },
  });

  try {
    const urlsToResearch: string[] = [];

    // Validate and queue the user-provided URL
    if (input.sourceUrl) {
      const urlValidation = SourceUrlSchema.safeParse(input.sourceUrl);
      if (urlValidation.success) {
        urlsToResearch.push(input.sourceUrl);
      } else {
        // Record invalid URL as a failed source (don't crash the whole run)
        await admin.from("content_sources").insert({
          research_run_id: run.id,
          content_request_id: input.contentRequestId,
          url: input.sourceUrl,
          retrieval_status: "failed",
          selected: false,
        });
      }
    }

    // ---- 3. Retrieve URLs ------------------------------------
    const retrievedSources = [];

    for (const url of urlsToResearch) {
      const retrieved = await researchProvider.retrieveUrl(url);

      const sourceRecord = await admin
        .from("content_sources")
        .insert({
          research_run_id: run.id,
          content_request_id: input.contentRequestId,
          url,
          title: retrieved.title,
          domain: retrieved.domain,
          author: retrieved.author,
          published_at: retrieved.publishedAt,
          retrieved_at: new Date().toISOString(),
          content: retrieved.content || null,
          retrieval_status: retrieved.retrievalStatus,
          content_hash: retrieved.contentHash || null,
          word_count: retrieved.wordCount,
          selected: false,
        })
        .select()
        .single();

      if (retrieved.retrievalStatus === "retrieved" && retrieved.content) {
        retrievedSources.push({ ...retrieved, id: sourceRecord.data?.id });
      }
    }

    // ---- 4. Handle supporting material as a virtual source ---
    if (input.supportingMaterial && input.supportingMaterial.trim().length > 50) {
      const hash = crypto
        .createHash("sha256")
        .update(input.supportingMaterial)
        .digest("hex");

      const sm = await admin
        .from("content_sources")
        .insert({
          research_run_id: run.id,
          content_request_id: input.contentRequestId,
          url: "internal://supporting-material",
          title: "Supporting Material (provided by user)",
          domain: "internal",
          content: input.supportingMaterial,
          word_count: input.supportingMaterial.split(/\s+/).filter(Boolean).length,
          retrieval_status: "retrieved",
          content_hash: hash,
          selected: false,
        })
        .select()
        .single();

      if (sm.data) {
        retrievedSources.push({
          id: sm.data.id,
          content: input.supportingMaterial,
          url: "internal://supporting-material",
          title: "Supporting Material (provided by user)",
          domain: "internal",
          author: null,
          publishedAt: null,
          wordCount: input.supportingMaterial.split(/\s+/).filter(Boolean).length,
          contentHash: hash,
          retrievalStatus: "retrieved" as const,
        });
      }
    }

    // ---- 5. AI summarize and score each source — run concurrently ----
    let selectedCount = 0;
    const sourcesToSummarise = retrievedSources
      .slice(0, MAX_CONTENT_SOURCES)
      .filter((s) => s.id && s.content);

    const summaryResults = await Promise.allSettled(
      sourcesToSummarise.map((source) =>
        aiProvider.summarizeSource({
          url: source.url,
          content: source.content,
          contentIdea: input.contentIdea,
          targetAudience: input.targetAudience,
        })
      )
    );

    for (let i = 0; i < sourcesToSummarise.length; i++) {
      const source = sourcesToSummarise[i];
      const result = summaryResults[i];

      if (result.status === "rejected") {
        console.error(`[Research] Failed to summarize source ${source.url}:`, result.reason);
        continue;
      }

      const summaryResult = result.value;

      await recordAiUsage({
        contentRequestId: input.contentRequestId,
        operation: "source_summary",
        ...summaryResult.usage,
      });

      const isSelected =
        summaryResult.data.is_relevant &&
        summaryResult.data.relevance_score >= RELEVANCE_THRESHOLD;

      if (isSelected) selectedCount++;

      await admin
        .from("content_sources")
        .update({
          summary: summaryResult.data.summary,
          relevance_score: summaryResult.data.relevance_score,
          selected: isSelected,
          selection_reason: summaryResult.data.selection_reason,
        })
        .eq("id", source.id);

      if (isSelected) {
        await recordAudit({
          actor_id: null,
          actor_email: null,
          action: "source_selected",
          entity_type: "content_source",
          entity_id: source.id,
          content_request_id: input.contentRequestId,
          metadata: {
            url: source.url,
            relevance_score: summaryResult.data.relevance_score,
            selection_reason: summaryResult.data.selection_reason,
          },
        });
      }
    }

    // ---- 6. Update research run as complete ------------------
    await admin.from("research_runs").update({
      status: "complete",
      source_count: retrievedSources.length,
      selected_source_count: selectedCount,
      completed_at: new Date().toISOString(),
    }).eq("id", run.id);

    // ---- 7. Transition request to RESEARCH_COMPLETE ----------
    await admin
      .from("content_requests")
      .update({ status: "RESEARCH_COMPLETE" })
      .eq("id", input.contentRequestId);

    await recordAudit({
      actor_id: input.userId,
      actor_email: input.userEmail,
      action: "research_completed",
      entity_type: "research_run",
      entity_id: run.id,
      content_request_id: input.contentRequestId,
      metadata: { sources_found: retrievedSources.length, sources_selected: selectedCount },
    });

    return {
      researchRunId: run.id,
      sourcesFound: retrievedSources.length,
      sourcesSelected: selectedCount,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown research error";

    // Mark research run as failed
    await admin.from("research_runs").update({
      status: "failed",
      error_message: message,
      completed_at: new Date().toISOString(),
    }).eq("id", run.id);

    // Transition to FAILED
    await admin
      .from("content_requests")
      .update({ status: "FAILED" })
      .eq("id", input.contentRequestId);

    await recordFailure({
      contentRequestId: input.contentRequestId,
      operation: "research",
      errorType: "RESEARCH_FAILED",
      message,
      stackTrace: error instanceof Error ? error.stack : null,
      isRetryable: true,
      metadata: { research_run_id: run.id },
    });

    return {
      researchRunId: run.id,
      sourcesFound: 0,
      sourcesSelected: 0,
      error: message,
    };
  }
}
