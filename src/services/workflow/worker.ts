// @ts-nocheck
/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Content Pipeline Worker
 *
 * Drives the AI content pipeline from a single entry point so each run
 * fits inside one serverless invocation (Vercel Cron, min interval 1 min).
 * In local development the routes run the pipeline inline instead
 * (`runPipelineToCompletion`), so `npm run dev` behaves exactly as before.
 *
 * Responsibilities per invocation of `advanceDueJobs`:
 *   1. Recover requests stuck in a processing state (>15 min) → FAILED
 *   2. Advance at most one step per due request (research / planning /
 *      draft / evaluation / channel adaptation), within a time budget
 *   3. Execute due scheduled / retry publishing_queue items
 *
 * Race note: two concurrent cron invocations may both read the same request.
 * Steps are idempotent-ish (plan/draft/evaluation existence is re-checked
 * before creating), so an overlapping run degrades to a no-op or a retried
 * step rather than corrupting state.
 */

import { createSupabaseAdminClient } from "@/lib/db/client";
import { runResearch } from "@/services/research/research-service";
import { advanceGenerationStep } from "@/services/generation/generation-service";
import { runChannelAdaptation } from "@/services/publishing/channel-service";
import { executePublishing } from "@/services/publishing/publishing-service";
import { recordFailure } from "@/lib/audit";

export const PROCESSING_STATUSES = [
  "RESEARCHING",
  "PLANNING",
  "GENERATING",
  "EVALUATING",
  "REVISING",
  "REVISION_REQUESTED",
  "CHANNEL_ADAPTATION",
];

// Minimum age (of `updated_at`) before the advance-on-read path will run
// another step. Guards against concurrent polling invocations (multiple
// tabs / overlapping fetches) re-entering the same step.
export const ADVANCE_DEBOUNCE_MS = 5_000;

// Requests older than this in a processing state are assumed to have been
// killed by the platform → reset to FAILED so the user can retry.
const STUCK_THRESHOLD_MS = 15 * 60 * 1000;

// Hard stop so a slow AI step cannot blow the function duration budget.
export const WORKER_TIME_BUDGET_MS = 240_000; // 4 min (maxDuration = 300s)

// Local dev pipeline loop safety cap.
export const MAX_INLINE_STEPS = 50;

export function isLocalDevelopment(): boolean {
  return process.env.NODE_ENV === "development";
}

export interface WorkerRunResult {
  recovered: number;
  advanced: number;
  remaining: number;
  published: number;
  budgetExhausted: boolean;
}

export interface AdvanceOneStepResult {
  advanced: boolean;
}

/**
 * Advance a single request by exactly one pipeline step.
 * Returns `{ advanced: true }` when a step ran; `{ advanced: false }` when the
 * request is not in a processing state or the step is already complete in DB.
 */
export async function advanceOneStepFor(request: any): Promise<AdvanceOneStepResult> {
  const status = request.status;

  if (!PROCESSING_STATUSES.includes(status)) {
    return { advanced: false };
  }

  const userEmail = await resolveActorEmail(request.user_id);

  switch (status) {
    case "RESEARCHING": {
      await runResearch({
        contentRequestId: request.id,
        userId: request.user_id,
        userEmail,
        sourceUrl: request.source_url,
        supportingMaterial: request.supporting_material,
        contentIdea: request.content_idea,
        targetAudience: request.target_audience,
      });
      return { advanced: true };
    }
    case "PLANNING":
    case "GENERATING":
    case "EVALUATING":
    case "REVISING":
    case "REVISION_REQUESTED": {
      await advanceGenerationStep({
        contentRequestId: request.id,
        userId: request.user_id,
        userEmail,
      });
      return { advanced: true };
    }
    case "CHANNEL_ADAPTATION": {
      await runChannelAdaptation({
        contentRequestId: request.id,
        userId: request.user_id,
        userEmail,
        channels: request.requested_channels,
      });
      return { advanced: true };
    }
    default:
      return { advanced: false };
  }
}

/**
 * Advance-on-read entry point used by the request-detail API on plans without
 * per-minute cron (Hobby). Runs a single step only when the request is in a
 * processing state AND was last touched more than the debounce window ago.
 * Returns true when a step actually ran.
 */
export async function advanceStepIfDue(request: any): Promise<boolean> {
  if (!PROCESSING_STATUSES.includes(request.status)) {
    return false;
  }

  const lastTouched = request.updated_at ? new Date(request.updated_at).getTime() : 0;
  if (Date.now() - lastTouched < ADVANCE_DEBOUNCE_MS) {
    return false;
  }

  await advanceOneStepFor(request);
  return true;
}

