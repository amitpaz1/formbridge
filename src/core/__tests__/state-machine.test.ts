/**
 * Unit tests for state-machine.ts
 */

import { describe, it, expect } from "vitest";
import {
  assertValidTransition,
  InvalidStateTransitionError,
  VALID_TRANSITIONS,
} from "../state-machine.js";
import type { SubmissionState } from "../../types/intake-contract.js";

describe("State Machine", () => {
  describe("VALID_TRANSITIONS map", () => {
    it("defines transitions for all core states", () => {
      const expectedStates: SubmissionState[] = [
        "draft",
        "in_progress",
        "awaiting_upload",
        "submitted",
        "needs_review",
        "approved",
        "rejected",
        "finalized",
        "cancelled",
        "expired",
      ];
      for (const state of expectedStates) {
        expect(VALID_TRANSITIONS.has(state)).toBe(true);
      }
    });

    it("terminal states have no valid transitions", () => {
      const terminalStates: SubmissionState[] = [
        "rejected",
        "finalized",
        "cancelled",
        "expired",
      ];
      for (const state of terminalStates) {
        const transitions = VALID_TRANSITIONS.get(state);
        expect(transitions?.size).toBe(0);
      }
    });
  });

  describe("assertValidTransition", () => {
    it("allows draft → in_progress", () => {
      expect(() => assertValidTransition("draft", "in_progress")).not.toThrow();
    });

    it("allows draft → submitted", () => {
      expect(() => assertValidTransition("draft", "submitted")).not.toThrow();
    });

    it("allows draft → needs_review", () => {
      expect(() => assertValidTransition("draft", "needs_review")).not.toThrow();
    });

    it("allows draft → awaiting_upload", () => {
      expect(() => assertValidTransition("draft", "awaiting_upload")).not.toThrow();
    });

    it("allows in_progress → submitted", () => {
      expect(() => assertValidTransition("in_progress", "submitted")).not.toThrow();
    });

    it("allows in_progress → needs_review", () => {
      expect(() => assertValidTransition("in_progress", "needs_review")).not.toThrow();
    });

    it("allows in_progress → awaiting_upload", () => {
      expect(() => assertValidTransition("in_progress", "awaiting_upload")).not.toThrow();
    });

    it("allows awaiting_upload → in_progress", () => {
      expect(() => assertValidTransition("awaiting_upload", "in_progress")).not.toThrow();
    });

    it("allows needs_review → approved", () => {
      expect(() => assertValidTransition("needs_review", "approved")).not.toThrow();
    });

    it("allows needs_review → rejected", () => {
      expect(() => assertValidTransition("needs_review", "rejected")).not.toThrow();
    });

    it("allows needs_review → draft (request changes)", () => {
      expect(() => assertValidTransition("needs_review", "draft")).not.toThrow();
    });

    it("allows approved → submitted", () => {
      expect(() => assertValidTransition("approved", "submitted")).not.toThrow();
    });

    it("allows submitted → finalized", () => {
      expect(() => assertValidTransition("submitted", "finalized")).not.toThrow();
    });

    // Invalid transitions
    it("rejects submitted → draft", () => {
      expect(() => assertValidTransition("submitted", "draft")).toThrow(
        InvalidStateTransitionError
      );
    });

    it("rejects finalized → anything", () => {
      expect(() => assertValidTransition("finalized", "draft")).toThrow(
        InvalidStateTransitionError
      );
    });

    it("rejects rejected → anything", () => {
      expect(() => assertValidTransition("rejected", "draft")).toThrow(
        InvalidStateTransitionError
      );
    });

    it("rejects cancelled → anything", () => {
      expect(() => assertValidTransition("cancelled", "draft")).toThrow(
        InvalidStateTransitionError
      );
    });

    it("rejects expired → anything", () => {
      expect(() => assertValidTransition("expired", "in_progress")).toThrow(
        InvalidStateTransitionError
      );
    });

    it("rejects in_progress → approved (must go through needs_review)", () => {
      expect(() => assertValidTransition("in_progress", "approved")).toThrow(
        InvalidStateTransitionError
      );
    });

    it("error contains from and to states", () => {
      try {
        assertValidTransition("finalized", "draft");
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidStateTransitionError);
        const e = error as InvalidStateTransitionError;
        expect(e.from).toBe("finalized");
        expect(e.to).toBe("draft");
        expect(e.message).toContain("finalized");
        expect(e.message).toContain("draft");
      }
    });
  });
});
