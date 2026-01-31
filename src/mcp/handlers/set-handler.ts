/**
 * MCP Set Handler — updates field values in a submission.
 */

import type { IntakeDefinition } from '../../schemas/intake-schema.js';
import type { SubmissionResponse, SubmissionSuccess } from '../../types/intake-contract.js';
import { SubmissionState } from '../../types/intake-contract.js';
import { validatePartialSubmission } from '../../validation/validator.js';
import { mapToIntakeError } from '../../validation/error-mapper.js';
import type { SubmissionStore } from '../submission-store.js';
import { lookupEntry, isError } from '../response-builder.js';

export async function handleSet(
  intake: IntakeDefinition,
  args: Record<string, unknown>,
  store: SubmissionStore
): Promise<SubmissionResponse> {
  const { resumeToken, data } = args as {
    resumeToken: string;
    data: Record<string, unknown>;
  };

  const result = lookupEntry(store, resumeToken, intake);
  if (isError(result)) return result;
  const entry = result;

  // Merge new data with existing data
  const mergedData = { ...entry.data, ...data };

  // Validate merged data (partial validation)
  const validationResult = validatePartialSubmission(intake.schema, mergedData);
  if (!validationResult.success) {
    return mapToIntakeError(validationResult.error, { resumeToken, includeTimestamp: true });
  }

  // Update submission
  const updated = store.update(resumeToken, {
    data: mergedData,
    state: SubmissionState.VALIDATING,
  });

  return {
    state: updated!.state,
    submissionId: updated!.submissionId,
    message: 'Submission updated successfully',
    resumeToken,
  } as SubmissionSuccess & { resumeToken: string };
}
