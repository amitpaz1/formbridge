/**
 * Event HTTP Routes
 * Provides HTTP endpoints for retrieving submission event streams
 */

import type { Request, Response, NextFunction } from "express";
import type { SubmissionManager } from "../core/submission-manager";
import { SubmissionNotFoundError } from "../core/submission-manager";
import type { IntakeEvent, IntakeEventType } from "../types/intake-contract";
import { z } from "zod";

/**
 * Valid event types for filtering
 */
const eventTypeEnum = z.enum([
  "submission.created",
  "field.updated",
  "validation.passed",
  "validation.failed",
  "upload.requested",
  "upload.completed",
  "upload.failed",
  "submission.submitted",
  "review.requested",
  "review.approved",
  "review.rejected",
  "delivery.attempted",
  "delivery.succeeded",
  "delivery.failed",
  "submission.finalized",
  "submission.cancelled",
  "submission.expired",
  "handoff.link_issued",
  "handoff.resumed",
]);

/**
 * Query parameter validation schema
 */
const queryParamsSchema = z
  .object({
    type: z
      .string()
      .optional()
      .refine(
        (val) => {
          if (!val) return true;
          const types = val.split(",");
          return types.every((t) => eventTypeEnum.safeParse(t).success);
        },
        {
          message: "Invalid event type",
        }
      ),
    actorKind: z.enum(["agent", "human", "system"]).optional(),
    since: z
      .string()
      .optional()
      .refine(
        (val) => {
          if (!val) return true;
          const date = new Date(val);
          return !isNaN(date.getTime());
        },
        {
          message: "Invalid ISO 8601 timestamp for 'since'",
        }
      ),
    until: z
      .string()
      .optional()
      .refine(
        (val) => {
          if (!val) return true;
          const date = new Date(val);
          return !isNaN(date.getTime());
        },
        {
          message: "Invalid ISO 8601 timestamp for 'until'",
        }
      ),
  })
  .strict();

/**
 * Event filter options parsed from query parameters
 */
interface EventFilterOptions {
  type?: IntakeEventType | IntakeEventType[];
  actorKind?: "agent" | "human" | "system";
  since?: string;
  until?: string;
}

/**
 * Parse and validate query parameters
 * @param query - Express request query object
 * @returns Validation result with parsed filters or error message
 */
function parseQueryParams(
  query: unknown
): { ok: true; filters: EventFilterOptions } | { ok: false; error: string } {
  const result = queryParamsSchema.safeParse(query);
  if (!result.success) {
    return { ok: false, error: result.error.issues[0].message };
  }

  const filters: EventFilterOptions = {};
  const validated = result.data;

  if (validated.type) {
    filters.type = validated.type.includes(",")
      ? (validated.type.split(",") as IntakeEventType[])
      : (validated.type as IntakeEventType);
  }

  if (validated.actorKind) {
    filters.actorKind = validated.actorKind;
  }

  if (validated.since) {
    filters.since = validated.since;
  }

  if (validated.until) {
    filters.until = validated.until;
  }

  return { ok: true, filters };
}

/**
 * Filter events by type
 * Supports single type or comma-separated list
 */
function filterByType(
  events: IntakeEvent[],
  type: IntakeEventType | IntakeEventType[]
): IntakeEvent[] {
  const types = Array.isArray(type) ? type : [type];
  return events.filter((event) => types.includes(event.type));
}

/**
 * Filter events by actor kind
 */
function filterByActorKind(
  events: IntakeEvent[],
  actorKind: "agent" | "human" | "system"
): IntakeEvent[] {
  return events.filter((event) => event.actor.kind === actorKind);
}

/**
 * Filter events by time range
 * @param events - Events to filter
 * @param since - ISO timestamp for start of range (inclusive)
 * @param until - ISO timestamp for end of range (inclusive)
 */
function filterByTimeRange(
  events: IntakeEvent[],
  since?: string,
  until?: string
): IntakeEvent[] {
  let filtered = events;

  if (since) {
    const sinceDate = new Date(since);
    filtered = filtered.filter((event) => new Date(event.ts) >= sinceDate);
  }

  if (until) {
    const untilDate = new Date(until);
    filtered = filtered.filter((event) => new Date(event.ts) <= untilDate);
  }

  return filtered;
}

/**
 * Apply all filters to an event stream
 */
function applyEventFilters(
  events: IntakeEvent[],
  filters: EventFilterOptions
): IntakeEvent[] {
  let filtered = events;

  if (filters.type) {
    filtered = filterByType(filtered, filters.type);
  }

  if (filters.actorKind) {
    filtered = filterByActorKind(filtered, filters.actorKind);
  }

  if (filters.since || filters.until) {
    filtered = filterByTimeRange(filtered, filters.since, filters.until);
  }

  return filtered;
}

/**
 * Create event routes
 * @param manager - SubmissionManager instance for handling submission operations
 */
export function createEventRoutes(manager: SubmissionManager) {
  return {
    /**
     * GET /submissions/:id/events
     * Retrieve the full event stream for a submission
     *
     * Request params:
     *   - id: submission ID
     *
     * Query parameters:
     *   - type: Filter by event type (comma-separated for multiple)
     *   - actorKind: Filter by actor kind (agent, human, system)
     *   - since: Filter by start time (ISO 8601 timestamp)
     *   - until: Filter by end time (ISO 8601 timestamp)
     *
     * Response:
     *   - events: Array of IntakeEvent objects with full audit trail
     */
    async getEvents(req: Request, res: Response, next: NextFunction) {
      try {
        const { id: submissionId } = req.params;

        if (!submissionId) {
          res.status(400).json({
            error: "Missing submission ID",
          });
          return;
        }

        // Fetch submission by ID
        const submission = await manager.getSubmission(submissionId);

        if (!submission) {
          res.status(404).json({
            error: "Submission not found",
          });
          return;
        }

        // Parse and validate query parameters
        const queryResult = parseQueryParams(req.query);
        if (!queryResult.ok) {
          res.status(400).json({
            error: `Invalid query parameters: ${queryResult.error}`,
          });
          return;
        }

        // Apply filters to event stream
        const events = submission.events || [];
        const filteredEvents = applyEventFilters(events, queryResult.filters);

        // Return the filtered event stream
        res.status(200).json({
          submissionId: submission.id,
          events: filteredEvents,
        });
      } catch (error) {
        if (error instanceof SubmissionNotFoundError) {
          res.status(404).json({ error: error.message });
          return;
        }
        next(error);
      }
    },
  };
}

/**
 * Express router factory for event routes
 * @param manager - SubmissionManager instance
 * @returns Object with event route handlers
 */
export function createEventRouter(manager: SubmissionManager) {
  // This would be used with Express like:
  // const router = express.Router();
  // const routes = createEventRoutes(manager);
  // router.get('/submissions/:id/events', routes.getEvents);
  // return router;

  return createEventRoutes(manager);
}
