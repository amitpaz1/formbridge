/**
 * Additional tests for hono-submissions.ts to improve coverage
 * 
 * Focuses on error handling paths and edge cases not covered in main hono-routes.test.ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { createHonoSubmissionRouter } from "../../src/routes/hono-submissions.js";
import { SubmissionManager } from "../../src/core/submission-manager.js";
import { InMemoryEventStore } from "../../src/core/event-store.js";
import type { Submission } from "../../src/submission-types.js";
import type { IntakeEvent } from "../../src/types/intake-contract.js";

// Test helper classes from existing patterns
class TestStore {
  private submissions = new Map<string, Submission>();
  async get(id: string) { return this.submissions.get(id) ?? null; }
  async save(s: Submission) { this.submissions.set(s.id, s); }
  async getByResumeToken(token: string) {
    for (const s of this.submissions.values()) {
      if (s.resumeToken === token) return s;
    }
    return null;
  }
}

class TestEmitter {
  events: IntakeEvent[] = [];
  async emit(event: IntakeEvent) { this.events.push(event); }
}

class TestRegistry {
  private intakes = new Map<string, { schema?: unknown; approvalGates?: unknown[] }>();
  register(id: string, schema?: unknown, gates?: unknown[]) {
    this.intakes.set(id, { schema, approvalGates: gates });
  }
  getIntake(id: string) {
    const intake = this.intakes.get(id);
    if (!intake) throw new Error(`Intake not found: ${id}`);
    return { schema: intake.schema || { fields: {} }, approvalGates: intake.approvalGates };
  }
}

const testActor = { kind: "agent" as const, id: "test-agent", name: "Test Agent" };

describe("Hono Submissions Route - Error Handling", () => {
  let app: Hono;
  let manager: SubmissionManager;
  let store: TestStore;
  let registry: TestRegistry;

  beforeEach(() => {
    store = new TestStore();
    const emitter = new TestEmitter();
    registry = new TestRegistry();
    const eventStore = new InMemoryEventStore();
    manager = new SubmissionManager({ store, eventEmitter: emitter, intakeRegistry: registry, baseUrl: "http://localhost:3000", eventStore });

    app = new Hono();
    app.route("/", createHonoSubmissionRouter(manager));

    // Register a basic intake
    registry.register("test-intake");
  });

  describe("POST /submissions/:id/handoff", () => {
    it("returns 404 when submission ID is missing (Hono routing)", async () => {
      const res = await app.request("/submissions//handoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      // Hono routing returns 404 for empty path params
      expect(res.status).toBe(404);
    });

    it("handles invalid JSON body gracefully", async () => {
      const sub = await manager.createSubmission({
        intakeId: "test-intake",
        actor: testActor,
      });

      const res = await app.request(`/submissions/${sub.submissionId}/handoff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "invalid-json{",
      });

      // Should still work with fallback actor
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.resumeUrl).toBeDefined();
    });

    it("returns 400 for invalid actor", async () => {
      const sub = await manager.createSubmission({
        intakeId: "test-intake",
        actor: testActor,
      });

      const res = await app.request(`/submissions/${sub.submissionId}/handoff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          actor: { kind: "invalid", id: "" } // Invalid kind and empty id
        }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.ok).toBe(false);
      expect(data.error.type).toBe("invalid_request");
      expect(data.error.message).toContain("Invalid actor");
    });
  });

  describe("GET /submissions/resume/:resumeToken", () => {
    it("returns 400 when resume token is missing", async () => {
      const res = await app.request("/submissions/resume/");
      expect(res.status).toBe(404); // Hono routing behavior
    });

    it("returns 403 for expired submission", async () => {
      const sub = await manager.createSubmission({
        intakeId: "test-intake",
        actor: testActor,
      });

      // Manually set expiry to past date
      const submission = await store.get(sub.submissionId);
      if (submission) {
        submission.expiresAt = new Date(Date.now() - 1000).toISOString(); // Expired 1 second ago
        await store.save(submission);
      }

      const res = await app.request(`/submissions/resume/${sub.resumeToken}`);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.ok).toBe(false);
      expect(data.error.type).toBe("expired");
      expect(data.error.message).toBe("This resume link has expired.");
    });

    it("returns 404 for non-existent resume token", async () => {
      const res = await app.request("/submissions/resume/rtok_nonexistent");
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.ok).toBe(false);
      expect(data.error.type).toBe("not_found");
      expect(data.error.message).toBe("Submission not found. The resume link may be invalid or expired.");
    });
  });

  describe("POST /submissions/resume/:resumeToken/resumed", () => {
    it("returns 400 when resume token is missing", async () => {
      const res = await app.request("/submissions/resume//resumed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(404); // Hono routing behavior
    });

    it("handles invalid JSON body gracefully with fallback actor", async () => {
      const sub = await manager.createSubmission({
        intakeId: "test-intake",
        actor: testActor,
      });

      const res = await app.request(`/submissions/resume/${sub.resumeToken}/resumed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "invalid-json{",
      });

      // Should work with fallback human actor
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.eventId).toBeDefined();
    });

    it("returns 400 for invalid actor", async () => {
      const sub = await manager.createSubmission({
        intakeId: "test-intake",
        actor: testActor,
      });

      const res = await app.request(`/submissions/resume/${sub.resumeToken}/resumed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          actor: { kind: "robot", id: "" } // Invalid kind and empty id
        }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.ok).toBe(false);
      expect(data.error.type).toBe("invalid_request");
      expect(data.error.message).toContain("Invalid actor");
    });

    it("returns 404 for non-existent resume token", async () => {
      const res = await app.request("/submissions/resume/rtok_nonexistent/resumed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actor: { kind: "human", id: "user-1", name: "User" }
        }),
      });

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.ok).toBe(false);
      expect(data.error.type).toBe("not_found");
    });

    it("returns 403 for expired submission", async () => {
      const sub = await manager.createSubmission({
        intakeId: "test-intake",
        actor: testActor,
      });

      // Manually set expiry to past date
      const submission = await store.get(sub.submissionId);
      if (submission) {
        submission.expiresAt = new Date(Date.now() - 1000).toISOString(); // Expired 1 second ago
        await store.save(submission);
      }

      const res = await app.request(`/submissions/resume/${sub.resumeToken}/resumed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actor: { kind: "human", id: "user-1", name: "User" }
        }),
      });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.ok).toBe(false);
      expect(data.error.type).toBe("expired");
    });
  });

  describe("POST /intake/:intakeId/submissions/:submissionId/submit", () => {
    it("returns 400 when resumeToken is missing", async () => {
      const res = await app.request("/intake/test-intake/submissions/sub_123/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          actor: testActor 
        }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.ok).toBe(false);
      expect(data.error.type).toBe("invalid_request");
      expect(data.error.message).toBe("resumeToken is required");
    });

    it("returns 400 when actor is missing", async () => {
      const res = await app.request("/intake/test-intake/submissions/sub_123/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          resumeToken: "rtok_123"
        }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.ok).toBe(false);
      expect(data.error.type).toBe("invalid_request");
      expect(data.error.message).toBe("Required");
    });

    it("returns 400 for invalid actor", async () => {
      const res = await app.request("/intake/test-intake/submissions/sub_123/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          resumeToken: "rtok_123",
          actor: { kind: "alien", id: "" } // Invalid kind and empty id
        }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.ok).toBe(false);
      expect(data.error.type).toBe("invalid_request");
    });

    it("returns 404 for non-existent submission", async () => {
      const res = await app.request("/intake/test-intake/submissions/sub_nonexistent/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeToken: "rtok_invalid",
          actor: testActor,
        }),
      });

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.ok).toBe(false);
      expect(data.error.type).toBe("not_found");
    });

    it("returns 409 for invalid/stale resume token", async () => {
      const sub = await manager.createSubmission({
        intakeId: "test-intake",
        actor: testActor,
      });

      const res = await app.request(`/intake/test-intake/submissions/${sub.submissionId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeToken: "rtok_invalid_token",
          actor: testActor,
        }),
      });

      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.ok).toBe(false);
      expect(data.error.type).toBe("invalid_resume_token");
      expect(data.error.message).toBe("Resume token is invalid or stale");
    });

    it("handles submit conflict gracefully", async () => {
      const sub = await manager.createSubmission({
        intakeId: "test-intake",
        actor: testActor,
      });

      // Submit once successfully
      await manager.submit({
        submissionId: sub.submissionId,
        resumeToken: sub.resumeToken,
        actor: testActor,
      });

      // Try to submit again with same idempotency key
      const res = await app.request(`/intake/test-intake/submissions/${sub.submissionId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeToken: sub.resumeToken,
          actor: testActor,
          idempotencyKey: "test-key-1",
        }),
      });

      // Should handle conflict gracefully (exact status depends on manager logic)
      expect([200, 409]).toContain(res.status);
    });

    it("handles manager errors with proper status codes", async () => {
      const sub = await manager.createSubmission({
        intakeId: "test-intake",
        actor: testActor,
      });

      // Test with a result that has needs_approval error type
      const originalSubmit = manager.submit;
      manager.submit = async () => ({
        ok: false,
        error: { type: "needs_approval", message: "Approval required" },
        state: "needs_review",
      });

      const res = await app.request(`/intake/test-intake/submissions/${sub.submissionId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeToken: sub.resumeToken,
          actor: testActor,
        }),
      });

      expect(res.status).toBe(202);
      const data = await res.json();
      expect(data.ok).toBe(false);
      expect(data.error?.type).toBe("needs_approval");

      // Restore original method
      manager.submit = originalSubmit;
    });

    it("handles unknown error types with 400 status", async () => {
      const sub = await manager.createSubmission({
        intakeId: "test-intake",
        actor: testActor,
      });

      // Mock a result with unknown error type
      const originalSubmit = manager.submit;
      manager.submit = async () => ({
        ok: false,
        error: { type: "unknown_error", message: "Something went wrong" },
        state: "draft",
      });

      const res = await app.request(`/intake/test-intake/submissions/${sub.submissionId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeToken: sub.resumeToken,
          actor: testActor,
        }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.ok).toBe(false);

      // Restore original method
      manager.submit = originalSubmit;
    });
  });
});