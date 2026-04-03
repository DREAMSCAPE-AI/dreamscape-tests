/**
 * DR-564 — US-TEST-027
 * Tests unitaires : cartStore (store/cartStore)
 *
 * Scénarios couverts :
 * - État initial
 * - fetchCart : succès, erreur
 * - addToCart : succès (ouvre le drawer), erreur (re-throw)
 * - updateItemQuantity : succès, erreur
 * - removeItem : succès, erreur
 * - clearCart : succès (ferme le drawer, vide localStorage), erreur
 * - extendExpiry : succès, erreur
 * - checkout : succès, erreur
 * - Computed getters : getItemCount, getTotalPrice, getExpiryTime, getTimeRemaining
 * - UI actions : openDrawer, closeDrawer, toggleDrawer, clearError
 *
 * @jest-environment jsdom
 * @ticket DR-564
 */

// ── Mock cartService (prevents import.meta.env evaluation) ─────────────────
const mockGetCart = jest.fn();
const mockAddToCart = jest.fn();
const mockUpdateCartItem = jest.fn();
const mockRemoveCartItem = jest.fn();
const mockClearCart = jest.fn();
const mockExtendCartExpiry = jest.fn();
const mockCheckout = jest.fn();

jest.mock('@/services/voyage/CartService', () => ({
  cartService: {
    getCart: mockGetCart,
    addToCart: mockAddToCart,
    updateCartItem: mockUpdateCartItem,
    removeCartItem: mockRemoveCartItem,
    clearCart: mockClearCart,
    extendCartExpiry: mockExtendCartExpiry,
    checkout: mockCheckout,
  },
}));

import { useCartStore } from '@/store/cartStore';

// ── Helpers ─────────────────────────────────────────────────────────────────

const initialState = {
  cart: null,
  isLoading: false,
  isCheckingOut: false,
  error: null,
  isDrawerOpen: false,
};

const mockCart = {
  id: 'cart-1',
  userId: 'user-1',
  items: [
    { id: 'item-1', type: 'FLIGHT', price: 299, quantity: 2, currency: 'EUR' },
    { id: 'item-2', type: 'HOTEL', price: 150, quantity: 1, currency: 'EUR' },
  ],
  totalPrice: 748,
  expiresAt: new Date(Date.now() + 3600000).toISOString(),
};

const mockCheckoutResponse = {
  bookingReference: 'BOOK-001',
  status: 'PENDING',
  items: mockCart.items,
};

function resetStore() {
  useCartStore.setState(initialState);
}

// ─────────────────────────────────────────────────────────────────────────────

