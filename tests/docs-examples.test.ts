/**
 * Tests for code examples used in documentation.
 * Ensures documented code actually works.
 */

import { describe, it, expect } from "vitest";
import { createFormBridgeAppWithIntakes } from "../src/app";
import { WebhookManager, signPayload, verifySignature } from "../src/core/webhook-manager";
import { InMemoryDeliveryQueue } from "../src/core/delivery-queue";
import { InMemoryEventStore } from "../src/core/event-store";

describe("Documentation Code Examples", () => {
  const vendorIntake = {
    id: "vendor-onboarding",
    version: "1.0.0",
    name: "Vendor Onboarding",
    description: "Collect vendor registration data",
    schema: {
      type: "object" as const,
      properties: {
        companyName: { type: "string", description: "Legal company name" },
        taxId: { type: "string", pattern: "^\\d{2}-\\d{7}$" },
        contactEmail: { type: "string", format: "email" },
      },
      required: ["companyName", "taxId", "contactEmail"],
    },
    destination: {
      kind: "webhook" as const,
      url: "https://your-api.com/vendors",
    },
  };

  it("quickstart: should create app with intake definitions", () => {
    const app = createFormBridgeAppWithIntakes([vendorIntake]);
    expect(app).toBeDefined();
  });

  it("quickstart: should create submission via HTTP", async () => {
    const app = createFormBridgeAppWithIntakes([vendorIntake]);

    const res = await app.request("/intake/vendor-onboarding/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actor: { kind: "agent", id: "my-agent" },
        initialFields: { companyName: "TechCorp" },
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.submissionId).toMatch(/^sub_/);
  });

  it("webhooks: should sign and verify payloads", () => {
    const payload = JSON.stringify({ submissionId: "sub_123" });
    const secret = "my-webhook-secret";

    const signature = signPayload(payload, secret);
    expect(verifySignature(payload, signature, secret)).toBe(true);
    expect(verifySignature(payload, "wrong", secret)).toBe(false);
  });

  it("events: should create and query event store", async () => {
    const store = new InMemoryEventStore();

    await store.appendEvent({
      eventId: "evt_1",
      type: "submission.created",
      submissionId: "sub_1",
      ts: new Date().toISOString(),
      actor: { kind: "agent", id: "agent-1" },
      state: "draft",
      payload: { intakeId: "test" },
    });

    const events = await store.getEvents("sub_1");
    expect(events).toHaveLength(1);
    expect(events[0].version).toBe(1);
  });
});
