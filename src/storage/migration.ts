/**
 * Storage Migration Utility
 *
 * Migrates data between storage backends (e.g., MemoryStorage → SqliteStorage).
 * Supports dry-run mode to preview what would be migrated.
 */

import type { FormBridgeStorage, SubmissionFilter } from "./storage-interface.js";

export interface MigrationResult {
  submissionsMigrated: number;
  eventsMigrated: number;
  errors: Array<{ entity: string; id: string; error: string }>;
  dryRun: boolean;
}

export interface MigrationOptions {
  /** If true, preview migration without writing */
  dryRun?: boolean;
  /** Only migrate submissions matching this filter */
  filter?: SubmissionFilter;
  /** Batch size for pagination */
  batchSize?: number;
}

/**
 * Migrate data from source to target storage.
 */
export async function migrateStorage(
  source: FormBridgeStorage,
  target: FormBridgeStorage,
  options: MigrationOptions = {}
): Promise<MigrationResult> {
  const { dryRun = false, filter = {}, batchSize = 100 } = options;

  const result: MigrationResult = {
    submissionsMigrated: 0,
    eventsMigrated: 0,
    errors: [],
    dryRun,
  };

  // Migrate submissions in batches
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const page = await source.submissions.list(filter, {
      limit: batchSize,
      offset,
    });

    for (const submission of page.items) {
      try {
        if (!dryRun) {
          await target.submissions.save(submission);
        }
        result.submissionsMigrated++;

        // Migrate events for this submission
        const events = await source.events.getEvents(submission.id);
        for (const event of events) {
          try {
            if (!dryRun) {
              await target.events.appendEvent({ ...event, version: undefined });
            }
            result.eventsMigrated++;
          } catch (error) {
            result.errors.push({
              entity: "event",
              id: event.eventId,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      } catch (error) {
        result.errors.push({
          entity: "submission",
          id: submission.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    hasMore = page.hasMore;
    offset += batchSize;
  }

  return result;
}