export async function advanceDueJobs(options?: { limit?: number }): Promise<WorkerRunResult> {
  const admin = createSupabaseAdminClient();
  const limit = options?.limit ?? 10;

  const recovered = await recoverStuckRequests(admin);

  const { data: requests, error } = await admin
    .from("content_requests")
    .select("*")
    .in("status", PROCESSING_STATUSES)
    .order("updated_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw error;
  }

  const startedAt = Date.now();
  let advanced = 0;
  let budgetExhausted = false;

  for (const request of requests ?? []) {
    if (Date.now() - startedAt >= WORKER_TIME_BUDGET_MS) {
      budgetExhausted = true;
      break;
    }
    try {
      const step = await advanceOneStepFor(request);
      if (step.advanced) advanced++;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown worker error";
      console.error(`[Worker] Step failed for request ${request.id}:`, message);
      await admin
        .from("content_requests")
        .update({ status: "FAILED" })
        .eq("id", request.id);
      await recordFailure({
        contentRequestId: request.id,
        operation: "worker_step",
        errorType: "UNKNOWN",
        message,
        stackTrace: err instanceof Error ? err.stack : null,
        isRetryable: true,
      });
    }
  }

  const published = await publishDueQueueItems(admin);

  return {
    recovered,
    advanced,
    remaining: Math.max(0, (requests?.length ?? 0) - advanced),
    published,
    budgetExhausted,
  };
}

/**
 * Local-development driver: advance a request through the whole pipeline
 * (research → generation → channel adaptation) without needing the cron.
 * Relies on the dev server process staying alive across calls.
 */
export async function runPipelineToCompletion(options: { contentRequestId: string }): Promise<void> {
  const admin = createSupabaseAdminClient();

  for (let i = 0; i < MAX_INLINE_STEPS; i++) {
    const { data: request } = await admin
      .from("content_requests")
      .select("*")
      .eq("id", options.contentRequestId)
      .single();

    if (!request || !PROCESSING_STATUSES.includes(request.status)) {
      break;
    }

    try {
      await advanceOneStepFor(request);
    } catch (err) {
      console.error(`[Worker] Inline step failed for request ${options.contentRequestId}:`, err);
      // advanceOneStepFor → failRequest already set the request to FAILED.
      break;
    }
  }
}

/**
 * Reset processing-state requests that have been stuck longer than the
 * threshold. A platform-timed-out function never runs its catch handler, so
 * the request stays mid-step forever; the state machine only allows retries
 * from FAILED, hence this sweep.
 */
async function recoverStuckRequests(admin: any): Promise<number> {
  const cutoff = new Date(Date.now() - STUCK_THRESHOLD_MS).toISOString();

  const { data: stuck } = await admin
    .from("content_requests")
    .select("id, user_id, status")
    .in("status", PROCESSING_STATUSES)
    .lt("updated_at", cutoff);

  let recovered = 0;
  for (const request of stuck ?? []) {
    await admin.from("content_requests").update({ status: "FAILED" }).eq("id", request.id);
    await recordFailure({
      contentRequestId: request.id,
      operation: "worker_recovery",
      errorType: "UNKNOWN",
      message: `Request stuck in "${request.status}" for over ${
        STUCK_THRESHOLD_MS / 60000
      } minutes; reset to FAILED for retry.`,
      isRetryable: true,
    });
    recovered++;
  }

  if (recovered > 0) {
    console.warn(`[Worker] Recovered ${recovered} stuck request(s)`);
  }

  return recovered;
}

/**
 * Execute publishing_queue items that are due:
 *  - SCHEDULED with scheduled_at <= now
 *  - READY (previous attempt failed and is retryable)
 */
export async function publishDueQueueItems(admin: any): Promise<number> {
  const now = new Date().toISOString();

  const { data: items } = await admin
    .from("publishing_queue")
    .select(
      "id, content_request_id, channel_content_id, channel, approved_draft_id, approved_version, idempotency_key, status, scheduled_at, retry_count"
    )
    .in("status", ["READY", "SCHEDULED"])
    .lte("retry_count", 3)
    .limit(5);

  let published = 0;
  for (const item of items ?? []) {
    if (item.status === "SCHEDULED" && new Date(item.scheduled_at) > new Date()) {
      continue;
    }
    try {
      await executePublishing(item.id, null, null);
      published++;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown publish error";
      console.error(`[Worker] Publish failed for queue item ${item.id}:`, message);
      // executePublishing marks the item READY/FAILED + increments retry_count.
    }
  }

  return published;
}

async function resolveActorEmail(userId?: string): Promise<string> {
  if (!userId) return "worker@system";
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle();
  return data?.email ?? "worker@system";
}