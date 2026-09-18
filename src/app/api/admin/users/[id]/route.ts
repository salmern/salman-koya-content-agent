// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/db/client";
import { recordAudit } from "@/lib/audit";
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
  toApiError,
  getStatusCode,
} from "@/lib/errors";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await requireRole("admin");
    const body = await req.json();
    const admin = createSupabaseAdminClient();

    // Fetch target user
    const { data: target } = await admin
      .from("profiles")
      .select("id, email, role, deactivated_at")
      .eq("id", id)
      .single() as any;

    if (!target) throw new NotFoundError("User");

    const allowedRoles = ["content_manager", "reviewer", "admin"];

    // Role change
    if (body.role !== undefined) {
      if (!allowedRoles.includes(body.role)) {
        throw new ValidationError("Invalid role. Must be content_manager, reviewer, or admin.");
      }

      // Prevent removing the last admin
      if (target.role === "admin" && body.role !== "admin") {
        const { count } = await admin
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("role", "admin") as any;
        if ((count ?? 0) <= 1) {
          throw new ForbiddenError("Cannot remove the last admin. Promote another user first.");
        }
      }

      await admin.from("profiles").update({ role: body.role }).eq("id", id);

      await recordAudit({
        actor_id: session.userId,
        actor_email: session.email,
        action: "user_role_changed",
        entity_type: "profile",
        entity_id: id,
        metadata: { from: target.role, to: body.role, email: target.email },
      });
    }

    // Deactivate / reactivate
    if (body.deactivated !== undefined) {
      if (id === session.userId) {
        throw new ForbiddenError("You cannot deactivate your own account.");
      }
      const deactivated_at = body.deactivated ? new Date().toISOString() : null;
      const deactivated_by = body.deactivated ? session.userId : null;

      await admin.from("profiles").update({ deactivated_at, deactivated_by }).eq("id", id);

      await recordAudit({
        actor_id: session.userId,
        actor_email: session.email,
        action: "user_role_changed",
        entity_type: "profile",
        entity_id: id,
        metadata: { action: body.deactivated ? "deactivated" : "reactivated", email: target.email },
      });
    }

    return NextResponse.json({ message: "User updated" });
  } catch (error) {
    return NextResponse.json(toApiError(error), { status: getStatusCode(error) });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await requireRole("admin");

    if (id === session.userId) {
      throw new ForbiddenError("You cannot delete your own account.");
    }

    const admin = createSupabaseAdminClient();

    const { data: target } = await admin
      .from("profiles")
      .select("id, email, role")
      .eq("id", id)
      .single() as any;

    if (!target) throw new NotFoundError("User");

    // Prevent deleting the last admin
    if (target.role === "admin") {
      const { count } = await admin
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("role", "admin") as any;
      if ((count ?? 0) <= 1) {
        throw new ForbiddenError("Cannot delete the last admin account.");
      }
    }

    await recordAudit({
      actor_id: session.userId,
      actor_email: session.email,
      action: "user_role_changed",
      entity_type: "profile",
      entity_id: id,
      metadata: { action: "deleted", email: target.email },
    });

    // Delete from auth (cascades to profile via FK)
    await admin.auth.admin.deleteUser(id);

    return NextResponse.json({ message: "User deleted" });
  } catch (error) {
    return NextResponse.json(toApiError(error), { status: getStatusCode(error) });
  }
}
