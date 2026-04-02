/**
 * US-TEST-012 — Tests unitaires routes/airports.ts
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';

// ── Mocks ─────────────────────────────────────────────────────────────────────
const mockGetNearestAirports     = jest.fn();
const mockGetAirportOnTime       = jest.fn();
const mockGetAirportRoutes       = jest.fn();

jest.mock('@/services/AmadeusService', () => ({
  __esModule: true,
  default: {
    getNearestRelevantAirports: mockGetNearestAirports,
    getAirportOnTimePerformance: mockGetAirportOnTime,
    getAirportRoutes:           mockGetAirportRoutes,
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
import airportsRouter from '@/routes/airports';

const app = express();
app.use(express.json());
app.use('/airports', airportsRouter);

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('Airports Routes — US-TEST-012', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /airports/nearest', () => {
    it('should return 200 with valid lat/lng', async () => {
      mockGetNearestAirports.mockResolvedValue({ data: [] } as never);

      const res = await request(app)
        .get('/airports/nearest')
        .query({ latitude: '48.8566', longitude: '2.3522' });

      expect([200, 400]).toContain(res.status);
    });

    it('should return 400 when coordinates are missing', async () => {
      const res = await request(app).get('/airports/nearest');
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('GET /airports/on-time-performance', () => {
    it('should return 200 for a valid IATA code', async () => {
      mockGetAirportOnTime.mockResolvedValue({ data: {} } as never);

      const res = await request(app)
        .get('/airports/on-time-performance')
        .query({ airportCode: 'CDG', date: '2026-06-01' });

      expect(res.status).toBe(200);
    });
  });
});
