import type { Metadata } from "next";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/db/client";
import { requireAuth } from "@/lib/auth/session";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime, formatRelativeTime, cn } from "@/lib/utils";
import { Send, CheckCircle2, XCircle, Calendar, Loader2 } from "lucide-react";

export const metadata: Metadata = { title: "Publishing" };
export const dynamic = "force-dynamic";

const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  READY: {
    label: "Ready",
    cls: "text-primary bg-[hsl(var(--info-subtle))] ring-[hsl(var(--info-border))]",
    icon: Send,
  },
  SCHEDULED: {
    label: "Scheduled",
    cls: "text-amber-700 dark:text-amber-400 bg-[hsl(var(--warning-subtle))] ring-[hsl(var(--warning-border))]",
    icon: Calendar,
  },
  PUBLISHING: {
    label: "Publishing",
    cls: "text-primary bg-[hsl(var(--info-subtle))] ring-[hsl(var(--info-border))]",
    icon: Loader2,
  },
  PUBLISHED: {
    label: "Published",
    cls: "text-green-700 dark:text-green-400 bg-[hsl(var(--success-subtle))] ring-[hsl(var(--success-border))]",
    icon: CheckCircle2,
  },
  FAILED: {
    label: "Failed",
    cls: "text-red-700 dark:text-red-400 bg-[hsl(var(--danger-subtle))] ring-[hsl(var(--danger-border))]",
    icon: XCircle,
  },
  CANCELLED: {
    label: "Cancelled",
    cls: "text-muted-foreground bg-secondary ring-border",
    icon: XCircle,
  },
};

export default async function PublishingPage() {
  await requireAuth();
  const supabase = await createSupabaseServerClient();

  const { data: rawQueue } = await supabase
    .from("publishing_queue")
    .select("*, content_request:content_request_id(content_idea)")
    .order("created_at", { ascending: false })
    .limit(100);

  const queue = (rawQueue as any[]) ?? [];

  const stats = {
    ready: queue.filter((q) => q.status === "READY").length,
    scheduled: queue.filter((q) => q.status === "SCHEDULED").length,
    published: queue.filter((q) => q.status === "PUBLISHED").length,
    failed: queue.filter((q) => q.status === "FAILED").length,
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <h1 className="text-lg font-semibold text-foreground">Publishing Queue</h1>

      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Ready", value: stats.ready },
          { label: "Scheduled", value: stats.scheduled },
          { label: "Published", value: stats.published },
          { label: "Failed", value: stats.failed },
        ].map((s) => (
          <div key={s.label} className="bg-card rounded-lg border border-border p-4">
            <p className="text-2xl font-bold tabular-nums text-foreground">{s.value}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <Card>
        {queue.length === 0 ? (
          <EmptyState
            icon={Send}
            title="No publishing activity"
            description="Approved content will appear here when added to the publishing queue."
          />
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Content</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Channel</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Time</th>
              </tr>
            </thead>
            <tbody>
              {queue.map((q) => {
                const config = STATUS_CONFIG[q.status] ?? STATUS_CONFIG.READY;
                const Icon = config.icon;
                const content = q.content_request as any;
                return (
                  <tr key={q.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/content/${q.content_request_id}`}
                        className="text-[13px] font-medium text-foreground hover:text-primary transition-colors line-clamp-1"
                      >
                        {content?.content_idea ?? "Unknown"}
                      </Link>
                      {q.provider === "mock" && (
                        <span className="text-[10px] text-muted-foreground ml-1">(Demo)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-muted-foreground capitalize">{q.channel}</td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded ring-1 font-medium",
                        config.cls
                      )}>
                        <Icon size={10} />
                        {config.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-[12px] text-muted-foreground">
                      {q.status === "PUBLISHED" && q.published_at
                        ? formatRelativeTime(q.published_at)
                        : q.status === "SCHEDULED" && q.scheduled_at
                          ? formatDateTime(q.scheduled_at)
                          : formatRelativeTime(q.created_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
