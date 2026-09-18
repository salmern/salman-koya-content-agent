/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { requireAuth, canManageRequest } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/db/client";
import { NotFoundError, ForbiddenError, toApiError, getStatusCode } from "@/lib/errors";
import { runChannelAdaptation } from "@/services/publishing/channel-service";
import type { ContentChannel } from "@/types";

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

    runChannelAdaptation({
      contentRequestId,
      userId: session.userId,
      userEmail: session.email,
      channels: channels as ContentChannel[],
    }).catch((err) => {
      console.error("[Channels API] Background channel adaptation failed:", err);
    });

    return NextResponse.json(
      { message: "Channel adaptation started", contentRequestId },
      { status: 202 }
    );
  } catch (error) {
    return NextResponse.json(toApiError(error), { status: getStatusCode(error) });
  }
}
