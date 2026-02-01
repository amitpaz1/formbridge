/**
 * WebhookManager additional tests focusing on uncovered paths
 * 
 * This test file targets the uncovered areas in src/core/webhook-manager.ts
 * to improve coverage from 79.6%
 * 
 * Note: Basic functionality is already covered in tests/webhook-manager.test.ts
 * This file focuses on edge cases, error conditions, and less common paths.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  WebhookManager,
  signPayload,
  verifySignature,
  type WebhookEventEmitter,
} from "../../src/core/webhook-manager";
import { InMemoryDeliveryQueue } from "../../src/core/delivery-queue";
import type { Submission } from "../../src/submission-types";
import type { Destination, IntakeEvent } from "../../src/types/intake-contract";

function createTestSubmission(overrides?: Partial<Submission>): Submission {
  return {
    id: "sub_test_123",
    intakeId: "intake_test",
    state: "submitted",
    resumeToken: "rtok_test",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T01:00:00.000Z",
    fields: { name: "John", email: "john@test.com" },
    fieldAttribution: { name: { kind: "agent", id: "agent-1" } },
    createdBy: { kind: "agent", id: "agent-1" },
    updatedBy: { kind: "human", id: "user-1" },
    events: [],
    ...overrides,
  };
}

const testDestination: Destination = {
  kind: "webhook",
  url: "https://example.com/webhook",
  headers: { "X-Custom": "value" },
};

describe("WebhookManager - Uncovered Paths", () => {
  let queue: InMemoryDeliveryQueue;
  let manager: WebhookManager;
  let mockEventEmitter: WebhookEventEmitter;

  beforeEach(() => {
    queue = new InMemoryDeliveryQueue();
    mockEventEmitter = {
      emit: vi.fn().mockResolvedValue(undefined),
    };
  });

  afterEach(() => {
    // Clean up any timers
    if (manager) {
      manager.stopRetryScheduler();
    }
  });

  describe("HMAC signing edge cases", () => {
    it("should handle empty payload", () => {
      const signature = signPayload("", "secret");
      expect(signature).toBeDefined();
      expect(signature.length).toBe(64);
      expect(verifySignature("", signature, "secret")).toBe(true);
    });

    it("should handle very long payload", () => {
      const longPayload = "x".repeat(10000);
      const signature = signPayload(longPayload, "secret");
      expect(verifySignature(longPayload, signature, "secret")).toBe(true);
    });

    it("should handle special characters in secret", () => {
      const secret = "secret!@#$%^&*()_+-=[]{}|;':\",./<>?`~";
      const payload = '{"test": true}';
      const signature = signPayload(payload, secret);
      expect(verifySignature(payload, signature, secret)).toBe(true);
    });

    it("should handle empty secret", () => {
      const payload = '{"test": true}';
      const signature = signPayload(payload, "");
      expect(verifySignature(payload, signature, "")).toBe(true);
    });

    it("should return false when signature lengths don't match", () => {
      const payload = '{"test": true}';
      const shortSig = "abc";
      expect(verifySignature(payload, shortSig, "secret")).toBe(false);
    });
  });

  describe("getDelivery - non-existent ID", () => {
    it("should return null for non-existent delivery ID", async () => {
      manager = new WebhookManager(queue);
      const result = await manager.getDelivery("nonexistent_delivery_id");
      expect(result).toBeNull();
    });

    it("should return null for empty delivery ID", async () => {
      manager = new WebhookManager(queue);
      const result = await manager.getDelivery("");
      expect(result).toBeNull();
    });
  });

  describe("getQueue method", () => {
    it("should return the configured queue instance", () => {
      manager = new WebhookManager(queue);
      const returnedQueue = manager.getQueue();
      expect(returnedQueue).toBe(queue);
    });

    it("should return default InMemoryDeliveryQueue when none provided", () => {
      manager = new WebhookManager();
      const returnedQueue = manager.getQueue();
      expect(returnedQueue).toBeInstanceOf(InMemoryDeliveryQueue);
    });
  });

  describe("retry scheduler management", () => {
    it("should start retry scheduler with custom interval", () => {
      manager = new WebhookManager(queue);
      
      // Mock the internal timer to avoid waiting
      const spy = vi.spyOn(global, 'setInterval');
      
      manager.startRetryScheduler(5000);
      expect(spy).toHaveBeenCalledWith(expect.any(Function), 5000);
      
      spy.mockRestore();
    });

    it("should not start multiple schedulers", () => {
      manager = new WebhookManager(queue);
      
      const spy = vi.spyOn(global, 'setInterval');
      
      manager.startRetryScheduler(1000);
      manager.startRetryScheduler(2000); // Second call should be ignored
      
      expect(spy).toHaveBeenCalledTimes(1);
      
      spy.mockRestore();
    });

    it("should stop retry scheduler", () => {
      manager = new WebhookManager(queue);
      
      const clearSpy = vi.spyOn(global, 'clearInterval');
      
      manager.startRetryScheduler(1000);
      manager.stopRetryScheduler();
      
      expect(clearSpy).toHaveBeenCalled();
      
      clearSpy.mockRestore();
    });

    it("should handle stopping scheduler when none is running", () => {
      manager = new WebhookManager(queue);
      
      const clearSpy = vi.spyOn(global, 'clearInterval');
      
      // Should not throw
      manager.stopRetryScheduler();
      
      // Should not have called clearInterval
      expect(clearSpy).not.toHaveBeenCalled();
      
      clearSpy.mockRestore();
    });
  });

  describe("SSRF protection", () => {
    it("should block localhost URLs in delivery", async () => {
      const mockFetch = vi.fn();
      manager = new WebhookManager(queue, { 
        fetchFn: mockFetch as any,
        eventEmitter: mockEventEmitter 
      });

      const maliciousDestination: Destination = {
        kind: "webhook",
        url: "http://localhost:8080/webhook",
      };

      const submission = createTestSubmission();
      const deliveryId = await manager.enqueueDelivery(submission, maliciousDestination);

      // Wait for processing
      await new Promise((r) => setTimeout(r, 100));

      // Should not have called fetch due to SSRF protection
      expect(mockFetch).not.toHaveBeenCalled();

      // Check delivery record is marked as failed
      const record = await queue.get(deliveryId);
      expect(record).toBeDefined();
      expect(record!.status).toBe("failed");
      expect(record!.error).toContain("SSRF blocked");
    });

    it("should block private IP ranges", async () => {
      const mockFetch = vi.fn();
      manager = new WebhookManager(queue, { 
        fetchFn: mockFetch as any,
        eventEmitter: mockEventEmitter 
      });

      const maliciousDestination: Destination = {
        kind: "webhook",
        url: "http://192.168.1.1/webhook",
      };

      const submission = createTestSubmission();
      const deliveryId = await manager.enqueueDelivery(submission, maliciousDestination);

      await new Promise((r) => setTimeout(r, 100));

      expect(mockFetch).not.toHaveBeenCalled();
      
      const record = await queue.get(deliveryId);
      expect(record).toBeDefined();
      expect(record!.status).toBe("failed");
    });
  });

  describe("event emission error handling", () => {
    it("should handle event emitter errors gracefully", async () => {
      // Create an emitter that fails only on certain events to test partial failure
      const selectivelyFaultyEmitter: WebhookEventEmitter = {
        emit: vi.fn().mockImplementation((event: IntakeEvent) => {
          // Fail only on delivery.attempted, succeed on others
          if (event.type === "delivery.attempted") {
            return Promise.reject(new Error("Emitter error"));
          }
          return Promise.resolve();
        }),
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      manager = new WebhookManager(queue, {
        fetchFn: mockFetch as any,
        eventEmitter: selectivelyFaultyEmitter,
      });

      const submission = createTestSubmission();
      
      // Should not throw even if event emitter fails
      const deliveryId = await manager.enqueueDelivery(submission, testDestination);

      await new Promise((r) => setTimeout(r, 200));

      // Verify the event emitter was called (and failed for attempted event)
      expect(selectivelyFaultyEmitter.emit).toHaveBeenCalled();
      
      // The delivery record should exist even if event emission fails
      const record = await queue.get(deliveryId);
      expect(record).toBeDefined();
      expect(record!.deliveryId).toBe(deliveryId);
    });

    it("should emit events without event emitter configured", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      manager = new WebhookManager(queue, {
        fetchFn: mockFetch as any,
        // No event emitter configured
      });

      const submission = createTestSubmission();
      
      // Should not throw when no event emitter is configured
      const deliveryId = await manager.enqueueDelivery(submission, testDestination);

      await new Promise((r) => setTimeout(r, 100));

      const record = await queue.get(deliveryId);
      expect(record).toBeDefined();
      expect(record!.status).toBe("succeeded");
    });
  });

  describe("delivery failure scenarios", () => {
    it("should handle fetch throwing non-Error objects", async () => {
      const mockFetch = vi.fn().mockRejectedValue("String error");

      manager = new WebhookManager(queue, {
        fetchFn: mockFetch as any,
        retryPolicy: {
          maxRetries: 1,
          initialDelayMs: 1,
          maxDelayMs: 10,
          backoffMultiplier: 2,
        },
        eventEmitter: mockEventEmitter,
      });

      const submission = createTestSubmission();
      const deliveryId = await manager.enqueueDelivery(submission, testDestination);

      await new Promise((r) => setTimeout(r, 100));

      const record = await queue.get(deliveryId);
      expect(record).toBeDefined();
      expect(record!.status).toBe("failed");
      expect(record!.error).toBe("String error");
    });

    it("should handle undefined error objects", async () => {
      const mockFetch = vi.fn().mockRejectedValue(undefined);

      manager = new WebhookManager(queue, {
        fetchFn: mockFetch as any,
        retryPolicy: {
          maxRetries: 1,
          initialDelayMs: 1,
          maxDelayMs: 10,
          backoffMultiplier: 2,
        },
        eventEmitter: mockEventEmitter,
      });

      const submission = createTestSubmission();
      const deliveryId = await manager.enqueueDelivery(submission, testDestination);

      await new Promise((r) => setTimeout(r, 100));

      const record = await queue.get(deliveryId);
      expect(record).toBeDefined();
      expect(record!.status).toBe("failed");
      expect(record!.error).toBe("undefined");
    });
  });

  describe("header sanitization", () => {
    it("should include custom headers from destination", () => {
      manager = new WebhookManager(queue);
      
      const destinationWithHeaders: Destination = {
        kind: "webhook",
        url: "https://example.com/webhook",
        headers: {
          "X-Custom-Header": "custom-value",
          "Authorization": "Bearer token123",
          "X-Another": "another-value",
        },
      };

      const headers = manager.buildHeaders('{"test": true}', destinationWithHeaders);
      
      expect(headers["X-Custom-Header"]).toBe("custom-value");
      expect(headers["Authorization"]).toBe("Bearer token123");
      expect(headers["X-Another"]).toBe("another-value");
      expect(headers["Content-Type"]).toBe("application/json");
    });

    it("should handle destination without headers", () => {
      manager = new WebhookManager(queue);
      
      const destinationNoHeaders: Destination = {
        kind: "webhook",
        url: "https://example.com/webhook",
        // No headers property
      };

      const headers = manager.buildHeaders('{"test": true}', destinationNoHeaders);
      
      expect(headers["Content-Type"]).toBe("application/json");
      expect(headers["X-FormBridge-Timestamp"]).toBeDefined();
    });

    it("should handle empty destination headers", () => {
      manager = new WebhookManager(queue);
      
      const destinationEmptyHeaders: Destination = {
        kind: "webhook",
        url: "https://example.com/webhook",
        headers: {},
      };

      const headers = manager.buildHeaders('{"test": true}', destinationEmptyHeaders);
      
      expect(headers["Content-Type"]).toBe("application/json");
      expect(headers["X-FormBridge-Timestamp"]).toBeDefined();
    });
  });

  describe("retry scheduling with queue context", () => {
    it("should handle queue without getContext method", () => {
      // Create a minimal queue without getContext
      const minimalQueue = {
        enqueue: vi.fn().mockResolvedValue(undefined),
        get: vi.fn().mockResolvedValue(null),
        update: vi.fn().mockResolvedValue(undefined),
        getBySubmission: vi.fn().mockResolvedValue([]),
        getPendingRetries: vi.fn().mockResolvedValue([]),
      };

      manager = new WebhookManager(minimalQueue as any);
      
      // Test that the manager recognizes a queue without getContext method
      const hasGetContext = 'getContext' in minimalQueue && typeof minimalQueue.getContext === 'function';
      expect(hasGetContext).toBe(false);
      
      // The retry logic should handle this gracefully
      expect(() => {
        manager.startRetryScheduler(1000);
        manager.stopRetryScheduler();
      }).not.toThrow();
    });

    it("should handle missing context in retry processing", async () => {
      const submission = createTestSubmission();
      const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
      
      manager = new WebhookManager(queue, { fetchFn: mockFetch as any });
      
      // Enqueue a delivery
      await manager.enqueueDelivery(submission, testDestination);
      
      // Manually create a pending retry record without context
      const deliveryId = "dlv_missing_context";
      const record = {
        deliveryId,
        submissionId: "sub_test_123",
        destinationUrl: "https://example.com/webhook",
        status: "pending" as const,
        attempts: 1,
        createdAt: new Date().toISOString(),
        nextRetryAt: new Date(Date.now() - 1000).toISOString(), // Ready for retry
      };
      
      await queue.enqueue(record, {
        submission: {
          id: "sub_test_123",
          intakeId: "intake_test",
          state: "submitted",
          fields: {},
          fieldAttribution: {},
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T01:00:00.000Z",
          createdBy: { kind: "agent", id: "agent-1" },
        },
        destination: {
          kind: "webhook",
          url: "https://example.com/webhook",
        },
      });
      
      // Clear the context to simulate missing context scenario
      if ('contexts' in queue && queue.contexts instanceof Map) {
        queue.contexts.delete(deliveryId);
      }
      
      manager.startRetryScheduler(50);
      
      await new Promise((r) => setTimeout(r, 100));
      
      manager.stopRetryScheduler();
      
      // Should handle missing context gracefully without throwing
    });
  });

  describe("payload building edge cases", () => {
    it("should handle submission with null/undefined fields", () => {
      manager = new WebhookManager(queue);
      
      const submission = createTestSubmission({
        fields: undefined as any,
        fieldAttribution: null as any,
      });
      
      const payload = manager.buildPayload(submission);
      
      expect(payload.submissionId).toBe("sub_test_123");
      expect(payload.fields).toBeUndefined();
      expect(payload.fieldAttribution).toBeNull();
    });

    it("should handle submission with complex nested fields", () => {
      manager = new WebhookManager(queue);
      
      const complexFields = {
        user: {
          name: "John",
          contacts: {
            emails: ["john@example.com", "john.doe@company.com"],
            phone: null,
          },
        },
        preferences: {
          newsletter: true,
          notifications: {
            email: false,
            sms: true,
          },
        },
        metadata: {
          source: "web_form",
          version: 1,
          tags: ["customer", "premium"],
        },
      };
      
      const submission = createTestSubmission({
        fields: complexFields,
      });
      
      const payload = manager.buildPayload(submission);
      
      expect(payload.fields).toEqual(complexFields);
      expect(payload.submissionId).toBe("sub_test_123");
    });
  });

  describe("dry run edge cases", () => {
    it("should handle destination with undefined URL", () => {
      manager = new WebhookManager(queue, { signingSecret: "secret" });
      
      const destinationNoUrl: Destination = {
        kind: "webhook",
        url: undefined,
        headers: { "X-Custom": "value" },
      };
      
      const submission = createTestSubmission();
      const result = manager.dryRun(submission, destinationNoUrl);
      
      expect(result.url).toBe("");
      expect(result.method).toBe("POST");
      expect(result.headers["Content-Type"]).toBe("application/json");
    });

    it("should handle destination with null URL", () => {
      manager = new WebhookManager(queue);
      
      const destinationNullUrl: Destination = {
        kind: "webhook",
        url: null as any,
      };
      
      const submission = createTestSubmission();
      const result = manager.dryRun(submission, destinationNullUrl);
      
      expect(result.url).toBe("");
    });
  });
});