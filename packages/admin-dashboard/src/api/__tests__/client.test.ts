/**
 * Tests for Admin Dashboard FormBridgeApiClient
 *
 * Covers:
 * - Constructor (baseUrl normalization, headers, API key)
 * - All API methods (intakes, submissions, events, approvals, deliveries, analytics)
 * - Error handling (ApiError, non-OK responses)
 * - URL encoding of path parameters
 * - Query parameter construction for filters
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FormBridgeApiClient, ApiError } from '../client';

// Mock global fetch
const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  mockFetch.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockOk(data: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  });
}

function mockError(status: number, body: string) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    text: () => Promise.resolve(body),
  });
}

function createClient(apiKey?: string) {
  return new FormBridgeApiClient({
    baseUrl: 'https://api.example.com/',
    apiKey,
  });
}

describe('FormBridgeApiClient', () => {
  describe('constructor', () => {
    it('should strip trailing slash from baseUrl', async () => {
      const client = createClient();
      mockOk([]);
      await client.listIntakes();
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/intakes',
        expect.any(Object)
      );
    });

    it('should set Content-Type header', async () => {
      const client = createClient();
      mockOk([]);
      await client.listIntakes();
      const callArgs = mockFetch.mock.calls[0]!;
      expect(callArgs[1].headers['Content-Type']).toBe('application/json');
    });

    it('should set Authorization header when apiKey provided', async () => {
      const client = createClient('fb_key_123');
      mockOk([]);
      await client.listIntakes();
      const callArgs = mockFetch.mock.calls[0]!;
      expect(callArgs[1].headers['Authorization']).toBe('Bearer fb_key_123');
    });

    it('should not set Authorization header without apiKey', async () => {
      const client = createClient();
      mockOk([]);
      await client.listIntakes();
      const callArgs = mockFetch.mock.calls[0]!;
      expect(callArgs[1].headers['Authorization']).toBeUndefined();
    });
  });

  describe('intakes', () => {
    it('should list intakes', async () => {
      const client = createClient();
      const data = [{ intakeId: 'vendor', name: 'Vendor' }];
      mockOk(data);
      const result = await client.listIntakes();
      expect(result).toEqual(data);
    });

    it('should get intake by ID', async () => {
      const client = createClient();
      const data = { intakeId: 'vendor', name: 'Vendor' };
      mockOk(data);
      const result = await client.getIntake('vendor');
      expect(result).toEqual(data);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/intakes/vendor',
        expect.any(Object)
      );
    });

    it('should encode intakeId in URL', async () => {
      const client = createClient();
      mockOk({});
      await client.getIntake('vendor/special');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/intakes/vendor%2Fspecial',
        expect.any(Object)
      );
    });
  });

  describe('submissions', () => {
    it('should list submissions without filter', async () => {
      const client = createClient();
      const data = { data: [], total: 0, page: 1, pageSize: 20, hasMore: false };
      mockOk(data);
      const result = await client.listSubmissions('vendor');
      expect(result).toEqual(data);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/intakes/vendor/submissions',
        expect.any(Object)
      );
    });

    it('should list submissions with filter parameters', async () => {
      const client = createClient();
      mockOk({ data: [], total: 0, page: 2, pageSize: 10, hasMore: false });
      await client.listSubmissions('vendor', {
        state: 'draft',
        page: 2,
        pageSize: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
      const url = mockFetch.mock.calls[0]![0] as string;
      expect(url).toContain('state=draft');
      expect(url).toContain('page=2');
      expect(url).toContain('pageSize=10');
      expect(url).toContain('sortBy=createdAt');
      expect(url).toContain('sortOrder=desc');
    });

    it('should skip undefined filter params', async () => {
      const client = createClient();
      mockOk({ data: [], total: 0, page: 1, pageSize: 20, hasMore: false });
      await client.listSubmissions('vendor', { state: 'draft' });
      const url = mockFetch.mock.calls[0]![0] as string;
      expect(url).toContain('state=draft');
      expect(url).not.toContain('page=');
      expect(url).not.toContain('sortBy=');
    });

    it('should get submission by ID', async () => {
      const client = createClient();
      const detail = { id: 'sub-1', intakeId: 'vendor', state: 'draft', events: [], deliveries: [] };
      mockOk(detail);
      const result = await client.getSubmission('vendor', 'sub-1');
      expect(result).toEqual(detail);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/intakes/vendor/submissions/sub-1',
        expect.any(Object)
      );
    });

    it('should encode submissionId in URL', async () => {
      const client = createClient();
      mockOk({});
      await client.getSubmission('vendor', 'sub/123');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/intakes/vendor/submissions/sub%2F123',
        expect.any(Object)
      );
    });
  });

  describe('events', () => {
    it('should get events for a submission', async () => {
      const client = createClient();
      const events = [{ eventId: 'e1', type: 'created' }];
      mockOk(events);
      const result = await client.getEvents('sub-1');
      expect(result).toEqual(events);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/submissions/sub-1/events',
        expect.any(Object)
      );
    });
  });

  describe('approvals', () => {
    it('should list pending approvals', async () => {
      const client = createClient();
      const approvals = [{ submissionId: 'sub-1', state: 'needs_review' }];
      mockOk(approvals);
      const result = await client.listPendingApprovals();
      expect(result).toEqual(approvals);
    });

    it('should approve submission with comment', async () => {
      const client = createClient();
      mockOk({});
      await client.approveSubmission('vendor', 'sub-1', 'Looks good');
      const callArgs = mockFetch.mock.calls[0]!;
      expect(callArgs[0]).toBe(
        'https://api.example.com/intakes/vendor/submissions/sub-1/approve'
      );
      expect(callArgs[1].method).toBe('POST');
      expect(JSON.parse(callArgs[1].body)).toEqual({ comment: 'Looks good' });
    });

    it('should approve submission without comment', async () => {
      const client = createClient();
      mockOk({});
      await client.approveSubmission('vendor', 'sub-1');
      const callArgs = mockFetch.mock.calls[0]!;
      expect(JSON.parse(callArgs[1].body)).toEqual({ comment: undefined });
    });

    it('should reject submission with reason', async () => {
      const client = createClient();
      mockOk({});
      await client.rejectSubmission('vendor', 'sub-1', 'Missing docs');
      const callArgs = mockFetch.mock.calls[0]!;
      expect(callArgs[0]).toBe(
        'https://api.example.com/intakes/vendor/submissions/sub-1/reject'
      );
      expect(JSON.parse(callArgs[1].body)).toEqual({ reason: 'Missing docs' });
    });
  });

  describe('deliveries', () => {
    it('should get deliveries for a submission', async () => {
      const client = createClient();
      const deliveries = [{ deliveryId: 'd1', status: 'succeeded' }];
      mockOk(deliveries);
      const result = await client.getDeliveries('sub-1');
      expect(result).toEqual(deliveries);
    });

    it('should retry delivery', async () => {
      const client = createClient();
      mockOk({});
      await client.retryDelivery('d-123');
      const callArgs = mockFetch.mock.calls[0]!;
      expect(callArgs[0]).toBe(
        'https://api.example.com/webhooks/deliveries/d-123/retry'
      );
      expect(callArgs[1].method).toBe('POST');
    });

    it('should encode deliveryId in URL', async () => {
      const client = createClient();
      mockOk({});
      await client.retryDelivery('d/special');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/webhooks/deliveries/d%2Fspecial/retry',
        expect.any(Object)
      );
    });
  });

  describe('analytics', () => {
    it('should get analytics summary', async () => {
      const client = createClient();
      const summary = { totalIntakes: 5, totalSubmissions: 100 };
      mockOk(summary);
      const result = await client.getAnalyticsSummary();
      expect(result).toEqual(summary);
    });

    it('should get volume data with default days', async () => {
      const client = createClient();
      mockOk([]);
      await client.getVolumeData();
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/analytics/volume?days=30',
        expect.any(Object)
      );
    });

    it('should get volume data with custom days', async () => {
      const client = createClient();
      mockOk([]);
      await client.getVolumeData(7);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/analytics/volume?days=7',
        expect.any(Object)
      );
    });

    it('should get intake metrics', async () => {
      const client = createClient();
      mockOk([]);
      const result = await client.getIntakeMetrics();
      expect(result).toEqual([]);
    });

    it('should get funnel data', async () => {
      const client = createClient();
      mockOk([]);
      const result = await client.getFunnelData();
      expect(result).toEqual([]);
    });
  });

  describe('error handling', () => {
    it('should throw ApiError for non-OK response', async () => {
      const client = createClient();
      mockError(404, '{"error":"not found"}');
      await expect(client.getIntake('missing')).rejects.toThrow(ApiError);
    });

    it('should include status, body, and path in ApiError', async () => {
      const client = createClient();
      mockError(500, 'Internal Server Error');
      try {
        await client.listIntakes();
        expect.unreachable('Should have thrown');
      } catch (e) {
        const err = e as ApiError;
        expect(err.status).toBe(500);
        expect(err.body).toBe('Internal Server Error');
        expect(err.path).toBe('/intakes');
        expect(err.name).toBe('ApiError');
      }
    });

    it('should propagate network errors', async () => {
      const client = createClient();
      mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'));
      await expect(client.listIntakes()).rejects.toThrow('fetch failed');
    });
  });

  describe('ApiError class', () => {
    it('should have descriptive message', () => {
      const err = new ApiError(404, 'Not found', '/intakes/vendor');
      expect(err.message).toContain('404');
      expect(err.message).toContain('/intakes/vendor');
      expect(err.message).toContain('Not found');
    });

    it('should extend Error', () => {
      const err = new ApiError(500, 'fail', '/test');
      expect(err).toBeInstanceOf(Error);
    });
  });
});
