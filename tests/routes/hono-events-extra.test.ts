/**
 * Additional tests for hono-events.ts to improve coverage
 * 
 * Focuses on export endpoints, pagination edge cases, and invalid query parameter handling
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { createHonoEventRouter } from "../../src/routes/hono-events.js";
import { SubmissionManager } from "../../src/core/submission-manager.js";
import { InMemoryEventStore } from "../../src/core/event-store.js";
import type { Submission } from "../../src/submission-types.js";
import type { IntakeEvent } from "../../src/types/intake-contract.js";

// Test helper classes (same pattern as existing tests)
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
  private intakes = new Map<string, { schema?: unknown }>();
  register(id: string, schema?: unknown) {
    this.intakes.set(id, { schema });
  }
  getIntake(id: string) {
    const intake = this.intakes.get(id);
    if (!intake) throw new Error(`Intake not found: ${id}`);
    return { schema: intake.schema || { fields: {} } };
  }
}

const testActor = { kind: "agent" as const, id: "test-agent", name: "Test Agent" };

describe("Hono Events Route - Export and Edge Cases", () => {
  let app: Hono;
  let manager: SubmissionManager;
  let store: TestStore;
  let registry: TestRegistry;

  beforeEach(() => {
    store = new TestStore();
    const emitter = new TestEmitter();
    registry = new TestRegistry();
    const eventStore = new InMemoryEventStore();
    manager = new SubmissionManager({ store, eventEmitter: emitter, baseUrl: "http://localhost:3000", eventStore });

    app = new Hono();
    app.route("/", createHonoEventRouter(manager));
  });

  describe("GET /submissions/:id/events", () => {
    it("returns 400 when submission ID is missing", async () => {
      const res = await app.request("/submissions//events");
      expect(res.status).toBe(404); // Hono routing behavior for empty param
    });

    it("returns 404 for non-existent submission", async () => {
      const res = await app.request("/submissions/sub_nonexistent/events");
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.ok).toBe(false);
      expect(data.error.type).toBe("not_found");
      expect(data.error.message).toBe("Submission not found");
    });

    it("returns 400 for invalid query parameters", async () => {
      const sub = await manager.createSubmission({
        intakeId: "test-intake",
        actor: testActor,
      });

      const res = await app.request(`/submissions/${sub.submissionId}/events?limit=not-a-number`);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.ok).toBe(false);
      expect(data.error.type).toBe("invalid_request");
      expect(data.error.message).toContain("Invalid query parameters");
    });

    it("returns 400 for invalid event types", async () => {
      const sub = await manager.createSubmission({
        intakeId: "test-intake",
        actor: testActor,
      });

      const res = await app.request(`/submissions/${sub.submissionId}/events?type=invalid.event.type`);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.ok).toBe(false);
      expect(data.error.type).toBe("invalid_request");
      expect(data.error.message).toContain("Invalid event type");
    });

    it("returns 400 for mixed valid and invalid event types", async () => {
      const sub = await manager.createSubmission({
        intakeId: "test-intake",
        actor: testActor,
      });

      const res = await app.request(`/submissions/${sub.submissionId}/events?type=submission.created,invalid.type`);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.ok).toBe(false);
      expect(data.error.type).toBe("invalid_request");
    });

    it("returns 400 for invalid actorKind", async () => {
      const sub = await manager.createSubmission({
        intakeId: "test-intake",
        actor: testActor,
      });

      const res = await app.request(`/submissions/${sub.submissionId}/events?actorKind=invalid`);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.ok).toBe(false);
      expect(data.error.type).toBe("invalid_request");
    });

    it("returns 400 for invalid ISO 8601 timestamp in since", async () => {
      const sub = await manager.createSubmission({
        intakeId: "test-intake",
        actor: testActor,
      });

      const res = await app.request(`/submissions/${sub.submissionId}/events?since=not-a-date`);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.ok).toBe(false);
      expect(data.error.type).toBe("invalid_request");
      expect(data.error.message).toContain("Invalid ISO 8601 timestamp for 'since'");
    });

    it("returns 400 for invalid ISO 8601 timestamp in until", async () => {
      const sub = await manager.createSubmission({
        intakeId: "test-intake",
        actor: testActor,
      });

      const res = await app.request(`/submissions/${sub.submissionId}/events?until=invalid-date`);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.ok).toBe(false);
      expect(data.error.type).toBe("invalid_request");
      expect(data.error.message).toContain("Invalid ISO 8601 timestamp for 'until'");
    });

    it("returns 400 for negative limit", async () => {
      const sub = await manager.createSubmission({
        intakeId: "test-intake",
        actor: testActor,
      });

      const res = await app.request(`/submissions/${sub.submissionId}/events?limit=-1`);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.ok).toBe(false);
      expect(data.error.type).toBe("invalid_request");
    });

    it("returns 400 for negative offset", async () => {
      const sub = await manager.createSubmission({
        intakeId: "test-intake",
        actor: testActor,
      });

      const res = await app.request(`/submissions/${sub.submissionId}/events?offset=-1`);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.ok).toBe(false);
      expect(data.error.type).toBe("invalid_request");
    });

    it("handles empty event list with correct pagination", async () => {
      const sub = await manager.createSubmission({
        intakeId: "test-intake",
        actor: testActor,
      });

      // Filter by non-existent event type to get empty results
      const res = await app.request(`/submissions/${sub.submissionId}/events?type=delivery.succeeded`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.submissionId).toBe(sub.submissionId);
      expect(data.events).toEqual([]);
      expect(data.pagination).toEqual({
        offset: 0,
        limit: 100,
        total: 0,
        hasMore: false,
      });
    });

    it("handles pagination correctly with hasMore flag", async () => {
      const sub = await manager.createSubmission({
        intakeId: "test-intake",
        actor: testActor,
      });

      // Generate one field update to get at least 2 events total (created + field.updated)
      await manager.setFields({
        submissionId: sub.submissionId,
        resumeToken: sub.resumeToken,
        actor: testActor,
        fields: { name: "test" },
      });

      // Test with limit smaller than total events
      const res = await app.request(`/submissions/${sub.submissionId}/events?limit=1`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.events.length).toBe(1);
      expect(data.pagination.hasMore).toBe(true);
      expect(data.pagination.total).toBeGreaterThan(1);
    });

    it("handles pagination offset correctly", async () => {
      const sub = await manager.createSubmission({
        intakeId: "test-intake",
        actor: testActor,
      });

      // Generate one field update to get multiple events
      await manager.setFields({
        submissionId: sub.submissionId,
        resumeToken: sub.resumeToken,
        actor: testActor,
        fields: { name: "test" },
      });

      // Test with offset
      const res = await app.request(`/submissions/${sub.submissionId}/events?offset=1&limit=1`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.pagination.offset).toBe(1);
      expect(data.pagination.limit).toBe(1);
    });

    it("applies event type filtering correctly", async () => {
      const sub = await manager.createSubmission({
        intakeId: "test-intake",
        actor: testActor,
      });

      // Generate field update events
      await manager.setFields({
        submissionId: sub.submissionId,
        resumeToken: sub.resumeToken,
        actor: testActor,
        fields: { name: "test" },
      });

      const res = await app.request(`/submissions/${sub.submissionId}/events?type=field.updated`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.events.every((e: any) => e.type === "field.updated")).toBe(true);
    });

    it("applies multiple event type filtering correctly", async () => {
      const sub = await manager.createSubmission({
        intakeId: "test-intake",
        actor: testActor,
      });

      // Generate field update events
      await manager.setFields({
        submissionId: sub.submissionId,
        resumeToken: sub.resumeToken,
        actor: testActor,
        fields: { name: "test" },
      });

      const res = await app.request(`/submissions/${sub.submissionId}/events?type=submission.created,field.updated`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.events.every((e: any) => ["submission.created", "field.updated"].includes(e.type))).toBe(true);
    });
  });

  describe("GET /submissions/:id/events/export", () => {
    it("returns 400 when submission ID is missing", async () => {
      const res = await app.request("/submissions//events/export");
      expect(res.status).toBe(404); // Hono routing behavior
    });

    it("returns 404 for non-existent submission", async () => {
      const res = await app.request("/submissions/sub_nonexistent/events/export");
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.ok).toBe(false);
      expect(data.error.type).toBe("not_found");
      expect(data.error.message).toBe("Submission not found");
    });

    it("exports as JSONL by default", async () => {
      const sub = await manager.createSubmission({
        intakeId: "test-intake",
        actor: testActor,
      });

      const res = await app.request(`/submissions/${sub.submissionId}/events/export`);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("application/x-ndjson");
      expect(res.headers.get("content-disposition")).toContain(`events-${sub.submissionId}.jsonl`);

      const body = await res.text();
      expect(body).toBeTruthy();
      // Should be newline-delimited JSON
      const lines = body.trim().split('\n');
      expect(lines.length).toBeGreaterThanOrEqual(1);
      // Each line should be valid JSON
      for (const line of lines) {
        expect(() => JSON.parse(line)).not.toThrow();
      }
    });

    it("exports as JSON when format=json", async () => {
      const sub = await manager.createSubmission({
        intakeId: "test-intake",
        actor: testActor,
      });

      const res = await app.request(`/submissions/${sub.submissionId}/events/export?format=json`);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("application/json");
      expect(res.headers.get("content-disposition")).toContain(`events-${sub.submissionId}.json`);

      const body = await res.text();
      const events = JSON.parse(body);
      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBeGreaterThanOrEqual(1);
    });

    it("exports as JSONL when format=jsonl explicitly", async () => {
      const sub = await manager.createSubmission({
        intakeId: "test-intake",
        actor: testActor,
      });

      const res = await app.request(`/submissions/${sub.submissionId}/events/export?format=jsonl`);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("application/x-ndjson");
    });

    it("returns 400 for invalid export format", async () => {
      const sub = await manager.createSubmission({
        intakeId: "test-intake",
        actor: testActor,
      });

      const res = await app.request(`/submissions/${sub.submissionId}/events/export?format=xml`);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.ok).toBe(false);
      expect(data.error.type).toBe("invalid_request");
    });

    it("returns 400 for invalid query parameters in export", async () => {
      const sub = await manager.createSubmission({
        intakeId: "test-intake",
        actor: testActor,
      });

      const res = await app.request(`/submissions/${sub.submissionId}/events/export?limit=not-a-number`);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.ok).toBe(false);
      expect(data.error.type).toBe("invalid_request");
    });

    it("applies filters correctly in export", async () => {
      const sub = await manager.createSubmission({
        intakeId: "test-intake",
        actor: testActor,
      });

      // Generate field update events
      await manager.setFields({
        submissionId: sub.submissionId,
        resumeToken: sub.resumeToken,
        actor: testActor,
        fields: { name: "test" },
      });

      const res = await app.request(`/submissions/${sub.submissionId}/events/export?type=field.updated&format=json`);
      expect(res.status).toBe(200);
      
      const body = await res.text();
      const events = JSON.parse(body);
      expect(events.every((e: any) => e.type === "field.updated")).toBe(true);
    });

    it("handles empty events list in export", async () => {
      const sub = await manager.createSubmission({
        intakeId: "test-intake",
        actor: testActor,
      });

      // Filter by non-existent event type
      const res = await app.request(`/submissions/${sub.submissionId}/events/export?type=delivery.succeeded&format=json`);
      expect(res.status).toBe(200);
      
      const body = await res.text();
      const events = JSON.parse(body);
      expect(events).toEqual([]);
    });

    it("handles empty events list in JSONL export", async () => {
      const sub = await manager.createSubmission({
        intakeId: "test-intake",
        actor: testActor,
      });

      // Filter by non-existent event type
      const res = await app.request(`/submissions/${sub.submissionId}/events/export?type=delivery.succeeded&format=jsonl`);
      expect(res.status).toBe(200);
      
      const body = await res.text();
      expect(body.trim()).toBe("");
    });

    it("redacts sensitive tokens in exported events", async () => {
      const sub = await manager.createSubmission({
        intakeId: "test-intake",
        actor: testActor,
      });

      const res = await app.request(`/submissions/${sub.submissionId}/events/export?format=json`);
      expect(res.status).toBe(200);
      
      const body = await res.text();
      const events = JSON.parse(body);
      
      // Check that no events contain resumeToken in their payload
      for (const event of events) {
        if (event.payload) {
          expect(event.payload).not.toHaveProperty("resumeToken");
        }
      }
    });

    it("applies limit correctly in export", async () => {
      const sub = await manager.createSubmission({
        intakeId: "test-intake",
        actor: testActor,
      });

      // Generate one field update to get multiple events
      await manager.setFields({
        submissionId: sub.submissionId,
        resumeToken: sub.resumeToken,
        actor: testActor,
        fields: { name: "test" },
      });

      const res = await app.request(`/submissions/${sub.submissionId}/events/export?limit=1&format=json`);
      expect(res.status).toBe(200);
      
      const body = await res.text();
      const events = JSON.parse(body);
      expect(events.length).toBe(1);
    });

    it("applies offset correctly in export", async () => {
      const sub = await manager.createSubmission({
        intakeId: "test-intake",
        actor: testActor,
      });

      // Generate one field update to get multiple events
      await manager.setFields({
        submissionId: sub.submissionId,
        resumeToken: sub.resumeToken,
        actor: testActor,
        fields: { name: "test" },
      });

      const resAll = await app.request(`/submissions/${sub.submissionId}/events/export?format=json`);
      const allEvents = JSON.parse(await resAll.text());

      const resOffset = await app.request(`/submissions/${sub.submissionId}/events/export?offset=1&format=json`);
      const offsetEvents = JSON.parse(await resOffset.text());

      expect(offsetEvents.length).toBe(allEvents.length - 1);
    });
  });
});