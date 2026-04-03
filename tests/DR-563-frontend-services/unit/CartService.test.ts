/**
 * DR-563 — US-TEST-026
 * Tests unitaires : CartService (services/voyage/CartService)
 *
 * Importe le vrai service — import.meta.env est transformé par vite-meta-transform.
 * Axios est mocké pour tester la logique du service sans appels HTTP réels.
 *
 * @jest-environment node
 * @ticket DR-563
 */

// ── Mock axios ──────────────────────────────────────────────────────────────
const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPut = jest.fn();
const mockDelete = jest.fn();

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    create: jest.fn(() => ({
      get: mockGet,
      post: mockPost,
      put: mockPut,
      delete: mockDelete,
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    })),
    isAxiosError: jest.fn(),
  },
}));

// Set env vars BEFORE importing the service
process.env.VITE_VOYAGE_SERVICE_URL = 'http://localhost:3003';

import { cartService } from '@/services/voyage/CartService';

// ── Fixtures ────────────────────────────────────────────────────────────────

const mockCart = {
  id: 'cart-1',
  userId: 'user-1',
  items: [{ id: 'item-1', type: 'FLIGHT', price: 299.99 }],
  totalPrice: 299.99,
  currency: 'EUR',
  expiresAt: '2026-01-15T12:00:00Z',
};

const mockCheckout = {
  bookingReference: 'BOOK-001',
  bookingId: 'bid-1',
  totalAmount: 299.99,
};

// ─────────────────────────────────────────────────────────────────────────────

describe('CartService', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── getCart ──────────────────────────────────────────────────────────────
  describe('getCart', () => {
    it('calls GET /cart with userId param', async () => {
      mockGet.mockResolvedValue({ data: { data: mockCart } });
      const result = await cartService.getCart('user-1');
      expect(mockGet).toHaveBeenCalledWith('/cart', { params: { userId: 'user-1' } });
      expect(result).toEqual(mockCart);
    });

    it('throws on error', async () => {
      mockGet.mockRejectedValue(new Error('Network error'));
      await expect(cartService.getCart('user-1')).rejects.toThrow('Network error');
    });
  });

  // ── addToCart ────────────────────────────────────────────────────────────
  describe('addToCart', () => {
    it('calls POST /cart/items with data', async () => {
      const addData = { userId: 'user-1', type: 'FLIGHT', itemId: 'f1', price: 299, currency: 'EUR' };
      mockPost.mockResolvedValue({ data: { data: mockCart } });
      const result = await cartService.addToCart(addData as any);
      expect(mockPost).toHaveBeenCalledWith('/cart/items', addData);
      expect(result).toEqual(mockCart);
    });

    it('throws on error', async () => {
      mockPost.mockRejectedValue(new Error('Failed'));
      await expect(cartService.addToCart({} as any)).rejects.toThrow('Failed');
    });
  });

  // ── updateCartItem ──────────────────────────────────────────────────────
  describe('updateCartItem', () => {
    it('calls PUT /cart/items/:id with userId and data', async () => {
      const updateData = { quantity: 2 };
      mockPut.mockResolvedValue({ data: { data: mockCart } });
      const result = await cartService.updateCartItem('user-1', 'item-1', updateData as any);
      expect(mockPut).toHaveBeenCalledWith('/cart/items/item-1', { ...updateData, userId: 'user-1' });
      expect(result).toEqual(mockCart);
    });

    it('throws on error', async () => {
      mockPut.mockRejectedValue(new Error('Update failed'));
      await expect(cartService.updateCartItem('u', 'i', {} as any)).rejects.toThrow('Update failed');
    });
  });

  // ── removeCartItem ──────────────────────────────────────────────────────
  describe('removeCartItem', () => {
    it('calls DELETE /cart/items/:id with userId param', async () => {
      mockDelete.mockResolvedValue({ data: { data: mockCart } });
      const result = await cartService.removeCartItem('user-1', 'item-1');
      expect(mockDelete).toHaveBeenCalledWith('/cart/items/item-1', { params: { userId: 'user-1' } });
      expect(result).toEqual(mockCart);
    });

    it('throws on error', async () => {
      mockDelete.mockRejectedValue(new Error('Remove failed'));
      await expect(cartService.removeCartItem('u', 'i')).rejects.toThrow('Remove failed');
    });
  });

  // ── clearCart ────────────────────────────────────────────────────────────
  describe('clearCart', () => {
    it('calls DELETE /cart with userId param', async () => {
      mockDelete.mockResolvedValue({ data: {} });
      await cartService.clearCart('user-1');
      expect(mockDelete).toHaveBeenCalledWith('/cart', { params: { userId: 'user-1' } });
    });

    it('throws on error', async () => {
      mockDelete.mockRejectedValue(new Error('Clear failed'));
      await expect(cartService.clearCart('u')).rejects.toThrow('Clear failed');
    });
  });

  // ── extendCartExpiry ────────────────────────────────────────────────────
  describe('extendCartExpiry', () => {
    it('calls PUT /cart/extend with userId', async () => {
      mockPut.mockResolvedValue({ data: { data: mockCart } });
      const result = await cartService.extendCartExpiry('user-1');
      expect(mockPut).toHaveBeenCalledWith('/cart/extend', { userId: 'user-1' });
      expect(result).toEqual(mockCart);
    });

    it('throws on error', async () => {
      mockPut.mockRejectedValue(new Error('Extend failed'));
      await expect(cartService.extendCartExpiry('u')).rejects.toThrow('Extend failed');
    });
  });

  // ── checkout ────────────────────────────────────────────────────────────
  describe('checkout', () => {
    it('calls POST /cart/checkout with data', async () => {
      const checkoutData = { userId: 'user-1', paymentMethodId: 'pm_test' };
      mockPost.mockResolvedValue({ data: { data: mockCheckout } });
      const result = await cartService.checkout(checkoutData as any);
      expect(mockPost).toHaveBeenCalledWith('/cart/checkout', checkoutData);
      expect(result).toEqual(mockCheckout);
    });

    it('throws on error', async () => {
      mockPost.mockRejectedValue(new Error('Checkout failed'));
      await expect(cartService.checkout({} as any)).rejects.toThrow('Checkout failed');
    });
  });
});
