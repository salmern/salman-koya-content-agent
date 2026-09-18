// @ts-nocheck
/**
 * Audit Log Service
 *
 * Every important workflow action must be auditable.
 * Audit logs are immutable — inserts only, never updates or deletes.
 * Uses the service role client to ensure logs are always written,
 * even when the user's RLS session cannot write.
 */

import type { AuditAction } from "@/types";

export interface AuditEntry {
  actor_id: string | null;
  actor_email: string | null;
  action: AuditAction;
  entity_type: string;
  entity_id: string;
  content_request_id?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Record an audit log entry.
 * Uses the admin client (service role) so logs cannot be blocked by RLS.
 * Never throws — a logging failure should never crash the main operation.
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    // Dynamic import to avoid bundling the admin client
    const { createSupabaseAdminClient } = await import("@/lib/db/client");
    const admin = createSupabaseAdminClient();

    await admin.from("audit_logs").insert({
      actor_id: entry.actor_id,
      actor_email: entry.actor_email,
      action: entry.action,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id,
      content_request_id: entry.content_request_id ?? null,
      metadata: entry.metadata ?? {},
    });
  } catch (error) {
    // Log the error to stderr but don't propagate
    console.error("[AuditLog] Failed to write audit entry:", error);
  }
}

/**
 * Record a failure event.
 * Always server-side.
 */
export async function recordFailure(params: {
  workflowRunId?: string | null;
  contentRequestId?: string | null;
  operation: string;
  errorType: string;
  message: string;
  stackTrace?: string | null;
  retryCount?: number;
  maxRetries?: number;
  isRetryable?: boolean;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const { createSupabaseAdminClient } = await import("@/lib/db/client");
    const admin = createSupabaseAdminClient();

    await admin.from("failure_events").insert({
      workflow_run_id: params.workflowRunId ?? null,
      content_request_id: params.contentRequestId ?? null,
      operation: params.operation,
      error_type: params.errorType,
      message: params.message,
      stack_trace: params.stackTrace ?? null,
      retry_count: params.retryCount ?? 0,
      max_retries: params.maxRetries ?? 3,
      is_retryable: params.isRetryable ?? true,
      metadata: params.metadata ?? {},
    });
  } catch (error) {
    console.error("[FailureEvent] Failed to record failure event:", error);
  }
}

/**
 * Record AI usage for cost tracking.
 */
export async function recordAiUsage(params: {
  contentRequestId?: string | null;
  operation: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
}): Promise<void> {
  try {
    const { createSupabaseAdminClient } = await import("@/lib/db/client");
    const admin = createSupabaseAdminClient();

    await admin.from("ai_usage").insert({
      content_request_id: params.contentRequestId ?? null,
      operation: params.operation,
      model: params.model,
      input_tokens: params.inputTokens,
      output_tokens: params.outputTokens,
      estimated_cost_usd: params.estimatedCostUsd,
    });
  } catch (error) {
    console.error("[AiUsage] Failed to record AI usage:", error);
  }
}
