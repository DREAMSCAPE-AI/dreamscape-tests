/**
 * US-TEST-015 — Tests unitaires hotelCache middleware
 * Scénarios : cache hit, cache miss, Redis indisponible, TTL par middleware
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// ── Mock Redis client ─────────────────────────────────────────────────────────
const mockRedisGet     = jest.fn();
const mockRedisSet     = jest.fn();
const mockRedisIsReady = jest.fn();

jest.mock('@/config/redis', () => ({
  __esModule: true,
  default: {
    get:     mockRedisGet,
    set:     mockRedisSet,
    isReady: mockRedisIsReady,
  },
}));

// ── Import middleware ─────────────────────────────────────────────────────────
import {
  hotelSearchCache,
  hotelDetailsCache,
  hotelListCache,
} from '@/middleware/hotelCache';

// ── Helpers ───────────────────────────────────────────────────────────────────
function buildMocks(query: Record<string, string> = {}, params: Record<string, string> = {}) {
  const headers: Record<string, string> = {};
  const req: any = { query, params, headers };
  const res: any = {
    _status: 200,
    _body: null as any,
    _headers: {} as Record<string, string>,
    status(code: number) { this._status = code; return this; },
    json(body: any)      { this._body = body;   return this; },
    set(key: string, value: string) { this._headers[key] = value; return this; },
    statusCode: 200,
  };
  const next = jest.fn();
  return { req, res, next };
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('hotelCache — US-TEST-015', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRedisIsReady.mockReturnValue(true);
    mockRedisGet.mockResolvedValue(null as never);
    mockRedisSet.mockResolvedValue('OK' as never);
  });

  // ── hotelSearchCache ────────────────────────────────────────────────────────
  describe('hotelSearchCache', () => {
    it('should call next() on cache miss and set X-Cache: MISS header', async () => {
      mockRedisGet.mockResolvedValue(null as never);
      const { req, res, next } = buildMocks({ cityCode: 'PAR', checkIn: '2026-06-01' });

      await hotelSearchCache(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res._headers['X-Cache']).toBe('MISS');
    });

    it('should return cached data and set X-Cache: HIT on cache hit', async () => {
      const cachedPayload = {
        data:     { hotels: [{ id: 'H1', name: 'Hotel Paris' }] },
        cachedAt: new Date().toISOString(),
      };
      mockRedisGet.mockResolvedValue(JSON.stringify(cachedPayload) as never);

      const { req, res, next } = buildMocks({ cityCode: 'PAR' });

      await hotelSearchCache(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res._headers['X-Cache']).toBe('HIT');
      expect(res._body).toEqual(cachedPayload.data);
      expect(res._status).toBe(200);
    });

    it('should call next() when Redis is not ready (graceful degradation)', async () => {
      mockRedisIsReady.mockReturnValue(false);
      const { req, res, next } = buildMocks({ cityCode: 'PAR' });

      await hotelSearchCache(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(mockRedisGet).not.toHaveBeenCalled();
    });

    it('should cache response body when res.json() is called after a cache miss', async () => {
      mockRedisGet.mockResolvedValue(null as never);
      const { req, res, next } = buildMocks({ cityCode: 'LON' });

      await hotelSearchCache(req, res, next);

      // Simulate the route handler calling res.json()
      res.json({ hotels: [{ id: 'H2' }] });

      // Give the async cache set a tick to run
      await new Promise(resolve => setImmediate(resolve));

      expect(mockRedisSet).toHaveBeenCalledWith(
        expect.stringContaining('voyage:hotel:search'),
        expect.stringContaining('"hotels"'),
        300 // HOTEL_SEARCH TTL = 5 minutes
      );
    });

    it('should call next() when Redis.get throws (graceful degradation)', async () => {
      mockRedisGet.mockRejectedValue(new Error('Redis connection lost') as never);
      const { req, res, next } = buildMocks({ cityCode: 'PAR' });

      await hotelSearchCache(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  // ── hotelDetailsCache ───────────────────────────────────────────────────────
  describe('hotelDetailsCache', () => {
    it('should call next() on cache miss', async () => {
      mockRedisGet.mockResolvedValue(null as never);
      const { req, res, next } = buildMocks({}, { hotelId: 'H-001' });

      await hotelDetailsCache(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should return cached data on hit', async () => {
      const cachedPayload = {
        data:     { id: 'H-001', name: 'Grand Hotel' },
        cachedAt: new Date().toISOString(),
      };
      mockRedisGet.mockResolvedValue(JSON.stringify(cachedPayload) as never);

      const { req, res, next } = buildMocks({}, { hotelId: 'H-001' });

      await hotelDetailsCache(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res._headers['X-Cache']).toBe('HIT');
    });

    it('should cache with 15-minute TTL (900s) on miss', async () => {
      mockRedisGet.mockResolvedValue(null as never);
      const { req, res, next } = buildMocks({}, { hotelId: 'H-002' });

      await hotelDetailsCache(req, res, next);
      res.json({ id: 'H-002', name: 'Test Hotel' });

      await new Promise(resolve => setImmediate(resolve));

      expect(mockRedisSet).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        900 // HOTEL_DETAILS TTL = 15 minutes
      );
    });

    it('should call next() when Redis is not ready', async () => {
      mockRedisIsReady.mockReturnValue(false);
      const { req, res, next } = buildMocks({}, { hotelId: 'H-001' });

      await hotelDetailsCache(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  // ── hotelListCache ──────────────────────────────────────────────────────────
  describe('hotelListCache', () => {
    it('should call next() on cache miss', async () => {
      mockRedisGet.mockResolvedValue(null as never);
      const { req, res, next } = buildMocks({ page: '1' });

      await hotelListCache(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should return cached data on hit', async () => {
      const cachedPayload = {
        data:     [{ id: 'H1' }, { id: 'H2' }],
        cachedAt: new Date().toISOString(),
      };
      mockRedisGet.mockResolvedValue(JSON.stringify(cachedPayload) as never);

      const { req, res, next } = buildMocks({ page: '1' });

      await hotelListCache(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res._headers['X-Cache']).toBe('HIT');
    });

    it('should cache with 1-hour TTL (3600s) on miss', async () => {
      mockRedisGet.mockResolvedValue(null as never);
      const { req, res, next } = buildMocks({ page: '2' });

      await hotelListCache(req, res, next);
      res.json([{ id: 'H3' }]);

      await new Promise(resolve => setImmediate(resolve));

      expect(mockRedisSet).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        3600 // HOTEL_LIST TTL = 1 hour
      );
    });

    it('should call next() when Redis is not ready', async () => {
      mockRedisIsReady.mockReturnValue(false);
      const { req, res, next } = buildMocks({ page: '1' });

      await hotelListCache(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });
});
