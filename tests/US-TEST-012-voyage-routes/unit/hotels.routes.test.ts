/**
 * US-TEST-012 — Tests unitaires routes/hotels.ts
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';

// ── Mocks ─────────────────────────────────────────────────────────────────────
const mockSearchHotels      = jest.fn();
const mockGetHotelRatings   = jest.fn();
const mockCreateHotelBooking = jest.fn();
const mockGetHotelList = jest.fn();

jest.mock('@/services/AmadeusService', () => ({
  __esModule: true,
  default: {
    searchHotels:        mockSearchHotels,
    getHotelRatings:     mockGetHotelRatings,
    createHotelBooking:  mockCreateHotelBooking,
    searchLocations:     jest.fn(),
    getHotelList:        mockGetHotelList,
  },
}));

jest.mock('@/mappers/HotelOfferMapper', () => ({
  __esModule: true,
  HotelOfferMapper: {
    mapToSimplifiedList: jest.fn((d: any) => d || []),
    mapToSimplified:     jest.fn((d: any) => d || {}),
    mapAmadeusToSimplified: jest.fn((d: any) => d || []),
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
          checkInDate: '2026-06-01',
          checkOutDate:'2026-06-05',
          adults:      '2',
        });

      expect(res.status).toBe(200);
    });

    it('should return 400 when required params are missing', async () => {
      const res = await request(app).get('/hotels/search');
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('should return 500 when AmadeusService throws', async () => {
      mockSearchHotels.mockRejectedValue(new Error('Amadeus down') as never);

      const res = await request(app)
        .get('/hotels/search')
        .query({ cityCode: 'PAR', checkInDate: '2026-06-01', checkOutDate: '2026-06-05', adults: '1' });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('should return 400 when dates are present but location is missing', async () => {
      const res = await request(app)
        .get('/hotels/search')
        .query({ checkInDate: '2026-06-01', checkOutDate: '2026-06-05' });

      expect(res.status).toBe(400);
    });

    it('should return graceful empty results for unsupported coordinate flow', async () => {
      mockSearchHotels.mockRejectedValue(new Error('coordinates hotelIds unsupported') as never);

      const res = await request(app)
        .get('/hotels/search')
        .query({
          latitude: '48.8566',
          longitude: '2.3522',
          checkInDate: '2026-06-01',
          checkOutDate: '2026-06-05',
          adults: '2',
        });

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('should parse array-based filters and pagination safely', async () => {
      mockSearchHotels.mockResolvedValue({ data: [], meta: {} } as never);

      const res = await request(app)
        .get('/hotels/search')
        .query({
          cityCode: ['PAR'],
          checkInDate: '2026-06-01',
          checkOutDate: '2026-06-05',
          ratings: ['4', '5'],
          amenities: ['WIFI', 'POOL'],
          page: '2',
          pageSize: '3',
        });

      expect(res.status).toBe(200);
      expect(mockSearchHotels).toHaveBeenCalledWith(expect.objectContaining({
        cityCode: 'PAR',
        ratings: ['4', '5'],
        amenities: ['WIFI', 'POOL'],
        page: { offset: 3, limit: 3 },
      }));
    });

    it('should parse single string value for ratings (covers parseArrayParam string branch)', async () => {
      mockSearchHotels.mockResolvedValue({ data: [], meta: {} } as never);

      const res = await request(app)
        .get('/hotels/search')
        .query({
          cityCode: 'PAR',
          checkInDate: '2026-06-01',
          checkOutDate: '2026-06-05',
          ratings: '4',
        });

      expect(res.status).toBe(200);
      expect(mockSearchHotels).toHaveBeenCalledWith(expect.objectContaining({
        ratings: ['4'],
      }));
    });
  });

  describe('secondary hotel endpoints', () => {
    it('should return 200 for GET /hotels/details/:hotelId', async () => {
      mockSearchHotels.mockResolvedValue({ data: [{ hotelId: 'H1' }], meta: {} } as never);

      const res = await request(app)
        .get('/hotels/details/H1')
        .query({ checkInDate: '2026-06-01', checkOutDate: '2026-06-05', adults: '1' });

      expect(res.status).toBe(200);
    });

    it('should return 404 for hotel details when no result is found', async () => {
      mockSearchHotels.mockResolvedValue({ data: [], meta: {} } as never);

      const res = await request(app).get('/hotels/details/H404');
      expect(res.status).toBe(404);
    });

    it('should return 404 when hotel details api throws', async () => {
      mockSearchHotels.mockRejectedValue(new Error('api down') as never);

      const res = await request(app).get('/hotels/details/H404');
      expect(res.status).toBe(404);
    });

    it('should return 200 for GET /hotels/ratings', async () => {
      mockSearchHotels.mockResolvedValue({ data: [{ hotelId: 'H1', rating: 4 }] } as never);

      const res = await request(app)
        .get('/hotels/ratings')
        .query({ hotelIds: 'H1,H2' });

      expect(res.status).toBe(200);
    });

    it('should return 400 for GET /hotels/ratings when hotelIds are missing', async () => {
      const res = await request(app).get('/hotels/ratings');
      expect(res.status).toBe(400);
    });

    it('should return 500 for GET /hotels/ratings when service throws', async () => {
      mockSearchHotels.mockRejectedValue(new Error('ratings down') as never);

      const res = await request(app)
        .get('/hotels/ratings')
        .query({ hotelIds: 'H1' });

      expect(res.status).toBe(500);
    });

    it('should return 201 for POST /hotels/bookings', async () => {
      mockCreateHotelBooking.mockResolvedValue({ data: { id: 'hotel-booking-1' } } as never);

      const res = await request(app)
        .post('/hotels/bookings')
        .send({
          offerId: 'offer-1',
          guests: [{
            name: { firstName: 'Alice', lastName: 'Doe' },
            contact: { email: 'alice@test.com', phone: '0102030405' },
          }],
          payments: [{ method: 'creditCard' }],
        });

      expect(res.status).toBe(201);
    });

    it('should validate missing offerId on hotel booking', async () => {
      const res = await request(app)
        .post('/hotels/bookings')
        .send({ guests: [{}], payments: [{}] });

      expect(res.status).toBe(400);
    });

    it('should validate guest contact fields on hotel booking', async () => {
      const res = await request(app)
        .post('/hotels/bookings')
        .send({
          offerId: 'offer-1',
          guests: [{ name: { firstName: 'Alice', lastName: 'Doe' }, contact: { email: 'alice@test.com' } }],
          payments: [{ method: 'creditCard' }],
        });

      expect(res.status).toBe(400);
    });

    it('should validate missing guest name fields on hotel booking', async () => {
      const res = await request(app)
        .post('/hotels/bookings')
        .send({
          offerId: 'offer-1',
          guests: [{ name: { firstName: 'Alice' }, contact: { email: 'alice@test.com', phone: '0102030405' } }],
          payments: [{ method: 'creditCard' }],
        });

      expect(res.status).toBe(400);
    });

    it('should return 400 when guests is empty array', async () => {
      const res = await request(app)
        .post('/hotels/bookings')
        .send({
          offerId: 'offer-1',
          guests: [],
          payments: [{ method: 'creditCard' }],
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Missing required field: guests (must be a non-empty array)');
    });

    it('should validate missing payments on hotel booking', async () => {
      const res = await request(app)
        .post('/hotels/bookings')
        .send({
          offerId: 'offer-1',
          guests: [{
            name: { firstName: 'Alice', lastName: 'Doe' },
            contact: { email: 'alice@test.com', phone: '0102030405' },
          }],
          payments: [],
        });

      expect(res.status).toBe(400);
    });

    it('should return 500 when hotel booking creation fails', async () => {
      mockCreateHotelBooking.mockRejectedValue(new Error('booking failed') as never);

      const res = await request(app)
        .post('/hotels/bookings')
        .send({
          offerId: 'offer-1',
          guests: [{
            name: { firstName: 'Alice', lastName: 'Doe' },
            contact: { email: 'alice@test.com', phone: '0102030405' },
          }],
          payments: [{ method: 'creditCard' }],
        });

      expect(res.status).toBe(500);
    });

    it('should return 200 for GET /hotels/list', async () => {
      mockSearchHotels.mockResolvedValue({ data: [], meta: { count: 0 } } as never);

      const res = await request(app)
        .get('/hotels/list')
        .query({ cityCode: 'PAR', page: '1', pageSize: '10' });

      expect(res.status).toBe(200);
    });

    it('should return 500 for GET /hotels/list when service throws', async () => {
      mockSearchHotels.mockRejectedValue(new Error('list failed') as never);

      const res = await request(app)
        .get('/hotels/list')
        .query({ cityCode: 'PAR' });

      expect(res.status).toBe(500);
    });

    it('should return 200 for GET /hotels/:hotelId/images', async () => {
      mockSearchHotels.mockResolvedValue({ data: [{ media: { images: [] } }] } as never);

      const res = await request(app)
        .get('/hotels/H1/images')
        .query({ adults: '1' });

      expect(res.status).toBe(200);
    });

    it('should return default image payload when image lookup throws', async () => {
      mockSearchHotels.mockRejectedValue(new Error('images down') as never);

      const res = await request(app).get('/hotels/H1/images');
      expect(res.status).toBe(200);
      expect(res.body.meta.error).toBe('Failed to fetch hotel images');
    });
  });
});
