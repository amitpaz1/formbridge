/**
 * ExpiryScheduler — periodically expires stale submissions via SubmissionManager.
 * Uses setInterval with configurable interval (default 60s).
 */
import { SubmissionManager } from './submission-manager.js';

export class ExpiryScheduler {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private manager: SubmissionManager,
    private intervalMs: number = 60_000
  ) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.manager.expireStaleSubmissions().catch((err) => {
        console.error('[ExpiryScheduler] Error expiring submissions:', err);
      });
    }, this.intervalMs);
    // unref() so the timer doesn't prevent Node.js process/test exit
    if (this.timer && typeof this.timer === 'object' && 'unref' in this.timer) {
      this.timer.unref();
    }
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
