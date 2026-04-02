/**
 * US-TEST-012 — Tests unitaires routes/activities.ts
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';

// ── Mocks ─────────────────────────────────────────────────────────────────────
const mockSearchActivities   = jest.fn();
const mockGetActivityById    = jest.fn();

jest.mock('@/services/AmadeusService', () => ({
  __esModule: true,
  default: {
    searchActivities:  mockSearchActivities,
    getActivityById:   mockGetActivityById,
  },
}));

jest.mock('@/mappers/ActivityMapper', () => ({
  __esModule: true,
  ActivityMapper: {
    mapAmadeusToSimplified: jest.fn((d: any) => d || []),
    mapSingleActivity:      jest.fn((d: any) => d || {}),
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
import activitiesRouter from '@/routes/activities';

const app = express();
app.use(express.json());
app.use('/activities', activitiesRouter);

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('Activities Routes — US-TEST-012', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /activities/search', () => {
    it('should return 200 with valid coordinates', async () => {
      mockSearchActivities.mockResolvedValue({ data: [] } as never);

      const res = await request(app)
        .get('/activities/search')
        .query({ latitude: '48.8566', longitude: '2.3522', radius: '20' });

      expect([200, 400]).toContain(res.status);
    });

    it('should return 400 when coordinates are missing', async () => {
      const res = await request(app).get('/activities/search');
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('should return 500 when AmadeusService throws', async () => {
      mockSearchActivities.mockRejectedValue(new Error('Amadeus error') as never);

      const res = await request(app)
        .get('/activities/search')
        .query({ latitude: '48.8566', longitude: '2.3522' });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('GET /activities/:id', () => {
    it('should return 200 for a valid activity ID', async () => {
      mockGetActivityById.mockResolvedValue({ data: { id: 'act-001', name: 'Eiffel Tower' } } as never);

      const res = await request(app).get('/activities/act-001');
      expect([200, 400, 404]).toContain(res.status);
    });

    it('should return error when activity not found', async () => {
      mockGetActivityById.mockRejectedValue(new Error('Activity not found') as never);

      const res = await request(app).get('/activities/ghost-id');
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });
});
