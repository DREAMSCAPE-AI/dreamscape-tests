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

const appNoAuth = express();
appNoAuth.use(express.json());
appNoAuth.use('/cart', cartRouter);

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
    it('should return 400 when userId is missing', async () => {
      const res = await request(appNoAuth).get('/cart');

      expect(res.status).toBe(400);
    });

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

    it('should return 500 when cart lookup fails', async () => {
      mockGetCart.mockRejectedValue(new Error('cart down') as never);

      const res = await request(app).get('/cart');
      expect(res.status).toBe(500);
    });
  });

  describe('POST /cart/items', () => {
    it('should return 400 when add item userId is missing', async () => {
      const res = await request(appNoAuth)
        .post('/cart/items')
        .send({ type: 'FLIGHT', itemId: 'f-001', itemData: {}, price: 300 });

      expect(res.status).toBe(400);
    });

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

    it('should reject invalid item type', async () => {
      const res = await request(app)
        .post('/cart/items')
        .send({ type: 'PACKAGE', itemId: 'f-001', itemData: {}, price: 300 });

      expect(res.status).toBe(400);
    });

    it('should reject invalid price', async () => {
      const res = await request(app)
        .post('/cart/items')
        .send({ type: 'FLIGHT', itemId: 'f-001', itemData: {}, price: 0 });

      expect(res.status).toBe(400);
    });

    it('should reject invalid quantity', async () => {
      const res = await request(app)
        .post('/cart/items')
        .send({ type: 'FLIGHT', itemId: 'f-001', itemData: {}, price: 300, quantity: 1.5 });

      expect(res.status).toBe(400);
    });

    it('should return 500 when addToCart fails', async () => {
      mockAddToCart.mockRejectedValue(new Error('add failed') as never);

      const res = await request(app)
        .post('/cart/items')
        .send({ type: 'FLIGHT', itemId: 'f-001', itemData: {}, price: 300 });

      expect(res.status).toBe(500);
    });
  });

  describe('DELETE /cart/items/:itemId', () => {
    it('should return 400 when remove item userId is missing', async () => {
      const res = await request(appNoAuth).delete('/cart/items/item-001');

      expect(res.status).toBe(400);
    });

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

    it('should return 500 when removeCartItem fails for another reason', async () => {
      mockRemoveCartItem.mockRejectedValue(new Error('remove failed') as never);

      const res = await request(app).delete('/cart/items/item-001');

      expect(res.status).toBe(500);
    });
  });

  describe('DELETE /cart', () => {
    it('should return 400 when clear cart userId is missing', async () => {
      const res = await request(appNoAuth).delete('/cart');

      expect(res.status).toBe(400);
    });

    it('should return 200 on successful cart clear', async () => {
      mockClearCart.mockResolvedValue(undefined as never);

      const res = await request(app).delete('/cart');
      expect([200, 204]).toContain(res.status);
    });

    it('should return 500 when cart clear fails', async () => {
      mockClearCart.mockRejectedValue(new Error('clear failed') as never);

      const res = await request(app).delete('/cart');
      expect(res.status).toBe(500);
    });
  });

  describe('PUT /cart/items/:itemId', () => {
    it('should return 400 when update item userId is missing', async () => {
      const res = await request(appNoAuth)
        .put('/cart/items/item-001')
        .send({ quantity: 2 });

      expect(res.status).toBe(400);
    });

    it('should return 200 on successful quantity update', async () => {
      mockUpdateCartItem.mockResolvedValue({
        ...mockCart,
        items: [{ ...mockCart.items[0], quantity: 2 }],
      } as never);

      const res = await request(app)
        .put('/cart/items/item-001')
        .send({ quantity: 2 });

      expect(res.status).toBe(200);
    });

    it('should return 400 when quantity is invalid on update', async () => {
      const res = await request(app)
        .put('/cart/items/item-001')
        .send({ quantity: 0 });

      expect(res.status).toBe(400);
    });

    it('should return 404 when updateCartItem reports not found', async () => {
      mockUpdateCartItem.mockRejectedValue(new Error('item not found') as never);

      const res = await request(app)
        .put('/cart/items/item-001')
        .send({ quantity: 2 });

      expect(res.status).toBe(404);
    });
  });

  describe('POST /cart/checkout', () => {
    it('should return 400 when checkout userId is missing', async () => {
      const res = await request(appNoAuth).post('/cart/checkout').send({});

      expect(res.status).toBe(400);
    });

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

    it('should return 400 when cart is empty', async () => {
      mockGetCart.mockResolvedValue({ ...mockCart, items: [] } as never);

      const res = await request(app).post('/cart/checkout').send({});
      expect(res.status).toBe(400);
    });

    it('should return 503 when payment service is unreachable', async () => {
      mockGetCart.mockResolvedValue(mockCart as never);
      global.fetch = jest.fn().mockRejectedValue(Object.assign(new Error('ECONNREFUSED'), { code: 'ECONNREFUSED' })) as any;

      const res = await request(app).post('/cart/checkout').send({});
      expect(res.status).toBe(503);
    });

    it('should return 503 when payment service times out (AbortError)', async () => {
      mockGetCart.mockResolvedValue(mockCart as never);
      const abortError = Object.assign(new Error('Aborted'), { name: 'AbortError' });
      global.fetch = jest.fn().mockRejectedValue(abortError) as any;

      const res = await request(app).post('/cart/checkout').send({});
      expect(res.status).toBe(503);
    });

    it('should continue checkout when metadata update returns not ok', async () => {
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
      global.fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: { paymentIntentId: 'pi_test_001', clientSecret: 'secret', amount: 30000, currency: 'eur', status: 'requires_payment_method' },
          }),
        } as any)
        .mockResolvedValueOnce({ ok: false } as any) as any;

      const res = await request(app).post('/cart/checkout').send({});
      expect([200, 201]).toContain(res.status);
    });

    it('should continue checkout when metadata update fetch throws', async () => {
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
      global.fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: { paymentIntentId: 'pi_test_001', clientSecret: 'secret', amount: 30000, currency: 'eur', status: 'requires_payment_method' },
          }),
        } as any)
        .mockRejectedValueOnce(new Error('metadata update failed')) as any;

      const res = await request(app).post('/cart/checkout').send({});
      expect([200, 201]).toContain(res.status);
    });

    it('should return 500 when booking creation fails after payment intent', async () => {
      mockGetCart.mockResolvedValue(mockCart as never);
      mockCreateBooking.mockRejectedValue(new Error('booking failed') as never);

      const res = await request(app).post('/cart/checkout').send({});
      expect(res.status).toBe(500);
    });
  });

  describe('PUT /cart/extend', () => {
    it('should return 400 when extend userId is missing', async () => {
      const res = await request(appNoAuth).put('/cart/extend');

      expect(res.status).toBe(400);
    });

    it('should return 200 when expiry is extended', async () => {
      mockExtendExpiry.mockResolvedValue(mockCart as never);

      const res = await request(app).put('/cart/extend');
      expect(res.status).toBe(200);
    });

    it('should return 404 when no cart can be extended', async () => {
      mockExtendExpiry.mockResolvedValue(null as never);

      const res = await request(app).put('/cart/extend');
      expect(res.status).toBe(404);
    });

    it('should return 500 when extend expiry fails', async () => {
      mockExtendExpiry.mockRejectedValue(new Error('extend failed') as never);

      const res = await request(app).put('/cart/extend');
      expect(res.status).toBe(500);
    });
  });
});
