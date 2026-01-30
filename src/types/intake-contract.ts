/**
 * FormBridge Intake Contract - TypeScript Type Definitions
 * Based on INTAKE_CONTRACT_SPEC.md v0.1.0-draft
 */

/**
 * Actor identity for all operations
 * Recorded on every event for audit purposes
 */
export interface Actor {
  kind: "agent" | "human" | "system";
  id: string;
  name?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Submission lifecycle states
 */
export type SubmissionState =
  | "draft"
  | "in_progress"
  | "awaiting_input"
  | "awaiting_upload"
  | "submitted"
  | "needs_review"
  | "approved"
  | "rejected"
  | "finalized"
  | "cancelled"
  | "expired";

/**
 * Error types for intake validation and processing
 */
export type IntakeErrorType =
  | "missing"
  | "invalid"
  | "conflict"
  | "needs_approval"
  | "upload_pending"
  | "delivery_failed"
  | "expired"
  | "cancelled";

/**
 * Field-level error details
 */
export interface FieldError {
  field: string;
  message: string;
  type: IntakeErrorType;
  constraint?: string;
  value?: unknown;
}

/**
 * Action types for next steps
 */
export type NextActionType =
  | "provide_missing_fields"
  | "correct_invalid_fields"
  | "fix_email_format"
  | "meet_minimum_requirements"
  | "fix_validation_errors"
  | "wait_for_review"
  | "collect_field"
  | "request_upload"
  | "retry_delivery"
  | "cancel";

/**
 * Next action guidance for agent loops
 */
export interface NextAction {
  type: NextActionType;
  description?: string;
  field?: string;
  fields?: string[];
  hint?: string;
  accept?: string[];
  maxBytes?: number;
  params?: Record<string, unknown>;
}

/**
 * Validation error response (used internally by error mappers)
 */
export interface ValidationErrorResponse {
  type: IntakeErrorType;
  message?: string;
  fields?: FieldError[];
  nextActions?: NextAction[];
  resumeToken?: string;
  idempotencyKey?: string;
  timestamp?: string;
}

/**
 * Structured error response envelope
 */
export interface IntakeError {
  ok: false;
  submissionId: string;
  state: SubmissionState;
  resumeToken: string;
  error: {
    type: IntakeErrorType;
    message?: string;
    fields?: FieldError[];
    nextActions?: NextAction[];
    retryable: boolean;
    retryAfterMs?: number;
  };
}

/**
 * Event types for the intake event stream
 */
export type IntakeEventType =
  | "submission.created"
  | "field.updated"
  | "validation.passed"
  | "validation.failed"
  | "upload.requested"
  | "upload.completed"
  | "upload.failed"
  | "submission.submitted"
  | "review.requested"
  | "review.approved"
  | "review.rejected"
  | "delivery.attempted"
  | "delivery.succeeded"
  | "delivery.failed"
  | "submission.finalized"
  | "submission.cancelled"
  | "submission.expired"
  | "handoff.link_issued"
  | "handoff.resumed";

/**
 * Typed event for audit trail
 */
export interface IntakeEvent {
  eventId: string;
  type: IntakeEventType;
  submissionId: string;
  ts: string;
  actor: Actor;
  state: SubmissionState;
  payload?: Record<string, unknown>;
}

/**
 * Approval gate configuration
 */
export interface ApprovalGate {
  name: string;
  reviewers: unknown;
  requiredApprovals?: number;
  autoApproveIf?: unknown;
  escalateAfterMs?: number;
}

/**
 * Destination for finalized submissions
 */
export interface Destination {
  kind: "webhook" | "callback" | "queue";
  url?: string;
  headers?: Record<string, string>;
  retryPolicy?: unknown;
}

/**
 * Intake definition - the template for data collection
 */
export interface IntakeDefinition {
  id: string;
  version: string;
  name: string;
  description?: string;
  schema: unknown;
  approvalGates?: ApprovalGate[];
  ttlMs?: number;
  destination: Destination;
  uiHints?: {
    steps?: unknown[];
    fieldHints?: Record<string, unknown>;
  };
}

/**
 * Create submission request
 */
export interface CreateSubmissionRequest {
  intakeId: string;
  idempotencyKey?: string;
  actor: Actor;
  initialFields?: Record<string, unknown>;
  ttlMs?: number;
}

/**
 * Create submission response
 */
export interface CreateSubmissionResponse {
  ok: true;
  submissionId: string;
  state: "draft" | "in_progress" | "submitted";
  resumeToken: string;
  schema: unknown;
  missingFields?: string[];
}

/**
 * Set fields request
 */
export interface SetFieldsRequest {
  submissionId: string;
  resumeToken: string;
  actor: Actor;
  fields: Record<string, unknown>;
}

/**
 * Submit request
 */
export interface SubmitRequest {
  submissionId: string;
  resumeToken: string;
  idempotencyKey: string;
  actor: Actor;
}

/**
 * Review request
 */
export interface ReviewRequest {
  submissionId: string;
  decision: "approved" | "rejected";
  reasons?: string[];
  actor: Actor;
}

/**
 * Cancel request
 */
export interface CancelRequest {
  submissionId: string;
  reason?: string;
  actor: Actor;
}
