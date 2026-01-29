/**
 * Submission HTTP Routes
 * Provides HTTP endpoints for submission operations including agent-to-human handoff
 */

import type { Request, Response, NextFunction } from "express";
import type { SubmissionManager } from "../core/submission-manager";
import type { Actor } from "../types/intake-contract";

/**
 * Create submission routes
 * @param manager - SubmissionManager instance for handling submission operations
 */
export function createSubmissionRoutes(manager: SubmissionManager) {
  return {
    /**
     * POST /submissions/:id/handoff
     * Generate a resume URL for agent-to-human handoff
     *
     * Request params:
     *   - id: submission ID
     *
     * Request body (optional):
     *   - actor: Actor object (defaults to system actor if not provided)
     *
     * Response:
     *   - resumeUrl: The shareable URL for human to continue the form
     *   - submissionId: The submission ID
     *   - resumeToken: The resume token (for reference)
     */
    async generateHandoff(req: Request, res: Response, next: NextFunction) {
      try {
        const { id: submissionId } = req.params;

        if (!submissionId) {
          res.status(400).json({
            error: "Missing submission ID",
          });
          return;
        }

        // Extract actor from request body or use system actor as default
        const actor: Actor = req.body?.actor || {
          kind: "system",
          id: "system",
          name: "System",
        };

        // Generate the handoff URL
        const resumeUrl = await manager.generateHandoffUrl(submissionId, actor);

        // Get the submission to include additional details
        const submission = await manager.getSubmission(submissionId);

        if (!submission) {
          res.status(404).json({
            error: "Submission not found",
          });
          return;
        }

        res.status(200).json({
          resumeUrl,
          submissionId: submission.id,
          resumeToken: submission.resumeToken,
        });
      } catch (error) {
        // Handle submission not found errors
        if (error instanceof Error && error.message.includes("not found")) {
          res.status(404).json({
            error: error.message,
          });
          return;
        }

        // Pass other errors to error handler
        next(error);
      }
    },

    /**
     * GET /submissions/resume/:resumeToken
     * Fetch submission data by resume token for agent-to-human handoff
     *
     * Used by frontend ResumeFormPage to load pre-filled form data
     */
    async getByResumeToken(req: Request, res: Response, next: NextFunction) {
      try {
        const { resumeToken } = req.params;

        if (!resumeToken) {
          res.status(400).json({
            error: "Missing resume token",
          });
          return;
        }

        // Fetch submission by resume token (method already exists)
        const submission = await manager.getSubmissionByResumeToken(resumeToken);

        if (!submission) {
          res.status(404).json({
            error: "Submission not found. The resume link may be invalid or expired.",
          });
          return;
        }

        // Check if submission is expired
        if (submission.expiresAt && new Date(submission.expiresAt) < new Date()) {
          res.status(403).json({
            error: "This resume link has expired.",
          });
          return;
        }

        // Return submission with fields and field attribution
        res.status(200).json(submission);
      } catch (error) {
        next(error);
      }
    },

    /**
     * POST /submissions/resume/:resumeToken/resumed
     * Emit HANDOFF_RESUMED event when human opens the resume form
     *
     * Allows agent to be notified when human starts completing the form
     */
    async emitResumed(req: Request, res: Response, next: NextFunction) {
      try {
        const { resumeToken } = req.params;

        if (!resumeToken) {
          res.status(400).json({
            error: "Missing resume token",
          });
          return;
        }

        // Extract actor from request body or use default human actor
        const actor: Actor = req.body?.actor || {
          kind: "human",
          id: "human-unknown",
          name: "Human User",
        };

        // Emit handoff.resumed event via manager
        const eventId = await manager.emitHandoffResumed(resumeToken, actor);

        res.status(200).json({
          ok: true,
          eventId,
        });
      } catch (error) {
        // Handle submission not found or expired errors
        if (error instanceof Error) {
          if (error.message.includes("not found")) {
            res.status(404).json({
              error: error.message,
            });
            return;
          }
          if (error.message.includes("expired")) {
            res.status(403).json({
              error: error.message,
            });
            return;
          }
        }

        // Pass other errors to error handler
        next(error);
      }
    },
  };
}

/**
 * Express router factory for submission routes
 * @param manager - SubmissionManager instance
 * @returns Express Router with submission endpoints
 */
export function createSubmissionRouter(manager: SubmissionManager) {
  // This would be used with Express like:
  // const router = express.Router();
  // const routes = createSubmissionRoutes(manager);
  // router.post('/submissions/:id/handoff', routes.generateHandoff);
  // return router;

  return createSubmissionRoutes(manager);
}
