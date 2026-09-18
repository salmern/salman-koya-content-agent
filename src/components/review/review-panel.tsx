"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, XCircle, RotateCcw, Clock, User, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime, cn } from "@/lib/utils";
import type { UserRole, WorkflowStatus } from "@/types";

interface ReviewPanelProps {
  contentRequestId: string;
  draft: any | null;
  evaluation: any | null;
  reviews: any[];
  sources: any[];
  currentUserId: string;
  currentUserRole: UserRole;
  contentOwnerId: string;
  status: WorkflowStatus;
  onReviewSubmitted: () => void;
}

type Decision = "approved" | "revision_requested" | "rejected";

const DECISION_CONFIG = {
  approved: {
    label: "Approve",
    icon: CheckCircle2,
    active: "border-green-600 bg-[hsl(var(--success-subtle))] text-green-700 dark:text-green-400",
    hover: "hover:border-green-400",
  },
  revision_requested: {
    label: "Request Revision",
    icon: RotateCcw,
    active: "border-amber-500 bg-[hsl(var(--warning-subtle))] text-amber-700 dark:text-amber-400",
    hover: "hover:border-amber-400",
  },
  rejected: {
    label: "Reject",
    icon: XCircle,
    active: "border-red-500 bg-[hsl(var(--danger-subtle))] text-red-700 dark:text-red-400",
    hover: "hover:border-red-400",
  },
};

