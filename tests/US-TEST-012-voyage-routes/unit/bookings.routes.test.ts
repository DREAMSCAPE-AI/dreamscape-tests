/**
 * US-TEST-012 — Tests unitaires routes/bookings.ts
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';

// ── Mocks ─────────────────────────────────────────────────────────────────────
const mockGetUserBookings  = jest.fn();
const mockGetBooking       = jest.fn();
const mockCancelBooking    = jest.fn();
const mockConfirmBooking   = jest.fn();

jest.mock('@/services/BookingService', () => ({
  __esModule: true,
  default: {
    getUserBookings: mockGetUserBookings,
    getBooking:      mockGetBooking,
    cancelBooking:   mockCancelBooking,
    confirmBooking:  mockConfirmBooking,
  },
}));

const mockPrismaFindMany   = jest.fn();
const mockPrismaFindUnique = jest.fn();
const mockPrismaAggregate  = jest.fn();
const mockPrismaCount      = jest.fn();
const mockPrismaGroupBy    = jest.fn();

jest.mock('@/database/prisma', () => ({
  __esModule: true,
  default: {
    bookingData: {
      findMany:   mockPrismaFindMany,
      findUnique: mockPrismaFindUnique,
      count:      mockPrismaCount,
      aggregate:  mockPrismaAggregate,
      groupBy:    mockPrismaGroupBy,
    },
  },
}));

// ── App setup ─────────────────────────────────────────────────────────────────
import bookingsRouter from '@/routes/bookings';

const app = express();
app.use(express.json());
// Inject auth user for protected routes
app.use((req: any, _res: any, next: any) => {
  req.user = { id: 'user-001', email: 'test@test.com' };
  next();
});
app.use('/bookings', bookingsRouter);

const appNoAuth = express();
appNoAuth.use(express.json());
appNoAuth.use('/bookings', bookingsRouter);

const mockBooking = {
  id:          'booking-001',
  userId:      'user-001',
  reference:   'BOOK-20260402-ABC01',
  status:      'CONFIRMED',
  type:        'FLIGHT',
  totalAmount: 450,
  currency:    'EUR',
  createdAt:   new Date().toISOString(),
};

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('Bookings Routes — US-TEST-012', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrismaCount.mockResolvedValue(1 as never);
  });

  describe('GET /bookings', () => {
    it('should return 200 with list of bookings', async () => {
      mockPrismaFindMany.mockResolvedValue([mockBooking] as never);

      const res = await request(app).get('/bookings');
      expect(res.status).toBe(200);
    });

    it('should return 400 when userId is missing (no auth, no query)', async () => {
      const res = await request(appNoAuth).get('/bookings');
      expect(res.status).toBe(400);
    });

    it('should support filters, search and sorting query params', async () => {
      mockPrismaFindMany.mockResolvedValue([mockBooking] as never);

      const res = await request(app).get('/bookings').query({
        status: 'CONFIRMED,CANCELLED',
        type: 'FLIGHT',
        sortBy: 'totalAmount',
        sortOrder: 'asc',
        search: 'abc01',
        page: '2',
        limit: '5',
      });

      expect(res.status).toBe(200);
      expect(mockPrismaCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ['CONFIRMED', 'CANCELLED'] },
            type: { in: ['FLIGHT'] },
            reference: { contains: 'ABC01' },
          }),
        })
      );
    });

    it('should return booking with populated items when data.items exists', async () => {
      mockPrismaFindMany.mockResolvedValue([{ ...mockBooking, data: { items: [{ id: 'i1' }] } }] as never);

      const res = await request(app).get('/bookings');
      expect(res.status).toBe(200);
      expect(res.body.data[0].items).toEqual([{ id: 'i1' }]);
      expect(res.body.data[0].itemCount).toBe(1);
    });

    it('should return 500 when list query fails', async () => {
      mockPrismaCount.mockRejectedValue(new Error('db down') as never);

      const res = await request(app).get('/bookings');
      expect(res.status).toBe(500);
    });

    it('should return Unknown error when list throws non-Error', async () => {
      mockPrismaCount.mockRejectedValue('plain error' as never);

      const res = await request(app).get('/bookings');
      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Unknown error');
    });
  });

  describe('GET /bookings/:reference', () => {
    it('should return 400 when userId is missing', async () => {
      const res = await request(appNoAuth).get('/bookings/BOOK-20260402-ABC01');

      expect(res.status).toBe(400);
    });

    it('should return 200 when booking found', async () => {
      mockGetBooking.mockResolvedValue(mockBooking as never);

      const res = await request(app).get('/bookings/BOOK-20260402-ABC01');
      expect(res.status).toBe(200);
    });

    it('should return 404 when booking not found', async () => {
      mockGetBooking.mockResolvedValue(null as never);

      const res = await request(app).get('/bookings/BOOK-UNKNOWN');
      expect(res.status).toBe(404);
    });

    it('should return 403 when booking belongs to another user', async () => {
      mockGetBooking.mockResolvedValue({ ...mockBooking, userId: 'other-user' } as never);

      const res = await request(app).get('/bookings/BOOK-20260402-ABC01');
      expect(res.status).toBe(403);
    });

    it('should return booking with populated items and metadata when data exists', async () => {
      mockGetBooking.mockResolvedValue({
        ...mockBooking,
        data: { items: [{ id: 'i1' }], metadata: { key: 'value' } },
      } as never);

      const res = await request(app).get('/bookings/BOOK-20260402-ABC01');
      expect(res.status).toBe(200);
      expect(res.body.data.items).toEqual([{ id: 'i1' }]);
      expect(res.body.data.metadata).toEqual({ key: 'value' });
    });

    it('should return 500 when service lookup fails', async () => {
      mockGetBooking.mockRejectedValue(new Error('lookup failed') as never);

      const res = await request(app).get('/bookings/BOOK-20260402-ABC01');
      expect(res.status).toBe(500);
    });

    it('should return Unknown error when lookup throws non-Error', async () => {
      mockGetBooking.mockRejectedValue('plain error' as never);

      const res = await request(app).get('/bookings/BOOK-20260402-ABC01');
      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Unknown error');
    });
  });

  describe('GET /bookings/stats', () => {
    it('should return 400 when stats userId is missing', async () => {
      const res = await request(appNoAuth).get('/bookings/stats');

      expect(res.status).toBe(400);
    });

    it('should return 200 with booking stats', async () => {
      mockPrismaGroupBy
        .mockResolvedValueOnce([{ status: 'CONFIRMED', _count: { status: 2 } }] as never)
        .mockResolvedValueOnce([{ type: 'FLIGHT', _count: { type: 2 } }] as never);
      mockPrismaAggregate.mockResolvedValue({ _sum: { totalAmount: 900 } } as never);

      const res = await request(app).get('/bookings/stats');

      expect(res.status).toBe(200);
      expect(res.body.data.totalSpent).toBe(900);
    });

    it('should return totalSpent 0 when aggregate returns null totalAmount', async () => {
      mockPrismaGroupBy
        .mockResolvedValueOnce([] as never)
        .mockResolvedValueOnce([] as never);
      mockPrismaAggregate.mockResolvedValue({ _sum: { totalAmount: null } } as never);

      const res = await request(app).get('/bookings/stats');
      expect(res.status).toBe(200);
      expect(res.body.data.totalSpent).toBe(0);
    });

    it('should return 500 when stats query fails', async () => {
      mockPrismaGroupBy.mockRejectedValue(new Error('stats failed') as never);

      const res = await request(app).get('/bookings/stats');
      expect(res.status).toBe(500);
    });

    it('should return Unknown error when stats throws non-Error', async () => {
      mockPrismaGroupBy.mockRejectedValue('plain error' as never);

      const res = await request(app).get('/bookings/stats');
      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Unknown error');
    });
  });

  describe('POST /bookings/:reference/confirm', () => {
    it('should return 400 when confirmation userId is missing', async () => {
      const res = await request(appNoAuth).post('/bookings/BOOK-20260402-ABC01/confirm').send({});

      expect(res.status).toBe(400);
    });

    it('should return 200 on successful confirmation', async () => {
      mockGetBooking.mockResolvedValue({ ...mockBooking, status: 'DRAFT' } as never);
      mockConfirmBooking.mockResolvedValue({ ...mockBooking, status: 'CONFIRMED' } as never);

      const res = await request(app).post('/bookings/BOOK-20260402-ABC01/confirm');

      expect(res.status).toBe(200);
    });

    it('should return 404 when booking does not exist', async () => {
      mockGetBooking.mockResolvedValue(null as never);

      const res = await request(app).post('/bookings/BOOK-404/confirm');
      expect(res.status).toBe(404);
    });

    it('should return 403 when booking belongs to another user', async () => {
      mockGetBooking.mockResolvedValue({ ...mockBooking, userId: 'other-user', status: 'DRAFT' } as never);

      const res = await request(app).post('/bookings/BOOK-20260402-ABC01/confirm');
      expect(res.status).toBe(403);
    });

    it('should return 200 when booking is already confirmed', async () => {
      mockGetBooking.mockResolvedValue({ ...mockBooking, status: 'CONFIRMED' } as never);

      const res = await request(app).post('/bookings/BOOK-20260402-ABC01/confirm');
      expect(res.status).toBe(200);
    });

    it('should return 400 when booking status is not confirmable', async () => {
      mockGetBooking.mockResolvedValue({ ...mockBooking, status: 'CANCELLED' } as never);

      const res = await request(app).post('/bookings/BOOK-20260402-ABC01/confirm');
      expect(res.status).toBe(400);
    });

    it('should return 500 when confirmation fails', async () => {
      mockGetBooking.mockResolvedValue({ ...mockBooking, status: 'DRAFT' } as never);
      mockConfirmBooking.mockRejectedValue(new Error('confirm failed') as never);

      const res = await request(app).post('/bookings/BOOK-20260402-ABC01/confirm');
      expect(res.status).toBe(500);
    });

    it('should return Unknown error when confirm throws non-Error', async () => {
      mockGetBooking.mockRejectedValue('plain error' as never);

      const res = await request(app).post('/bookings/BOOK-20260402-ABC01/confirm');
      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Unknown error');
    });
  });

  describe('POST /bookings/:reference/cancel', () => {
    it('should return 400 when cancellation userId is missing', async () => {
      const res = await request(appNoAuth)
        .post('/bookings/BOOK-20260402-ABC01/cancel')
        .send({ reason: 'Changed plans' });

      expect(res.status).toBe(400);
    });

    it('should return 200 on successful cancellation', async () => {
      mockGetBooking.mockResolvedValue(mockBooking as never);
      mockCancelBooking.mockResolvedValue({ ...mockBooking, status: 'CANCELLED' } as never);

      const res = await request(app)
        .post('/bookings/BOOK-20260402-ABC01/cancel')
        .send({ reason: 'Changed plans' });

      expect([200, 201]).toContain(res.status);
    });

    it('should return error when booking not found', async () => {
      mockGetBooking.mockResolvedValue(null as never);

      const res = await request(app)
        .post('/bookings/BOOK-GHOST/cancel')
        .send({ reason: 'Test' });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('should return 403 when booking belongs to another user', async () => {
      mockGetBooking.mockResolvedValue({ ...mockBooking, userId: 'other-user' } as never);

      const res = await request(app)
        .post('/bookings/BOOK-20260402-ABC01/cancel')
        .send({ reason: 'Changed plans' });

      expect(res.status).toBe(403);
    });

    it('should return 400 when booking cannot be cancelled', async () => {
      mockGetBooking.mockResolvedValue({ ...mockBooking, status: 'FAILED' } as never);

      const res = await request(app)
        .post('/bookings/BOOK-20260402-ABC01/cancel')
        .send({ reason: 'Changed plans' });

      expect(res.status).toBe(400);
    });

    it('should return 500 when cancellation fails', async () => {
      mockGetBooking.mockResolvedValue(mockBooking as never);
      mockCancelBooking.mockRejectedValue(new Error('cancel failed') as never);

      const res = await request(app)
        .post('/bookings/BOOK-20260402-ABC01/cancel')
        .send({ reason: 'Changed plans' });

      expect(res.status).toBe(500);
    });

    it('should return Unknown error when cancel throws non-Error', async () => {
      mockGetBooking.mockRejectedValue('plain error' as never);

      const res = await request(app)
        .post('/bookings/BOOK-20260402-ABC01/cancel')
        .send({ reason: 'Changed plans' });

      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Unknown error');
    });
  });
});
