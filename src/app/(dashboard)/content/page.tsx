import type { Metadata } from "next";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/db/client";
import { requireAuth } from "@/lib/auth/session";
import { canCreateContent } from "@/lib/auth/permissions";
import { StatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FileText, Plus } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import type { WorkflowStatus } from "@/types";

export const metadata: Metadata = { title: "Content" };
export const dynamic = "force-dynamic";

export default async function ContentListPage() {
  const session = await requireAuth();
  const supabase = await createSupabaseServerClient();

  const isReviewer = ["reviewer", "admin"].includes(session.profile.role);

  const query = supabase
    .from("content_requests")
    .select("id, content_idea, target_audience, status, updated_at, requested_channels")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(100);

  if (!isReviewer) query.eq("user_id", session.userId);

  const { data: rawRequests } = await query;
  const requests = (rawRequests as any[]) ?? [];

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Content</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            {requests.length} request{requests.length !== 1 ? "s" : ""}
          </p>
        </div>
        {canCreateContent(session.profile.role) && (
          <Link
            href="/content/new"
            className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary text-white text-[13px] font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus size={13} />New Content
          </Link>
        )}
      </div>

      <Card>
        {requests.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No content yet"
            description="Create a content request to start the AI research and drafting pipeline."
            action={
              canCreateContent(session.profile.role) ? (
                <Link href="/content/new" className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary text-white text-[13px] font-medium hover:bg-primary/90 transition-colors">
                  <Plus size={13} />Create your first content
                </Link>
              ) : undefined
            }
          />
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                  Content
                </th>
                <th className="text-left px-4 py-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide hidden md:table-cell">
                  Audience
                </th>
                <th className="text-left px-4 py-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                  Status
                </th>
                <th className="text-left px-4 py-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide hidden lg:table-cell">
                  Updated
                </th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req: any) => (
                <tr key={req.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/content/${req.id}`}
                      className="text-[13px] font-medium text-foreground hover:text-primary transition-colors line-clamp-1"
                    >
                      {req.content_idea}
                    </Link>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-[13px] text-muted-foreground line-clamp-1">{req.target_audience}</span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={req.status as WorkflowStatus} />
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-[12px] text-muted-foreground">
                    {formatRelativeTime(req.updated_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
