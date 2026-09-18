// @ts-nocheck
/**
 * Publishing Service
 *
 * Enforces all publishing invariants before any content goes out.
 * Uses idempotency keys to prevent duplicate publishing.
 */

import { createSupabaseAdminClient } from "@/lib/db/client";
import { getPublishingProvider } from "@/lib/publishing";
import { recordAudit, recordFailure } from "@/lib/audit";
import { getApprovalState } from "@/services/review/review-service";
import {
  NotApprovedError,
  StaleApprovalError,
  DuplicatePublishError,
  NotFoundError,
} from "@/lib/errors";
import type { ContentChannel } from "@/types";

const MAX_PUBLISH_RETRIES = 3;

export interface PublishInput {
  contentRequestId: string;
  channelContentId: string;
  userId: string;
  userEmail: string;
  scheduledAt?: string | null;
  recipients?: string[]; // optional override for newsletter recipients
}

export async function enqueueForPublishing(input: PublishInput): Promise<string> {
  const admin = createSupabaseAdminClient();
  const provider = getPublishingProvider();

  // ---- 1. Verify approval -------------------------------------
  const approval = await getApprovalState(input.contentRequestId);

  if (!approval.isApproved) throw new NotApprovedError();
  if (approval.isStale) throw new StaleApprovalError();

  // ---- 2. Load channel content --------------------------------
  const { data: channelContent } = await admin
    .from("channel_content")
    .select("*")
    .eq("id", input.channelContentId)
    .eq("content_request_id", input.contentRequestId)
    .single();

  if (!channelContent) throw new NotFoundError("Channel content");

  // ---- 3. Build idempotency key and check duplicate ----------
  const idempotencyKey = `${input.contentRequestId}__${channelContent.channel}__v${approval.approvedVersion}`;

  const { data: existing } = await admin
    .from("publishing_queue")
    .select("id, status")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (existing) {
    if (existing.status === "PUBLISHED") {
      throw new DuplicatePublishError(channelContent.channel);
    }
    // Item exists but is not yet published — return it so executePublishing can run
    return existing.id;
  }

  // ---- 4. Create publishing queue entry ----------------------
  const { data: queueItem, error } = await admin
    .from("publishing_queue")
    .insert({
      content_request_id: input.contentRequestId,
      channel_content_id: input.channelContentId,
      channel: channelContent.channel as ContentChannel,
      approved_draft_id: approval.approvedDraftId!,
      approved_version: approval.approvedVersion!,
      idempotency_key: idempotencyKey,
      status: input.scheduledAt ? "SCHEDULED" : "READY",
      scheduled_at: input.scheduledAt ?? null,
      provider: provider.name,
    })
    .select()
    .single();

  if (error || !queueItem) throw new Error("Failed to create publishing queue entry");

  if (input.scheduledAt) {
    await recordAudit({
      actor_id: input.userId,
      actor_email: input.userEmail,
      action: "scheduled",
      entity_type: "publishing_queue",
      entity_id: queueItem.id,
      content_request_id: input.contentRequestId,
      metadata: {
        channel: channelContent.channel,
        scheduled_at: input.scheduledAt,
        provider: provider.name,
      },
    });
  }

  return queueItem.id;
}

