/**
 * Application Error Hierarchy
 *
 * All application errors extend AppError so they can be handled uniformly
 * at the API boundary without leaking internal details to the client.
 */

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly isOperational: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

// ---- Auth Errors --------------------------------------------

export class AuthError extends AppError {
  constructor(message = "Authentication required") {
    super(message, "AUTH_ERROR", 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to perform this action") {
    super(message, "FORBIDDEN", 403);
  }
}

export class SeparationOfDutiesError extends AppError {
  constructor() {
    super(
      "You cannot approve your own content. Another reviewer must approve it.",
      "SEPARATION_OF_DUTIES",
      403
    );
  }
}

// ---- Validation Errors --------------------------------------

export class ValidationError extends AppError {
  constructor(
    message: string,
    public readonly field?: string
  ) {
    super(message, "VALIDATION_ERROR", 400);
  }
}

// ---- Not Found Errors ---------------------------------------

export class NotFoundError extends AppError {
  constructor(entity = "Resource") {
    super(`${entity} not found`, "NOT_FOUND", 404);
  }
}

// ---- Workflow Errors ----------------------------------------

export class WorkflowError extends AppError {
  constructor(message: string) {
    super(message, "WORKFLOW_ERROR", 409);
  }
}

export class StaleApprovalError extends AppError {
  constructor() {
    super(
      "The approval is stale. A newer version of this content exists. Please review and approve the latest version before publishing.",
      "STALE_APPROVAL",
      409
    );
  }
}

export class NotApprovedError extends AppError {
  constructor() {
    super(
      "This content has not been approved for publishing. Human approval is required before any content can be published.",
      "NOT_APPROVED",
      409
    );
  }
}

export class DuplicatePublishError extends AppError {
  constructor(channel: string) {
    super(
      `This exact version of the content has already been published to ${channel}. Duplicate publishing is not allowed.`,
      "DUPLICATE_PUBLISH",
      409
    );
  }
}

export class RevisionLimitError extends AppError {
  constructor(limit: number) {
    super(
      `Automatic revision limit of ${limit} reached. Human review is required.`,
      "REVISION_LIMIT",
      409
    );
  }
}

// ---- Research Errors ----------------------------------------

export class ResearchError extends AppError {
  constructor(
    message: string,
    public readonly url?: string,
    public readonly httpStatus?: number
  ) {
    super(message, "RESEARCH_ERROR", 502);
  }
}

export class InvalidUrlError extends AppError {
  constructor(url: string) {
    super(`The URL "${url}" is not valid or is not accessible.`, "INVALID_URL", 400);
  }
}

// ---- AI Errors ----------------------------------------------

export class AiError extends AppError {
  constructor(
    message: string,
    public readonly operation?: string
  ) {
    super(message, "AI_ERROR", 502);
  }
}

export class AiOutputError extends AppError {
  constructor(
    message: string,
    public readonly rawOutput?: unknown
  ) {
    super(message, "AI_OUTPUT_ERROR", 502);
  }
}

// ---- Rate Limit Errors --------------------------------------

export class RateLimitError extends AppError {
  constructor(retryAfterSeconds?: number) {
    super(
      `Too many requests. ${retryAfterSeconds ? `Please retry after ${retryAfterSeconds} seconds.` : "Please try again later."}`,
      "RATE_LIMIT",
      429
    );
  }
}

// ---- API Response helpers -----------------------------------

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    field?: string;
  };
}

export function toApiError(error: unknown): ApiErrorResponse {
  if (error instanceof AppError) {
    return {
      error: {
        code: error.code,
        message: error.message,
      },
    };
  }

  if (error instanceof Error) {
    // Don't leak internal error details
    return {
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred. Please try again.",
      },
    };
  }

  return {
    error: {
      code: "UNKNOWN_ERROR",
      message: "An unknown error occurred.",
    },
  };
}

export function getStatusCode(error: unknown): number {
  if (error instanceof AppError) return error.statusCode;
  return 500;
}
