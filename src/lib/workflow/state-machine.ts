/**
 * Content Workflow State Machine
 *
 * Central authority for all workflow state transitions.
 * Invalid transitions are rejected — state must never be mutated arbitrarily.
 */

import type { WorkflowStatus } from "@/types";

// ---- Valid Transitions Map ----------------------------------

const VALID_TRANSITIONS: Record<WorkflowStatus, WorkflowStatus[]> = {
  DRAFT: ["RESEARCHING", "FAILED"],
  RESEARCHING: ["RESEARCH_COMPLETE", "FAILED"],
  RESEARCH_COMPLETE: ["PLANNING", "FAILED"],
  PLANNING: ["GENERATING", "FAILED"],
  GENERATING: ["EVALUATING", "FAILED"],
  EVALUATING: ["REVISING", "AWAITING_REVIEW", "FAILED"],
  REVISING: ["EVALUATING", "FAILED"],
  AWAITING_REVIEW: ["APPROVED", "REVISION_REQUESTED", "REJECTED"],
  REVISION_REQUESTED: ["GENERATING", "FAILED"],
  APPROVED: ["CHANNEL_ADAPTATION", "FAILED"],
  REJECTED: [],
  CHANNEL_ADAPTATION: ["READY_TO_SCHEDULE", "FAILED"],
  READY_TO_SCHEDULE: ["SCHEDULED", "PUBLISHED", "FAILED"],
  SCHEDULED: ["PUBLISHING", "FAILED", "READY_TO_SCHEDULE"],
  PUBLISHING: ["PUBLISHED", "FAILED"],
  PUBLISHED: [],
  FAILED: ["DRAFT", "RESEARCHING", "GENERATING", "PLANNING"],
};

// ---- State Machine ------------------------------------------

export class WorkflowStateMachine {
  static canTransition(from: WorkflowStatus, to: WorkflowStatus): boolean {
    return VALID_TRANSITIONS[from]?.includes(to) ?? false;
  }

  static assertTransition(from: WorkflowStatus, to: WorkflowStatus): void {
    if (!this.canTransition(from, to)) throw new WorkflowTransitionError(from, to);
  }

  static validNextStates(from: WorkflowStatus): WorkflowStatus[] {
    return VALID_TRANSITIONS[from] ?? [];
  }

  static isTerminal(status: WorkflowStatus): boolean {
    const next = VALID_TRANSITIONS[status];
    return !next || next.length === 0;
  }

  static canPublish(status: WorkflowStatus): boolean {
    return ["READY_TO_SCHEDULE", "SCHEDULED"].includes(status);
  }

  static isActive(status: WorkflowStatus): boolean {
    return !this.isTerminal(status) && status !== "FAILED";
  }
}

// ---- Errors -------------------------------------------------

export class WorkflowTransitionError extends Error {
  constructor(
    public readonly from: WorkflowStatus,
    public readonly to: WorkflowStatus
  ) {
    super(
      `Invalid workflow transition: ${from} → ${to}. ` +
        `Allowed from ${from}: ${VALID_TRANSITIONS[from]?.join(", ") || "none"}`
    );
    this.name = "WorkflowTransitionError";
  }
}

// ---- Step type: what icon/state a step shows ----------------

export type StepState =
  | "done"       // completed — show checkmark
  | "active"     // AI actively processing — show spinner
  | "waiting"    // waiting for human action — show clock/pause
  | "pending"    // not reached yet
  | "error";     // failed

/**
 * Ordered workflow steps.
 * Each step knows:
 * - which statuses map to it
 * - which of those statuses are "actively processing" (show spinner)
 * - which are "waiting for human" (show pause/clock icon)
 * - which are "done" (step fully completed and passed)
 */
