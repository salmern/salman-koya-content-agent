// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/db/client";
import { recordAudit } from "@/lib/audit";
import { NotFoundError, toApiError, getStatusCode } from "@/lib/errors";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await requireRole("admin");
    const body = await req.json();
    const admin = createSupabaseAdminClient();

    const { data: content } = await admin
      .from("content_requests")
      .select("id, content_idea, status, deleted_at")
      .eq("id", id)
      .single() as any;

    if (!content) throw new NotFoundError("Content request");

    const updates: Record<string, any> = {};

    if (body.action === "archive") {
      updates.archived_at = content.archived_at ? null : new Date().toISOString();
      await admin.from("content_requests").update(updates).eq("id", id);
      await recordAudit({
        actor_id: session.userId,
        actor_email: session.email,
        action: "status_changed",
        entity_type: "content_request",
        entity_id: id,
        content_request_id: id,
        metadata: { action: updates.archived_at ? "archived" : "unarchived" },
      });
    }

    if (body.action === "delete") {
      updates.deleted_at = new Date().toISOString();
      updates.deleted_by = session.userId;
      await admin.from("content_requests").update(updates).eq("id", id);
      await recordAudit({
        actor_id: session.userId,
        actor_email: session.email,
        action: "status_changed",
        entity_type: "content_request",
        entity_id: id,
        content_request_id: id,
        metadata: { action: "soft_deleted", content_idea: content.content_idea },
      });
    }

    if (body.action === "restore") {
      updates.deleted_at = null;
      updates.deleted_by = null;
      await admin.from("content_requests").update(updates).eq("id", id);
      await recordAudit({
        actor_id: session.userId,
        actor_email: session.email,
        action: "status_changed",
        entity_type: "content_request",
        entity_id: id,
        content_request_id: id,
        metadata: { action: "restored" },
      });
    }

    return NextResponse.json({ message: "Content updated" });
  } catch (error) {
    return NextResponse.json(toApiError(error), { status: getStatusCode(error) });
  }
}
