/**
 * Submission store MCP tests focusing on uncovered paths
 * 
 * This test file targets the uncovered areas in src/mcp/submission-store.ts
 * to improve coverage from 76.2%
 */

import { describe, it, expect, beforeEach } from "vitest";
import { 
  InMemorySubmissionStore, 
  SubmissionStore, 
  type MCPSubmissionEntry 
} from "../../src/mcp/submission-store";
import type { Submission } from "../../src/submission-types";
import { SubmissionState } from "../../src/types/intake-contract";

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
    idempotencyKey: undefined,
    ...overrides,
  };
}

describe("InMemorySubmissionStore", () => {
  let store: InMemorySubmissionStore;

  beforeEach(() => {
    store = new InMemorySubmissionStore();
  });

  describe("getByResumeToken - not found cases", () => {
    it("should return null when resume token does not exist", async () => {
      const result = await store.getByResumeToken("nonexistent_token");
      expect(result).toBeNull();
    });

    it("should return null when resume token is empty string", async () => {
      const result = await store.getByResumeToken("");
      expect(result).toBeNull();
    });

    it("should handle concurrent access when token is being updated", async () => {
      const submission = createTestSubmission();
      await store.save(submission);

      // Simulate concurrent access - get by old token after save with new token
      const updatedSubmission = createTestSubmission({
        resumeToken: "new_token",
      });
      await store.save(updatedSubmission);

      // Old token should now return null
      const result = await store.getByResumeToken("rtok_test");
      expect(result).toBeNull();
    });
  });

  describe("getByIdempotencyKey - not found cases", () => {
    it("should return null when idempotency key does not exist", async () => {
      const result = await store.getByIdempotencyKey("nonexistent_key");
      expect(result).toBeNull();
    });

    it("should return null when idempotency key is undefined/empty", async () => {
      const result = await store.getByIdempotencyKey("");
      expect(result).toBeNull();
    });
  });

  describe("stale token cleanup", () => {
    it("should properly cleanup old resume tokens when submission is updated", async () => {
      const submission = createTestSubmission();
      await store.save(submission);

      // Update with new resume token
      const updatedSubmission = createTestSubmission({
        resumeToken: "new_rtok_test",
      });
      await store.save(updatedSubmission);

      // Old token should be cleaned up
      const oldTokenResult = await store.getByResumeToken("rtok_test");
      expect(oldTokenResult).toBeNull();

      // New token should work
      const newTokenResult = await store.getByResumeToken("new_rtok_test");
      expect(newTokenResult).not.toBeNull();
      expect(newTokenResult!.id).toBe("sub_test_123");
    });

    it("should handle multiple token updates for same submission", async () => {
      const submission = createTestSubmission();
      await store.save(submission);

      // Multiple updates with different tokens
      const updates = ["token_1", "token_2", "token_3"];
      for (const token of updates) {
        const updated = createTestSubmission({ resumeToken: token });
        await store.save(updated);
      }

      // Only the latest token should work
      const result = await store.getByResumeToken("token_3");
      expect(result).not.toBeNull();

      // All previous tokens should be cleaned up
      for (const oldToken of ["rtok_test", "token_1", "token_2"]) {
        const oldResult = await store.getByResumeToken(oldToken);
        expect(oldResult).toBeNull();
      }
    });
  });

  describe("idempotency key management", () => {
    it("should handle submissions with and without idempotency keys", async () => {
      // Save submission without idempotency key
      const submission1 = createTestSubmission();
      await store.save(submission1);

      // Save submission with idempotency key
      const submission2 = createTestSubmission({
        id: "sub_test_456",
        resumeToken: "rtok_test_2",
        idempotencyKey: "idem_key_1",
      });
      await store.save(submission2);

      // Verify both can be retrieved
      const result1 = await store.get("sub_test_123");
      expect(result1).not.toBeNull();

      const result2 = await store.getByIdempotencyKey("idem_key_1");
      expect(result2).not.toBeNull();
      expect(result2!.id).toBe("sub_test_456");
    });
  });

  describe("getAll method", () => {
    it("should return all stored submissions", () => {
      store.clear(); // Ensure clean state

      const submissions = [
        createTestSubmission({ id: "sub_1", resumeToken: "tok_1" }),
        createTestSubmission({ id: "sub_2", resumeToken: "tok_2" }),
        createTestSubmission({ id: "sub_3", resumeToken: "tok_3" }),
      ];

      // Save all submissions
      submissions.forEach(async (sub) => await store.save(sub));

      const all = store.getAll();
      expect(all.length).toBe(3);
      
      // Verify all submissions are present
      const ids = all.map(entry => entry.submission.id);
      expect(ids).toContain("sub_1");
      expect(ids).toContain("sub_2");
      expect(ids).toContain("sub_3");
    });

    it("should return empty array when no submissions exist", () => {
      store.clear();
      const all = store.getAll();
      expect(all).toEqual([]);
    });
  });
});

