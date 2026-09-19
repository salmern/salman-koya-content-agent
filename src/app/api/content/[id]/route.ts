/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/db/client";
import { NotFoundError, ForbiddenError, toApiError, getStatusCode } from "@/lib/errors";
import { recordFailure } from "@/lib/audit";
import { advanceStepIfDue, publishDueQueueItems, PROCESSING_STATUSES } from "@/services/workflow/worker";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await requireAuth();
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("content_requests")
      .select("*")
      .eq("id", id)
      .single();

    let request = data as any;

    if (error || !request) throw new NotFoundError("Content request");

    const isReviewer = ["reviewer", "admin"].includes(session.profile.role);
    if (!isReviewer && request.user_id !== session.userId) {
      throw new ForbiddenError();
    }

    // Advance-on-read: while this workspace page is being polled, run exactly
    // one pipeline step per request-detail GET (debounced). This drives the
    // pipeline on Hobby, which does not support per-minute cron jobs. The read
    // is awaited so the serverless function stays alive for the whole step.
    let advanced = false;
    let stepFailed = false;
    try {
      advanced = await advanceStepIfDue(request);
    } catch (err) {
      // Research and generation step handlers persist their own FAILED state +
      // failure record. Channel adaptation does not, so persist it here to stop
      // the debounced poll from re-invoking a failing step every ~5s. The
      // `.in()` guard means we never overwrite a terminal state if a handler
      // already persisted it (also avoiding a duplicate failure record).
      stepFailed = true;
      console.error(`[Workspace API] Step failed for ${id}:`, err);
      try {
        const admin = createSupabaseAdminClient();
        await (admin.from("content_requests") as any)
          .update({ status: "FAILED" })
          .eq("id", id)
          .in("status", PROCESSING_STATUSES);
        await recordFailure({
          contentRequestId: id,
          operation: "worker_step",
          errorType: "UNKNOWN",
          message: err instanceof Error ? err.message : "Unknown step error",
          stackTrace: err instanceof Error ? err.stack : null,
          isRetryable: true,
        });
      } catch (persistErr) {
        console.error(`[Workspace API] Failed to persist FAILED for ${id}:`, persistErr);
      }
    }

    if (advanced || stepFailed) {
      // Flush due scheduled/retry publishes while we are here. The worker
      // uses the admin client (service role), not the user-scoped one.
      try {
        await publishDueQueueItems(createSupabaseAdminClient());
      } catch (err) {
        console.error(`[Workspace API] Publish sweep failed:`, err);
      }

      // Re-fetch so the response reflects the step outcome (success or FAILED).
      const { data: fresh } = await supabase
        .from("content_requests")
        .select("*")
        .eq("id", id)
        .single();
      request = fresh as any;
    }

    const [
      { data: researchRuns },
      { data: sources },
      { data: plan },
      { data: drafts },
      { data: evaluations },
      { data: reviews },
      { data: channelContent },
      { data: publishingQueue },
    ] = await Promise.all([
      supabase.from("research_runs").select("*").eq("content_request_id", id).order("created_at", { ascending: false }),
      supabase.from("content_sources").select("*").eq("content_request_id", id).order("relevance_score", { ascending: false }),
      supabase.from("content_plans").select("*").eq("content_request_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("content_drafts").select("*").eq("content_request_id", id).order("version_number", { ascending: false }),
      supabase.from("draft_evaluations").select("*").eq("content_request_id", id).order("created_at", { ascending: false }),
      supabase.from("human_reviews").select("*, reviewer:profiles!human_reviews_reviewer_id_fkey(full_name, email)").eq("content_request_id", id).order("created_at", { ascending: false }),
      supabase.from("channel_content").select("*").eq("content_request_id", id).order("created_at", { ascending: false }),
      supabase.from("publishing_queue").select("*").eq("content_request_id", id).order("created_at", { ascending: false }),
    ]);

    return NextResponse.json({
      request,
      researchRuns: (researchRuns as any[]) ?? [],
      sources: (sources as any[]) ?? [],
      plan: plan as any,
      drafts: (drafts as any[]) ?? [],
      evaluations: (evaluations as any[]) ?? [],
      reviews: (reviews as any[]) ?? [],
      channelContent: (channelContent as any[]) ?? [],
      publishingQueue: (publishingQueue as any[]) ?? [],
    });
  } catch (error) {
    console.error("[Content API] GET failed:", error);
    return NextResponse.json(toApiError(error), { status: getStatusCode(error) });
  }
}