export function ReviewPanel({
  contentRequestId,
  draft,
  evaluation,
  reviews,
  sources,
  currentUserId,
  currentUserRole,
  contentOwnerId,
  status,
  onReviewSubmitted,
}: ReviewPanelProps) {
  const router = useRouter();
  const [decision, setDecision] = useState<Decision | null>(null);
  const [feedback, setFeedback] = useState("");
  const [revisionInstructions, setRevisionInstructions] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canReview = ["reviewer", "admin"].includes(currentUserRole);
  const isSelfReview = currentUserId === contentOwnerId;
  const sodEnabled = process.env.NEXT_PUBLIC_DEMO_MODE !== "true";
  const canActuallyReview = canReview && (!sodEnabled || !isSelfReview);
  const isAwaitingReview = ["AWAITING_REVIEW", "REVISION_REQUESTED"].includes(status);

  async function handleSubmitReview() {
    if (!decision || !draft) return;

    if (decision === "revision_requested" && !revisionInstructions.trim()) {
      toast.error("Please provide revision instructions");
      return;
    }
    if (decision === "rejected" && feedback.trim().length < 10) {
      toast.error("Please explain why this is being rejected (min 10 characters)");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentRequestId,
          draftId: draft.id,
          decision,
          // Send undefined (not null) when empty — schema accepts optional
          feedback: feedback.trim() || undefined,
          revision_instructions: revisionInstructions.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        toast.error("Review failed", { description: json.error?.message ?? "Unknown error" });
        return;
      }

      const labels = { approved: "Approved", revision_requested: "Revision requested", rejected: "Rejected" };
      toast.success(labels[decision]);
      setDecision(null);
      setFeedback("");
      setRevisionInstructions("");
      onReviewSubmitted();
      // Re-run Server Components so the sidebar badge count updates immediately
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  if (!draft) {
    return <EmptyState icon={Clock} title="No draft to review" description="A draft must be generated before it can be reviewed." />;
  }

  const labelCls = "block text-[13px] font-medium text-foreground mb-1.5";
  const textareaCls = "w-full px-3 py-2 rounded-md border border-border bg-background text-[13px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring resize-none transition-shadow";

  return (
    <div className="space-y-4">
      {/* Review history */}
      {reviews.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Review History</CardTitle></CardHeader>
          <CardContent className="space-y-2.5">
            {reviews.map((review) => {
              const cfg = DECISION_CONFIG[review.decision as Decision];
              const Icon = cfg?.icon ?? CheckCircle2;
              return (
                <div key={review.id} className="rounded-md border border-border bg-secondary/30 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Icon size={13} className={cn(
                        review.decision === "approved" ? "text-green-600" :
                        review.decision === "rejected" ? "text-red-600" : "text-amber-600"
                      )} />
                      <span className="text-[13px] font-medium text-foreground capitalize">
                        {review.decision.replace(/_/g, " ")}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <User size={10} />
                      <span>{review.reviewer?.full_name ?? review.reviewer?.email ?? "Reviewer"}</span>
                      <span>· v{review.draft_version}</span>
                      <span>· {formatDateTime(review.created_at)}</span>
                    </div>
                  </div>
                  {review.feedback && (
                    <p className="text-[12px] text-muted-foreground mt-2 leading-relaxed">{review.feedback}</p>
                  )}
                  {review.revision_instructions && (
                    <div className="mt-2 pl-3 border-l-2 border-amber-300">
                      <p className="text-[11px] font-medium text-amber-600 mb-0.5">Instructions</p>
                      <p className="text-[12px] text-foreground">{review.revision_instructions}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Source grounding */}
      {sources.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Sources Informing This Article</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {sources.map((s, i) => (
              <div key={s.id} className="flex items-start gap-3 p-2.5 rounded-md bg-secondary/40">
                <span className="text-[11px] font-medium text-muted-foreground flex-shrink-0 mt-0.5 w-4">{i + 1}.</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-foreground truncate">{s.title ?? s.domain}</p>
                  {s.selection_reason && (
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{s.selection_reason}</p>
                  )}
                  {s.url && s.url !== "internal://supporting-material" && (
                    <a href={s.url} target="_blank" rel="noopener noreferrer"
                      className="text-[11px] text-primary hover:underline flex items-center gap-0.5 mt-0.5">
                      {s.domain} <ExternalLink size={9} />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* AI eval summary */}
      {evaluation && (
        <Alert
          variant={evaluation.overall_status === "PASS" ? "success" : evaluation.overall_status === "REVISE" ? "warning" : "error"}
          title={`AI Evaluation: ${evaluation.overall_status} (${Number(evaluation.scores?.overall).toFixed(1)}/10)`}
        >
          {evaluation.summary}
        </Alert>
      )}

      {/* Review form */}
      {isAwaitingReview && canActuallyReview ? (
        <Card>
          <CardHeader><CardTitle>Submit Review — v{draft.version_number}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {isSelfReview && sodEnabled && (
              <Alert variant="warning" title="Separation of duties">
                You cannot review content you created. Assign a reviewer from the team.
              </Alert>
            )}

            {/* Decision buttons */}
            <div>
              <label className={labelCls}>Decision</label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.entries(DECISION_CONFIG) as [Decision, typeof DECISION_CONFIG[keyof typeof DECISION_CONFIG]][]).map(([d, cfg]) => {
                  const Icon = cfg.icon;
                  const isSelected = decision === d;
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDecision(d)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 py-3 px-2 rounded-md border-2 text-[12px] font-medium transition-colors",
                        isSelected ? cfg.active : cn("border-border text-muted-foreground", cfg.hover)
                      )}
                    >
                      <Icon size={15} />
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Feedback */}
            <div>
              <label className={labelCls}>
                Feedback
                {decision === "rejected" && <span className="text-destructive ml-1">*</span>}
                {decision !== "rejected" && <span className="text-muted-foreground font-normal ml-1">(optional)</span>}
              </label>
              <textarea
                rows={3}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                className={textareaCls}
                placeholder="Share your thoughts on this draft…"
              />
            </div>

            {/* Revision instructions */}
            {decision === "revision_requested" && (
              <div>
                <label className={labelCls}>
                  Revision Instructions <span className="text-destructive">*</span>
                </label>
                <textarea
                  rows={4}
                  value={revisionInstructions}
                  onChange={(e) => setRevisionInstructions(e.target.value)}
                  className={cn(textareaCls, "border-amber-300 dark:border-amber-700")}
                  placeholder="Be specific: 'Expand the implementation section', 'Remove the unsupported statistic in paragraph 2'…"
                />
              </div>
            )}

            <div className="flex justify-end">
              <Button
                onClick={handleSubmitReview}
                loading={submitting}
                disabled={!decision}
                variant={decision === "approved" ? "primary" : decision === "rejected" ? "destructive" : "secondary"}
                size="sm"
              >
                Submit Review
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : isAwaitingReview && !canActuallyReview ? (
        <Alert variant="info" title="Review pending">
          {!canReview
            ? "Only reviewers and admins can submit reviews."
            : "You cannot review your own content. Another team member must review it."}
        </Alert>
      ) : (
        <Alert variant="info">
          {status === "APPROVED" && "Approved. Proceed to channel adaptation."}
          {status === "REJECTED" && "This content was rejected."}
          {status === "REVISION_REQUESTED" && "Revision requested — the AI is generating a new version."}
          {!["APPROVED", "REJECTED", "REVISION_REQUESTED"].includes(status) &&
            "Content is not currently awaiting review."}
        </Alert>
      )}
    </div>
  );
}
