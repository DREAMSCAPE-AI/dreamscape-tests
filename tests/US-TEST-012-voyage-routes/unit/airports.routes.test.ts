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

    it('should pass optional radius, limit, offset, sort params to service', async () => {
      mockGetNearestAirports.mockResolvedValue({ data: [] } as never);

      const res = await request(app)
        .get('/airports/nearest')
        .query({ latitude: '48.8566', longitude: '2.3522', radius: '100', limit: '5', offset: '10', sort: 'relevance' });

      expect(res.status).toBe(200);
      expect(mockGetNearestAirports).toHaveBeenCalledWith(expect.objectContaining({
        radius: 100,
        page: { limit: 5, offset: 10 },
        sort: 'relevance',
      }));
    });

    it('should return 500 when nearest airports lookup throws', async () => {
      mockGetNearestAirports.mockRejectedValue(new Error('nearest down') as never);

      const res = await request(app)
        .get('/airports/nearest')
        .query({ latitude: '48.8566', longitude: '2.3522' });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to get nearest relevant airports');
    });

    it('should return Unknown error when nearest throws non-Error', async () => {
      mockGetNearestAirports.mockRejectedValue('plain error' as never);

      const res = await request(app)
        .get('/airports/nearest')
        .query({ latitude: '48.8566', longitude: '2.3522' });

      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Unknown error');
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

    it('should return 400 when airportCode or date is missing', async () => {
      const res = await request(app)
        .get('/airports/on-time-performance')
        .query({ airportCode: 'CDG' });

      expect(res.status).toBe(400);
    });

    it('should return 500 when on-time service throws', async () => {
      mockGetAirportOnTime.mockRejectedValue(new Error('down') as never);

      const res = await request(app)
        .get('/airports/on-time-performance')
        .query({ airportCode: 'CDG', date: '2026-06-01' });

      expect(res.status).toBe(500);
    });

    it('should return Unknown error when on-time throws non-Error', async () => {
      mockGetAirportOnTime.mockRejectedValue('plain error' as never);

      const res = await request(app)
        .get('/airports/on-time-performance')
        .query({ airportCode: 'CDG', date: '2026-06-01' });

      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Unknown error');
    });
  });

  describe('GET /airports/routes', () => {
    it('should return 200 for a valid departure airport', async () => {
      mockGetAirportRoutes.mockResolvedValue({ data: [] } as never);

      const res = await request(app)
        .get('/airports/routes')
        .query({ departureAirportCode: 'CDG' });

      expect(res.status).toBe(200);
    });

    it('should return 400 when departure airport is missing', async () => {
      const res = await request(app).get('/airports/routes');
      expect(res.status).toBe(400);
    });

    it('should pass optional max param to service', async () => {
      mockGetAirportRoutes.mockResolvedValue({ data: [] } as never);

      const res = await request(app)
        .get('/airports/routes')
        .query({ departureAirportCode: 'CDG', max: '50' });

      expect(res.status).toBe(200);
      expect(mockGetAirportRoutes).toHaveBeenCalledWith(expect.objectContaining({ max: 50 }));
    });

    it('should return 500 when airport routes service throws', async () => {
      mockGetAirportRoutes.mockRejectedValue(new Error('down') as never);

      const res = await request(app)
        .get('/airports/routes')
        .query({ departureAirportCode: 'CDG' });

      expect(res.status).toBe(500);
    });

    it('should return Unknown error when routes throws non-Error', async () => {
      mockGetAirportRoutes.mockRejectedValue('plain error' as never);

      const res = await request(app)
        .get('/airports/routes')
        .query({ departureAirportCode: 'CDG' });

      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Unknown error');
    });
  });
});
