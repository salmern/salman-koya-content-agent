// @ts-nocheck
/**
 * Review Service
 *
 * Enforces all human approval invariants:
 * 1. Only reviewers/admins can approve
 * 2. Separation of duties (can't approve own content)
 * 3. Approval must match the version being published
 * 4. Stale approval detection
 */

import { createSupabaseAdminClient } from "@/lib/db/client";
import { recordAudit } from "@/lib/audit";
import {
  ForbiddenError,
  SeparationOfDutiesError,
  WorkflowError,
  NotFoundError,
} from "@/lib/errors";
import type { ReviewDecision } from "@/types";

export interface ReviewInput {
  contentRequestId: string;
  draftId: string;
  reviewerId: string;
  reviewerEmail: string;
  reviewerRole: string;
  contentOwnerId: string;
  decision: ReviewDecision;
  feedback: string | null;
  revisionInstructions: string | null;
}

export async function submitReview(input: ReviewInput): Promise<void> {
  // ---- Authorization checks --------------------------------

  if (!["reviewer", "admin"].includes(input.reviewerRole)) {
    throw new ForbiddenError("Only reviewers and admins can submit reviews.");
  }

  const enforceSOD = process.env.ENFORCE_SEPARATION_OF_DUTIES !== "false";
  if (enforceSOD && input.reviewerId === input.contentOwnerId) {
    throw new SeparationOfDutiesError();
  }

  if (input.decision === "revision_requested" && !input.revisionInstructions?.trim()) {
    throw new WorkflowError("Revision instructions are required when requesting revisions.");
  }

  if (input.decision === "rejected" && !input.feedback?.trim()) {
    throw new WorkflowError("Feedback is required when rejecting content.");
  }

  const admin = createSupabaseAdminClient();

  // ---- Verify the draft exists and belongs to this request --
  const { data: draft } = await admin
    .from("content_drafts")
    .select("id, version_number, content_request_id")
    .eq("id", input.draftId)
    .eq("content_request_id", input.contentRequestId)
    .single();

  if (!draft) throw new NotFoundError("Draft");

  // ---- Verify content request is in reviewable state --------
  const { data: request } = await admin
    .from("content_requests")
    .select("status")
    .eq("id", input.contentRequestId)
    .single();

  if (!request) throw new NotFoundError("Content request");

  if (!["AWAITING_REVIEW", "REVISION_REQUESTED"].includes(request.status)) {
    throw new WorkflowError(
      `Content is not awaiting review (current status: ${request.status}).`
    );
  }

  // ---- Insert the review record (immutable) -----------------
  const { data: review, error: reviewError } = await admin
    .from("human_reviews")
    .insert({
      content_request_id: input.contentRequestId,
      draft_id: input.draftId,
      draft_version: draft.version_number,
      reviewer_id: input.reviewerId,
      decision: input.decision,
      feedback: input.feedback,
      revision_instructions: input.revisionInstructions,
    })
    .select()
    .single();

  if (reviewError || !review) {
    throw new Error("Failed to save review record");
  }

  // ---- Update content request status -----------------------
  const newStatus =
    input.decision === "approved"
      ? "APPROVED"
      : input.decision === "revision_requested"
        ? "REVISION_REQUESTED"
        : "REJECTED";

  await admin
    .from("content_requests")
    .update({ status: newStatus })
    .eq("id", input.contentRequestId);

  // ---- Audit log -------------------------------------------
  const auditAction =
    input.decision === "approved"
      ? "review_approved"
      : input.decision === "revision_requested"
        ? "revision_requested"
        : "review_rejected";

  await recordAudit({
    actor_id: input.reviewerId,
    actor_email: input.reviewerEmail,
    action: auditAction,
    entity_type: "human_review",
    entity_id: review.id,
    content_request_id: input.contentRequestId,
    metadata: {
      decision: input.decision,
      draft_version: draft.version_number,
      feedback_length: input.feedback?.length ?? 0,
    },
  });
}

/**
 * Check approval state for a content request.
 * Returns whether there is a valid, non-stale approval.
 */
export async function getApprovalState(contentRequestId: string): Promise<{
  isApproved: boolean;
  approvedDraftId: string | null;
  approvedVersion: number | null;
  isStale: boolean;
  currentVersion: number | null;
}> {
  const admin = createSupabaseAdminClient();

  // Find the most recent approval
  const { data: approval } = await admin
    .from("human_reviews")
    .select("draft_id, draft_version")
    .eq("content_request_id", contentRequestId)
    .eq("decision", "approved")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!approval) {
    return { isApproved: false, approvedDraftId: null, approvedVersion: null, isStale: false, currentVersion: null };
  }

  // Find the latest draft version
  const { data: latestDraft } = await admin
    .from("content_drafts")
    .select("id, version_number")
    .eq("content_request_id", contentRequestId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const currentVersion = latestDraft?.version_number ?? null;
  const isStale = currentVersion !== null && currentVersion > approval.draft_version;

  return {
    isApproved: true,
    approvedDraftId: approval.draft_id,
    approvedVersion: approval.draft_version,
    isStale,
    currentVersion,
  };
}
