/**
 * US-TEST-012 — Tests unitaires routes/cart.ts
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';

// ── Mocks ─────────────────────────────────────────────────────────────────────
const mockGetCart         = jest.fn();
const mockAddToCart       = jest.fn();
const mockUpdateCartItem  = jest.fn();
const mockRemoveCartItem  = jest.fn();
const mockClearCart       = jest.fn();
const mockExtendExpiry    = jest.fn();
const mockCreateBooking   = jest.fn();

jest.mock('@/services/CartService', () => ({
  __esModule: true,
  default: {
    getCart:          mockGetCart,
    addToCart:        mockAddToCart,
    updateCartItem:   mockUpdateCartItem,
    removeCartItem:   mockRemoveCartItem,
    clearCart:        mockClearCart,
    extendCartExpiry: mockExtendExpiry,
  },
}));

jest.mock('@/services/BookingService', () => ({
  __esModule: true,
  default: { createBookingFromCart: mockCreateBooking },
}));

jest.mock('@/database/prisma', () => ({
  __esModule: true,
  default: {
    cartData: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
  },
}));

jest.mock('@/config/redis', () => ({
  __esModule: true,
  default: { get: jest.fn().mockResolvedValue(null), set: jest.fn(), del: jest.fn() },
}));

// ── App setup ─────────────────────────────────────────────────────────────────
import cartRouter from '@/routes/cart';

const app = express();
app.use(express.json());
app.use((req: any, _res: any, next: any) => {
  req.user = { id: 'user-001', email: 'test@test.com' };
  next();
});
app.use('/cart', cartRouter);

const mockCart = {
  id:         'cart-001',
  userId:     'user-001',
  totalPrice: 300,
  currency:   'EUR',
  expiresAt:  new Date(Date.now() + 30 * 60 * 1000),
  items: [
    { id: 'item-001', type: 'FLIGHT', itemId: 'f-001', price: 300, quantity: 1, currency: 'EUR' },
  ],
};

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('Cart Routes — US-TEST-012', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            paymentIntentId: 'pi_test_001',
            clientSecret: 'secret_test',
            amount: 30000,
            currency: 'eur',
            status: 'requires_payment_method',
          },
        }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as any) as any;
  });

  describe('GET /cart', () => {
    it('should return 200 with cart data', async () => {
      mockGetCart.mockResolvedValue(mockCart as never);

      const res = await request(app).get('/cart');
      expect(res.status).toBe(200);
    });

    it('should return empty cart when user has no cart', async () => {
      mockGetCart.mockResolvedValue(null as never);

      const res = await request(app).get('/cart');
      expect(res.status).toBe(200);
    });
  });

  describe('POST /cart/items', () => {
    it('should return 201 when item added successfully', async () => {
      mockAddToCart.mockResolvedValue(mockCart as never);

      const res = await request(app)
        .post('/cart/items')
        .send({ type: 'FLIGHT', itemId: 'f-001', itemData: {}, price: 300 });

      expect([200, 201]).toContain(res.status);
    });

    it('should return error when type is missing', async () => {
      const res = await request(app)
        .post('/cart/items')
        .send({ itemId: 'f-001', price: 300 }); // missing type

      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('DELETE /cart/items/:itemId', () => {
    it('should return 200 on successful removal', async () => {
      mockRemoveCartItem.mockResolvedValue({ ...mockCart, items: [] } as never);

      const res = await request(app).delete('/cart/items/item-001');
      expect([200, 204]).toContain(res.status);
    });

    it('should return error when item not found', async () => {
      mockRemoveCartItem.mockRejectedValue(new Error('Cart item not found') as never);

      const res = await request(app).delete('/cart/items/ghost-item');
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('DELETE /cart', () => {
    it('should return 200 on successful cart clear', async () => {
      mockClearCart.mockResolvedValue(undefined as never);

      const res = await request(app).delete('/cart');
      expect([200, 204]).toContain(res.status);
    });
  });

  describe('POST /cart/checkout', () => {
    it('should return 200 or 201 on successful checkout', async () => {
      mockGetCart.mockResolvedValue(mockCart as never);
      mockCreateBooking.mockResolvedValue({
        id: 'booking-001',
        reference: 'BOOK-ABC',
        status: 'DRAFT',
        totalAmount: 300,
        currency: 'EUR',
        createdAt: new Date().toISOString(),
        data: { items: mockCart.items },
      } as never);

      const res = await request(app)
        .post('/cart/checkout')
        .send({ paymentIntentId: 'pi_test_001' });

      expect([200, 201]).toContain(res.status);
    });
  });
});
