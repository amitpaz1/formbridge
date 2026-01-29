/**
 * Submission Routes Tests
 * Verify HTTP endpoint handlers for submission operations
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSubmissionRoutes } from "../submissions";
import type { SubmissionManager } from "../../core/submission-manager";
import type { Submission } from "../../types";

describe("Submission Routes", () => {
  describe("POST /submissions/:id/handoff", () => {
    it("should generate handoff URL for existing submission", async () => {
      // Mock submission
      const mockSubmission: Submission = {
        id: "sub_test123",
        intakeId: "intake_test",
        state: "in_progress",
        resumeToken: "rtok_abc123",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        fields: { name: "Test" },
        fieldAttribution: {},
        createdBy: { kind: "agent", id: "agent_1", name: "Agent" },
        updatedBy: { kind: "agent", id: "agent_1", name: "Agent" },
        events: [],
      };

      // Mock SubmissionManager
      const mockManager = {
        generateHandoffUrl: vi.fn().mockResolvedValue("http://localhost:3000/resume?token=rtok_abc123"),
        getSubmission: vi.fn().mockResolvedValue(mockSubmission),
      } as unknown as SubmissionManager;

      // Create routes
      const routes = createSubmissionRoutes(mockManager);

      // Mock Express request and response
      const mockReq = {
        params: { id: "sub_test123" },
        body: {
          actor: {
            kind: "agent",
            id: "agent_1",
            name: "Test Agent",
          },
        },
      };

      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      const mockNext = vi.fn();

      // Call the handler
      await routes.generateHandoff(mockReq as any, mockRes as any, mockNext);

      // Verify generateHandoffUrl was called with correct params
      expect(mockManager.generateHandoffUrl).toHaveBeenCalledWith(
        "sub_test123",
        mockReq.body.actor
      );

      // Verify response
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        resumeUrl: "http://localhost:3000/resume?token=rtok_abc123",
        submissionId: "sub_test123",
        resumeToken: "rtok_abc123",
      });
    });

    it("should use system actor when no actor provided in request", async () => {
      const mockSubmission: Submission = {
        id: "sub_test123",
        intakeId: "intake_test",
        state: "in_progress",
        resumeToken: "rtok_abc123",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        fields: {},
        fieldAttribution: {},
        createdBy: { kind: "system", id: "system", name: "System" },
        updatedBy: { kind: "system", id: "system", name: "System" },
        events: [],
      };

      const mockManager = {
        generateHandoffUrl: vi.fn().mockResolvedValue("http://localhost:3000/resume?token=rtok_abc123"),
        getSubmission: vi.fn().mockResolvedValue(mockSubmission),
      } as unknown as SubmissionManager;

      const routes = createSubmissionRoutes(mockManager);

      const mockReq = {
        params: { id: "sub_test123" },
        body: {}, // No actor provided
      };

      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      const mockNext = vi.fn();

      await routes.generateHandoff(mockReq as any, mockRes as any, mockNext);

      // Verify system actor was used
      expect(mockManager.generateHandoffUrl).toHaveBeenCalledWith(
        "sub_test123",
        {
          kind: "system",
          id: "system",
          name: "System",
        }
      );

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it("should return 404 when submission not found", async () => {
      const mockManager = {
        generateHandoffUrl: vi.fn().mockRejectedValue(new Error("Submission not found: sub_notfound")),
        getSubmission: vi.fn().mockResolvedValue(null),
      } as unknown as SubmissionManager;

      const routes = createSubmissionRoutes(mockManager);

      const mockReq = {
        params: { id: "sub_notfound" },
        body: {},
      };

      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      const mockNext = vi.fn();

      await routes.generateHandoff(mockReq as any, mockRes as any, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Submission not found: sub_notfound",
      });
    });

    it("should return 400 when submission ID is missing", async () => {
      const mockManager = {} as unknown as SubmissionManager;
      const routes = createSubmissionRoutes(mockManager);

      const mockReq = {
        params: {}, // No id
        body: {},
      };

      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      const mockNext = vi.fn();

      await routes.generateHandoff(mockReq as any, mockRes as any, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Missing submission ID",
      });
    });

    it("should pass unknown errors to next middleware", async () => {
      const unknownError = new Error("Database connection failed");

      const mockManager = {
        generateHandoffUrl: vi.fn().mockRejectedValue(unknownError),
        getSubmission: vi.fn().mockResolvedValue(null),
      } as unknown as SubmissionManager;

      const routes = createSubmissionRoutes(mockManager);

      const mockReq = {
        params: { id: "sub_test123" },
        body: {},
      };

      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      const mockNext = vi.fn();

      await routes.generateHandoff(mockReq as any, mockRes as any, mockNext);

      // Unknown errors should be passed to next()
      expect(mockNext).toHaveBeenCalledWith(unknownError);
    });
  });
});
