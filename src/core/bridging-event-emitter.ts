/**
 * Bridging event emitter — fans out events to multiple listeners.
 */
import type { IntakeEvent } from '../types/intake-contract.js';

export class BridgingEventEmitter {
  private listeners: Array<(event: IntakeEvent) => Promise<void>> = [];

  addListener(listener: (event: IntakeEvent) => Promise<void>): void {
    this.listeners.push(listener);
  }

  async emit(event: IntakeEvent): Promise<void> {
    // Use allSettled for error isolation — one failing listener won't block others
    const results = await Promise.allSettled(this.listeners.map((fn) => fn(event)));
    for (const result of results) {
      if (result.status === 'rejected') {
        console.error('[BridgingEventEmitter] Listener error:', result.reason);
      }
    }
  }
}
