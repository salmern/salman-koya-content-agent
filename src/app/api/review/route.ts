/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/db/client";
import { NotFoundError, toApiError, getStatusCode } from "@/lib/errors";
import { ReviewActionSchema } from "@/schemas/content-request";
import { submitReview } from "@/services/review/review-service";

export async function POST(req: Request) {
  try {
    const session = await requireAuth();
    const body = await req.json();
    const { contentRequestId, draftId, ...reviewData } = body;

    if (!contentRequestId || !draftId) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "contentRequestId and draftId are required" } },
        { status: 400 }
      );
    }

    const parsed = ReviewActionSchema.safeParse(reviewData);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.errors[0]?.message ?? "Invalid review input",
          },
        },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("content_requests")
      .select("user_id")
      .eq("id", contentRequestId)
      .single();

    const request = data as any;

    if (error || !request) throw new NotFoundError("Content request");

    const action = parsed.data;

    await submitReview({
      contentRequestId,
      draftId,
      reviewerId: session.userId,
      reviewerEmail: session.email,
      reviewerRole: session.profile.role,
      contentOwnerId: request.user_id,
      decision: action.decision,
      feedback: "feedback" in action ? (action.feedback ?? null) : null,
      revisionInstructions:
        "revision_instructions" in action ? (action.revision_instructions ?? null) : null,
    });

    return NextResponse.json({ message: "Review submitted", decision: action.decision });
  } catch (error) {
    return NextResponse.json(toApiError(error), { status: getStatusCode(error) });
  }
}
