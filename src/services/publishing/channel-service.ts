// @ts-nocheck
/**
 * Channel Adaptation Service
 *
 * Generates channel-specific content from an approved draft.
 * Uses deterministic validators after each generation attempt.
 * Retries up to MAX_CHANNEL_RETRIES times before failing.
 */

import { createSupabaseAdminClient } from "@/lib/db/client";
import { getAiProvider } from "@/lib/ai";
import { recordAudit, recordAiUsage, recordFailure } from "@/lib/audit";
import { getApprovalState } from "@/services/review/review-service";
import {
  validateLinkedIn,
  validateX,
  validateNewsletter,
} from "@/lib/validation/channel-validators";
import { NotApprovedError, StaleApprovalError } from "@/lib/errors";
import type { ContentChannel, ChannelValidationError } from "@/types";

const MAX_CHANNEL_RETRIES = 3;

/**
 * Strip markdown for channels that render plain text (LinkedIn, X).
 * Newsletter/article keep markdown because they're rendered as HTML or prose.
 */
function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")          // headings
    .replace(/\*\*(.*?)\*\*/g, "$1")       // bold
    .replace(/__(.*?)__/g, "$1")           // bold alt
    .replace(/\*(.*?)\*/g, "$1")           // italic
    .replace(/_(.*?)_/g, "$1")             // italic alt
    .replace(/`([^`]+)`/g, "$1")           // inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links
    .replace(/^---+$/gm, "")              // horizontal rules
    .replace(/^\*\*\*+$/gm, "")           // horizontal rules alt
    .replace(/^\d+\.\s+/gm, "")           // numbered lists
    .replace(/^[-*+]\s+/gm, "→ ")         // bullet lists → arrow
    .replace(/(?<!\w)\*+(?!\w)/g, "")     // stray asterisks
    .replace(/\n{3,}/g, "\n\n")           // collapse blank lines
    .trim();
}

export interface ChannelAdaptationInput {
  contentRequestId: string;
  userId: string;
  userEmail: string;
  channels: ContentChannel[];
}

export async function runChannelAdaptation(input: ChannelAdaptationInput): Promise<void> {
  const admin = createSupabaseAdminClient();
  const ai = getAiProvider();

  // ---- Verify approval state --------------------------------
  const approval = await getApprovalState(input.contentRequestId);

  if (!approval.isApproved) {
    throw new NotApprovedError();
  }
  if (approval.isStale) {
    throw new StaleApprovalError();
  }

  // Load the approved draft
  const { data: draft } = await admin
    .from("content_drafts")
    .select("*")
    .eq("id", approval.approvedDraftId!)
    .single();

  if (!draft) throw new Error("Approved draft not found");

  const { data: request } = await admin
    .from("content_requests")
    .select("target_audience")
    .eq("id", input.contentRequestId)
    .single();

  // Load sources for attribution
  const { data: sources } = await admin
    .from("content_sources")
    .select("url, title")
    .eq("content_request_id", input.contentRequestId)
    .eq("selected", true);

  // Update status
  await admin
    .from("content_requests")
    .update({ status: "CHANNEL_ADAPTATION" })
    .eq("id", input.contentRequestId);

  // Process each requested channel
  for (const channel of input.channels) {
    if (channel === "article") continue; // article is the draft itself

    await generateChannelContent({
      admin,
      ai,
      channel,
      draft,
      request,
      sources: sources ?? [],
      contentRequestId: input.contentRequestId,
      approvedDraftId: approval.approvedDraftId!,
      userId: input.userId,
      userEmail: input.userEmail,
    });
  }

  // Move to READY_TO_SCHEDULE
  await admin
    .from("content_requests")
    .update({ status: "READY_TO_SCHEDULE" })
    .eq("id", input.contentRequestId);

  await recordAudit({
    actor_id: input.userId,
    actor_email: input.userEmail,
    action: "channel_generated",
    entity_type: "content_request",
    entity_id: input.contentRequestId,
    content_request_id: input.contentRequestId,
    metadata: { channels: input.channels },
  });
}

async function generateChannelContent(params: {
  admin: ReturnType<typeof createSupabaseAdminClient>;
  ai: Awaited<ReturnType<typeof getAiProvider>>;
  channel: ContentChannel;
  draft: Record<string, any>;
  request: Record<string, any> | null;
  sources: Array<{ url: string; title: string | null }>;
  contentRequestId: string;
  approvedDraftId: string;
  userId: string;
  userEmail: string;
}): Promise<void> {
  const { admin, ai, channel, draft, request, sources } = params;

  // Check if already generated (idempotent)
  const { data: existing } = await admin
    .from("channel_content")
    .select("id")
    .eq("content_request_id", params.contentRequestId)
    .eq("approved_draft_id", params.approvedDraftId)
    .eq("channel", channel)
    .maybeSingle();

  if (existing) return; // Already done

  let lastValidationErrors: ChannelValidationError[] = [];
  let revisionCount = 0;
  let finalContent: {
    content: string;
    hashtags: string[];
    cta: string | null;
    subjectLine: string | null;
    title: string | null;
  } | null = null;

  for (let attempt = 0; attempt < MAX_CHANNEL_RETRIES; attempt++) {
    try {
      let generated;
      let validationResult;

      if (channel === "linkedin") {
        const result = await ai.generateLinkedIn({
          article: draft.article,
          title: draft.title,
          summary: draft.summary,
          targetAudience: request?.target_audience ?? "",
          sources: sources.map((s) => ({ url: s.url, title: s.title })),
        });

        await recordAiUsage({
          contentRequestId: params.contentRequestId,
          operation: "linkedin_generation",
          ...result.usage,
        });

        validationResult = validateLinkedIn({
          content: result.data.content,
          hashtags: result.data.hashtags,
          cta: result.data.cta,
        });

        generated = {
          content: stripMarkdown(result.data.content),  // LinkedIn is plain text
          hashtags: result.data.hashtags,
          cta: result.data.cta,
          subjectLine: null,
          title: null,
        };
      } else if (channel === "x") {
        const result = await ai.generateX({
          article: draft.article,
          title: draft.title,
          summary: draft.summary,
        });

        await recordAiUsage({
          contentRequestId: params.contentRequestId,
          operation: "x_generation",
          ...result.usage,
        });

        validationResult = validateX({
          content: result.data.content,
          hashtags: result.data.hashtags,
        });

        // Safety net: if single post exceeds 280 chars, auto-truncate rather than fail
        let xContent = stripMarkdown(result.data.content);
        const isThread = xContent.includes("---");
        if (!isThread && xContent.length > 280) {
          xContent = xContent.slice(0, 277) + "…";
          // Re-validate after truncation
          validationResult = validateX({ content: xContent, hashtags: result.data.hashtags });
        }

        generated = {
          content: xContent,
          hashtags: result.data.hashtags,
          cta: null,
          subjectLine: null,
          title: null,
        };
      } else if (channel === "newsletter") {
        const result = await ai.generateNewsletter({
          article: draft.article,
          title: draft.title,
          summary: draft.summary,
          targetAudience: request?.target_audience ?? "",
        });

        await recordAiUsage({
          contentRequestId: params.contentRequestId,
          operation: "newsletter_generation",
          ...result.usage,
        });

        validationResult = validateNewsletter({
          content: result.data.content,
          subjectLine: result.data.subject_line,
          cta: result.data.cta,
        });

        generated = {
          content: result.data.content,
          hashtags: [],
          cta: result.data.cta,
          subjectLine: result.data.subject_line,
          title: null,
        };
      } else {
        continue;
      }

      lastValidationErrors = validationResult.errors;

      if (validationResult.valid) {
        finalContent = generated;
        break;
      } else {
        // Validation failed — retry with errors as context
        revisionCount++;
        console.warn(`[Channel ${channel}] Validation failed attempt ${attempt + 1}:`, validationResult.errors);
      }
    } catch (err) {
      console.error(`[Channel ${channel}] Generation error attempt ${attempt + 1}:`, err);
      revisionCount++;
    }
  }

  // Save whatever we have (even if validation failed after retries)
  const validationStatus =
    finalContent !== null ? "valid" : lastValidationErrors.some((e) => e.severity === "error") ? "invalid" : "revision_needed";

  const contentToSave = finalContent ?? {
    content: `[${channel.toUpperCase()} content generation failed after ${MAX_CHANNEL_RETRIES} attempts]`,
    hashtags: [],
    cta: null,
    subjectLine: null,
    title: null,
  };

  const charCount = contentToSave.content.length;
  const wordCount = contentToSave.content.split(/\s+/).filter(Boolean).length;

  await admin.from("channel_content").insert({
    content_request_id: params.contentRequestId,
    approved_draft_id: params.approvedDraftId,
    channel,
    title: contentToSave.title,
    subject_line: contentToSave.subjectLine,
    content: contentToSave.content,
    hashtags: contentToSave.hashtags,
    cta: contentToSave.cta,
    word_count: wordCount,
    character_count: charCount,
    validation_status: validationStatus,
    validation_errors: lastValidationErrors as unknown as import("@/lib/db/database.types").Json,
    generation_model: ai.model,
    revision_count: revisionCount,
  });

  if (finalContent === null) {
    await recordFailure({
      contentRequestId: params.contentRequestId,
      operation: `channel_generation_${channel}`,
      errorType: "CHANNEL_GENERATION_FAILED",
      message: `${channel} content failed validation after ${MAX_CHANNEL_RETRIES} attempts`,
      isRetryable: true,
    });
  }
}
