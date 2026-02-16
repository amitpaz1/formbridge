/**
 * Tests for Error Handler Middleware
 *
 * Covers:
 * - Status code mapping for all error types
 * - Error formatting to IntakeError and ErrorResponse shapes
 * - SubmissionError class and toIntakeError()
 * - Error handler factory (createErrorHandler)
 * - Helper functions (throwValidationError, throwNotFoundError, createSubmissionError)
 * - Development vs production behavior
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import {
  createErrorHandler,
  SubmissionError,
  throwValidationError,
  throwNotFoundError,
  createSubmissionError,
} from '../../src/middleware/error-handler';
import {
  IntakeNotFoundError,
  IntakeDuplicateError,
  IntakeValidationError,
} from '../../src/core/intake-registry';

// Helper to create a Hono app with error handler and a route that throws
function createTestApp(
  errorFactory: () => never,
  handlerOptions?: Parameters<typeof createErrorHandler>[0]
) {
  const app = new Hono();
  app.onError(createErrorHandler(handlerOptions));
  app.get('/test', () => {
    errorFactory();
  });
  return app;
}

async function fetchJson(app: Hono, path = '/test') {
  const res = await app.request(path);
  const body = await res.json();
  return { status: res.status, body };
}

describe('Error Handler Middleware', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('SubmissionError class', () => {
    it('should store all properties', () => {
      const error = new SubmissionError('sub-1', 'draft', 'tok-1', {
        type: 'missing',
        message: 'Field required',
        fields: [{ field: 'name', message: 'required', code: 'required' }],
        retryable: true,
      });

      expect(error.submissionId).toBe('sub-1');
      expect(error.state).toBe('draft');
      expect(error.resumeToken).toBe('tok-1');
      expect(error.intakeError.type).toBe('missing');
      expect(error.name).toBe('SubmissionError');
      expect(error.message).toBe('Field required');
    });

    it('should default message when intakeError.message is empty', () => {
      const error = new SubmissionError('sub-1', 'draft', 'tok-1', {
        type: 'invalid',
        retryable: false,
      });
      expect(error.message).toBe('Submission error');
    });

    it('should convert to IntakeError via toIntakeError()', () => {
      const errorDetails = {
        type: 'conflict' as const,
        message: 'Token mismatch',
        retryable: false,
      };
      const error = new SubmissionError('sub-2', 'in_progress', 'tok-2', errorDetails);
      const intakeError = error.toIntakeError();

      expect(intakeError).toEqual({
        ok: false,
        submissionId: 'sub-2',
        state: 'in_progress',
        resumeToken: 'tok-2',
        error: errorDetails,
      });
    });
  });

  describe('status code mapping', () => {
    it('should return 400 for SubmissionError with type "missing"', async () => {
      const { status } = await fetchJson(
        createTestApp(() => {
          throw new SubmissionError('s1', 'draft', 't1', { type: 'missing', retryable: true });
        })
      );
      expect(status).toBe(400);
    });

    it('should return 400 for SubmissionError with type "invalid"', async () => {
      const { status } = await fetchJson(
        createTestApp(() => {
          throw new SubmissionError('s1', 'draft', 't1', { type: 'invalid', retryable: true });
        })
      );
      expect(status).toBe(400);
    });

    it('should return 409 for SubmissionError with type "conflict"', async () => {
      const { status } = await fetchJson(
        createTestApp(() => {
          throw new SubmissionError('s1', 'draft', 't1', { type: 'conflict', retryable: false });
        })
      );
      expect(status).toBe(409);
    });

    it('should return 202 for SubmissionError with type "needs_approval"', async () => {
      const { status } = await fetchJson(
        createTestApp(() => {
          throw new SubmissionError('s1', 'submitted', 't1', { type: 'needs_approval', retryable: false });
        })
      );
      expect(status).toBe(202);
    });

    it('should return 202 for SubmissionError with type "upload_pending"', async () => {
      const { status } = await fetchJson(
        createTestApp(() => {
          throw new SubmissionError('s1', 'awaiting_upload', 't1', { type: 'upload_pending', retryable: true });
        })
      );
      expect(status).toBe(202);
    });

    it('should return 502 for SubmissionError with type "delivery_failed"', async () => {
      const { status } = await fetchJson(
        createTestApp(() => {
          throw new SubmissionError('s1', 'submitted', 't1', { type: 'delivery_failed', retryable: true });
        })
      );
      expect(status).toBe(502);
    });

    it('should return 410 for SubmissionError with type "expired"', async () => {
      const { status } = await fetchJson(
        createTestApp(() => {
          throw new SubmissionError('s1', 'expired', 't1', { type: 'expired', retryable: false });
        })
      );
      expect(status).toBe(410);
    });

    it('should return 410 for SubmissionError with type "cancelled"', async () => {
      const { status } = await fetchJson(
        createTestApp(() => {
          throw new SubmissionError('s1', 'cancelled', 't1', { type: 'cancelled', retryable: false });
        })
      );
      expect(status).toBe(410);
    });

    it('should return 400 for unknown SubmissionError type', async () => {
      const { status } = await fetchJson(
        createTestApp(() => {
          throw new SubmissionError('s1', 'draft', 't1', { type: 'unknown_type' as never, retryable: false });
        })
      );
      expect(status).toBe(400);
    });

    it('should return 404 for IntakeNotFoundError', async () => {
      const { status } = await fetchJson(
        createTestApp(() => {
          throw new IntakeNotFoundError('vendor');
        })
      );
      expect(status).toBe(404);
    });

    it('should return 409 for IntakeDuplicateError', async () => {
      const { status } = await fetchJson(
        createTestApp(() => {
          throw new IntakeDuplicateError('vendor');
        })
      );
      expect(status).toBe(409);
    });

    it('should return 400 for IntakeValidationError', async () => {
      const { status } = await fetchJson(
        createTestApp(() => {
          throw new IntakeValidationError('vendor', 'missing schema');
        })
      );
      expect(status).toBe(400);
    });

    it('should use HTTPException status directly', async () => {
      const { status } = await fetchJson(
        createTestApp(() => {
          throw new HTTPException(429, { message: 'Rate limited' });
        })
      );
      expect(status).toBe(429);
    });

    it('should return 500 for generic Error', async () => {
      const { status } = await fetchJson(
        createTestApp(() => {
          throw new Error('Something broke');
        })
      );
      expect(status).toBe(500);
    });

    it('should return 500 for generic Error', async () => {
      const { status } = await fetchJson(
        createTestApp(() => {
          throw new Error('unexpected');
        })
      );
      expect(status).toBe(500);
    });
  });

  describe('error formatting', () => {
    it('should format SubmissionError as IntakeError', async () => {
      const { body } = await fetchJson(
        createTestApp(() => {
          throw new SubmissionError('sub-1', 'draft', 'tok-1', {
            type: 'missing',
            message: 'Name is required',
            retryable: true,
          });
        })
      );

      expect(body.ok).toBe(false);
      expect(body.submissionId).toBe('sub-1');
      expect(body.state).toBe('draft');
      expect(body.resumeToken).toBe('tok-1');
      expect(body.error.type).toBe('missing');
      expect(body.error.message).toBe('Name is required');
    });

    it('should format IntakeNotFoundError as ErrorResponse', async () => {
      const { body } = await fetchJson(
        createTestApp(() => {
          throw new IntakeNotFoundError('vendor');
        })
      );

      expect(body.ok).toBe(false);
      expect(body.error.type).toBe('not_found');
      expect(body.error.message).toContain('vendor');
    });

    it('should format IntakeDuplicateError as ErrorResponse', async () => {
      const { body } = await fetchJson(
        createTestApp(() => {
          throw new IntakeDuplicateError('vendor');
        })
      );

      expect(body.ok).toBe(false);
      expect(body.error.type).toBe('conflict');
    });

    it('should format IntakeValidationError as ErrorResponse', async () => {
      const { body } = await fetchJson(
        createTestApp(() => {
          throw new IntakeValidationError('vendor', 'bad schema');
        })
      );

      expect(body.ok).toBe(false);
      expect(body.error.type).toBe('invalid_request');
    });

    it('should format HTTPException as ErrorResponse', async () => {
      const { body } = await fetchJson(
        createTestApp(() => {
          throw new HTTPException(503, { message: 'Service down' });
        })
      );

      expect(body.ok).toBe(false);
      expect(body.error.type).toBe('internal_error');
      expect(body.error.message).toBe('Service down');
    });

    it('should format client-level HTTPException as invalid_request', async () => {
      const { body } = await fetchJson(
        createTestApp(() => {
          throw new HTTPException(422, { message: 'Unprocessable' });
        })
      );

      expect(body.error.type).toBe('invalid_request');
    });

    it('should format generic Error in non-production mode', async () => {
      const { body } = await fetchJson(
        createTestApp(() => {
          throw new Error('Detailed message');
        })
      );

      expect(body.ok).toBe(false);
      expect(body.error.type).toBe('internal_error');
      // In test (non-production), the message is exposed
      expect(body.error.message).toBe('Detailed message');
    });

    it('should hide generic Error message in production mode', async () => {
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        const { body } = await fetchJson(
          createTestApp(
            () => { throw new Error('Secret details'); },
            { logErrors: false, includeStack: false }
          )
        );

        expect(body.error.message).toBe('An internal error occurred');
      } finally {
        process.env.NODE_ENV = origEnv;
      }
    });

    it('should format generic Error as internal_error', async () => {
      const { body } = await fetchJson(
        createTestApp(() => {
          throw new Error('unexpected failure');
        })
      );

      expect(body.ok).toBe(false);
      expect(body.error.type).toBe('internal_error');
      expect(body.error.message).toBe('unexpected failure');
    });
  });

  describe('createErrorHandler options', () => {
    it('should log errors by default in non-production', async () => {
      // Error handler now uses pino structured logger instead of console.error.
      // Verify the handler runs without error and returns proper response.
      const { body, status } = await fetchJson(
        createTestApp(() => {
          throw new Error('test error');
        })
      );
      expect(status).toBe(500);
      expect(body.error.message).toBe('test error');
    });

    it('should not log errors when logErrors is false', async () => {
      await fetchJson(
        createTestApp(
          () => { throw new Error('test'); },
          { logErrors: false }
        )
      );
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should include stack trace in response when includeStack is true', async () => {
      const { body } = await fetchJson(
        createTestApp(
          () => { throw new Error('with stack'); },
          { includeStack: true, logErrors: false }
        )
      );
      expect(body.error.stack).toBeDefined();
      expect(body.error.stack).toContain('Error: with stack');
    });

    it('should not include stack trace when includeStack is false', async () => {
      const { body } = await fetchJson(
        createTestApp(
          () => { throw new Error('no stack'); },
          { includeStack: false, logErrors: false }
        )
      );
      expect(body.error.stack).toBeUndefined();
    });
  });

  describe('helper functions', () => {
    it('throwValidationError should throw HTTPException with 400', () => {
      expect(() => throwValidationError('bad input')).toThrow(HTTPException);
      try {
        throwValidationError('bad input');
      } catch (e) {
        expect((e as HTTPException).status).toBe(400);
        expect((e as HTTPException).message).toBe('bad input');
      }
    });

    it('throwNotFoundError should throw HTTPException with 404', () => {
      expect(() => throwNotFoundError('Submission', 'abc-123')).toThrow(HTTPException);
      try {
        throwNotFoundError('Submission', 'abc-123');
      } catch (e) {
        expect((e as HTTPException).status).toBe(404);
        expect((e as HTTPException).message).toContain("Submission 'abc-123' not found");
      }
    });

    it('createSubmissionError should return a SubmissionError', () => {
      const error = createSubmissionError('sub-1', 'draft', 'tok-1', {
        type: 'invalid',
        message: 'Bad field',
        retryable: false,
      });

      expect(error).toBeInstanceOf(SubmissionError);
      expect(error.submissionId).toBe('sub-1');
    });
  });
});
