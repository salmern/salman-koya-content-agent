// =============================================================
// Koya Content Agent — Core Domain Types
// =============================================================

// ---- Auth & Users -------------------------------------------

export type UserRole = "content_manager" | "reviewer" | "admin";

export interface Profile {
  id: string; // matches auth.users.id
  email: string;
  full_name: string | null;
  role: UserRole;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

// ---- Workflow States ----------------------------------------

export type WorkflowStatus =
  | "DRAFT"
  | "RESEARCHING"
  | "RESEARCH_COMPLETE"
  | "PLANNING"
  | "GENERATING"
  | "EVALUATING"
  | "REVISING"
  | "AWAITING_REVIEW"
  | "REVISION_REQUESTED"
  | "APPROVED"
  | "REJECTED"
  | "CHANNEL_ADAPTATION"
  | "READY_TO_SCHEDULE"
  | "SCHEDULED"
  | "PUBLISHING"
  | "PUBLISHED"
  | "FAILED";

// ---- Content Channels ---------------------------------------

export type ContentChannel = "article" | "linkedin" | "x" | "newsletter";

export type ContentTone =
  | "professional"
  | "conversational"
  | "authoritative"
  | "friendly"
  | "educational"
  | "persuasive";

// ---- Content Request ----------------------------------------

export interface ContentRequest {
  id: string;
  user_id: string;
  content_idea: string;
  target_audience: string;
  primary_keyword: string | null;
  content_goal: string | null;
  source_url: string | null;
  supporting_material: string | null;
  tone: ContentTone | null;
  additional_instructions: string | null;
  requested_channels: ContentChannel[];
  status: WorkflowStatus;
  created_at: string;
  updated_at: string;
}

export type CreateContentRequestInput = Pick<
  ContentRequest,
  | "content_idea"
  | "target_audience"
  | "primary_keyword"
  | "content_goal"
  | "source_url"
  | "supporting_material"
  | "tone"
  | "additional_instructions"
  | "requested_channels"
>;

// ---- Research -----------------------------------------------

export type ResearchStatus = "pending" | "running" | "complete" | "failed";
export type SourceRetrievalStatus =
  | "pending"
  | "retrieved"
  | "failed"
  | "skipped"
  | "paywall"
  | "empty"
  | "too_large";

export interface ResearchRun {
  id: string;
  content_request_id: string;
  status: ResearchStatus;
  error_message: string | null;
  source_count: number;
  selected_source_count: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContentSource {
  id: string;
  research_run_id: string;
  content_request_id: string;
  url: string;
  title: string | null;
  domain: string | null;
  author: string | null;
  published_at: string | null;
  retrieved_at: string | null;
  content: string | null;
  summary: string | null;
  relevance_score: number | null; // 0-10
  selected: boolean;
  selection_reason: string | null;
  retrieval_status: SourceRetrievalStatus;
  content_hash: string | null;
  word_count: number | null;
  created_at: string;
  updated_at: string;
}

// ---- Content Plan -------------------------------------------

export interface ContentPlan {
  id: string;
  content_request_id: string;
  working_title: string;
  primary_keyword: string;
  secondary_keywords: string[];
  search_intent: string;
  target_audience: string;
  content_goal: string;
  outline: OutlineSection[];
  key_points: string[];
  source_mapping: SourceMapping[];
  recommended_links: RecommendedLink[];
  recommended_image_description: string | null;
  created_at: string;
  updated_at: string;
}

export interface OutlineSection {
  level: "h1" | "h2" | "h3";
  title: string;
  notes: string | null;
  source_ids: string[];
}

export interface SourceMapping {
  source_id: string;
  usage: string; // e.g. "Used for AI recruitment trends"
  sections: string[]; // section titles
}

export interface RecommendedLink {
  url: string;
  anchor_text: string;
  type: "internal" | "external";
}

// ---- Content Drafts -----------------------------------------

export type DraftCreatedBy = "ai" | "human" | "ai_revision";

export interface ContentDraft {
  id: string;
  content_request_id: string;
  content_plan_id: string | null;
  version_number: number;
  parent_version_id: string | null;
  title: string;
  summary: string;
  article: string; // full markdown content
  primary_keyword: string;
  secondary_keywords: string[];
  source_ids: string[];
  key_claims: KeyClaim[];
  word_count: number;
  reading_time_minutes: number;
  change_summary: string | null;
  created_by: DraftCreatedBy;
  created_by_user_id: string | null;
  created_at: string;
}

export interface KeyClaim {
  claim: string;
  source_ids: string[];
  supported: boolean;
  flag: boolean; // true = needs human review
}

// ---- Draft Evaluation ---------------------------------------

export type EvaluationStatus = "PASS" | "REVISE" | "REJECT";

export interface DraftEvaluation {
  id: string;
  draft_id: string;
  content_request_id: string;
  overall_status: EvaluationStatus;
  scores: EvaluationScores;
  unsupported_claims: UnsupportedClaim[];
  weak_sections: WeakSection[];
  recommended_changes: string[];
  summary: string;
  model: string;
  input_tokens: number | null;
  output_tokens: number | null;
  estimated_cost_usd: number | null;
  created_at: string;
}

export interface EvaluationScores {
  topic_relevance: number; // 0-10
  source_grounding: number;
  factual_consistency: number;
  audience_fit: number;
  tone: number;
  seo_fit: number;
  channel_fit: number;
  clarity: number;
  completeness: number;
  overall: number;
}

export interface UnsupportedClaim {
  claim: string;
  location: string; // e.g. "Introduction, paragraph 2"
  recommendation: string;
}

export interface WeakSection {
  section: string;
  issue: string;
  recommendation: string;
}

// ---- Draft Revisions ----------------------------------------

export interface DraftRevision {
  id: string;
  original_draft_id: string;
  revised_draft_id: string;
  content_request_id: string;
  revision_number: number;
  changes_made: string[];
  revision_reason: string;
  model: string;
  input_tokens: number | null;
  output_tokens: number | null;
  estimated_cost_usd: number | null;
  created_at: string;
}

// ---- Human Review -------------------------------------------

export type ReviewDecision = "approved" | "revision_requested" | "rejected";

export interface HumanReview {
  id: string;
  content_request_id: string;
  draft_id: string;
  draft_version: number;
  reviewer_id: string;
  decision: ReviewDecision;
  feedback: string | null;
  revision_instructions: string | null;
  created_at: string;
}

// ---- Approval State -----------------------------------------

export interface ApprovalState {
  content_request_id: string;
  approved_draft_id: string | null;
  approved_version: number | null;
  approved_by: string | null;
  approved_at: string | null;
  is_stale: boolean; // true if a newer draft version exists after approval
  current_draft_version: number | null;
}

// ---- Channel Content ----------------------------------------

export type ChannelValidationStatus = "pending" | "valid" | "invalid" | "revision_needed";

export interface ChannelContent {
  id: string;
  content_request_id: string;
  approved_draft_id: string;
  channel: ContentChannel;
  title: string | null;
  subject_line: string | null; // newsletter
  content: string;
  hashtags: string[];
  cta: string | null;
  word_count: number;
  character_count: number;
  validation_status: ChannelValidationStatus;
  validation_errors: ChannelValidationError[];
  generation_model: string | null;
  revision_count: number;
  created_at: string;
  updated_at: string;
}

export interface ChannelValidationError {
  rule: string;
  message: string;
  severity: "error" | "warning";
}

// ---- Publishing Queue ---------------------------------------

export type PublishingStatus =
  | "READY"
  | "SCHEDULED"
  | "PUBLISHING"
  | "PUBLISHED"
  | "FAILED"
  | "CANCELLED";

export interface PublishingQueueItem {
  id: string;
  content_request_id: string;
  channel_content_id: string;
  channel: ContentChannel;
  approved_draft_id: string;
  approved_version: number;
  idempotency_key: string; // content_id + channel + approved_version
  status: PublishingStatus;
  scheduled_at: string | null;
  published_at: string | null;
  error_message: string | null;
  retry_count: number;
  provider: string; // 'mock' | 'linkedin' | 'twitter' | 'mailchimp'
  provider_post_id: string | null;
  created_at: string;
  updated_at: string;
}

// ---- Audit Log ----------------------------------------------

export type AuditAction =
  | "content_created"
  | "research_started"
  | "research_completed"
  | "research_failed"
  | "source_selected"
  | "source_deselected"
  | "plan_created"
  | "draft_generated"
  | "draft_evaluated"
  | "draft_revised"
  | "review_requested"
  | "review_approved"
  | "review_rejected"
  | "revision_requested"
  | "channel_generated"
  | "scheduled"
  | "published"
  | "publishing_failed"
  | "status_changed"
  | "user_role_changed"
  | "approval_invalidated";

export interface AuditLog {
  id: string;
  actor_id: string | null; // user id or null for system
  actor_email: string | null;
  action: AuditAction;
  entity_type: string; // e.g. 'content_request', 'draft', 'review'
  entity_id: string;
  content_request_id: string | null; // for tracing entire workflow
  metadata: Record<string, unknown>;
  created_at: string;
}

// ---- Workflow Runs ------------------------------------------

export type WorkflowOperation =
  | "research"
  | "planning"
  | "generation"
  | "evaluation"
  | "revision"
  | "channel_adaptation"
  | "publishing";

export interface WorkflowRun {
  id: string;
  content_request_id: string;
  operation: WorkflowOperation;
  status: "running" | "complete" | "failed";
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ---- Failure Events -----------------------------------------

export type FailureType =
  | "RESEARCH_FAILED"
  | "AI_GENERATION_FAILED"
  | "EVALUATION_FAILED"
  | "REVISION_FAILED"
  | "CHANNEL_GENERATION_FAILED"
  | "PUBLISHING_FAILED"
  | "VALIDATION_FAILED"
  | "AUTH_FAILED"
  | "UNKNOWN";

export interface FailureEvent {
  id: string;
  workflow_run_id: string | null;
  content_request_id: string | null;
  operation: string;
  error_type: FailureType;
  message: string;
  stack_trace: string | null;
  retry_count: number;
  max_retries: number;
  is_retryable: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ---- AI Cost Tracking ---------------------------------------

export interface AiUsageRecord {
  id: string;
  content_request_id: string | null;
  operation: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  estimated_cost_usd: number;
  created_at: string;
}

// ---- UI / View Models ---------------------------------------

export interface ContentRequestWithStatus extends ContentRequest {
  draft_count: number;
  latest_evaluation_status: EvaluationStatus | null;
  has_approval: boolean;
  is_approval_stale: boolean;
  latest_review_decision: ReviewDecision | null;
  research_run_id: string | null;
}

export interface DashboardStats {
  drafts: number;
  awaiting_review: number;
  approved: number;
  scheduled: number;
  published: number;
  failed: number;
}
