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
  });
});
