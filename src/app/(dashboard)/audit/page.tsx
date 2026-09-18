import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/session";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime, cn } from "@/lib/utils";
import { History } from "lucide-react";

export const metadata: Metadata = { title: "Audit Log" };
export const dynamic = "force-dynamic";

// Map actions to a single semantic colour bucket
const ACTION_BUCKET: Record<string, "info" | "success" | "warning" | "danger" | "neutral"> = {
  content_created: "info",
  research_started: "info",
  research_completed: "info",
  research_failed: "danger",
  source_selected: "info",
  plan_created: "info",
  draft_generated: "info",
  draft_evaluated: "info",
  draft_revised: "warning",
  review_requested: "warning",
  review_approved: "success",
  review_rejected: "danger",
  revision_requested: "warning",
  channel_generated: "info",
  scheduled: "info",
  published: "success",
  publishing_failed: "danger",
  status_changed: "neutral",
  user_role_changed: "warning",
  approval_invalidated: "danger",
};

const BUCKET_CLS = {
  info: "text-primary bg-[hsl(var(--info-subtle))] ring-[hsl(var(--info-border))]",
  success: "text-green-700 dark:text-green-400 bg-[hsl(var(--success-subtle))] ring-[hsl(var(--success-border))]",
  warning: "text-amber-700 dark:text-amber-400 bg-[hsl(var(--warning-subtle))] ring-[hsl(var(--warning-border))]",
  danger: "text-red-700 dark:text-red-400 bg-[hsl(var(--danger-subtle))] ring-[hsl(var(--danger-border))]",
  neutral: "text-muted-foreground bg-secondary ring-border",
};

export default async function AuditPage() {
  await requireRole(["admin", "reviewer"]);
  const supabase = await createSupabaseServerClient();

  const { data: rawLogs } = await supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  const logs = (rawLogs as any[]) ?? [];

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Audit Log</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          Complete immutable history of all workflow actions
        </p>
      </div>

      <Card>
        {logs.length === 0 ? (
          <EmptyState
            icon={History}
            title="No audit entries"
            description="Workflow actions will be recorded here as you use the platform."
          />
        ) : (
          <div className="divide-y divide-border">
            {logs.map((log: any) => {
              const bucket = ACTION_BUCKET[log.action] ?? "neutral";
              return (
                <div key={log.id} className="flex items-start gap-3 px-4 py-3">
                  <span className={cn(
                    "flex-shrink-0 mt-0.5 text-[11px] px-1.5 py-0.5 rounded ring-1 font-medium whitespace-nowrap",
                    BUCKET_CLS[bucket]
                  )}>
                    {log.action.replace(/_/g, " ")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-foreground">
                      <span className="font-medium">{log.actor_email ?? "System"}</span>
                      {" · "}
                      <span className="text-muted-foreground">
                        {log.entity_type} #{String(log.entity_id).slice(0, 8)}
                      </span>
                    </p>
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 font-mono truncate">
                        {JSON.stringify(log.metadata).slice(0, 120)}
                      </p>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground flex-shrink-0 tabular-nums">
                    {formatDateTime(log.created_at)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
