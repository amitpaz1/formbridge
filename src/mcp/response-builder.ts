/**
 * MCP Response Builder — factory functions for common MCP response patterns.
 * Eliminates duplicated error construction blocks across handlers.
 */

import type { IntakeError } from '../types/intake-contract.js';
import type { MCPSessionStore, MCPSubmissionEntry } from './submission-store.js';
import type { IntakeDefinition } from '../schemas/intake-schema.js';

/**
 * MCP tool response shape
 */
export interface MCPToolResponse {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
  [key: string]: unknown;
}

/**
 * Converts an IntakeError to a plain Record for use as a response object.
 */
export function toRecord(error: IntakeError): Record<string, unknown> {
  return JSON.parse(JSON.stringify(error));
}

/**
 * Build a success MCP response
 */
export function successResponse(data: unknown): MCPToolResponse {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  };
}

/**
 * Build an error MCP response
 */
export function errorResponse(message: string, extra?: Record<string, unknown>): MCPToolResponse {
  return {
    content: [{ type: 'text', text: JSON.stringify({ error: message, ...extra }) }],
    isError: true,
  };
}

/**
 * Build an IntakeError for invalid resume token
 */
export function invalidTokenError(): IntakeError {
  return {
    type: 'invalid',
    message: 'Invalid resume token',
    fields: [{
      field: 'resumeToken',
      message: 'Resume token not found or has expired',
      type: 'invalid',
    }],
    nextActions: [{ type: 'create', description: 'Create a new submission' }],
    timestamp: new Date().toISOString(),
  };
}

/**
 * Build an IntakeError for intake ID mismatch
 */
export function intakeMismatchError(actualIntakeId: string, requestedIntakeId: string): IntakeError {
  return {
    type: 'conflict',
    message: 'Resume token belongs to a different intake form',
    fields: [{
      field: 'resumeToken',
      message: `Token is for intake '${actualIntakeId}', not '${requestedIntakeId}'`,
      type: 'conflict',
    }],
    nextActions: [{ type: 'create', description: 'Create a new submission for this intake form' }],
    timestamp: new Date().toISOString(),
  };
}

/**
 * Look up and validate a submission entry by resume token.
 * Returns the entry or an IntakeError if lookup fails.
 */
export function lookupEntry(
  store: MCPSessionStore,
  resumeToken: string,
  intake: IntakeDefinition
): MCPSubmissionEntry | IntakeError {
  const entry = store.get(resumeToken);
  if (!entry) {
    return invalidTokenError();
  }
  if (entry.intakeId !== intake.id) {
    return intakeMismatchError(entry.intakeId, intake.id);
  }
  return entry;
}

/**
 * Type guard to check if a lookup result is an IntakeError
 */
export function isError(result: MCPSubmissionEntry | IntakeError): result is IntakeError {
  return 'type' in result && 'fields' in result && !('submissionId' in result);
}
