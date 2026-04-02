/**
 * US-TEST-010 — Tests unitaires CartService
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// ── Mock Redis ─────────────────────────────────────────────────────────────────
const mockRedisGet = jest.fn();
const mockRedisSet = jest.fn();
const mockRedisDel = jest.fn();

jest.mock('@/config/redis', () => ({
  __esModule: true,
  default: {
    get: mockRedisGet,
    set: mockRedisSet,
    del: mockRedisDel,
  },
}));

// ── Mock Prisma ────────────────────────────────────────────────────────────────
const mockCartFindFirst  = jest.fn();
const mockCartFindUnique = jest.fn();
const mockCartCreate     = jest.fn();
const mockCartUpdate     = jest.fn();
const mockCartDelete     = jest.fn();
const mockCartDeleteMany = jest.fn();
const mockCartItemCreate = jest.fn();
const mockCartItemUpdate = jest.fn();
const mockCartItemDelete = jest.fn();

jest.mock('@/database/prisma', () => ({
  __esModule: true,
  default: {
    cartData: {
      findFirst:  mockCartFindFirst,
      findUnique: mockCartFindUnique,
      create:     mockCartCreate,
      update:     mockCartUpdate,
      delete:     mockCartDelete,
      deleteMany: mockCartDeleteMany,
    },
    cartItem: {
      create: mockCartItemCreate,
      update: mockCartItemUpdate,
      delete: mockCartItemDelete,
    },
  },
}));

// ── Import après les mocks ─────────────────────────────────────────────────────
import { CartService } from '@/services/CartService';

// ── Fixtures ───────────────────────────────────────────────────────────────────
const USER_ID = 'user-cart-test';
const CART_ID = 'cart-abc-001';

const mockCartItem = {
  id:       'item-001',
  cartId:   CART_ID,
  type:     'FLIGHT',
  itemId:   'flight-001',
  itemData: { origin: 'CDG', destination: 'LHR' },
  quantity: 1,
  price:    300,
  currency: 'EUR',
};

const mockCart = {
  id:         CART_ID,
  userId:     USER_ID,
  totalPrice: 300,
  currency:   'EUR',
  expiresAt:  new Date(Date.now() + 30 * 60 * 1000),
  createdAt:  new Date(),
  items:      [mockCartItem],
};

const mockEmptyCart = { ...mockCart, totalPrice: 0, items: [] };
const mockCachedCart = {
  ...mockCart,
  expiresAt: mockCart.expiresAt.toISOString(),
  createdAt: mockCart.createdAt.toISOString(),
};

// ── Tests ──────────────────────────────────────────────────────────────────────
describe('CartService — US-TEST-010', () => {
  let service: CartService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CartService();
    mockRedisGet.mockResolvedValue(null as never);
    mockRedisSet.mockResolvedValue('OK' as never);
    mockRedisDel.mockResolvedValue(1 as never);
  });

  // ── getCart ───────────────────────────────────────────────────────────────
  describe('getCart', () => {
    it('should return cached cart from Redis (cache hit)', async () => {
      mockRedisGet.mockResolvedValue(JSON.stringify(mockCachedCart) as never);

      const result = await service.getCart(USER_ID);

      expect(mockRedisGet).toHaveBeenCalledWith(`cart:${USER_ID}`);
      expect(mockCartFindFirst).not.toHaveBeenCalled();
      expect(result).toEqual(mockCachedCart);
    });

    it('should fall back to DB on cache miss and refresh Redis', async () => {
      mockRedisGet.mockResolvedValue(null as never);
      mockCartFindFirst.mockResolvedValue(mockCart as never);

      const result = await service.getCart(USER_ID);

      expect(mockCartFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ userId: USER_ID }) })
      );
      expect(mockRedisSet).toHaveBeenCalled();
      expect(result).toEqual(mockCart);
    });

    it('should return null when cart not in Redis nor in DB', async () => {
      mockRedisGet.mockResolvedValue(null as never);
      mockCartFindFirst.mockResolvedValue(null as never);

      const result = await service.getCart(USER_ID);
      expect(result).toBeNull();
    });

    it('should only query non-expired carts from DB', async () => {
      mockRedisGet.mockResolvedValue(null as never);
      mockCartFindFirst.mockResolvedValue(null as never);

      await service.getCart(USER_ID);

      expect(mockCartFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            expiresAt: { gte: expect.any(Date) },
          }),
        })
      );
    });

    it('should propagate DB errors', async () => {
      mockRedisGet.mockResolvedValue(null as never);
      mockCartFindFirst.mockRejectedValue(new Error('DB connection lost') as never);

      await expect(service.getCart(USER_ID)).rejects.toThrow('DB connection lost');
    });
  });

  // ── addToCart ─────────────────────────────────────────────────────────────
  describe('addToCart', () => {
    const addFlightPayload = {
      userId:   USER_ID,
      type:     'FLIGHT' as const,
      itemId:   'flight-001',
      itemData: { origin: 'CDG', destination: 'LHR' },
      price:    300,
    };

    it('should create a new cart when user has none and add the item', async () => {
      mockCartFindFirst.mockResolvedValue(null as never);
      mockCartCreate.mockResolvedValue({ ...mockCart, items: [mockCartItem] } as never);
      mockCartFindUnique.mockResolvedValue({ ...mockCart, items: [mockCartItem] } as never);
      mockCartUpdate.mockResolvedValue(mockCart as never);

      const result = await service.addToCart(addFlightPayload);

      expect(mockCartCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: USER_ID,
            items: expect.objectContaining({ create: expect.any(Object) }),
          }),
        })
      );
      expect(result).toBeDefined();
    });

    it('should add a hotel item to an existing cart', async () => {
      mockRedisGet.mockResolvedValue(JSON.stringify(mockEmptyCart) as never);
      mockCartItemCreate.mockResolvedValue({} as never);
      mockCartFindUnique.mockResolvedValue({ ...mockCart, items: [] } as never);
      mockCartUpdate.mockResolvedValue(mockEmptyCart as never);

      await service.addToCart({
        userId:   USER_ID,
        type:     'HOTEL',
        itemId:   'hotel-001',
        itemData: { name: 'Hotel Paris' },
        price:    200,
      });

      expect(mockCartItemCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'HOTEL', itemId: 'hotel-001' }),
        })
      );
    });

    it('should add an activity item to an existing cart', async () => {
      mockRedisGet.mockResolvedValue(JSON.stringify(mockEmptyCart) as never);
      mockCartItemCreate.mockResolvedValue({} as never);
      mockCartFindUnique.mockResolvedValue({ ...mockCart, items: [] } as never);
      mockCartUpdate.mockResolvedValue(mockEmptyCart as never);

      await service.addToCart({
        userId:   USER_ID,
        type:     'ACTIVITY',
        itemId:   'activity-001',
        itemData: { name: 'Eiffel Tower Tour' },
        price:    50,
      });

      expect(mockCartItemCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'ACTIVITY' }),
        })
      );
    });

    it('should skip duplicate item (same itemId + type) and return current cart', async () => {
      mockRedisGet.mockResolvedValue(JSON.stringify(mockCachedCart) as never);

      const result = await service.addToCart(addFlightPayload);

      expect(mockCartItemCreate).not.toHaveBeenCalled();
      expect(result).toEqual(mockCachedCart);
    });
  });

  // ── removeCartItem ────────────────────────────────────────────────────────
  describe('removeCartItem', () => {
    it('should remove an existing item and recalculate total', async () => {
      mockRedisGet.mockResolvedValue(JSON.stringify(mockCart) as never);
      mockCartItemDelete.mockResolvedValue({} as never);
      mockCartFindUnique.mockResolvedValue(mockEmptyCart as never);
      mockCartUpdate.mockResolvedValue(mockEmptyCart as never);

      const result = await service.removeCartItem(USER_ID, 'item-001');

      expect(mockCartItemDelete).toHaveBeenCalledWith({ where: { id: 'item-001' } });
      expect(result).toBeDefined();
    });

    it('should throw when cart not found', async () => {
      mockCartFindFirst.mockResolvedValue(null as never);

      await expect(service.removeCartItem(USER_ID, 'item-001')).rejects.toThrow('Cart not found');
    });

    it('should throw when item not found in cart', async () => {
      mockRedisGet.mockResolvedValue(JSON.stringify({ ...mockCart, items: [] }) as never);

      await expect(service.removeCartItem(USER_ID, 'item-ghost')).rejects.toThrow(
        'Cart item not found'
      );
    });

    it('should result in zero totalPrice when removing the last item', async () => {
      mockRedisGet.mockResolvedValue(JSON.stringify(mockCart) as never);
      mockCartItemDelete.mockResolvedValue({} as never);
      mockCartFindUnique.mockResolvedValue({ ...mockCart, items: [] } as never);
      mockCartUpdate.mockResolvedValue({ ...mockEmptyCart, totalPrice: 0 } as never);

      const result = await service.removeCartItem(USER_ID, 'item-001');
      expect(result.totalPrice).toBe(0);
    });
  });

  // ── updateCartItem ────────────────────────────────────────────────────────
  describe('updateCartItem', () => {
    it('should update item quantity and recalculate total', async () => {
      mockRedisGet.mockResolvedValue(JSON.stringify(mockCart) as never);
      mockCartItemUpdate.mockResolvedValue({} as never);
      const updatedCart = { ...mockCart, totalPrice: 600, items: [{ ...mockCartItem, quantity: 2 }] };
      mockCartFindUnique.mockResolvedValue(updatedCart as never);
      mockCartUpdate.mockResolvedValue(updatedCart as never);

      const result = await service.updateCartItem(USER_ID, 'item-001', { quantity: 2 });

      expect(mockCartItemUpdate).toHaveBeenCalledWith({
        where: { id: 'item-001' },
        data:  { quantity: 2 },
      });
      expect(result.totalPrice).toBe(600);
    });

    it('should throw when cart not found', async () => {
      mockCartFindFirst.mockResolvedValue(null as never);

      await expect(service.updateCartItem(USER_ID, 'item-001', { quantity: 2 })).rejects.toThrow(
        'Cart not found'
      );
    });

    it('should throw when item not found', async () => {
      mockRedisGet.mockResolvedValue(JSON.stringify({ ...mockCart, items: [] }) as never);

      await expect(service.updateCartItem(USER_ID, 'item-ghost', { quantity: 2 })).rejects.toThrow(
        'Cart item not found'
      );
    });
  });

  // ── clearCart ─────────────────────────────────────────────────────────────
  describe('clearCart', () => {
    it('should delete the cart and remove from Redis', async () => {
      mockRedisGet.mockResolvedValue(JSON.stringify(mockCart) as never);
      mockCartDelete.mockResolvedValue({} as never);

      await service.clearCart(USER_ID);

      expect(mockCartDelete).toHaveBeenCalledWith({ where: { id: CART_ID } });
      expect(mockRedisDel).toHaveBeenCalledWith(`cart:${USER_ID}`);
    });

    it('should do nothing gracefully when cart does not exist', async () => {
      mockCartFindFirst.mockResolvedValue(null as never);

      await expect(service.clearCart(USER_ID)).resolves.toBeUndefined();
      expect(mockCartDelete).not.toHaveBeenCalled();
    });
  });

  // ── cleanupExpiredCarts ───────────────────────────────────────────────────
  describe('cleanupExpiredCarts', () => {
    it('should delete expired carts and return count', async () => {
      mockCartDeleteMany.mockResolvedValue({ count: 5 } as never);

      const count = await service.cleanupExpiredCarts();

      expect(mockCartDeleteMany).toHaveBeenCalledWith({
        where: { expiresAt: { lt: expect.any(Date) } },
      });
      expect(count).toBe(5);
    });

    it('should return 0 when no expired carts exist', async () => {
      mockCartDeleteMany.mockResolvedValue({ count: 0 } as never);

      const count = await service.cleanupExpiredCarts();
      expect(count).toBe(0);
    });
  });

  // ── extendCartExpiry ──────────────────────────────────────────────────────
  describe('extendCartExpiry', () => {
    it('should extend expiry and update cache', async () => {
      mockRedisGet.mockResolvedValue(JSON.stringify(mockCart) as never);
      const extendedCart = { ...mockCart, expiresAt: new Date(Date.now() + 30 * 60 * 1000) };
      mockCartUpdate.mockResolvedValue(extendedCart as never);

      const result = await service.extendCartExpiry(USER_ID);

      expect(mockCartUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: CART_ID },
          data:  expect.objectContaining({ expiresAt: expect.any(Date) }),
        })
      );
      expect(mockRedisSet).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should return null when no cart found', async () => {
      mockCartFindFirst.mockResolvedValue(null as never);

      const result = await service.extendCartExpiry(USER_ID);
      expect(result).toBeNull();
    });
  });
});
