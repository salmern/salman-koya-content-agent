"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import {
  Search, FileText, Cpu, ClipboardCheck, CheckCircle2, Globe,
  Loader2, RefreshCw, AlertTriangle, ExternalLink, Star, Send,
  Clock, ChevronRight,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { formatRelativeTime, truncate, cn } from "@/lib/utils";
import {
  getWorkflowProgress,
  WORKFLOW_STEPS,
  POLLING_ACTIVE_STATUSES,
  getStepState,
} from "@/lib/workflow/state-machine";
import type { WorkflowStatus, UserRole } from "@/types";
import { ReviewPanel } from "@/components/review/review-panel";
import { ChannelPanel } from "@/components/publishing/channel-panel";
import { PublishingPanel } from "@/components/publishing/publishing-panel";

interface WorkspaceData {
  request: Record<string, any>;
  researchRuns: any[];
  sources: any[];
  plan: any | null;
  drafts: any[];
  evaluations: any[];
  reviews: any[];
  channelContent: any[];
  publishingQueue: any[];
}

interface ContentWorkspaceProps {
  contentRequestId: string;
  initialRequest: Record<string, any>;
  currentUserId: string;
  currentUserRole: UserRole;
  currentUserEmail: string;
}

type Tab = "overview" | "sources" | "draft" | "evaluation" | "review" | "channels" | "publishing";