describe("SubmissionStore (MCP)", () => {
  let store: SubmissionStore;

  beforeEach(() => {
    store = new SubmissionStore();
  });

  describe("update - non-existent entry", () => {
    it("should return undefined when trying to update non-existent entry", () => {
      const result = store.update("nonexistent_token", {
        data: { updated: true },
      });
      expect(result).toBeUndefined();
    });

    it("should return undefined when trying to update with empty token", () => {
      const result = store.update("", { data: { updated: true } });
      expect(result).toBeUndefined();
    });
  });

  describe("create with idempotency key handling", () => {
    it("should create multiple entries when no idempotency key collision", () => {
      const entry1 = store.create("intake_1", { field1: "value1" });
      const entry2 = store.create("intake_1", { field2: "value2" });

      expect(entry1.submissionId).not.toBe(entry2.submissionId);
      expect(entry1.resumeToken).not.toBe(entry2.resumeToken);
    });

    it("should handle idempotency key tracking correctly", () => {
      const entry1 = store.create("intake_1", { field1: "value1" }, "idem_key_1");
      
      // Try to get by idempotency key
      const retrieved = store.getByIdempotencyKey("idem_key_1");
      expect(retrieved).toBeDefined();
      expect(retrieved!.submissionId).toBe(entry1.submissionId);
    });

    it("should handle entries without idempotency keys", () => {
      const entry = store.create("intake_1", { field1: "value1" });
      expect(entry.idempotencyKey).toBeUndefined();
      
      // Should not interfere with idempotency key lookups
      const retrieved = store.getByIdempotencyKey("any_key");
      expect(retrieved).toBeUndefined();
    });
  });

  describe("get method - edge cases", () => {
    it("should return undefined for non-existent resume token", () => {
      const result = store.get("nonexistent_token");
      expect(result).toBeUndefined();
    });

    it("should return undefined for empty resume token", () => {
      const result = store.get("");
      expect(result).toBeUndefined();
    });
  });

  describe("getByIdempotencyKey - edge cases", () => {
    it("should return undefined for non-existent idempotency key", () => {
      const result = store.getByIdempotencyKey("nonexistent_key");
      expect(result).toBeUndefined();
    });

    it("should return undefined for empty idempotency key", () => {
      const result = store.getByIdempotencyKey("");
      expect(result).toBeUndefined();
    });
  });

  describe("delete method behavior", () => {
    it("should return false when trying to delete non-existent entry", () => {
      const result = store.delete("nonexistent_token");
      expect(result).toBe(false);
    });

    it("should properly clean up idempotency key when deleting entry", () => {
      const entry = store.create("intake_1", { field1: "value1" }, "idem_key_1");
      
      // Verify entry exists
      expect(store.get(entry.resumeToken)).toBeDefined();
      expect(store.getByIdempotencyKey("idem_key_1")).toBeDefined();
      
      // Delete entry
      const deleted = store.delete(entry.resumeToken);
      expect(deleted).toBe(true);
      
      // Verify cleanup
      expect(store.get(entry.resumeToken)).toBeUndefined();
      expect(store.getByIdempotencyKey("idem_key_1")).toBeUndefined();
    });

    it("should handle deleting entry without idempotency key", () => {
      const entry = store.create("intake_1", { field1: "value1" });
      
      const deleted = store.delete(entry.resumeToken);
      expect(deleted).toBe(true);
      expect(store.get(entry.resumeToken)).toBeUndefined();
    });
  });

  describe("timestamp management", () => {
    it("should set createdAt and updatedAt on creation", () => {
      const before = new Date();
      const entry = store.create("intake_1", { field1: "value1" });
      const after = new Date();

      expect(entry.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(entry.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
      expect(entry.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(entry.updatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it("should update updatedAt timestamp on update", async () => {
      const entry = store.create("intake_1", { field1: "value1" });
      const originalUpdatedAt = entry.updatedAt;
      
      // Small delay to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const updated = store.update(entry.resumeToken, {
        data: { field1: "updated_value" }
      });
      
      expect(updated).toBeDefined();
      expect(updated!.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
      expect(updated!.createdAt.getTime()).toBe(originalUpdatedAt.getTime()); // createdAt should not change
    });
  });

  describe("state transitions", () => {
    it("should handle state changes through updates", () => {
      const entry = store.create("intake_1", { field1: "value1" });
      expect(entry.state).toBe(SubmissionState.CREATED);
      
      const updated = store.update(entry.resumeToken, {
        state: SubmissionState.SUBMITTED
      });
      
      expect(updated).toBeDefined();
      expect(updated!.state).toBe(SubmissionState.SUBMITTED);
    });
  });
});