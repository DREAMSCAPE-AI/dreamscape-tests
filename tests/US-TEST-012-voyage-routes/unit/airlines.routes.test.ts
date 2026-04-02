/**
 * US-TEST-012 — Tests unitaires routes/airlines.ts
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';

// ── Mocks ─────────────────────────────────────────────────────────────────────
const mockLookupAirlineCode = jest.fn();
const mockGetAirlineRoutes = jest.fn();

jest.mock('@/services/AmadeusService', () => ({
  __esModule: true,
  default: {
    lookupAirlineCode: mockLookupAirlineCode,
    getAirlineRoutes: mockGetAirlineRoutes,
  },
}));

jest.mock('@/config/environment', () => ({
  config: { amadeus: { baseUrl: 'https://test.api.amadeus.com', apiKey: 'k', apiSecret: 's' } },
}));

jest.mock('@/services/CacheService', () => ({
  __esModule: true,
  default: { cacheWrapper: jest.fn((_t: any, _p: any, fn: any) => fn()) },
}));

// ── App setup ─────────────────────────────────────────────────────────────────
import airlinesRouter from '@/routes/airlines';

const app = express();
app.use(express.json());
app.use('/airlines', airlinesRouter);

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('Airlines Routes — US-TEST-012', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /airlines/lookup', () => {
    it('should return 200 with airline codes', async () => {
      mockLookupAirlineCode.mockResolvedValue({ data: [{ iataCode: 'AF', businessName: 'Air France' }] } as never);

      const res = await request(app)
        .get('/airlines/lookup')
        .query({ airlineCodes: 'AF' });

      expect(res.status).toBe(200);
    });

    it('should return error when code is missing', async () => {
      const res = await request(app).get('/airlines/routes');
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('should return 404-level error for unknown airline code', async () => {
      mockLookupAirlineCode.mockRejectedValue(new Error('Airline not found') as never);

      const res = await request(app)
        .get('/airlines/lookup')
        .query({ airlineCodes: 'ZZZ' });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });
});