export async function executePublishing(queueItemId: string, userId: string, userEmail: string, recipientOverrides?: string[]): Promise<void> {
  const admin = createSupabaseAdminClient();
  const provider = getPublishingProvider();

  const { data: queueItem } = await admin
    .from("publishing_queue")
    .select("*, channel_content:channel_content_id(*)")
    .eq("id", queueItemId)
    .single();

  if (!queueItem) throw new NotFoundError("Publishing queue item");

  if (queueItem.status === "PUBLISHED") {
    throw new DuplicatePublishError(queueItem.channel);
  }

  // ---- Re-verify approval before publishing ------------------
  const approval = await getApprovalState(queueItem.content_request_id);
  if (!approval.isApproved) throw new NotApprovedError();
  if (approval.isStale) throw new StaleApprovalError();

  // Verify the queue item's approved version still matches
  if (approval.approvedVersion !== queueItem.approved_version) {
    throw new StaleApprovalError();
  }

  const channelContent = queueItem.channel_content as Record<string, any>;

  // Mark as PUBLISHING
  await admin
    .from("publishing_queue")
    .update({ status: "PUBLISHING" })
    .eq("id", queueItemId);

  try {
    const result = await provider.publish({
      channel: queueItem.channel,
      content: channelContent?.content ?? "",
      title: channelContent?.title ?? null,
      hashtags: channelContent?.hashtags ?? [],
      idempotencyKey: queueItem.idempotency_key,
      recipientOverrides,
    });

    console.log(`[Publishing] channel=${queueItem.channel} provider=${provider.name} success=${result.success} error=${result.errorMessage ?? "none"}`);

    if (result.success) {
      await admin.from("publishing_queue").update({
        status: "PUBLISHED",
        published_at: result.publishedAt ?? new Date().toISOString(),
        provider_post_id: result.providerPostId,
        error_message: null,
      }).eq("id", queueItemId);

      // Update content request status if all channels are published
      await checkAndUpdatePublishedStatus(queueItem.content_request_id);

      await recordAudit({
        actor_id: userId,
        actor_email: userEmail,
        action: "published",
        entity_type: "publishing_queue",
        entity_id: queueItemId,
        content_request_id: queueItem.content_request_id,
        metadata: {
          channel: queueItem.channel,
          provider: provider.name,
          is_demo: result.isDemo,
          provider_post_id: result.providerPostId,
        },
      });
    } else {
      const retryCount = (queueItem.retry_count ?? 0) + 1;
      await admin.from("publishing_queue").update({
        status: retryCount >= MAX_PUBLISH_RETRIES ? "FAILED" : "READY",
        error_message: result.errorMessage,
        retry_count: retryCount,
      }).eq("id", queueItemId);

      await recordFailure({
        contentRequestId: queueItem.content_request_id,
        operation: `publishing_${queueItem.channel}`,
        errorType: "PUBLISHING_FAILED",
        message: result.errorMessage ?? "Publishing failed",
        retryCount,
        maxRetries: MAX_PUBLISH_RETRIES,
        isRetryable: retryCount < MAX_PUBLISH_RETRIES,
      });

      await recordAudit({
        actor_id: userId,
        actor_email: userEmail,
        action: "publishing_failed",
        entity_type: "publishing_queue",
        entity_id: queueItemId,
        content_request_id: queueItem.content_request_id,
        metadata: { error: result.errorMessage, retry_count: retryCount },
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown publishing error";
    const retryCount = (queueItem.retry_count ?? 0) + 1;

    await admin.from("publishing_queue").update({
      status: retryCount >= MAX_PUBLISH_RETRIES ? "FAILED" : "READY",
      error_message: message,
      retry_count: retryCount,
    }).eq("id", queueItemId);

    await recordFailure({
      contentRequestId: queueItem.content_request_id,
      operation: `publishing_${queueItem.channel}`,
      errorType: "PUBLISHING_FAILED",
      message,
      retryCount,
      maxRetries: MAX_PUBLISH_RETRIES,
      isRetryable: retryCount < MAX_PUBLISH_RETRIES,
    });

    throw error;
  }
}

async function checkAndUpdatePublishedStatus(contentRequestId: string): Promise<void> {
  const admin = createSupabaseAdminClient();

  const { data: queueItems } = await admin
    .from("publishing_queue")
    .select("status")
    .eq("content_request_id", contentRequestId);

  if (!queueItems?.length) return;

  const allPublished = queueItems.every((item) => item.status === "PUBLISHED");
  if (allPublished) {
    await admin
      .from("content_requests")
      .update({ status: "PUBLISHED" })
      .eq("id", contentRequestId);
  }
}
