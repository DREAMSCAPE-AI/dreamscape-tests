/**
 * US-TEST-012 — Tests unitaires routes/transfers.ts
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';

// ── Mocks ─────────────────────────────────────────────────────────────────────
const mockSearchTransfers  = jest.fn();
const mockCreateTransferBooking = jest.fn();
const mockGetTransferOrder = jest.fn();

jest.mock('@/services/AmadeusService', () => ({
  __esModule: true,
  default: {
    searchTransfers:      mockSearchTransfers,
    createTransferBooking: mockCreateTransferBooking,
    getTransferOrder:     mockGetTransferOrder,
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
import transfersRouter from '@/routes/transfers';

const app = express();
app.use(express.json());
app.use((req: any, _res: any, next: any) => {
  req.user = { id: 'user-001' };
  next();
});
app.use('/transfers', transfersRouter);

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('Transfers Routes — US-TEST-012', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /transfers/search', () => {
    it('should return 200 with valid search params', async () => {
      mockSearchTransfers.mockResolvedValue({ data: [] } as never);

      const res = await request(app)
        .get('/transfers/search')
        .query({
          startLocationCode: 'CDG',
          endLocationCode:   'PAR',
          startDateTime:     '2026-06-01T08:00:00',
          passengers:        2,
        });

      expect(res.status).toBe(200);
    });

    it('should return error when AmadeusService throws', async () => {
      mockSearchTransfers.mockRejectedValue(new Error('Service unavailable') as never);

      const res = await request(app)
        .get('/transfers/search')
        .query({ startLocationCode: 'CDG', startDateTime: '2026-06-01T08:00:00', passengers: '1' });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('should return Unknown error when search throws non-Error', async () => {
      mockSearchTransfers.mockRejectedValue('plain error' as never);

      const res = await request(app)
        .get('/transfers/search')
        .query({ startLocationCode: 'CDG', startDateTime: '2026-06-01T08:00:00', passengers: '1' });

      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Unknown error');
    });

    it('should return 400 when required params are missing', async () => {
      const res = await request(app)
        .get('/transfers/search')
        .query({ startLocationCode: 'CDG' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Missing required parameters: startDateTime, passengers');
    });
  });

  describe('POST /transfers/bookings', () => {
    it('should return 200 or 201 on successful booking', async () => {
      mockCreateTransferBooking.mockResolvedValue({ data: { id: 'transfer-order-001' } } as never);

      const res = await request(app)
        .post('/transfers/bookings')
        .send({
          data: {
            transferType: 'PRIVATE',
            start:        { dateTime: '2026-06-01T08:00:00', locationCode: 'CDG' },
            passengers:   [{ firstName: 'Alice', lastName: 'Dupont', phone: '+33612345678', email: 'alice@test.com' }],
          },
        });

      expect(res.status).toBe(200);
    });

    it('should return 500 when booking creation throws', async () => {
      mockCreateTransferBooking.mockRejectedValue(new Error('Booking failed') as never);

      const res = await request(app)
        .post('/transfers/bookings')
        .send({ data: { transferType: 'PRIVATE' } });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to create transfer booking');
    });

    it('should return Unknown error when booking throws non-Error', async () => {
      mockCreateTransferBooking.mockRejectedValue('plain error' as never);

      const res = await request(app)
        .post('/transfers/bookings')
        .send({ data: { transferType: 'PRIVATE' } });

      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Unknown error');
    });
  });

  describe('GET /transfers/orders/:orderId', () => {
    it('should return 200 when transfer order is found', async () => {
      mockGetTransferOrder.mockResolvedValue({ data: { id: 'order-001' } } as never);

      const res = await request(app).get('/transfers/orders/order-001');

      expect(res.status).toBe(200);
      expect(mockGetTransferOrder).toHaveBeenCalledWith('order-001');
    });

    it('should return 500 when transfer order retrieval throws', async () => {
      mockGetTransferOrder.mockRejectedValue(new Error('Order unavailable') as never);

      const res = await request(app).get('/transfers/orders/order-001');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to retrieve transfer order');
    });

    it('should return Unknown error when order retrieval throws non-Error', async () => {
      mockGetTransferOrder.mockRejectedValue('plain error' as never);

      const res = await request(app).get('/transfers/orders/order-001');

      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Unknown error');
    });
  });
});