describe('cartStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
    localStorage.clear();
  });

  // ── Initial state ──────────────────────────────────────────────────────────
  describe('initial state', () => {
    it('has correct default values', () => {
      const state = useCartStore.getState();
      expect(state.cart).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.isCheckingOut).toBe(false);
      expect(state.error).toBeNull();
      expect(state.isDrawerOpen).toBe(false);
    });
  });

  // ── fetchCart ──────────────────────────────────────────────────────────────
  describe('fetchCart', () => {
    it('sets cart on success', async () => {
      mockGetCart.mockResolvedValue(mockCart);

      await useCartStore.getState().fetchCart('user-1');

      const state = useCartStore.getState();
      expect(mockGetCart).toHaveBeenCalledWith('user-1');
      expect(state.cart).toEqual(mockCart);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('sets error on failure', async () => {
      mockGetCart.mockRejectedValue(new Error('Network Error'));

      await useCartStore.getState().fetchCart('user-1');

      const state = useCartStore.getState();
      expect(state.cart).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe('Network Error');
    });
  });

  // ── addToCart ──────────────────────────────────────────────────────────────
  describe('addToCart', () => {
    it('sets cart and opens drawer on success', async () => {
      mockAddToCart.mockResolvedValue(mockCart);
      const payload = { userId: 'user-1', type: 'FLIGHT', itemData: {}, price: 299, currency: 'EUR' };

      await useCartStore.getState().addToCart(payload);

      const state = useCartStore.getState();
      expect(mockAddToCart).toHaveBeenCalledWith(payload);
      expect(state.cart).toEqual(mockCart);
      expect(state.isDrawerOpen).toBe(true);
      expect(state.isLoading).toBe(false);
    });

    it('sets error and re-throws on failure', async () => {
      mockAddToCart.mockRejectedValue(new Error('409 Conflict'));

      await expect(useCartStore.getState().addToCart({})).rejects.toThrow('409 Conflict');

      const state = useCartStore.getState();
      expect(state.error).toBe('409 Conflict');
      expect(state.isLoading).toBe(false);
    });
  });

  // ── updateItemQuantity ─────────────────────────────────────────────────────
  describe('updateItemQuantity', () => {
    it('updates cart on success', async () => {
      const updatedCart = { ...mockCart, items: [{ ...mockCart.items[0], quantity: 3 }] };
      mockUpdateCartItem.mockResolvedValue(updatedCart);

      await useCartStore.getState().updateItemQuantity('user-1', 'item-1', 3);

      const state = useCartStore.getState();
      expect(mockUpdateCartItem).toHaveBeenCalledWith('user-1', 'item-1', { quantity: 3 });
      expect(state.cart).toEqual(updatedCart);
    });

    it('sets error and re-throws on failure', async () => {
      mockUpdateCartItem.mockRejectedValue(new Error('404 Not Found'));

      await expect(useCartStore.getState().updateItemQuantity('user-1', 'bad-id', 1)).rejects.toThrow();

      expect(useCartStore.getState().error).toBe('404 Not Found');
    });
  });

  // ── removeItem ─────────────────────────────────────────────────────────────
  describe('removeItem', () => {
    it('updates cart after removal', async () => {
      const updatedCart = { ...mockCart, items: [] };
      mockRemoveCartItem.mockResolvedValue(updatedCart);

      await useCartStore.getState().removeItem('user-1', 'item-1');

      expect(mockRemoveCartItem).toHaveBeenCalledWith('user-1', 'item-1');
      expect(useCartStore.getState().cart).toEqual(updatedCart);
    });

    it('sets error and re-throws on failure', async () => {
      mockRemoveCartItem.mockRejectedValue(new Error('Server Error'));

      await expect(useCartStore.getState().removeItem('user-1', 'item-1')).rejects.toThrow();

      expect(useCartStore.getState().error).toBe('Server Error');
    });
  });

  // ── clearCart ──────────────────────────────────────────────────────────────
  describe('clearCart', () => {
    it('sets cart to null and closes drawer on success', async () => {
      mockClearCart.mockResolvedValue(undefined);
      useCartStore.setState({ cart: mockCart, isDrawerOpen: true });

      await useCartStore.getState().clearCart('user-1');

      const state = useCartStore.getState();
      expect(mockClearCart).toHaveBeenCalledWith('user-1');
      expect(state.cart).toBeNull();
      expect(state.isDrawerOpen).toBe(false);
    });

    it('sets error and re-throws on failure', async () => {
      mockClearCart.mockRejectedValue(new Error('500 Server Error'));

      await expect(useCartStore.getState().clearCart('user-1')).rejects.toThrow();

      expect(useCartStore.getState().error).toBe('500 Server Error');
    });
  });

  // ── extendExpiry ───────────────────────────────────────────────────────────
  describe('extendExpiry', () => {
    it('updates cart with new expiry', async () => {
      const extendedCart = { ...mockCart, expiresAt: new Date(Date.now() + 7200000).toISOString() };
      mockExtendCartExpiry.mockResolvedValue(extendedCart);

      await useCartStore.getState().extendExpiry('user-1');

      expect(mockExtendCartExpiry).toHaveBeenCalledWith('user-1');
      expect(useCartStore.getState().cart).toEqual(extendedCart);
    });

    it('sets error and re-throws on failure', async () => {
      mockExtendCartExpiry.mockRejectedValue(new Error('Failed'));

      await expect(useCartStore.getState().extendExpiry('user-1')).rejects.toThrow();
    });
  });

  // ── checkout ───────────────────────────────────────────────────────────────
  describe('checkout', () => {
    it('returns checkout response on success', async () => {
      mockCheckout.mockResolvedValue(mockCheckoutResponse);

      const result = await useCartStore.getState().checkout('user-1');

      expect(mockCheckout).toHaveBeenCalledWith({ userId: 'user-1', metadata: undefined });
      expect(result).toEqual(mockCheckoutResponse);
      expect(useCartStore.getState().isCheckingOut).toBe(false);
    });

    it('passes metadata if provided', async () => {
      mockCheckout.mockResolvedValue(mockCheckoutResponse);
      const meta = { promoCode: 'SAVE10' };

      await useCartStore.getState().checkout('user-1', meta);

      expect(mockCheckout).toHaveBeenCalledWith({ userId: 'user-1', metadata: meta });
    });

    it('sets error and re-throws on failure', async () => {
      mockCheckout.mockRejectedValue(new Error('Payment failed'));

      await expect(useCartStore.getState().checkout('user-1')).rejects.toThrow('Payment failed');

      const state = useCartStore.getState();
      expect(state.error).toBe('Payment failed');
      expect(state.isCheckingOut).toBe(false);
    });
  });

  // ── Computed getters ───────────────────────────────────────────────────────
  describe('getItemCount', () => {
    it('returns 0 when cart is null', () => {
      expect(useCartStore.getState().getItemCount()).toBe(0);
    });

    it('returns total quantity of all items', () => {
      useCartStore.setState({ cart: mockCart });
      // items[0].quantity=2, items[1].quantity=1 → total=3
      expect(useCartStore.getState().getItemCount()).toBe(3);
    });
  });

  describe('getTotalPrice', () => {
    it('returns 0 when cart is null', () => {
      expect(useCartStore.getState().getTotalPrice()).toBe(0);
    });

    it('returns cart totalPrice', () => {
      useCartStore.setState({ cart: mockCart });
      expect(useCartStore.getState().getTotalPrice()).toBe(748);
    });
  });

  describe('getExpiryTime', () => {
    it('returns null when no cart', () => {
      expect(useCartStore.getState().getExpiryTime()).toBeNull();
    });

    it('returns Date from cart.expiresAt', () => {
      useCartStore.setState({ cart: mockCart });
      const expiry = useCartStore.getState().getExpiryTime();
      expect(expiry).toBeInstanceOf(Date);
    });
  });

  describe('getTimeRemaining', () => {
    it('returns null when no cart', () => {
      expect(useCartStore.getState().getTimeRemaining()).toBeNull();
    });

    it('returns positive ms when expiry is in the future', () => {
      useCartStore.setState({ cart: mockCart });
      const remaining = useCartStore.getState().getTimeRemaining();
      expect(remaining).toBeGreaterThan(0);
    });
  });

  // ── UI actions ─────────────────────────────────────────────────────────────
  describe('UI actions', () => {
    it('openDrawer sets isDrawerOpen to true', () => {
      useCartStore.getState().openDrawer();
      expect(useCartStore.getState().isDrawerOpen).toBe(true);
    });

    it('closeDrawer sets isDrawerOpen to false', () => {
      useCartStore.setState({ isDrawerOpen: true });
      useCartStore.getState().closeDrawer();
      expect(useCartStore.getState().isDrawerOpen).toBe(false);
    });

    it('toggleDrawer flips isDrawerOpen', () => {
      expect(useCartStore.getState().isDrawerOpen).toBe(false);
      useCartStore.getState().toggleDrawer();
      expect(useCartStore.getState().isDrawerOpen).toBe(true);
      useCartStore.getState().toggleDrawer();
      expect(useCartStore.getState().isDrawerOpen).toBe(false);
    });

    it('clearError sets error to null', () => {
      useCartStore.setState({ error: 'Some error' });
      useCartStore.getState().clearError();
      expect(useCartStore.getState().error).toBeNull();
    });
  });
});
