/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { canCreateContent } from "@/lib/auth/permissions";
import { createSupabaseServerClient } from "@/lib/db/client";
import { CreateContentRequestSchema } from "@/schemas/content-request";
import { recordAudit } from "@/lib/audit";
import { ForbiddenError, toApiError, getStatusCode } from "@/lib/errors";
import { isLocalDevelopment, runPipelineToCompletion } from "@/services/workflow/worker";

export async function POST(req: Request) {
  try {
    const session = await requireAuth();

    // Mirror the content_requests_insert RLS policy: only content managers and
    // admins can create requests. Give a clear 403 instead of letting the DB
    // fail with a cryptic generic message.
    if (!canCreateContent(session.profile.role)) {
      throw new ForbiddenError(
        "Only content managers and admins can create content. Ask an admin to assign you the content_manager role."
      );
    }

    const body = await req.json();

    const parsed = CreateContentRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.errors[0]?.message ?? "Invalid input",
            field: parsed.error.errors[0]?.path.join("."),
          },
        },
        { status: 400 }
      );
    }

    const input = parsed.data;
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("content_requests")
      .insert({
        user_id: session.userId,
        content_idea: input.content_idea,
        target_audience: input.target_audience,
        primary_keyword: input.primary_keyword ?? null,
        content_goal: input.content_goal ?? null,
        source_url: input.source_url ?? null,
        supporting_material: input.supporting_material ?? null,
        tone: input.tone ?? null,
        additional_instructions: input.additional_instructions ?? null,
        requested_channels: input.requested_channels,
        status: "DRAFT",
      } as any)
      .select()
      .single();

    const request = data as any;

    if (error || !request) {
      console.error("[POST /api/content] DB error:", error);
      return NextResponse.json(
        { error: { code: "DB_ERROR", message: "Failed to create content request." } },
        { status: 500 }
      );
    }

    await recordAudit({
      actor_id: session.userId,
      actor_email: session.email,
      action: "content_created",
      entity_type: "content_request",
      entity_id: request.id,
      content_request_id: request.id,
      metadata: {
        content_idea: input.content_idea,
        channels: input.requested_channels,
      },
    });

    // Auto-start research so the "research is starting" message the user just
    // saw holds true. The worker (or the local inline path) drives it.
    await (supabase.from("content_requests") as any).update({ status: "RESEARCHING" }).eq("id", request.id);

    if (isLocalDevelopment()) {
      runPipelineToCompletion({ contentRequestId: request.id }).catch((err) => {
        console.error("[Content API] Inline research failed:", err);
      });
    }

    return NextResponse.json(request, { status: 201 });
  } catch (error) {
    return NextResponse.json(toApiError(error), { status: getStatusCode(error) });
  }
}

export async function GET(req: Request) {
  try {
    const session = await requireAuth();
    const supabase = await createSupabaseServerClient();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);
    const offset = parseInt(searchParams.get("offset") ?? "0");

    const isReviewer = ["reviewer", "admin"].includes(session.profile.role);

    let query = supabase
      .from("content_requests")
      .select("*", { count: "exact" })
      .order("updated_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (!isReviewer) {
      query = query.eq("user_id", session.userId);
    }

    if (status) {
      query = query.eq("status", status.toUpperCase());
    }

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json(
        { error: { code: "DB_ERROR", message: "Failed to fetch content requests." } },
        { status: 500 }
      );
    }

    return NextResponse.json({ data, count, limit, offset });
  } catch (error) {
    return NextResponse.json(toApiError(error), { status: getStatusCode(error) });
  }
}
