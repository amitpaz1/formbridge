/**
 * DeliveryQueue unit tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  InMemoryDeliveryQueue,
  calculateRetryDelay,
  DEFAULT_RETRY_POLICY,
} from "../src/core/delivery-queue";
import type { DeliveryRecord } from "../src/types/intake-contract";

function createTestDelivery(
  overrides?: Partial<DeliveryRecord>
): DeliveryRecord {
  return {
    deliveryId: `dlv_test_${Math.random().toString(36).slice(2)}`,
    submissionId: "sub_test_123",
    destinationUrl: "https://example.com/webhook",
    status: "pending",
    attempts: 0,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("InMemoryDeliveryQueue", () => {
  let queue: InMemoryDeliveryQueue;

  beforeEach(() => {
    queue = new InMemoryDeliveryQueue();
  });

  describe("enqueue", () => {
    it("should enqueue a delivery record", async () => {
      const record = createTestDelivery();
      await queue.enqueue(record);

      const retrieved = await queue.get(record.deliveryId);
      expect(retrieved).toEqual(record);
    });
  });

  describe("get", () => {
    it("should return null for non-existent delivery", async () => {
      const result = await queue.get("dlv_nonexistent");
      expect(result).toBeNull();
    });

    it("should return a delivery by ID", async () => {
      const record = createTestDelivery({ deliveryId: "dlv_abc" });
      await queue.enqueue(record);

      const result = await queue.get("dlv_abc");
      expect(result).toEqual(record);
    });
  });

  describe("getBySubmission", () => {
    it("should return all deliveries for a submission", async () => {
      const record1 = createTestDelivery({
        deliveryId: "dlv_1",
        submissionId: "sub_a",
      });
      const record2 = createTestDelivery({
        deliveryId: "dlv_2",
        submissionId: "sub_a",
      });
      const record3 = createTestDelivery({
        deliveryId: "dlv_3",
        submissionId: "sub_b",
      });

      await queue.enqueue(record1);
      await queue.enqueue(record2);
      await queue.enqueue(record3);

      const deliveries = await queue.getBySubmission("sub_a");
      expect(deliveries.length).toBe(2);
      expect(deliveries.every((d) => d.submissionId === "sub_a")).toBe(true);
    });

    it("should return empty array for unknown submission", async () => {
      const deliveries = await queue.getBySubmission("sub_unknown");
      expect(deliveries).toEqual([]);
    });
  });

  describe("update", () => {
    it("should update an existing delivery record", async () => {
      const record = createTestDelivery({ deliveryId: "dlv_update" });
      await queue.enqueue(record);

      record.status = "succeeded";
      record.attempts = 1;
      await queue.update(record);

      const updated = await queue.get("dlv_update");
      expect(updated!.status).toBe("succeeded");
      expect(updated!.attempts).toBe(1);
    });

    it("should throw for non-existent delivery", async () => {
      const record = createTestDelivery({ deliveryId: "dlv_missing" });
      await expect(queue.update(record)).rejects.toThrow(
        "Delivery not found"
      );
    });
  });

  describe("getPendingRetries", () => {
    it("should return pending deliveries ready for retry", async () => {
      const ready = createTestDelivery({
        deliveryId: "dlv_ready",
        status: "pending",
        nextRetryAt: new Date(Date.now() - 1000).toISOString(), // in the past
      });
      const notReady = createTestDelivery({
        deliveryId: "dlv_not_ready",
        status: "pending",
        nextRetryAt: new Date(Date.now() + 60000).toISOString(), // in the future
      });
      const succeeded = createTestDelivery({
        deliveryId: "dlv_done",
        status: "succeeded",
      });

      await queue.enqueue(ready);
      await queue.enqueue(notReady);
      await queue.enqueue(succeeded);

      const pending = await queue.getPendingRetries();
      expect(pending.length).toBe(1);
      expect(pending[0].deliveryId).toBe("dlv_ready");
    });

    it("should return pending deliveries with no nextRetryAt", async () => {
      const record = createTestDelivery({
        deliveryId: "dlv_immediate",
        status: "pending",
      });
      await queue.enqueue(record);

      const pending = await queue.getPendingRetries();
      expect(pending.length).toBe(1);
    });
  });

  describe("getStats", () => {
    it("should return queue statistics", async () => {
      await queue.enqueue(
        createTestDelivery({ deliveryId: "dlv_1", status: "pending" })
      );
      await queue.enqueue(
        createTestDelivery({ deliveryId: "dlv_2", status: "succeeded" })
      );
      await queue.enqueue(
        createTestDelivery({ deliveryId: "dlv_3", status: "failed" })
      );
      await queue.enqueue(
        createTestDelivery({ deliveryId: "dlv_4", status: "pending" })
      );

      const stats = await queue.getStats();
      expect(stats.total).toBe(4);
      expect(stats.pending).toBe(2);
      expect(stats.succeeded).toBe(1);
      expect(stats.failed).toBe(1);
    });

    it("should return zeros for empty queue", async () => {
      const stats = await queue.getStats();
      expect(stats).toEqual({ total: 0, pending: 0, succeeded: 0, failed: 0 });
    });
  });
});

describe("calculateRetryDelay", () => {
  it("should calculate exponential backoff delay", () => {
    const policy = DEFAULT_RETRY_POLICY;

    expect(calculateRetryDelay(1, policy)).toBe(1000);
    expect(calculateRetryDelay(2, policy)).toBe(2000);
    expect(calculateRetryDelay(3, policy)).toBe(4000);
    expect(calculateRetryDelay(4, policy)).toBe(8000);
    expect(calculateRetryDelay(5, policy)).toBe(16000);
  });

  it("should cap at maxDelayMs", () => {
    const policy = { ...DEFAULT_RETRY_POLICY, maxDelayMs: 5000 };

    expect(calculateRetryDelay(1, policy)).toBe(1000);
    expect(calculateRetryDelay(5, policy)).toBe(5000); // capped
    expect(calculateRetryDelay(10, policy)).toBe(5000); // capped
  });
});
