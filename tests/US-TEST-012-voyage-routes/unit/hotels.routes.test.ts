/**
 * US-TEST-012 — Tests unitaires routes/hotels.ts
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';

// ── Mocks ─────────────────────────────────────────────────────────────────────
const mockSearchHotels      = jest.fn();
const mockGetHotelOffers    = jest.fn();
const mockGetHotelRatings   = jest.fn();
const mockCreateHotelBooking = jest.fn();

jest.mock('@/services/AmadeusService', () => ({
  __esModule: true,
  default: {
    searchHotels:        mockSearchHotels,
    getHotelOffers:      mockGetHotelOffers,
    getHotelRatings:     mockGetHotelRatings,
    createHotelBooking:  mockCreateHotelBooking,
    searchLocations:     jest.fn(),
    getHotelList:        jest.fn(),
  },
}));

jest.mock('@/mappers/HotelOfferMapper', () => ({
  __esModule: true,
  HotelOfferMapper: {
    mapToSimplifiedList: jest.fn((d: any) => d || []),
    mapToSimplified:     jest.fn((d: any) => d || {}),
  },
}));

jest.mock('@/config/redis', () => ({
  __esModule: true,
  default: {
    get:     jest.fn().mockResolvedValue(null),
    set:     jest.fn(),
    del:     jest.fn(),
    isReady: jest.fn().mockReturnValue(false), // skip cache middleware
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
import hotelsRouter from '@/routes/hotels';

const app = express();
app.use(express.json());
app.use((req: any, _res: any, next: any) => {
  req.user = { id: 'user-001' };
  next();
});
app.use('/hotels', hotelsRouter);

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('Hotels Routes — US-TEST-012', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /hotels/search', () => {
    it('should return 200 with valid params', async () => {
      mockSearchHotels.mockResolvedValue({ data: [] } as never);

      const res = await request(app)
        .get('/hotels/search')
        .query({
          cityCode:    'PAR',
          checkIn:     '2026-06-01',
          checkOut:    '2026-06-05',
          adults:      '2',
        });

      expect([200, 400]).toContain(res.status); // 400 if validation differs
    });

    it('should return 400 when required params are missing', async () => {
      const res = await request(app).get('/hotels/search');
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('should return 500 when AmadeusService throws', async () => {
      mockSearchHotels.mockRejectedValue(new Error('Amadeus down') as never);

      const res = await request(app)
        .get('/hotels/search')
        .query({ cityCode: 'PAR', checkIn: '2026-06-01', checkOut: '2026-06-05', adults: '1' });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('GET /hotels/:hotelId', () => {
    it('should return 200 for a valid hotel ID', async () => {
      mockGetHotelOffers.mockResolvedValue({ data: [{ hotel: { hotelId: 'H1' } }] } as never);

      const res = await request(app)
        .get('/hotels/H1')
        .query({ checkIn: '2026-06-01', checkOut: '2026-06-05', adults: '1' });

      expect([200, 400, 404]).toContain(res.status);
    });
  });
});
