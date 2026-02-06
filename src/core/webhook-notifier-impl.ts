/**
 * WebhookNotifierImpl — bridges ApprovalManager's WebhookNotifier to WebhookManager.
 * Formats ReviewerNotification payloads and delivers via the existing webhook infrastructure
 * (HMAC signing, exponential backoff retry, delivery queue tracking).
 */
import type { Submission } from '../submission-types.js';
import type { Destination } from '../types/intake-contract.js';
import type { WebhookNotifier, ReviewerNotification } from './approval-manager.js';
import { WebhookManager } from './webhook-manager.js';
import { SubmissionId, IntakeId, ResumeToken } from '../types/branded.js';

export class WebhookNotifierImpl implements WebhookNotifier {
  constructor(
    private webhookManager: WebhookManager,
    private notificationUrl?: string
  ) {}

  async notifyReviewers(notification: ReviewerNotification): Promise<void> {
    if (!this.notificationUrl) return;

    // Build a synthetic Submission-like object for the webhook manager
    const syntheticSubmission: Submission = {
      id: SubmissionId(notification.submissionId),
      intakeId: IntakeId(notification.intakeId),
      state: notification.state,
      resumeToken: ResumeToken(''),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      fields: notification.fields,
      fieldAttribution: {},
      createdBy: notification.createdBy,
      updatedBy: notification.createdBy,
      events: [],
    };

    const destination: Destination = {
      kind: 'webhook',
      url: this.notificationUrl,
    };

    await this.webhookManager.enqueueDelivery(syntheticSubmission, destination);
  }
}
