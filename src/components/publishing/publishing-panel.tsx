"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Send, Calendar, Clock, CheckCircle2, XCircle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime, formatRelativeTime, cn } from "@/lib/utils";
import type { WorkflowStatus } from "@/types";

interface PublishingPanelProps {
  contentRequestId: string;
  channelContent: any[];
  publishingQueue: any[];
  status: WorkflowStatus;
  isOwner: boolean;
  onRefresh: () => void;
}

const STATUS_CLS: Record<string, string> = {
  READY: "text-primary bg-[hsl(var(--info-subtle))] ring-[hsl(var(--info-border))]",
  SCHEDULED: "text-amber-700 dark:text-amber-400 bg-[hsl(var(--warning-subtle))] ring-[hsl(var(--warning-border))]",
  PUBLISHING: "text-primary bg-[hsl(var(--info-subtle))] ring-[hsl(var(--info-border))]",
  PUBLISHED: "text-green-700 dark:text-green-400 bg-[hsl(var(--success-subtle))] ring-[hsl(var(--success-border))]",
  FAILED: "text-red-700 dark:text-red-400 bg-[hsl(var(--danger-subtle))] ring-[hsl(var(--danger-border))]",
  CANCELLED: "text-muted-foreground bg-secondary ring-border",
};

export function PublishingPanel({
  contentRequestId,
  channelContent,
  publishingQueue,
  status,
  isOwner,
  onRefresh,
}: PublishingPanelProps) {
  const [publishing, setPublishing] = useState<string | null>(null);
  const [scheduledAt, setScheduledAt] = useState<Record<string, string>>({});
  // Per-channel recipient override for newsletter
  const [recipients, setRecipients] = useState<Record<string, string>>({});

  const publishableChannels = channelContent.filter((ch) => ch.validation_status === "valid");
  const canPublish = ["READY_TO_SCHEDULE", "SCHEDULED", "APPROVED", "PUBLISHED"].includes(status);
  const queueByContentId = Object.fromEntries(
    publishingQueue.map((q) => [q.channel_content_id, q])
  );

  async function handlePublish(channelContentId: string, channel: string, scheduleAt?: string) {
    setPublishing(channelContentId);
    try {
      const res = await fetch("/api/publishing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentRequestId,
          channel_content_id: channelContentId,
          scheduled_at: scheduleAt || null,
          // Pass recipient overrides for newsletter channel
          recipients: channel === "newsletter" && recipients[channelContentId]
            ? recipients[channelContentId].split(",").map((e) => e.trim()).filter(Boolean)
            : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error("Publishing failed", {
          description: json.error?.message ?? "Unknown error",
        });
        return;
      }

      if (scheduleAt) {
        toast.success("Scheduled", {
          description: `Scheduled for ${new Date(scheduleAt).toLocaleString()}`,
        });
      } else if (json.published === false) {
        // Publishing was attempted but failed — show the real error
        toast.error("Publishing failed", {
          description: json.error ?? "The platform rejected the request. Check the queue for details.",
        });
      } else {
        const isDemo = json.provider === "mock" || json.isDemo === true;
        toast.success(isDemo ? "Published (Demo)" : "Published successfully", {
          description: isDemo
            ? "Mock provider — content was not actually sent."
            : "Your content is now live.",
        });
      }

      onRefresh();
    } finally {
      setPublishing(null);
    }
  }

  if (!canPublish && publishingQueue.length === 0) {
    return (
      <EmptyState
        icon={Send}
        title="Not ready to publish"
        description={
          status === "APPROVED"
            ? "Generate channel content first, then publish from here."
            : "Content must be approved and channel content generated before publishing."
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {publishingQueue.some((q) => q.provider === "mock") && (
        <Alert variant="info" title="Demo publishing active for some channels">
          Channels without real credentials use a mock provider — content is not actually
          sent. Set credentials in{" "}
          <code className="text-[11px] font-mono">.env.local</code> to publish for real.
        </Alert>
      )}

      {/* Queue status */}
      {publishingQueue.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Queue</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {publishingQueue.map((q) => (
              <div
                key={q.id}
                className="flex items-center justify-between rounded-md bg-secondary/40 border border-border p-3"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "text-[11px] px-1.5 py-0.5 rounded ring-1 font-medium",
                      STATUS_CLS[q.status] ?? STATUS_CLS.READY
                    )}
                  >
                    {q.status}
                  </span>
                  <div>
                    <p className="text-[13px] font-medium text-foreground capitalize">
                      {q.channel}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {q.status === "PUBLISHED" && q.published_at
                        ? `Published ${formatRelativeTime(q.published_at)}`
                        : q.status === "SCHEDULED" && q.scheduled_at
                          ? `Scheduled for ${formatDateTime(q.scheduled_at)}`
                          : q.status === "FAILED" && q.error_message
                            ? `Failed: ${q.error_message}`
                            : formatRelativeTime(q.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {q.status === "PUBLISHED" && (
                    <CheckCircle2 size={14} className="text-green-600" />
                  )}
                  {q.status === "FAILED" && <XCircle size={14} className="text-red-600" />}
                  {q.status === "PUBLISHING" && (
                    <Loader2 size={14} className="animate-spin text-primary" />
                  )}
                  {q.status === "SCHEDULED" && (
                    <Clock size={14} className="text-amber-500" />
                  )}
                  {q.provider === "mock" && (
                    <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded ring-1 ring-border">
                      Demo
                    </span>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Publish actions — show for every publishable channel including READY/FAILED ones */}
      {publishableChannels.length > 0 && isOwner && canPublish && (
        <Card>
          <CardHeader><CardTitle>Publish</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {publishableChannels.map((ch) => {
              const queueItem = queueByContentId[ch.id];
              const qStatus = queueItem?.status;
              const isPublished = qStatus === "PUBLISHED";
              const isScheduled = qStatus === "SCHEDULED";
              const isPublishing = qStatus === "PUBLISHING";
              // Show button for: no queue item, READY, or FAILED
              const showButton = !isPublished && !isScheduled && !isPublishing;
              const isFailed = qStatus === "FAILED";
              const isReady = qStatus === "READY";
              const isLoading = publishing === ch.id;

              return (
                <div
                  key={ch.id}
                  className="rounded-md border border-border p-3 space-y-3"
                >
                  {/* Channel info row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-foreground capitalize">
                        {ch.channel}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {ch.character_count} chars · {ch.word_count} words
                      </p>
                      {isPublished && (
                        <p className="text-[11px] text-green-600 mt-1 flex items-center gap-1">
                          <CheckCircle2 size={10} />
                          Published {formatRelativeTime(queueItem.published_at)}
                        </p>
                      )}
                      {isScheduled && (
                        <p className="text-[11px] text-amber-600 mt-1">
                          Scheduled for {formatDateTime(queueItem.scheduled_at)}
                        </p>
                      )}
                      {isPublishing && (
                        <p className="text-[11px] text-primary mt-1 flex items-center gap-1">
                          <Loader2 size={10} className="animate-spin" />Publishing…
                        </p>
                      )}
                      {isReady && (
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Queued — click Publish Now to send
                        </p>
                      )}
                      {isFailed && (
                        <p className="text-[11px] text-red-600 mt-1">
                          {queueItem.error_message
                            ? `Failed: ${queueItem.error_message}`
                            : "Failed — click Retry to try again"}
                        </p>
                      )}
                    </div>

                    {/* Action buttons (right side) — only when not in-progress/published/scheduled */}
                    {showButton && (
                      <div className="flex items-end gap-2 flex-shrink-0">
                        {!queueItem && (
                          <div>
                            <label className="block text-[11px] text-muted-foreground mb-1">
                              Schedule (optional)
                            </label>
                            <input
                              type="datetime-local"
                              min={new Date().toISOString().slice(0, 16)}
                              value={scheduledAt[ch.id] ?? ""}
                              onChange={(e) =>
                                setScheduledAt((p) => ({ ...p, [ch.id]: e.target.value }))
                              }
                              className="h-7 px-2 rounded border border-border bg-background text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                            />
                          </div>
                        )}
                        <Button
                          size="sm"
                          variant={isFailed ? "destructive" : "primary"}
                          loading={isLoading}
                          onClick={() => {
                            const sched = scheduledAt[ch.id];
                            handlePublish(
                              ch.id,
                              ch.channel,
                              sched ? new Date(sched).toISOString() : undefined
                            );
                          }}
                        >
                          {isFailed ? (
                            <><RefreshCw size={12} />Retry</>
                          ) : scheduledAt[ch.id] ? (
                            <><Calendar size={12} />Schedule</>
                          ) : (
                            <><Send size={12} />Publish Now</>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Recipients field — newsletter only, shown when about to publish */}
                  {ch.channel === "newsletter" && showButton && (
                    <div>
                      <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                        Recipients
                        <span className="ml-1 font-normal">(comma-separated — leave blank to use default)</span>
                      </label>
                      <input
                        type="text"
                        value={recipients[ch.id] ?? ""}
                        onChange={(e) =>
                          setRecipients((p) => ({ ...p, [ch.id]: e.target.value }))
                        }
                        placeholder="e.g. you@example.com, mentor@example.com"
                        className="w-full h-8 px-3 rounded border border-border bg-background text-[12px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
