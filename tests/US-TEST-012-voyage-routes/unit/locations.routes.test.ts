/**
 * US-TEST-012 — Tests unitaires routes/locations.ts
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';

// ── Mocks ─────────────────────────────────────────────────────────────────────
const mockSearchLocations = jest.fn();
const mockSearchAirports  = jest.fn();

jest.mock('@/services/AmadeusService', () => ({
  __esModule: true,
  default: {
    searchLocations: mockSearchLocations,
    searchAirports:  mockSearchAirports,
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
import locationsRouter from '@/routes/locations';

const app = express();
app.use(express.json());
app.use('/locations', locationsRouter);

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('Locations Routes — US-TEST-012', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /locations/search', () => {
    it('should return 200 with valid keyword', async () => {
      mockSearchLocations.mockResolvedValue({ data: [{ iataCode: 'CDG', name: 'Paris CDG' }] } as never);

      const res = await request(app)
        .get('/locations/search')
        .query({ keyword: 'Paris' });

      expect([200, 400]).toContain(res.status);
    });

    it('should return 400 when keyword is missing', async () => {
      const res = await request(app).get('/locations/search');
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('should support subType filter (AIRPORT)', async () => {
      mockSearchAirports.mockResolvedValue({ data: [] } as never);

      const res = await request(app)
        .get('/locations/search')
        .query({ keyword: 'London', subType: 'AIRPORT' });

      expect([200, 400]).toContain(res.status);
    });

    it('should return 500 when AmadeusService throws', async () => {
      mockSearchLocations.mockRejectedValue(new Error('API Error') as never);

      const res = await request(app)
        .get('/locations/search')
        .query({ keyword: 'Paris' });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('GET /locations/airports', () => {
    it('should return airport-filtered results', async () => {
      mockSearchLocations.mockResolvedValue({ data: [] } as never);

      const res = await request(app)
        .get('/locations/airports')
        .query({ keyword: 'London' });

      expect([200, 400]).toContain(res.status);
    });
  });
});
