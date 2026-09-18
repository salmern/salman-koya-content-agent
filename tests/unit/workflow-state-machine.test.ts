import { describe, it, expect } from "vitest";
import {
  WorkflowStateMachine,
  WorkflowTransitionError,
} from "@/lib/workflow/state-machine";
import type { WorkflowStatus } from "@/types";

describe("WorkflowStateMachine", () => {
  describe("canTransition", () => {
    it("allows DRAFT → RESEARCHING", () => {
      expect(WorkflowStateMachine.canTransition("DRAFT", "RESEARCHING")).toBe(true);
    });

    it("allows RESEARCHING → RESEARCH_COMPLETE", () => {
      expect(WorkflowStateMachine.canTransition("RESEARCHING", "RESEARCH_COMPLETE")).toBe(true);
    });

    it("allows EVALUATING → AWAITING_REVIEW", () => {
      expect(WorkflowStateMachine.canTransition("EVALUATING", "AWAITING_REVIEW")).toBe(true);
    });

    it("allows AWAITING_REVIEW → APPROVED", () => {
      expect(WorkflowStateMachine.canTransition("AWAITING_REVIEW", "APPROVED")).toBe(true);
    });

    it("allows AWAITING_REVIEW → REJECTED", () => {
      expect(WorkflowStateMachine.canTransition("AWAITING_REVIEW", "REJECTED")).toBe(true);
    });

    it("blocks DRAFT → APPROVED (invalid skip)", () => {
      expect(WorkflowStateMachine.canTransition("DRAFT", "APPROVED")).toBe(false);
    });

    it("blocks PUBLISHED → DRAFT (published is terminal)", () => {
      expect(WorkflowStateMachine.canTransition("PUBLISHED", "DRAFT")).toBe(false);
    });

    it("blocks REJECTED → PUBLISHED (rejected is terminal)", () => {
      expect(WorkflowStateMachine.canTransition("REJECTED", "PUBLISHED")).toBe(false);
    });

    it("blocks APPROVED → PUBLISHING (must go through CHANNEL_ADAPTATION first)", () => {
      expect(WorkflowStateMachine.canTransition("APPROVED", "PUBLISHING")).toBe(false);
    });

    it("blocks DRAFT → PUBLISHED (cannot skip all steps)", () => {
      expect(WorkflowStateMachine.canTransition("DRAFT", "PUBLISHED")).toBe(false);
    });
  });

  describe("assertTransition", () => {
    it("does not throw on valid transition", () => {
      expect(() =>
        WorkflowStateMachine.assertTransition("DRAFT", "RESEARCHING")
      ).not.toThrow();
    });

    it("throws WorkflowTransitionError on invalid transition", () => {
      expect(() =>
        WorkflowStateMachine.assertTransition("DRAFT", "APPROVED")
      ).toThrow(WorkflowTransitionError);
    });

    it("error message includes both states", () => {
      try {
        WorkflowStateMachine.assertTransition("PUBLISHED", "DRAFT");
      } catch (e) {
        expect(e).toBeInstanceOf(WorkflowTransitionError);
        expect((e as WorkflowTransitionError).message).toContain("PUBLISHED");
        expect((e as WorkflowTransitionError).message).toContain("DRAFT");
      }
    });
  });

  describe("isTerminal", () => {
    it("PUBLISHED is terminal", () => {
      expect(WorkflowStateMachine.isTerminal("PUBLISHED")).toBe(true);
    });

    it("REJECTED is terminal", () => {
      expect(WorkflowStateMachine.isTerminal("REJECTED")).toBe(true);
    });

    it("DRAFT is not terminal", () => {
      expect(WorkflowStateMachine.isTerminal("DRAFT")).toBe(false);
    });

    it("AWAITING_REVIEW is not terminal", () => {
      expect(WorkflowStateMachine.isTerminal("AWAITING_REVIEW")).toBe(false);
    });
  });

  describe("validNextStates", () => {
    it("returns correct next states for AWAITING_REVIEW", () => {
      const next = WorkflowStateMachine.validNextStates("AWAITING_REVIEW");
      expect(next).toContain("APPROVED");
      expect(next).toContain("REJECTED");
      expect(next).toContain("REVISION_REQUESTED");
    });

    it("returns empty array for PUBLISHED", () => {
      expect(WorkflowStateMachine.validNextStates("PUBLISHED")).toHaveLength(0);
    });
  });
});
