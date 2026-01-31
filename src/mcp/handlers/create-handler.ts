/**
 * MCP Create Handler — creates a new submission session.
 */

import type { IntakeDefinition } from '../../schemas/intake-schema.js';
import type { SubmissionResponse, SubmissionSuccess } from '../../types/intake-contract.js';
import { validatePartialSubmission } from '../../validation/validator.js';
import { mapToIntakeError } from '../../validation/error-mapper.js';
import type { SubmissionStore } from '../submission-store.js';

export async function handleCreate(
  intake: IntakeDefinition,
  args: Record<string, unknown>,
  store: SubmissionStore
): Promise<SubmissionResponse> {
  const { data = {}, idempotencyKey } = args as {
    data?: Record<string, unknown>;
    idempotencyKey?: string;
  };

  // Check for existing submission with same idempotency key
  if (idempotencyKey) {
    const existing = store.getByIdempotencyKey(idempotencyKey);
    if (existing) {
      return {
        state: existing.state,
        submissionId: existing.submissionId,
        message: 'Submission already exists (idempotent)',
        resumeToken: existing.resumeToken,
      } as SubmissionSuccess & { resumeToken: string };
    }
  }

  // Validate initial data if provided (partial validation)
  if (Object.keys(data).length > 0) {
    const validationResult = validatePartialSubmission(intake.schema, data);
    if (!validationResult.success) {
      return mapToIntakeError(validationResult.error, { includeTimestamp: true });
    }
  }

  // Create new submission entry
  const entry = store.create(intake.id, data, idempotencyKey);

  return {
    state: entry.state,
    submissionId: entry.submissionId,
    message: 'Submission created successfully',
    resumeToken: entry.resumeToken,
  } as SubmissionSuccess & { resumeToken: string };
}