export function ContentWorkspace({
  contentRequestId,
  initialRequest: _initialRequest,
  currentUserId,
  currentUserRole,
  currentUserEmail: _currentUserEmail,
}: ContentWorkspaceProps) {
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [selectedDraftIndex, setSelectedDraftIndex] = useState(0);

  const fetchInFlightRef = useRef(false);

  const fetchData = useCallback(async () => {
    // The detail GET may advance one pipeline step (advance-on-read) and can
    // take up to a minute. Never overlap fetches: it would spawn concurrent
    // step invocations for the same request.
    if (fetchInFlightRef.current) return;
    fetchInFlightRef.current = true;
    try {
      const res = await fetch(`/api/content/${contentRequestId}`);
      if (res.ok) setData(await res.json());
    } catch (err) {
      console.error("[Workspace] fetch failed:", err);
    } finally {
      fetchInFlightRef.current = false;
      setLoading(false);
    }
  }, [contentRequestId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Poll while AI is actively processing.
  // - 2s interval (down from 3s) for snappier status updates
  // - Pauses automatically when the browser tab is hidden (saves requests)
  // - Resumes and immediately fetches when tab becomes visible again
  useEffect(() => {
    if (!data) return;
    const status = data.request.status as WorkflowStatus;
    if (!POLLING_ACTIVE_STATUSES.includes(status)) return;

    let interval: ReturnType<typeof setInterval> | null = null;

    function startPolling() {
      interval = setInterval(fetchData, 2000);
    }

    function stopPolling() {
      if (interval !== null) {
        clearInterval(interval);
        interval = null;
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        stopPolling();
      } else {
        // Tab became visible again — fetch immediately then restart interval
        fetchData();
        startPolling();
      }
    }

    // Start immediately unless tab is already hidden
    if (document.visibilityState !== "hidden") {
      startPolling();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [data, fetchData]);

  async function handleAction(action: string, body: Record<string, any> = {}) {
    setActionLoading(action);
    try {
      const res = await fetch(`/api/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentRequestId, ...body }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error?.message ?? "Action failed");
        return false;
      }
      // Optimistically update status for background operations
      // so the UI reflects the new state immediately without waiting for the next poll
      if (action === "channels" && data) {
        setData((prev) => prev
          ? { ...prev, request: { ...prev.request, status: "CHANNEL_ADAPTATION" } }
          : prev
        );
      }
      if (action === "generation" && data) {
        setData((prev) => prev
          ? { ...prev, request: { ...prev.request, status: "PLANNING" } }
          : prev
        );
      }
      if (action === "research" && data) {
        setData((prev) => prev
          ? { ...prev, request: { ...prev.request, status: "RESEARCHING" } }
          : prev
        );
      }
      await fetchData();
      return true;
    } catch {
      toast.error("Network error. Please try again.");
      return false;
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-3">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-14 w-full mt-4" />
        <div className="grid grid-cols-3 gap-3 mt-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
      </div>
    );
  }

  if (!data) {
    return <Alert variant="error">Failed to load content workspace. Please refresh.</Alert>;
  }

  const request = data.request;
  const status = request.status as WorkflowStatus;
  const isOwner = request.user_id === currentUserId;
  const isAdmin = currentUserRole === "admin";
  const isProcessing = POLLING_ACTIVE_STATUSES.includes(status);
  const latestDraft = data.drafts[0] ?? null;
  const latestEvaluation = data.evaluations[0] ?? null;
  const selectedDraft = data.drafts[selectedDraftIndex] ?? latestDraft;
  const evalForSelected = data.evaluations.find((e) => e.draft_id === selectedDraft?.id);
  const progress = getWorkflowProgress(status);
  const selectedSources = data.sources.filter((s) => s.selected);

  const TABS: { id: Tab; label: string; icon: React.ElementType; badge?: number }[] = [
    { id: "overview", label: "Overview", icon: FileText },
    { id: "sources", label: "Sources", icon: Search, badge: selectedSources.length || undefined },
    { id: "draft", label: "Draft", icon: Cpu, badge: data.drafts.length || undefined },
    { id: "evaluation", label: "Evaluation", icon: Star },
    { id: "review", label: "Review", icon: ClipboardCheck, badge: data.reviews.length || undefined },
    { id: "channels", label: "Channels", icon: Globe, badge: data.channelContent.length || undefined },
    { id: "publishing", label: "Publishing", icon: Send, badge: data.publishingQueue.length || undefined },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <StatusBadge status={status} />
            {isProcessing && (
              <span className="flex items-center gap-1 text-[12px] text-primary">
                <Loader2 size={11} className="animate-spin" />
                Processing…
              </span>
            )}
          </div>
          <h1 className="text-lg font-semibold text-foreground truncate">{request.content_idea}</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            {request.target_audience} · {formatRelativeTime(request.updated_at)}
          </p>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {status === "DRAFT" && isOwner && (
            <Button size="sm" onClick={() => handleAction("research")} loading={actionLoading === "research"}>
              <Search size={12} />Start Research
            </Button>
          )}
          {status === "FAILED" && (isOwner || isAdmin) && (
            <Button size="sm" variant="outline" onClick={() => handleAction("research")} loading={actionLoading === "research"}>
              <RefreshCw size={12} />Retry
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={fetchData} disabled={isProcessing} aria-label="Refresh">
            <RefreshCw size={13} className={isProcessing ? "animate-spin" : ""} />
          </Button>
        </div>
      </div>

      {/* ── Workflow progress ──────────────────────────────── */}
      <div className="bg-card rounded-lg border border-border p-4">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">
            Workflow
          </span>
          <span className="text-[11px] text-muted-foreground">{progress}%</span>
        </div>
        <Progress value={progress} className="h-[3px] mb-3" />
        <div className="flex items-center gap-1 overflow-x-auto">
          {WORKFLOW_STEPS.map((step, idx) => {
            const stepState = getStepState(step, status);
            const isLast = idx === WORKFLOW_STEPS.length - 1;

            return (
              <div key={step.key} className="flex items-center gap-1 flex-shrink-0">
                <div
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors",
                    stepState === "done" && "text-green-700 dark:text-green-400",
                    stepState === "active" && "text-primary",
                    stepState === "waiting" && "text-amber-600 dark:text-amber-400",
                    stepState === "pending" && "text-muted-foreground/40",
                    stepState === "error" && "text-destructive"
                  )}
                >
                  {stepState === "done" && <CheckCircle2 size={11} />}
                  {stepState === "active" && <Loader2 size={11} className="animate-spin" />}
                  {stepState === "waiting" && <Clock size={11} />}
                  {stepState === "error" && <AlertTriangle size={11} />}
                  {step.label}
                </div>
                {!isLast && <ChevronRight size={10} className="text-muted-foreground/30 flex-shrink-0" />}
              </div>
            );
          })}
        </div>

        {/* Contextual sub-label — only shown for human-waiting states */}
        {status === "AWAITING_REVIEW" && (
          <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <Clock size={10} />
            Waiting for reviewer decision
          </p>
        )}
        {status === "REVISION_REQUESTED" && (
          <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <Clock size={10} />
            Revision requested — AI will generate a new version shortly
          </p>
        )}
      </div>

      {/* ── Action banner — appears when user input is required ── */}
      {status === "RESEARCH_COMPLETE" && isOwner && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-[hsl(var(--info-border))] bg-[hsl(var(--info-subtle))] px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <CheckCircle2 size={16} className="text-primary flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-foreground">
                Research complete
              </p>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                {data.sources.filter((s) => s.selected).length} source
                {data.sources.filter((s) => s.selected).length !== 1 ? "s" : ""} selected.
                Ready to generate your draft.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => handleAction("generation")}
            loading={actionLoading === "generation"}
            className="flex-shrink-0"
          >
            <Cpu size={12} />
            Generate Content
          </Button>
        </div>
      )}

      {/* ── Status alerts ──────────────────────────────────── */}
      {status === "FAILED" && (
        <Alert variant="error" title="Pipeline failed">
          The workflow encountered an error. Check failure details and retry when ready.
        </Alert>
      )}
      {status === "AWAITING_REVIEW" && (
        <Alert variant="warning" title="Awaiting reviewer approval">
          {isOwner
            ? "Your draft has been submitted for review. A reviewer will approve, reject, or request changes."
            : `Draft v${latestDraft?.version_number ?? 1} is ready for your review. Open the Review tab to submit your decision.`}
        </Alert>
      )}
      {status === "AWAITING_REVIEW" && latestDraft?.version_number > 1 && (
        <Alert variant="info">
          Draft v{latestDraft.version_number} was reached after {latestDraft.version_number - 1} automatic revision{latestDraft.version_number > 2 ? "s" : ""}.
        </Alert>
      )}
      {status === "APPROVED" && (isOwner || isAdmin) && data.channelContent.length === 0 && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-[hsl(var(--success-border))] bg-[hsl(var(--success-subtle))] px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <CheckCircle2 size={16} className="text-green-600 flex-shrink-0" />
            <div>
              <p className="text-[13px] font-medium text-foreground">Content approved</p>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                Generate LinkedIn, X, and newsletter versions to prepare for publishing.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => {
              handleAction("channels", { channels: request.requested_channels });
              setActiveTab("channels");
            }}
            loading={actionLoading === "channels"}
            className="flex-shrink-0"
          >
            <Globe size={12} />
            Adapt Channels
          </Button>
        </div>
      )}

      {/* ── Tabs ───────────────────────────────────────────── */}
      <div className="border-b border-border -mb-4">
        <nav className="flex overflow-x-auto" aria-label="Workspace tabs">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-4 h-10 text-[13px] border-b-2 transition-colors whitespace-nowrap",
                  isActive
                    ? "border-primary text-primary font-medium"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon size={13} />
                {tab.label}
                {tab.badge !== undefined && (
                  <span className={cn(
                    "rounded px-1 py-0.5 text-[10px] font-medium",
                    isActive ? "bg-[hsl(var(--info-subtle))] text-primary" : "bg-secondary text-muted-foreground"
                  )}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ── Tab content ────────────────────────────────────── */}
      <div className="min-h-56 pt-4">
        {activeTab === "overview" && <OverviewTab request={request} researchRun={data.researchRuns[0]} sources={data.sources} />}
        {activeTab === "sources" && <SourcesTab sources={data.sources} researchRun={data.researchRuns[0]} />}
        {activeTab === "draft" && (
          <DraftTab drafts={data.drafts} selectedIndex={selectedDraftIndex} onSelectIndex={setSelectedDraftIndex} />
        )}
        {activeTab === "evaluation" && <EvaluationTab evaluation={evalForSelected} draft={selectedDraft} />}
        {activeTab === "review" && (
          <ReviewPanel
            contentRequestId={contentRequestId}
            draft={latestDraft}
            evaluation={latestEvaluation}
            reviews={data.reviews}
            sources={selectedSources}
            currentUserId={currentUserId}
            currentUserRole={currentUserRole}
            contentOwnerId={request.user_id}
            status={status}
            onReviewSubmitted={fetchData}
          />
        )}
        {activeTab === "channels" && (
          <ChannelPanel
            contentRequestId={contentRequestId}
            channelContent={data.channelContent}
            requestedChannels={request.requested_channels}
            status={status}
            isOwner={isOwner || isAdmin}
            onAdapt={() => handleAction("channels", { channels: request.requested_channels })}
          />
        )}
        {activeTab === "publishing" && (
          <PublishingPanel
            contentRequestId={contentRequestId}
            channelContent={data.channelContent}
            publishingQueue={data.publishingQueue}
            status={status}
            isOwner={isOwner || isAdmin}
            onRefresh={fetchData}
          />
        )}
      </div>
    </div>
  );
}

// ── Overview ─────────────────────────────────────────────────

function OverviewTab({ request, researchRun, sources }: {
  request: any;
  researchRun: any;
  sources: any[];
}) {
  // Use live source counts from actual records — researchRun counters can be stale
  const totalSources = sources.length;
  const selectedSources = sources.filter((s) => s.selected).length;

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card>
        <CardHeader><CardTitle>Content Brief</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Field label="Content Idea" value={request.content_idea} />
          <Field label="Target Audience" value={request.target_audience} />
          {request.primary_keyword && <Field label="Primary Keyword" value={request.primary_keyword} />}
          {request.content_goal && <Field label="Content Goal" value={request.content_goal} />}
          {request.tone && <Field label="Tone" value={request.tone} capitalize />}
          {request.source_url && (
            <div>
              <p className="text-[11px] font-medium text-muted-foreground mb-1 uppercase tracking-wide">Source URL</p>
              <a
                href={request.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[13px] text-primary hover:underline underline-offset-2 truncate"
              >
                {truncate(request.source_url, 55)} <ExternalLink size={10} />
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Channels</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {(request.requested_channels ?? []).map((ch: string) => (
              <span key={ch} className="px-2 py-0.5 bg-secondary text-foreground rounded text-[12px] font-medium capitalize ring-1 ring-border">
                {ch}
              </span>
            ))}
          </div>
          {researchRun && (
            <div className="pt-3 border-t border-border grid grid-cols-2 gap-3">
              <Stat label="Sources found" value={totalSources} />
              <Stat label="Selected" value={selectedSources} highlight />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value, capitalize }: { label: string; value: string; capitalize?: boolean }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-0.5">{label}</p>
      <p className={cn("text-[13px] text-foreground leading-snug", capitalize && "capitalize")}>{value}</p>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground mb-0.5">{label}</p>
      <p className={cn("text-lg font-semibold tabular-nums", highlight ? "text-green-600 dark:text-green-400" : "text-foreground")}>
        {value}
      </p>
    </div>
  );
}

// ── Sources ──────────────────────────────────────────────────

function SourcesTab({ sources, researchRun }: { sources: any[]; researchRun: any }) {
  if (!sources.length) {
    return <EmptyState icon={Search} title="No sources yet" description="Start research to retrieve and analyse sources." />;
  }
  const selected = sources.filter((s) => s.selected);
  const notSelected = sources.filter((s) => !s.selected);

  return (
    <div className="space-y-4">
      {researchRun?.error_message && (
        <Alert variant="warning" title="Research issue">{researchRun.error_message}</Alert>
      )}
      {selected.length > 0 && (
        <div className="space-y-2">
          <p className="text-[12px] font-medium text-muted-foreground flex items-center gap-1.5">
            <CheckCircle2 size={12} className="text-green-600" />
            Selected sources ({selected.length})
          </p>
          {selected.map((s) => <SourceCard key={s.id} source={s} selected />)}
        </div>
      )}
      {notSelected.length > 0 && (
        <div className="space-y-2">
          <p className="text-[12px] font-medium text-muted-foreground">Not selected ({notSelected.length})</p>
          {notSelected.map((s) => <SourceCard key={s.id} source={s} selected={false} />)}
        </div>
      )}
    </div>
  );
}

function SourceCard({ source, selected }: { source: any; selected: boolean }) {
  const STATUS_BADGE: Record<string, string> = {
    retrieved: "text-green-700 dark:text-green-400 bg-[hsl(var(--success-subtle))] ring-[hsl(var(--success-border))]",
    failed: "text-red-700 dark:text-red-400 bg-[hsl(var(--danger-subtle))] ring-[hsl(var(--danger-border))]",
    paywall: "text-amber-700 dark:text-amber-400 bg-[hsl(var(--warning-subtle))] ring-[hsl(var(--warning-border))]",
    empty: "text-muted-foreground bg-secondary ring-border",
    too_large: "text-amber-700 bg-[hsl(var(--warning-subtle))] ring-[hsl(var(--warning-border))]",
  };

  return (
    <div className={cn(
      "rounded-lg border p-3.5",
      selected ? "border-[hsl(var(--success-border))] bg-[hsl(var(--success-subtle))]" : "border-border bg-card"
    )}>
      <div className="flex items-start gap-2 mb-2">
        <span className={cn("text-[11px] px-1.5 py-0.5 rounded ring-1 font-medium flex-shrink-0",
          STATUS_BADGE[source.retrieval_status] ?? "text-muted-foreground bg-secondary ring-border"
        )}>
          {source.retrieval_status}
        </span>
        {source.relevance_score !== null && (
          <span className="text-[11px] text-muted-foreground flex items-center gap-0.5 ml-auto">
            <Star size={10} className="text-amber-400" />
            {Number(source.relevance_score).toFixed(1)}/10
          </span>
        )}
      </div>
      <p className="text-[13px] font-medium text-foreground truncate">{source.title ?? source.url}</p>
      {source.domain && source.domain !== "internal" && (
        <a href={source.url} target="_blank" rel="noopener noreferrer"
          className="text-[11px] text-muted-foreground hover:text-primary flex items-center gap-0.5 mt-0.5">
          {source.domain} <ExternalLink size={9} />
        </a>
      )}
      {source.summary && <p className="text-[12px] text-muted-foreground mt-2 leading-relaxed">{source.summary}</p>}
      {source.selection_reason && selected && (
        <p className="text-[11px] text-green-700 dark:text-green-400 mt-1.5 italic">↳ {source.selection_reason}</p>
      )}
    </div>
  );
}

// ── Draft ────────────────────────────────────────────────────

function DraftTab({ drafts, selectedIndex, onSelectIndex }: {
  drafts: any[]; selectedIndex: number; onSelectIndex: (i: number) => void;
}) {
  if (!drafts.length) {
    return <EmptyState icon={Cpu} title="No drafts yet" description="Complete research first, then generate content." />;
  }
  const draft = drafts[selectedIndex] ?? drafts[0];

  return (
    <div className="space-y-3">
      {drafts.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {drafts.map((d, i) => (
            <button
              key={d.id}
              onClick={() => onSelectIndex(i)}
              className={cn(
                "flex-shrink-0 h-6 px-2.5 rounded text-[12px] font-medium transition-colors",
                i === selectedIndex ? "bg-primary text-white" : "bg-secondary text-muted-foreground hover:text-foreground"
              )}
            >
              v{d.version_number}{i === 0 ? " (latest)" : ""}
            </button>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <div>
            <CardTitle>{draft.title}</CardTitle>
            <p className="text-[11px] text-muted-foreground mt-1">
              v{draft.version_number} · {draft.word_count} words · ~{draft.reading_time_minutes} min read
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {draft.summary && (
            <div className="p-3 rounded-md bg-[hsl(var(--info-subtle))] border border-[hsl(var(--info-border))]">
              <p className="text-[11px] font-medium text-primary mb-1 uppercase tracking-wide">Summary</p>
              <p className="text-[13px] text-foreground leading-relaxed">{draft.summary}</p>
            </div>
          )}
          {draft.change_summary && (
            <div className="p-3 rounded-md bg-[hsl(var(--warning-subtle))] border border-[hsl(var(--warning-border))]">
              <p className="text-[11px] font-medium text-amber-600 mb-1 uppercase tracking-wide">Changes in this version</p>
              <p className="text-[13px] text-foreground">{draft.change_summary}</p>
            </div>
          )}
          <div className="prose-content border-t border-border pt-4 whitespace-pre-wrap">
            {draft.article}
          </div>
        </CardContent>
      </Card>

      {draft.key_claims?.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Key Claims</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {draft.key_claims.map((claim: any, i: number) => (
              <div key={i} className={cn(
                "flex items-start gap-2 p-2.5 rounded-md text-[12px]",
                claim.flag ? "bg-[hsl(var(--warning-subtle))] border border-[hsl(var(--warning-border))]"
                  : claim.supported ? "bg-[hsl(var(--success-subtle))]" : "bg-secondary"
              )}>
                {claim.flag
                  ? <AlertTriangle size={12} className="text-amber-500 flex-shrink-0 mt-0.5" />
                  : claim.supported
                    ? <CheckCircle2 size={12} className="text-green-600 flex-shrink-0 mt-0.5" />
                    : <AlertTriangle size={12} className="text-muted-foreground flex-shrink-0 mt-0.5" />}
                <span className="text-foreground">{claim.claim}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Evaluation ───────────────────────────────────────────────

function EvaluationTab({ evaluation, draft }: { evaluation: any; draft: any }) {
  if (!evaluation) {
    return <EmptyState icon={Star} title="No evaluation yet" description="Generate a draft first." />;
  }
  const scores = evaluation.scores ?? {};
  const statusBadge = {
    PASS: "text-green-700 dark:text-green-400 bg-[hsl(var(--success-subtle))] ring-[hsl(var(--success-border))]",
    REVISE: "text-amber-700 dark:text-amber-400 bg-[hsl(var(--warning-subtle))] ring-[hsl(var(--warning-border))]",
    REJECT: "text-red-700 dark:text-red-400 bg-[hsl(var(--danger-subtle))] ring-[hsl(var(--danger-border))]",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className={cn("px-2.5 py-1 rounded text-[13px] font-semibold ring-1",
          statusBadge[evaluation.overall_status as keyof typeof statusBadge] ?? "bg-secondary text-foreground ring-border"
        )}>
          {evaluation.overall_status}
        </span>
        {draft && <span className="text-[13px] text-muted-foreground">Draft v{draft.version_number}</span>}
        <span className={cn("ml-auto text-2xl font-bold tabular-nums",
          Number(scores.overall) >= 7.5 ? "text-green-600" : Number(scores.overall) >= 5.5 ? "text-amber-600" : "text-red-600"
        )}>
          {Number(scores.overall).toFixed(1)}<span className="text-sm font-normal text-muted-foreground">/10</span>
        </span>
      </div>

      <Card>
        <CardHeader><CardTitle>Dimension Scores</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.entries(scores).filter(([k]) => k !== "overall").map(([key, val]) => (
              <div key={key}>
                <div className="flex justify-between items-baseline mb-1">
                  <span className="text-[12px] text-muted-foreground capitalize">{key.replace(/_/g, " ")}</span>
                  <span className="text-[12px] font-semibold text-foreground tabular-nums">{Number(val).toFixed(1)}</span>
                </div>
                <Progress
                  value={Number(val) * 10}
                  className="h-[3px]"
                  barClassName={Number(val) >= 7 ? "bg-green-500" : Number(val) >= 5 ? "bg-amber-400" : "bg-red-400"}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <p className="text-[13px] text-foreground bg-secondary rounded-lg p-4 border border-border leading-relaxed">
        {evaluation.summary}
      </p>

      {evaluation.unsupported_claims?.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Unsupported Claims</CardTitle></CardHeader>
          <CardContent className="space-y-2.5">
            {evaluation.unsupported_claims.map((c: any, i: number) => (
              <div key={i} className="p-3 rounded-md bg-[hsl(var(--warning-subtle))] border border-[hsl(var(--warning-border))]">
                <p className="text-[12px] font-medium text-foreground">&ldquo;{c.claim}&rdquo;</p>
                <p className="text-[11px] text-muted-foreground mt-1">Location: {c.location}</p>
                <p className="text-[12px] text-amber-700 dark:text-amber-400 mt-1">↳ {c.recommendation}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {evaluation.recommended_changes?.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Recommended Changes</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-1.5">
              {evaluation.recommended_changes.map((c: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-[13px] text-foreground">
                  <span className="text-primary mt-0.5 flex-shrink-0">→</span>
                  {c}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
