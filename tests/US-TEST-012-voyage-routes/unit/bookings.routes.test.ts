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

jest.mock('@/database/prisma', () => ({
  __esModule: true,
  default: {
    bookingData: {
      findMany:   mockPrismaFindMany,
      findUnique: mockPrismaFindUnique,
      count:      jest.fn().mockResolvedValue(0),
      aggregate:  mockPrismaAggregate,
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
  });

  describe('GET /bookings', () => {
    it('should return 200 with list of bookings', async () => {
      mockPrismaFindMany.mockResolvedValue([mockBooking] as never);

      const res = await request(app).get('/bookings');
      expect(res.status).toBe(200);
    });

    it('should return 400 when userId is missing (no auth, no query)', async () => {
      const appNoAuth = express();
      appNoAuth.use(express.json());
      appNoAuth.use('/bookings', bookingsRouter);

      const res = await request(appNoAuth).get('/bookings');
      expect(res.status).toBe(400);
    });
  });

  describe('GET /bookings/:reference', () => {
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
  });

  describe('POST /bookings/:reference/cancel', () => {
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
  });
});