export const WORKFLOW_STEPS = [
  {
    key: "research",
    label: "Research",
    statuses: ["RESEARCHING", "RESEARCH_COMPLETE"],
    // Only RESEARCHING is active; RESEARCH_COMPLETE means the step is done
    activeStatuses: ["RESEARCHING"],
    waitingStatuses: [] as WorkflowStatus[],
    doneStatuses: ["RESEARCH_COMPLETE"],
  },
  {
    key: "planning",
    label: "Planning",
    statuses: ["PLANNING"],
    activeStatuses: ["PLANNING"],
    waitingStatuses: [] as WorkflowStatus[],
    doneStatuses: [] as WorkflowStatus[],
  },
  {
    key: "drafting",
    label: "Drafting",
    statuses: ["GENERATING", "EVALUATING", "REVISING"],
    activeStatuses: ["GENERATING", "EVALUATING", "REVISING"],
    waitingStatuses: [] as WorkflowStatus[],
    doneStatuses: [] as WorkflowStatus[],
  },
  {
    key: "review",
    label: "Review",
    // AWAITING_REVIEW and REVISION_REQUESTED are both human-gate states — not AI processing
    statuses: ["AWAITING_REVIEW", "REVISION_REQUESTED"],
    activeStatuses: [] as WorkflowStatus[],
    waitingStatuses: ["AWAITING_REVIEW", "REVISION_REQUESTED"],
    doneStatuses: [] as WorkflowStatus[],
  },
  {
    key: "approved",
    label: "Approved",
    statuses: ["APPROVED"],
    activeStatuses: [] as WorkflowStatus[],
    waitingStatuses: [] as WorkflowStatus[],
    doneStatuses: ["APPROVED"],
  },
  {
    key: "channels",
    label: "Channels",
    statuses: ["CHANNEL_ADAPTATION", "READY_TO_SCHEDULE"],
    activeStatuses: ["CHANNEL_ADAPTATION"],
    waitingStatuses: [] as WorkflowStatus[],
    doneStatuses: ["READY_TO_SCHEDULE"],
  },
  {
    key: "publishing",
    label: "Publishing",
    statuses: ["SCHEDULED", "PUBLISHING", "PUBLISHED"],
    activeStatuses: ["PUBLISHING"],
    waitingStatuses: ["SCHEDULED"],
    doneStatuses: ["PUBLISHED"],
  },
] as const;

type WorkflowStep = (typeof WORKFLOW_STEPS)[number];

/**
 * Determine the display state for a given step given the current workflow status.
 */
export function getStepState(step: WorkflowStep, status: WorkflowStatus): StepState {
  if (status === "FAILED") return "error";

  const stepIndex = WORKFLOW_STEPS.findIndex((s) => s.key === step.key);
  const currentStepIndex = WORKFLOW_STEPS.findIndex((s) =>
    (s.statuses as readonly string[]).includes(status)
  );

  // Step is in the past (fully completed)
  if (stepIndex < currentStepIndex) return "done";

  // Step is explicitly marked done at this status
  if ((step.doneStatuses as readonly string[]).includes(status)) return "done";

  // Step is not yet reached
  if (stepIndex > currentStepIndex) return "pending";

  // Current step — determine if active, waiting, or generic active
  if ((step.waitingStatuses as readonly string[]).includes(status)) return "waiting";
  if ((step.activeStatuses as readonly string[]).includes(status)) return "active";

  // Fallback: current step with no specific mapping — treat as active
  return "active";
}

/**
 * Statuses where the page should actively poll for updates (AI is processing).
 * Human-waiting states like AWAITING_REVIEW do NOT need polling.
 */
export const POLLING_ACTIVE_STATUSES: WorkflowStatus[] = [
  "RESEARCHING",
  "PLANNING",
  "GENERATING",
  "EVALUATING",
  "REVISING",
  "REVISION_REQUESTED",
  "CHANNEL_ADAPTATION",
  "PUBLISHING",
];

export function getWorkflowProgress(status: WorkflowStatus): number {
  const ORDER: WorkflowStatus[] = [
    "DRAFT",
    "RESEARCHING",
    "RESEARCH_COMPLETE",
    "PLANNING",
    "GENERATING",
    "EVALUATING",
    "REVISING",
    "AWAITING_REVIEW",
    "REVISION_REQUESTED",
    "APPROVED",
    "CHANNEL_ADAPTATION",
    "READY_TO_SCHEDULE",
    "SCHEDULED",
    "PUBLISHED",
  ];
  const index = ORDER.indexOf(status);
  if (index === -1) return 0;
  return Math.round((index / (ORDER.length - 1)) * 100);
}

// ---- Legacy display helpers (kept for audit log, etc.) ------

export const STATUS_LABELS: Record<WorkflowStatus, string> = {
  DRAFT: "Draft",
  RESEARCHING: "Researching",
  RESEARCH_COMPLETE: "Research Complete",
  PLANNING: "Planning",
  GENERATING: "Generating",
  EVALUATING: "Evaluating",
  REVISING: "Revising",
  AWAITING_REVIEW: "Awaiting Review",
  REVISION_REQUESTED: "Revision Requested",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CHANNEL_ADAPTATION: "Adapting Channels",
  READY_TO_SCHEDULE: "Ready to Schedule",
  SCHEDULED: "Scheduled",
  PUBLISHING: "Publishing",
  PUBLISHED: "Published",
  FAILED: "Failed",
};
