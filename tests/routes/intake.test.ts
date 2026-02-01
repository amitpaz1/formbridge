/**
 * Comprehensive tests for intake route handlers
 *
 * Tests intake schema endpoint with coverage for error conditions and edge cases:
 * - GET /intake/:id/schema — get schema for an intake
 * 
 * Note: The source file (src/routes/intake.ts) currently only implements the schema endpoint.
 * The task description mentioned additional routes (GET /intakes, GET /intakes/:id) but these
 * do not exist in the current implementation.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { Hono } from "hono";
import { createIntakeRouter, createGetSchemaHandler } from "../../src/routes/intake.js";
import type { IntakeRegistry } from "../../src/core/intake-registry.js";
import { IntakeNotFoundError } from "../../src/core/intake-registry.js";
import type { JSONSchema } from "../../src/submission-types.js";

// ---------- Test Helpers ----------

function createMockIntakeRegistry(): IntakeRegistry {
  return {
    getSchema: vi.fn(),
    getIntake: vi.fn(),
    register: vi.fn(),
    listIntakes: vi.fn(),
  } as any;
}

const mockSchema: JSONSchema = {
  type: "object",
  properties: {
    legal_name: {
      type: "string",
      minLength: 1,
    },
    country: {
      type: "string",
      enum: ["US", "CA", "UK", "DE", "FR"],
    },
    tax_id: {
      type: "string",
      pattern: "^[0-9]{2}-[0-9]{7}$",
    },
    contact_email: {
      type: "string",
      format: "email",
    },
  },
  required: ["legal_name", "country", "tax_id", "contact_email"],
};

describe("Intake Routes", () => {
  let registry: IntakeRegistry;
  let app: Hono;

  beforeEach(() => {
    registry = createMockIntakeRegistry();
    app = new Hono();
    app.route("/", createIntakeRouter(registry));
  });

  describe("GET /:id/schema", () => {
    it("should successfully return intake schema", async () => {
      vi.mocked(registry.getSchema).mockReturnValue(mockSchema);

      const response = await app.request("/vendor-onboarding/schema", {
        method: "GET",
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json).toEqual({
        ok: true,
        intakeId: "vendor-onboarding",
        schema: mockSchema,
      });
      expect(registry.getSchema).toHaveBeenCalledWith("vendor-onboarding");
    });

    it("should return 404 for intake not found", async () => {
      vi.mocked(registry.getSchema).mockImplementation(() => {
        throw new IntakeNotFoundError("nonexistent");
      });

      const response = await app.request("/nonexistent/schema", {
        method: "GET",
      });

      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json.ok).toBe(false);
      expect(json.error.type).toBe("not_found");
      expect(json.error.message).toBe("Intake definition 'nonexistent' not found");
      expect(registry.getSchema).toHaveBeenCalledWith("nonexistent");
    });

    it("should return 500 for unexpected error", async () => {
      vi.mocked(registry.getSchema).mockImplementation(() => {
        throw new Error("Database connection failed");
      });

      const response = await app.request("/vendor-onboarding/schema", {
        method: "GET",
      });

      expect(response.status).toBe(500);
      const json = await response.json();
      expect(json.ok).toBe(false);
      expect(json.error.type).toBe("internal_error");
      expect(json.error.message).toBe("Database connection failed");
    });

    it("should return 500 for unknown error", async () => {
      vi.mocked(registry.getSchema).mockImplementation(() => {
        throw "String error"; // Non-Error object
      });

      const response = await app.request("/vendor-onboarding/schema", {
        method: "GET",
      });

      expect(response.status).toBe(500);
      const json = await response.json();
      expect(json.ok).toBe(false);
      expect(json.error.type).toBe("internal_error");
      expect(json.error.message).toBe("Unknown error occurred");
    });

    it("should work with different intake IDs", async () => {
      const simpleSchema: JSONSchema = {
        type: "object",
        properties: {
          name: { type: "string" },
        },
        required: ["name"],
      };

      vi.mocked(registry.getSchema).mockReturnValue(simpleSchema);

      const response = await app.request("/simple-intake/schema", {
        method: "GET",
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json).toEqual({
        ok: true,
        intakeId: "simple-intake",
        schema: simpleSchema,
      });
      expect(registry.getSchema).toHaveBeenCalledWith("simple-intake");
    });

    it("should handle complex schema structures", async () => {
      const complexSchema: JSONSchema = {
        type: "object",
        properties: {
          personal: {
            type: "object",
            properties: {
              firstName: { type: "string" },
              lastName: { type: "string" },
              age: { type: "integer", minimum: 0, maximum: 150 },
            },
            required: ["firstName", "lastName"],
          },
          documents: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["passport", "license", "id"] },
                number: { type: "string" },
              },
              required: ["type", "number"],
            },
            minItems: 1,
            maxItems: 5,
          },
        },
        required: ["personal"],
      };

      vi.mocked(registry.getSchema).mockReturnValue(complexSchema);

      const response = await app.request("/complex-intake/schema", {
        method: "GET",
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.ok).toBe(true);
      expect(json.intakeId).toBe("complex-intake");
      expect(json.schema).toEqual(complexSchema);
    });
  });

  describe("createGetSchemaHandler standalone function", () => {
    it("should work as a standalone handler", async () => {
      const handler = createGetSchemaHandler(registry);
      vi.mocked(registry.getSchema).mockReturnValue(mockSchema);

      // Create a minimal context object for testing
      const mockContext = {
        req: {
          param: vi.fn().mockReturnValue("vendor-onboarding"),
        },
        json: vi.fn().mockReturnValue({ mocked: "response" }),
      } as any;

      const result = await handler(mockContext);

      expect(mockContext.req.param).toHaveBeenCalledWith("id");
      expect(mockContext.json).toHaveBeenCalledWith(
        {
          ok: true,
          intakeId: "vendor-onboarding",
          schema: mockSchema,
        },
        200
      );
      expect(result).toEqual({ mocked: "response" });
    });

    it("should handle errors in standalone mode", async () => {
      const handler = createGetSchemaHandler(registry);
      vi.mocked(registry.getSchema).mockImplementation(() => {
        throw new IntakeNotFoundError("test-intake");
      });

      const mockContext = {
        req: {
          param: vi.fn().mockReturnValue("test-intake"),
        },
        json: vi.fn().mockReturnValue({ mocked: "error" }),
      } as any;

      const result = await handler(mockContext);

      expect(mockContext.json).toHaveBeenCalledWith(
        {
          ok: false,
          error: {
            type: "not_found",
            message: "Intake definition 'test-intake' not found",
          },
        },
        404
      );
      expect(result).toEqual({ mocked: "error" });
    });
  });
});