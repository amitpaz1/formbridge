/**
 * Comprehensive tests for upload route handlers
 *
 * Tests all upload endpoints with coverage for error conditions and edge cases:
 * - POST /intake/:id/submissions/:sid/uploads — request a file upload
 * - POST /intake/:id/submissions/:sid/uploads/:uploadId/confirm — confirm upload completion
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { Hono } from "hono";
import { createUploadRouter } from "../../src/routes/uploads.js";
import type { IntakeRegistry } from "../../src/core/intake-registry.js";
import { IntakeNotFoundError } from "../../src/core/intake-registry.js";
import type { 
  SubmissionManager,
  RequestUploadInput,
  ConfirmUploadInput 
} from "../../src/core/submission-manager.js";
import type { Actor } from "../../src/types/intake-contract.js";

// ---------- Test Helpers ----------

const testActor: Actor = { kind: "agent", id: "test-agent", name: "Test Agent" };

function createMockIntakeRegistry(): IntakeRegistry {
  return {
    getIntake: vi.fn(),
    getSchema: vi.fn(),
    register: vi.fn(),
    listIntakes: vi.fn(),
  } as any;
}

function createMockSubmissionManager(): SubmissionManager {
  return {
    requestUpload: vi.fn(),
    confirmUpload: vi.fn(),
    create: vi.fn(),
    get: vi.fn(),
    update: vi.fn(),
    finalize: vi.fn(),
  } as any;
}

const validRequestBody = {
  resumeToken: "rtok_123",
  actor: testActor,
  field: "documents.w9",
  filename: "w9-form.pdf",
  mimeType: "application/pdf",
  sizeBytes: 524288,
};

const validConfirmBody = {
  resumeToken: "rtok_123", 
  actor: testActor,
};

const mockIntakeDefinition = {
  id: "vendor-onboarding",
  version: "1.0.0",
  name: "Vendor Onboarding",
  schema: { type: "object", properties: {} },
};

describe("Upload Routes", () => {
  let registry: IntakeRegistry;
  let manager: SubmissionManager;
  let app: Hono;

  beforeEach(() => {
    registry = createMockIntakeRegistry();
    manager = createMockSubmissionManager();
    app = new Hono();
    app.route("/", createUploadRouter(registry, manager));
  });

  describe("POST /:id/submissions/:sid/uploads", () => {
    it("should successfully request an upload", async () => {
      const mockResult = {
        ok: true,
        uploadId: "upl_123abc",
        method: "PUT",
        url: "https://storage.example.com/signed-url",
        expiresInMs: 900000,
        constraints: {
          accept: ["application/pdf"],
          maxBytes: 10485760,
        },
      };

      vi.mocked(registry.getIntake).mockReturnValue(mockIntakeDefinition);
      vi.mocked(manager.requestUpload).mockResolvedValue(mockResult);

      const response = await app.request("/vendor-onboarding/submissions/sub_123/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validRequestBody),
      });

      expect(response.status).toBe(201);
      expect(await response.json()).toEqual(mockResult);
      expect(registry.getIntake).toHaveBeenCalledWith("vendor-onboarding");
      expect(manager.requestUpload).toHaveBeenCalledWith(
        {
          submissionId: "sub_123",
          resumeToken: "rtok_123",
          field: "documents.w9",
          filename: "w9-form.pdf",
          mimeType: "application/pdf",
          sizeBytes: 524288,
          actor: testActor,
        },
        mockIntakeDefinition
      );
    });

    it("should return 400 for missing resumeToken", async () => {
      const response = await app.request("/vendor-onboarding/submissions/sub_123/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...validRequestBody, resumeToken: undefined }),
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.ok).toBe(false);
      expect(json.error.type).toBe("invalid_request");
      expect(json.error.message).toBe("Missing required field: resumeToken");
    });

    it("should return 400 for missing actor", async () => {
      const response = await app.request("/vendor-onboarding/submissions/sub_123/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...validRequestBody, actor: undefined }),
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.ok).toBe(false);
      expect(json.error.type).toBe("invalid_request");
      expect(json.error.message).toBe("Missing required field: actor (with kind and id)");
    });

    it("should return 400 for incomplete actor", async () => {
      const response = await app.request("/vendor-onboarding/submissions/sub_123/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...validRequestBody, actor: { kind: "agent" } }),
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.ok).toBe(false);
      expect(json.error.type).toBe("invalid_request");
      expect(json.error.message).toBe("Missing required field: actor (with kind and id)");
    });

    it("should return 400 for missing field", async () => {
      const response = await app.request("/vendor-onboarding/submissions/sub_123/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...validRequestBody, field: undefined }),
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.ok).toBe(false);
      expect(json.error.type).toBe("invalid_request");
      expect(json.error.message).toBe("Missing required fields: field, filename, mimeType, sizeBytes");
    });

    it("should return 400 for missing filename", async () => {
      const response = await app.request("/vendor-onboarding/submissions/sub_123/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...validRequestBody, filename: undefined }),
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.ok).toBe(false);
      expect(json.error.type).toBe("invalid_request");
      expect(json.error.message).toBe("Missing required fields: field, filename, mimeType, sizeBytes");
    });

    it("should return 400 for invalid sizeBytes (negative)", async () => {
      const response = await app.request("/vendor-onboarding/submissions/sub_123/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...validRequestBody, sizeBytes: -1 }),
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.ok).toBe(false);
      expect(json.error.type).toBe("invalid_request");
      expect(json.error.message).toBe("sizeBytes must be a positive integer");
    });

    it("should return 400 for invalid sizeBytes (zero)", async () => {
      const response = await app.request("/vendor-onboarding/submissions/sub_123/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...validRequestBody, sizeBytes: 0 }),
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.ok).toBe(false);
      expect(json.error.type).toBe("invalid_request");
      expect(json.error.message).toBe("sizeBytes must be a positive integer");
    });

    it("should return 400 for invalid sizeBytes (float)", async () => {
      const response = await app.request("/vendor-onboarding/submissions/sub_123/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...validRequestBody, sizeBytes: 123.5 }),
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.ok).toBe(false);
      expect(json.error.type).toBe("invalid_request");
      expect(json.error.message).toBe("sizeBytes must be a positive integer");
    });

    it("should return 400 for invalid sizeBytes (string)", async () => {
      const response = await app.request("/vendor-onboarding/submissions/sub_123/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...validRequestBody, sizeBytes: "123" }),
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.ok).toBe(false);
      expect(json.error.type).toBe("invalid_request");
      expect(json.error.message).toBe("Missing required fields: field, filename, mimeType, sizeBytes");
    });

    it("should return 404 for intake not found", async () => {
      vi.mocked(registry.getIntake).mockImplementation(() => {
        throw new IntakeNotFoundError("nonexistent");
      });

      const response = await app.request("/nonexistent/submissions/sub_123/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validRequestBody),
      });

      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json.ok).toBe(false);
      expect(json.error.type).toBe("not_found");
      expect(json.error.message).toBe("Intake definition 'nonexistent' not found");
    });

    it("should return 409 for invalid resume token", async () => {
      vi.mocked(registry.getIntake).mockReturnValue(mockIntakeDefinition);
      vi.mocked(manager.requestUpload).mockImplementation(() => {
        throw new Error("Invalid resume token for submission");
      });

      const response = await app.request("/vendor-onboarding/submissions/sub_123/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validRequestBody),
      });

      expect(response.status).toBe(409);
      const json = await response.json();
      expect(json.ok).toBe(false);
      expect(json.error.type).toBe("invalid_resume_token");
      expect(json.error.message).toBe("Invalid or expired resume token");
    });

    it("should return 404 for submission not found", async () => {
      vi.mocked(registry.getIntake).mockReturnValue(mockIntakeDefinition);
      vi.mocked(manager.requestUpload).mockImplementation(() => {
        throw new Error("Submission not found");
      });

      const response = await app.request("/vendor-onboarding/submissions/sub_123/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validRequestBody),
      });

      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json.ok).toBe(false);
      expect(json.error.type).toBe("not_found");
      expect(json.error.message).toBe("Submission or resource not found");
    });

    it("should return 500 for storage backend error", async () => {
      vi.mocked(registry.getIntake).mockReturnValue(mockIntakeDefinition);
      vi.mocked(manager.requestUpload).mockImplementation(() => {
        throw new Error("Storage backend not configured");
      });

      const response = await app.request("/vendor-onboarding/submissions/sub_123/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validRequestBody),
      });

      expect(response.status).toBe(500);
      const json = await response.json();
      expect(json.ok).toBe(false);
      expect(json.error.type).toBe("storage_error");
      expect(json.error.message).toBe("Storage backend error");
    });

    it("should return 500 for internal error", async () => {
      vi.mocked(registry.getIntake).mockReturnValue(mockIntakeDefinition);
      vi.mocked(manager.requestUpload).mockImplementation(() => {
        throw new Error("Unexpected internal error");
      });

      const response = await app.request("/vendor-onboarding/submissions/sub_123/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validRequestBody),
      });

      expect(response.status).toBe(500);
      const json = await response.json();
      expect(json.ok).toBe(false);
      expect(json.error.type).toBe("internal_error");
      expect(json.error.message).toBe("An internal error occurred");
    });
  });

  describe("POST /:id/submissions/:sid/uploads/:uploadId/confirm", () => {
    it("should successfully confirm an upload", async () => {
      const mockResult = {
        ok: true,
        submissionId: "sub_123",
        state: "in_progress" as const,
        resumeToken: "rtok_new456",
        field: "documents.w9",
      };

      vi.mocked(registry.getIntake).mockReturnValue(mockIntakeDefinition);
      vi.mocked(manager.confirmUpload).mockResolvedValue(mockResult);

      const response = await app.request("/vendor-onboarding/submissions/sub_123/uploads/upl_123/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validConfirmBody),
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(mockResult);
      expect(registry.getIntake).toHaveBeenCalledWith("vendor-onboarding");
      expect(manager.confirmUpload).toHaveBeenCalledWith({
        submissionId: "sub_123",
        resumeToken: "rtok_123",
        uploadId: "upl_123",
        actor: testActor,
      });
    });

    it("should return 400 for missing resumeToken", async () => {
      const response = await app.request("/vendor-onboarding/submissions/sub_123/uploads/upl_123/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actor: testActor }),
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.ok).toBe(false);
      expect(json.error.type).toBe("invalid_request");
      expect(json.error.message).toBe("Missing required field: resumeToken");
    });

    it("should return 400 for missing actor", async () => {
      const response = await app.request("/vendor-onboarding/submissions/sub_123/uploads/upl_123/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeToken: "rtok_123" }),
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.ok).toBe(false);
      expect(json.error.type).toBe("invalid_request");
      expect(json.error.message).toBe("Missing required field: actor (with kind and id)");
    });

    it("should return 404 for intake not found", async () => {
      vi.mocked(registry.getIntake).mockImplementation(() => {
        throw new IntakeNotFoundError("nonexistent");
      });

      const response = await app.request("/nonexistent/submissions/sub_123/uploads/upl_123/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validConfirmBody),
      });

      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json.ok).toBe(false);
      expect(json.error.type).toBe("not_found");
      expect(json.error.message).toBe("Intake definition 'nonexistent' not found");
    });

    it("should return 409 for invalid resume token", async () => {
      vi.mocked(registry.getIntake).mockReturnValue(mockIntakeDefinition);
      vi.mocked(manager.confirmUpload).mockImplementation(() => {
        throw new Error("Invalid resume token for submission");
      });

      const response = await app.request("/vendor-onboarding/submissions/sub_123/uploads/upl_123/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validConfirmBody),
      });

      expect(response.status).toBe(409);
      const json = await response.json();
      expect(json.ok).toBe(false);
      expect(json.error.type).toBe("invalid_resume_token");
      expect(json.error.message).toBe("Invalid or expired resume token");
    });

    it("should return 404 for upload not found", async () => {
      vi.mocked(registry.getIntake).mockReturnValue(mockIntakeDefinition);
      vi.mocked(manager.confirmUpload).mockImplementation(() => {
        throw new Error("Upload not found");
      });

      const response = await app.request("/vendor-onboarding/submissions/sub_123/uploads/upl_123/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validConfirmBody),
      });

      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json.ok).toBe(false);
      expect(json.error.type).toBe("not_found");
      expect(json.error.message).toBe("Submission or resource not found");
    });

    it("should return 400 for upload verification failure", async () => {
      vi.mocked(registry.getIntake).mockReturnValue(mockIntakeDefinition);
      vi.mocked(manager.confirmUpload).mockImplementation(() => {
        throw new Error("Upload verification failed - file corrupted");
      });

      const response = await app.request("/vendor-onboarding/submissions/sub_123/uploads/upl_123/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validConfirmBody),
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.ok).toBe(false);
      expect(json.error.type).toBe("storage_error");
      expect(json.error.message).toBe("Upload verification failed");
    });

    it("should return 500 for storage backend error", async () => {
      vi.mocked(registry.getIntake).mockReturnValue(mockIntakeDefinition);
      vi.mocked(manager.confirmUpload).mockImplementation(() => {
        throw new Error("Storage backend connection lost");
      });

      const response = await app.request("/vendor-onboarding/submissions/sub_123/uploads/upl_123/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validConfirmBody),
      });

      expect(response.status).toBe(500);
      const json = await response.json();
      expect(json.ok).toBe(false);
      expect(json.error.type).toBe("storage_error");
      expect(json.error.message).toBe("Storage backend error");
    });

    it("should return 500 for internal error", async () => {
      vi.mocked(registry.getIntake).mockReturnValue(mockIntakeDefinition);
      vi.mocked(manager.confirmUpload).mockImplementation(() => {
        throw new Error("Unexpected internal error");
      });

      const response = await app.request("/vendor-onboarding/submissions/sub_123/uploads/upl_123/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validConfirmBody),
      });

      expect(response.status).toBe(500);
      const json = await response.json();
      expect(json.ok).toBe(false);
      expect(json.error.type).toBe("internal_error");
      expect(json.error.message).toBe("An internal error occurred");
    });
  });
});