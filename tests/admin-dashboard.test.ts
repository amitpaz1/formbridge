/**
 * Feature 022 — Admin Dashboard Tests
 *
 * Tests the API client, analytics route, and dashboard component/page exports.
 * Component render tests are skipped here — they require a React environment.
 */

import { describe, it, expect, vi } from "vitest";
import {
  createHonoAnalyticsRouter,
  type AnalyticsDataProvider,
} from "../src/routes/hono-analytics.js";

// =============================================================================
// § API Client Tests
// =============================================================================

describe("FormBridgeApiClient", () => {
  const API_BASE = "http://localhost:3000";

  function createMockFetch(response: unknown, status = 200) {
    return vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(response),
      text: () => Promise.resolve(JSON.stringify(response)),
    });
  }

  it("should construct API URLs correctly", async () => {
    const mockFetch = createMockFetch([]);
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;

    try {
      const { FormBridgeApiClient } = await import(
        "../packages/admin-dashboard/src/api/client.js"
      );
      const client = new FormBridgeApiClient({ baseUrl: API_BASE });
      await client.listIntakes();

      expect(mockFetch).toHaveBeenCalledWith(
        `${API_BASE}/intakes`,
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        })
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("should include API key in auth header", async () => {
    const mockFetch = createMockFetch([]);
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;

    try {
      const { FormBridgeApiClient } = await import(
        "../packages/admin-dashboard/src/api/client.js"
      );
      const client = new FormBridgeApiClient({
        baseUrl: API_BASE,
        apiKey: "test-key-123",
      });
      await client.listIntakes();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer test-key-123",
          }),
        })
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("should throw ApiError on non-ok response", async () => {
    const mockFetch = createMockFetch({ error: "not found" }, 404);
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;

    try {
      const { FormBridgeApiClient, ApiError } = await import(
        "../packages/admin-dashboard/src/api/client.js"
      );
      const client = new FormBridgeApiClient({ baseUrl: API_BASE });

      await expect(client.listIntakes()).rejects.toThrow(ApiError);
      await expect(client.listIntakes()).rejects.toMatchObject({
        status: 404,
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("should build query string for submission filters", async () => {
    const mockFetch = createMockFetch({
      data: [],
      total: 0,
      page: 1,
      pageSize: 20,
      hasMore: false,
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;

    try {
      const { FormBridgeApiClient } = await import(
        "../packages/admin-dashboard/src/api/client.js"
      );
      const client = new FormBridgeApiClient({ baseUrl: API_BASE });
      await client.listSubmissions("test-intake", {
        state: "submitted",
        page: 2,
        pageSize: 10,
      });

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain("state=submitted");
      expect(calledUrl).toContain("page=2");
      expect(calledUrl).toContain("pageSize=10");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("should encode URL parameters", async () => {
    const mockFetch = createMockFetch({});
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;

    try {
      const { FormBridgeApiClient } = await import(
        "../packages/admin-dashboard/src/api/client.js"
      );
      const client = new FormBridgeApiClient({ baseUrl: API_BASE });
      await client.getIntake("intake with spaces");

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain("intake%20with%20spaces");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("should call approve with POST and body", async () => {
    const mockFetch = createMockFetch({});
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;

    try {
      const { FormBridgeApiClient } = await import(
        "../packages/admin-dashboard/src/api/client.js"
      );
      const client = new FormBridgeApiClient({ baseUrl: API_BASE });
      await client.approveSubmission("intake-1", "sub-1", "looks good");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/approve"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ comment: "looks good" }),
        })
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("should call retry delivery with POST", async () => {
    const mockFetch = createMockFetch({});
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;

    try {
      const { FormBridgeApiClient } = await import(
        "../packages/admin-dashboard/src/api/client.js"
      );
      const client = new FormBridgeApiClient({ baseUrl: API_BASE });
      await client.retryDelivery("del-123");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/webhooks/deliveries/del-123/retry"),
        expect.objectContaining({ method: "POST" })
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("should strip trailing slash from base URL", async () => {
    const mockFetch = createMockFetch([]);
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;

    try {
      const { FormBridgeApiClient } = await import(
        "../packages/admin-dashboard/src/api/client.js"
      );
      const client = new FormBridgeApiClient({
        baseUrl: "http://localhost:3000/",
      });
      await client.listIntakes();

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toBe("http://localhost:3000/intakes");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("should call analytics summary endpoint", async () => {
    const mockFetch = createMockFetch({
      totalIntakes: 3,
      totalSubmissions: 42,
      pendingApprovals: 5,
      submissionsByState: {},
      recentActivity: [],
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;

    try {
      const { FormBridgeApiClient } = await import(
        "../packages/admin-dashboard/src/api/client.js"
      );
      const client = new FormBridgeApiClient({ baseUrl: API_BASE });
      const result = await client.getAnalyticsSummary();

      expect(result.totalIntakes).toBe(3);
      expect(result.totalSubmissions).toBe(42);
      expect(mockFetch).toHaveBeenCalledWith(
        `${API_BASE}/analytics/summary`,
        expect.any(Object)
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("should call volume endpoint with days parameter", async () => {
    const mockFetch = createMockFetch([{ date: "2025-01-01", count: 5 }]);
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;

    try {
      const { FormBridgeApiClient } = await import(
        "../packages/admin-dashboard/src/api/client.js"
      );
      const client = new FormBridgeApiClient({ baseUrl: API_BASE });
      await client.getVolumeData(7);

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain("/analytics/volume?days=7");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

// =============================================================================
// § Analytics Route Tests
// =============================================================================

describe("Analytics Route", () => {
  function createMockProvider(
    overrides: Partial<AnalyticsDataProvider> = {}
  ): AnalyticsDataProvider {
    return {
      getIntakeIds: () => ["intake-1", "intake-2"],
      getTotalSubmissions: () => 15,
      getPendingApprovalCount: () => 3,
      getSubmissionsByState: () => ({
        draft: 5,
        submitted: 3,
        approved: 7,
      }),
      getRecentEvents: () => [],
      getEventsByType: () => [],
      ...overrides,
    };
  }

  it("should return analytics summary", async () => {
    const provider = createMockProvider();
    const router = createHonoAnalyticsRouter(provider);

    const res = await router.request("/analytics/summary");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({
      totalIntakes: 2,
      totalSubmissions: 15,
      pendingApprovals: 3,
      submissionsByState: { draft: 5, submitted: 3, approved: 7 },
      recentActivity: [],
    });
  });

  it("should return volume data with correct number of days", async () => {
    const provider = createMockProvider();
    const router = createHonoAnalyticsRouter(provider);

    const res = await router.request("/analytics/volume?days=7");
    expect(res.status).toBe(200);

    const body = (await res.json()) as Array<{ date: string; count: number }>;
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(7);
    expect(body[0]).toHaveProperty("date");
    expect(body[0]).toHaveProperty("count");
  });

  it("should default to 30 days for volume", async () => {
    const provider = createMockProvider();
    const router = createHonoAnalyticsRouter(provider);

    const res = await router.request("/analytics/volume");
    expect(res.status).toBe(200);

    const body = (await res.json()) as Array<{ date: string; count: number }>;
    expect(body.length).toBe(30);
  });

  it("should cap volume days at 365", async () => {
    const provider = createMockProvider();
    const router = createHonoAnalyticsRouter(provider);

    const res = await router.request("/analytics/volume?days=999");
    expect(res.status).toBe(200);

    const body = (await res.json()) as Array<{ date: string; count: number }>;
    expect(body.length).toBe(365);
  });

  it("should count events matching volume date range", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const provider = createMockProvider({
      getEventsByType: (type: string) => {
        if (type === "submission.created") {
          return [
            {
              eventId: "e1",
              type: "submission.created" as any,
              submissionId: "s1",
              ts: `${today}T10:00:00.000Z`,
              actor: { kind: "agent" as const, id: "a1" },
              state: "draft" as any,
            },
            {
              eventId: "e2",
              type: "submission.created" as any,
              submissionId: "s2",
              ts: `${today}T12:00:00.000Z`,
              actor: { kind: "agent" as const, id: "a2" },
              state: "draft" as any,
            },
          ];
        }
        return [];
      },
    });

    const router = createHonoAnalyticsRouter(provider);
    const res = await router.request("/analytics/volume?days=7");
    const body = (await res.json()) as Array<{ date: string; count: number }>;

    const todayEntry = body.find((d) => d.date === today);
    expect(todayEntry).toBeDefined();
    expect(todayEntry!.count).toBe(2);
  });

  it("should include recent events in summary", async () => {
    const provider = createMockProvider({
      getRecentEvents: (limit: number) => [
        {
          eventId: "e1",
          type: "submission.created" as any,
          submissionId: "s1",
          ts: new Date().toISOString(),
          actor: { kind: "agent" as const, id: "a1" },
          state: "draft" as any,
        },
      ],
    });

    const router = createHonoAnalyticsRouter(provider);
    const res = await router.request("/analytics/summary");
    const body = await res.json() as any;

    expect(body.recentActivity).toHaveLength(1);
    expect(body.recentActivity[0].eventId).toBe("e1");
  });
});

// =============================================================================
// § Dashboard Component Structure Tests (no React required)
// =============================================================================

describe("Dashboard Component Structure", () => {
  it("should export NAV_ITEMS with expected routes", async () => {
    const { NAV_ITEMS } = await import(
      "../packages/admin-dashboard/src/components/nav-items.js"
    );
    expect(NAV_ITEMS.length).toBeGreaterThanOrEqual(5);
    const paths = NAV_ITEMS.map((n: { path: string }) => n.path);
    expect(paths).toContain("/");
    expect(paths).toContain("/intakes");
    expect(paths).toContain("/submissions");
    expect(paths).toContain("/approvals");
    expect(paths).toContain("/analytics");
  });

  it("should have correct nav item structure", async () => {
    const { NAV_ITEMS } = await import(
      "../packages/admin-dashboard/src/components/nav-items.js"
    );
    for (const item of NAV_ITEMS) {
      expect(item).toHaveProperty("id");
      expect(item).toHaveProperty("label");
      expect(item).toHaveProperty("path");
    }
  });
});

// =============================================================================
// § API Types Completeness
// =============================================================================

describe("API Client Types", () => {
  it("should export all expected types", async () => {
    const mod = await import(
      "../packages/admin-dashboard/src/api/client.js"
    );
    expect(mod.FormBridgeApiClient).toBeDefined();
    expect(mod.ApiError).toBeDefined();
  });

  it("ApiError should contain status and path", async () => {
    const { ApiError } = await import(
      "../packages/admin-dashboard/src/api/client.js"
    );
    const err = new ApiError(404, "not found", "/intakes");
    expect(err.status).toBe(404);
    expect(err.path).toBe("/intakes");
    expect(err.body).toBe("not found");
    expect(err.name).toBe("ApiError");
  });
});
