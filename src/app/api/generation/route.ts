/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { requireAuth, canManageRequest } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/db/client";
import { NotFoundError, ForbiddenError, WorkflowError, toApiError, getStatusCode } from "@/lib/errors";
import { WorkflowStateMachine } from "@/lib/workflow/state-machine";
import { runGeneration } from "@/services/generation/generation-service";
import type { WorkflowStatus } from "@/types";

export async function POST(req: Request) {
  try {
    const session = await requireAuth();
    const { contentRequestId } = await req.json();

    if (!contentRequestId) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "contentRequestId is required" } },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("content_requests")
      .select("*")
      .eq("id", contentRequestId)
      .single();

    const request = data as any;

    if (error || !request) throw new NotFoundError("Content request");
    if (!canManageRequest(session, request.user_id)) throw new ForbiddenError();

    const currentStatus = request.status as WorkflowStatus;
    if (!WorkflowStateMachine.canTransition(currentStatus, "PLANNING")) {
      throw new WorkflowError(
        `Cannot start generation from status "${currentStatus}". Research must be complete first.`
      );
    }

    runGeneration({
      contentRequestId,
      userId: session.userId,
      userEmail: session.email,
    }).catch((err) => {
      console.error("[Generation API] Background generation failed:", err);
    });

    return NextResponse.json(
      { message: "Generation started", contentRequestId },
      { status: 202 }
    );
  } catch (error) {
    return NextResponse.json(toApiError(error), { status: getStatusCode(error) });
  }
}
