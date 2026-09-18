import type { Metadata } from "next";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/session";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/badge";
import { ClipboardCheck, ArrowRight } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Review Queue" };
export const dynamic = "force-dynamic";

export default async function ReviewQueuePage() {
  await requireRole(["reviewer", "admin"]);
  const supabase = await createSupabaseServerClient();

  const { data: rawRequests } = await supabase
    .from("content_requests")
    .select("id, content_idea, target_audience, status, updated_at, profiles:user_id(full_name, email)")
    .in("status", ["AWAITING_REVIEW", "REVISION_REQUESTED"])
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  const requests = (rawRequests as any[]) ?? [];

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Review Queue</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          {requests.length} item{requests.length !== 1 ? "s" : ""} awaiting review
        </p>
      </div>

      <Card>
        {requests.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title="Nothing to review"
            description="All content has been reviewed. New submissions will appear here."
          />
        ) : (
          <div className="divide-y divide-border">
            {requests.map((req: any) => {
              const author = req.profiles as any;
              return (
                <Link
                  key={req.id}
                  href={`/content/${req.id}`}
                  className="flex items-center justify-between px-4 py-3.5 hover:bg-secondary/30 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-foreground truncate">{req.content_idea}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {req.target_audience}
                      {author?.full_name || author?.email
                        ? ` · by ${author?.full_name ?? author?.email}`
                        : ""}
                      {" · "}
                      {formatRelativeTime(req.updated_at)}
                    </p>
                  </div>
                  <div className="ml-3 flex items-center gap-2 flex-shrink-0">
                    <StatusBadge status={req.status} />
                    <ArrowRight size={13} className="text-muted-foreground" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
