/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { requireAuth, canManageRequest } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/db/client";
import { NotFoundError, ForbiddenError, WorkflowError, toApiError, getStatusCode } from "@/lib/errors";
import { WorkflowStateMachine } from "@/lib/workflow/state-machine";
import { isLocalDevelopment, runPipelineToCompletion } from "@/services/workflow/worker";
import type { WorkflowStatus } from "@/types";

export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const session = await requireAuth();
    const { contentRequestId, channels } = await req.json();

    if (!contentRequestId || !channels?.length) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "contentRequestId and channels are required" } },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("content_requests")
      .select("user_id, status")
      .eq("id", contentRequestId)
      .single();

    const request = data as any;

    if (error || !request) throw new NotFoundError("Content request");
    if (!canManageRequest(session, request.user_id)) throw new ForbiddenError();

    const currentStatus = request.status as WorkflowStatus;
    if (!WorkflowStateMachine.canTransition(currentStatus, "CHANNEL_ADAPTATION")) {
      throw new WorkflowError(
        `Cannot adapt channels from status "${currentStatus}". Content must be APPROVED or FAILED first.`
      );
    }

    const { error: statusError } = await (supabase.from("content_requests") as any)
      .update({ status: "CHANNEL_ADAPTATION" })
      .eq("id", contentRequestId);

    if (statusError) {
      return NextResponse.json(
        { error: { code: "DB_ERROR", message: "Failed to start channel adaptation." } },
        { status: 500 }
      );
    }

    // Local development runs inline so progress is instant; production
    // defers to the cron worker (/api/cron/advance).
    if (isLocalDevelopment()) {
      runPipelineToCompletion({ contentRequestId }).catch((err) => {
        console.error("[Channels API] Inline channel adaptation failed:", err);
      });
    }

    return NextResponse.json(
      { message: "Channel adaptation started", contentRequestId },
      { status: 202 }
    );
  } catch (error) {
    return NextResponse.json(toApiError(error), { status: getStatusCode(error) });
  }
}
