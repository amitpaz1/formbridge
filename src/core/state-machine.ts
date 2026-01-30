/**
 * State Machine - Submission state transition validation
 *
 * Defines valid state transitions for the submission lifecycle
 * and provides a guard function to enforce them.
 */

import type { SubmissionState } from "../types/intake-contract.js";

/**
 * Error thrown when an invalid state transition is attempted
 */
export class InvalidStateTransitionError extends Error {
  public readonly from: SubmissionState;
  public readonly to: SubmissionState;

  constructor(from: SubmissionState, to: SubmissionState) {
    super(
      `Invalid state transition: '${from}' → '${to}'`
    );
    this.name = "InvalidStateTransitionError";
    this.from = from;
    this.to = to;
  }
}

/**
 * Valid state transitions for the submission lifecycle.
 *
 * State diagram:
 *
 *   draft ─────────────► in_progress
 *     │                    │  ▲
 *     │                    │  │
 *     │                    ▼  │
 *     │              awaiting_upload
 *     │                    │
 *     ▼                    ▼
 *   submitted ◄──────── in_progress
 *     │                    │
 *     │                    ▼
 *     │              needs_review
 *     │               │  │  │
 *     │               ▼  ▼  ▼
 *     │         approved rejected draft
 *     │            │
 *     │            ▼
 *     │        submitted
 *     ▼
 *   finalized
 *
 * Terminal states: finalized, cancelled, expired, rejected
 */
export const VALID_TRANSITIONS: ReadonlyMap<
  SubmissionState,
  ReadonlySet<SubmissionState>
> = new Map([
  ["draft", new Set<SubmissionState>(["in_progress", "awaiting_upload", "submitted", "needs_review", "cancelled", "expired"])],
  ["in_progress", new Set<SubmissionState>(["awaiting_upload", "submitted", "needs_review", "cancelled", "expired"])],
  ["awaiting_upload", new Set<SubmissionState>(["in_progress", "cancelled", "expired"])],
  ["submitted", new Set<SubmissionState>(["finalized", "cancelled"])],
  ["needs_review", new Set<SubmissionState>(["approved", "rejected", "draft"])],
  ["approved", new Set<SubmissionState>(["submitted", "finalized"])],
  ["rejected", new Set<SubmissionState>()],
  ["finalized", new Set<SubmissionState>()],
  ["cancelled", new Set<SubmissionState>()],
  ["expired", new Set<SubmissionState>()],
]);

/**
 * Assert that a state transition is valid.
 *
 * @param from - Current state
 * @param to - Desired next state
 * @throws {InvalidStateTransitionError} If the transition is not allowed
 */
export function assertValidTransition(
  from: SubmissionState,
  to: SubmissionState
): void {
  const validTargets = VALID_TRANSITIONS.get(from);
  if (!validTargets || !validTargets.has(to)) {
    throw new InvalidStateTransitionError(from, to);
  }
}
