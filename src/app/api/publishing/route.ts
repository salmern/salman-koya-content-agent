/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { requireAuth, canManageRequest } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/db/client";
import { NotFoundError, ForbiddenError, toApiError, getStatusCode } from "@/lib/errors";
import { enqueueForPublishing, executePublishing } from "@/services/publishing/publishing-service";
import { PublishScheduleSchema } from "@/schemas/content-request";

export async function POST(req: Request) {
  try {
    const session = await requireAuth();
    const body = await req.json();
    const { contentRequestId, recipients, ...rest } = body;

    if (!contentRequestId) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "contentRequestId is required" } },
        { status: 400 }
      );
    }

    const parsed = PublishScheduleSchema.safeParse(rest);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.errors[0]?.message ?? "Invalid input",
          },
        },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("content_requests")
      .select("user_id")
      .eq("id", contentRequestId)
      .single();

    const request = data as any;

    if (!request) throw new NotFoundError("Content request");
    if (!canManageRequest(session, request.user_id)) throw new ForbiddenError();

    const queueItemId = await enqueueForPublishing({
      contentRequestId,
      channelContentId: parsed.data.channel_content_id,
      userId: session.userId,
      userEmail: session.email,
      scheduledAt: parsed.data.scheduled_at ?? null,
      recipients: Array.isArray(recipients) && recipients.length > 0 ? recipients : undefined,
    });

    if (!parsed.data.scheduled_at) {
      await executePublishing(queueItemId, session.userId, session.email,
        Array.isArray(recipients) && recipients.length > 0 ? recipients : undefined
      );
    }

    // Fetch the queue item to return actual outcome to the client
    const { createSupabaseAdminClient } = await import("@/lib/db/client");
    const adminDb = createSupabaseAdminClient();
    const { data: queueItem } = await adminDb
      .from("publishing_queue")
      .select("provider, status, error_message")
      .eq("id", queueItemId)
      .single() as { data: { provider: string; status: string; error_message: string | null } | null };

    const actualStatus = queueItem?.status ?? "UNKNOWN";
    const publishedSuccessfully = actualStatus === "PUBLISHED";

    return NextResponse.json(
      {
        queueItemId,
        message: publishedSuccessfully ? "Published" : "Enqueued",
        provider: queueItem?.provider ?? "mock",
        isDemo: queueItem?.provider === "mock",
        published: publishedSuccessfully,
        status: actualStatus,
        error: queueItem?.error_message ?? null,
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(toApiError(error), { status: getStatusCode(error) });
  }
}

export async function GET(req: Request) {
  try {
    await requireAuth(); // Verify authentication; RLS handles data scoping
    const supabase = await createSupabaseServerClient();
    const { searchParams } = new URL(req.url);
    const contentRequestId = searchParams.get("contentRequestId");

    let query = supabase
      .from("publishing_queue")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (contentRequestId) {
      query = query.eq("content_request_id", contentRequestId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: { code: "DB_ERROR", message: "Failed to fetch publishing queue" } },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: (data as any[]) ?? [] });
  } catch (error) {
    return NextResponse.json(toApiError(error), { status: getStatusCode(error) });
  }
}
