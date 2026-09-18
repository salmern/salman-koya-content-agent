import { describe, it, expect } from "vitest";
import {
  AppError,
  AuthError,
  ForbiddenError,
  SeparationOfDutiesError,
  ValidationError,
  NotFoundError,
  WorkflowError,
  StaleApprovalError,
  NotApprovedError,
  DuplicatePublishError,
  RevisionLimitError,
  ResearchError,
  AiError,
  AiOutputError,
  RateLimitError,
  toApiError,
  getStatusCode,
} from "@/lib/errors";

describe("Error classes", () => {
  describe("AppError base", () => {
    it("is an instance of Error", () => {
      const e = new AppError("test", "TEST", 400);
      expect(e).toBeInstanceOf(Error);
    });

    it("sets message, code, statusCode", () => {
      const e = new AppError("something failed", "MY_CODE", 422);
      expect(e.message).toBe("something failed");
      expect(e.code).toBe("MY_CODE");
      expect(e.statusCode).toBe(422);
    });

    it("defaults statusCode to 500", () => {
      const e = new AppError("err", "CODE");
      expect(e.statusCode).toBe(500);
    });
  });

  describe("AuthError", () => {
    it("has 401 status", () => expect(new AuthError().statusCode).toBe(401));
    it("has code AUTH_ERROR", () => expect(new AuthError().code).toBe("AUTH_ERROR"));
  });

  describe("ForbiddenError", () => {
    it("has 403 status", () => expect(new ForbiddenError().statusCode).toBe(403));
  });

  describe("SeparationOfDutiesError", () => {
    it("has 403 status and correct code", () => {
      const e = new SeparationOfDutiesError();
      expect(e.statusCode).toBe(403);
      expect(e.code).toBe("SEPARATION_OF_DUTIES");
      expect(e.message).toMatch(/approve your own/i);
    });
  });

  describe("NotFoundError", () => {
    it("has 404 status", () => expect(new NotFoundError().statusCode).toBe(404));
    it("includes entity name in message", () => {
      expect(new NotFoundError("Draft").message).toMatch(/Draft/);
    });
  });

  describe("StaleApprovalError", () => {
    it("has 409 status", () => expect(new StaleApprovalError().statusCode).toBe(409));
    it("code is STALE_APPROVAL", () => expect(new StaleApprovalError().code).toBe("STALE_APPROVAL"));
    it("message explains the situation", () => {
      expect(new StaleApprovalError().message).toMatch(/stale|newer version/i);
    });
  });

  describe("NotApprovedError", () => {
    it("has 409 status", () => expect(new NotApprovedError().statusCode).toBe(409));
    it("message references human approval", () => {
      expect(new NotApprovedError().message).toMatch(/human approval/i);
    });
  });

  describe("DuplicatePublishError", () => {
    it("includes channel in message", () => {
      const e = new DuplicatePublishError("linkedin");
      expect(e.message).toMatch(/linkedin/i);
      expect(e.statusCode).toBe(409);
    });
  });

  describe("RevisionLimitError", () => {
    it("includes limit count in message", () => {
      const e = new RevisionLimitError(3);
      expect(e.message).toMatch(/3/);
    });
  });

  describe("AiOutputError", () => {
    it("stores raw output", () => {
      const raw = { bad: "json" };
      const e = new AiOutputError("invalid", raw);
      expect(e.rawOutput).toBe(raw);
    });
  });

  describe("RateLimitError", () => {
    it("includes retry time when provided", () => {
      const e = new RateLimitError(30);
      expect(e.message).toMatch(/30 seconds/);
      expect(e.statusCode).toBe(429);
    });
    it("has generic message when no retry time", () => {
      const e = new RateLimitError();
      expect(e.message).toMatch(/try again/i);
    });
  });
});

describe("toApiError", () => {
  it("converts AppError to API format", () => {
    const e = new ForbiddenError("No access");
    const result = toApiError(e);
    expect(result.error.code).toBe("FORBIDDEN");
    expect(result.error.message).toBe("No access");
  });

  it("hides internal Error details", () => {
    const e = new Error("Internal database connection string leaked");
    const result = toApiError(e);
    expect(result.error.code).toBe("INTERNAL_ERROR");
    expect(result.error.message).not.toMatch(/database|connection/i);
  });

  it("handles non-Error values", () => {
    const result = toApiError("a string error");
    expect(result.error.code).toBe("UNKNOWN_ERROR");
  });

  it("handles null", () => {
    const result = toApiError(null);
    expect(result.error.code).toBe("UNKNOWN_ERROR");
  });
});

describe("getStatusCode", () => {
  it("returns AppError statusCode", () => {
    expect(getStatusCode(new NotFoundError())).toBe(404);
    expect(getStatusCode(new ForbiddenError())).toBe(403);
    expect(getStatusCode(new AuthError())).toBe(401);
  });

  it("returns 500 for plain Error", () => {
    expect(getStatusCode(new Error("oops"))).toBe(500);
  });

  it("returns 500 for non-Error values", () => {
    expect(getStatusCode("string error")).toBe(500);
    expect(getStatusCode(null)).toBe(500);
  });
});
