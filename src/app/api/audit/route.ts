import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/db/client";
import { toApiError, getStatusCode } from "@/lib/errors";

export async function GET(req: Request) {
  try {
    // Only admins can read the full audit log
    const session = await requireRole(["admin", "reviewer"]);
    const supabase = await createSupabaseServerClient();
    const { searchParams } = new URL(req.url);

    const contentRequestId = searchParams.get("contentRequestId");
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);
    const offset = parseInt(searchParams.get("offset") ?? "0");

    let query = supabase
      .from("audit_logs")
      .select("*, actor:actor_id(full_name, email)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (contentRequestId) {
      query = query.eq("content_request_id", contentRequestId);
    } else if (session.profile.role !== "admin") {
      // Reviewers can only see audit logs for requests they reviewed
      query = query.eq("actor_id", session.userId);
    }

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json(
        { error: { code: "DB_ERROR", message: "Failed to fetch audit logs" } },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data ?? [], count, limit, offset });
  } catch (error) {
    return NextResponse.json(toApiError(error), { status: getStatusCode(error) });
  }
}
