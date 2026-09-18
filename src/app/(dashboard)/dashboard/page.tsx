import type { Metadata } from "next";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/db/client";
import { requireAuth } from "@/lib/auth/session";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  FileText, Clock, CheckCircle2, Calendar, Globe,
  AlertTriangle, Plus, ArrowRight,
} from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import type { WorkflowStatus } from "@/types";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

const DRAFT_STATUSES: WorkflowStatus[] = [
  "DRAFT", "RESEARCHING", "RESEARCH_COMPLETE", "PLANNING", "GENERATING", "EVALUATING", "REVISING",
];
const APPROVED_STATUSES: WorkflowStatus[] = ["APPROVED", "CHANNEL_ADAPTATION", "READY_TO_SCHEDULE"];

export default async function DashboardPage() {
  const session = await requireAuth();
  const supabase = await createSupabaseServerClient();

  const isReviewer = ["reviewer", "admin"].includes(session.profile.role);

  // Single query — all data we need
  const query = supabase
    .from("content_requests")
    .select("id, content_idea, status, updated_at")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (!isReviewer) query.eq("user_id", session.userId);

  const { data: rawRequests } = await query;
  const requests = (rawRequests as any[]) ?? [];

  const stats = { drafts: 0, awaiting_review: 0, approved: 0, scheduled: 0, published: 0, failed: 0 };
  requests.forEach((r) => {
    const s = r.status as WorkflowStatus;
    if (DRAFT_STATUSES.includes(s)) stats.drafts++;
    else if (s === "AWAITING_REVIEW" || s === "REVISION_REQUESTED") stats.awaiting_review++;
    else if (APPROVED_STATUSES.includes(s)) stats.approved++;
    else if (s === "SCHEDULED") stats.scheduled++;
    else if (s === "PUBLISHED") stats.published++;
    else if (s === "FAILED" || s === "REJECTED") stats.failed++;
  });

  const STAT_CARDS = [
    { label: "In Progress", value: stats.drafts, icon: FileText, href: "/content" },
    { label: "Awaiting Review", value: stats.awaiting_review, icon: Clock, href: "/review" },
    { label: "Approved", value: stats.approved, icon: CheckCircle2, href: "/content" },
    { label: "Scheduled", value: stats.scheduled, icon: Calendar, href: "/publishing" },
    { label: "Published", value: stats.published, icon: Globe, href: "/publishing" },
    { label: "Failed / Rejected", value: stats.failed, icon: AlertTriangle, href: "/content" },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Dashboard</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            {session.profile.full_name ?? session.email}
          </p>
        </div>
        <Link
          href="/content/new"
          className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary text-white text-[13px] font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus size={13} />New Content
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {STAT_CARDS.map(({ label, value, icon: Icon, href }) => (
          <Link
            key={label}
            href={href}
            className="group bg-card rounded-lg border border-border p-4 hover:border-primary/30 hover:shadow-sm transition-all"
          >
            <Icon size={14} className="text-muted-foreground mb-2.5" />
            <p className="text-2xl font-bold tabular-nums text-foreground">{value}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 group-hover:text-foreground transition-colors">
              {label}
            </p>
          </Link>
        ))}
      </div>

      {/* Recent content */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Content</CardTitle>
          <Link href="/content" className="flex items-center gap-1 text-[13px] text-primary hover:underline">
            View all <ArrowRight size={12} />
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {requests.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No content yet"
              description="Create your first content request to get started."
              action={
                <Link href="/content/new" className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary text-white text-[13px] font-medium hover:bg-primary/90 transition-colors">
                  <Plus size={13} />Create content
                </Link>
              }
            />
          ) : (
            <div className="divide-y divide-border">
              {requests.slice(0, 8).map((req: any) => (
                <Link
                  key={req.id}
                  href={`/content/${req.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-secondary/40 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-foreground truncate">{req.content_idea}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{formatRelativeTime(req.updated_at)}</p>
                  </div>
                  <StatusBadge status={req.status as WorkflowStatus} />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
