/**
 * DR-563 — US-TEST-026
 * Tests unitaires : FavoritesService (services/user/FavoritesService)
 *
 * Importe le vrai service — import.meta.env transformé par vite-meta-transform.
 *
 * @jest-environment jsdom
 * @ticket DR-563
 */

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPut = jest.fn();
const mockDelete = jest.fn();

let mockRequestInterceptor: ((config: any) => any) | null = null;
let mockResponseErrorInterceptor: ((error: any) => any) | null = null;

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    create: jest.fn(() => ({
      get: mockGet,
      post: mockPost,
      put: mockPut,
      delete: mockDelete,
      interceptors: {
        request: {
          use: jest.fn((onFulfilled: (c: any) => any) => {
            mockRequestInterceptor = onFulfilled;
          }),
        },
        response: {
          use: jest.fn((_ok: any, onError: (e: any) => any) => {
            mockResponseErrorInterceptor = onError;
          }),
        },
      },
    })),
  },
}));

process.env.VITE_USER_SERVICE_URL = 'http://localhost:3002';

import favoritesService, { FavoriteType } from '@/services/user/FavoritesService';

// ── Fixtures ────────────────────────────────────────────────────────────────

const mockFavorite = {
  id: 'fav-1', userId: 'user-1', entityType: FavoriteType.FLIGHT,
  entityId: 'flight-1', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
};

// ─────────────────────────────────────────────────────────────────────────────

describe('FavoritesService', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── CRUD ──────────────────────────────────────────────────────────────────
  describe('getFavorites', () => {
    it('calls GET / with no params by default', async () => {
      mockGet.mockResolvedValue({ data: { success: true, data: [], pagination: { total: 0 } } });
      await favoritesService.getFavorites();
      expect(mockGet).toHaveBeenCalledWith('/', { params: undefined });
    });

    it('passes filter params (entityType, limit, offset)', async () => {
      mockGet.mockResolvedValue({ data: { success: true, data: [], pagination: {} } });
      await favoritesService.getFavorites({ entityType: FavoriteType.HOTEL, limit: 20, offset: 0 });
      expect(mockGet).toHaveBeenCalledWith('/', {
        params: { entityType: FavoriteType.HOTEL, limit: 20, offset: 0 },
      });
    });

    it('returns the response data', async () => {
      const mockResponse = { success: true, data: [mockFavorite], pagination: { total: 1, limit: 10, offset: 0, hasMore: false } };
      mockGet.mockResolvedValue({ data: mockResponse });
      const result = await favoritesService.getFavorites();
      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });
  });

  describe('addFavorite', () => {
    it('calls POST / with favorite payload', async () => {
      const payload = { entityType: FavoriteType.FLIGHT, entityId: 'flight-1' };
      mockPost.mockResolvedValue({ data: { success: true, data: mockFavorite, message: 'Added' } });
      const result = await favoritesService.addFavorite(payload);
      expect(mockPost).toHaveBeenCalledWith('/', payload);
      expect(result.success).toBe(true);
      expect(result.data.entityId).toBe('flight-1');
    });

    it('propagates 409 errors (already favorited)', async () => {
      mockPost.mockRejectedValue(new Error('409 Conflict'));
      await expect(favoritesService.addFavorite({ entityType: FavoriteType.FLIGHT, entityId: 'flight-1' })).rejects.toThrow();
    });
  });

  describe('getFavoriteById', () => {
    it('calls GET /:id', async () => {
      mockGet.mockResolvedValue({ data: { success: true, data: mockFavorite } });
      const result = await favoritesService.getFavoriteById('fav-1');
      expect(mockGet).toHaveBeenCalledWith('/fav-1');
      expect(result.data.id).toBe('fav-1');
    });
  });

  describe('updateFavorite', () => {
    it('calls PUT /:id with update payload', async () => {
      const update = { notes: 'Great flight' };
      mockPut.mockResolvedValue({ data: { success: true, data: { ...mockFavorite, notes: 'Great flight' }, message: 'Updated' } });
      const result = await favoritesService.updateFavorite('fav-1', update);
      expect(mockPut).toHaveBeenCalledWith('/fav-1', update);
      expect(result.data.notes).toBe('Great flight');
    });
  });

  describe('deleteFavorite', () => {
    it('calls DELETE /:id and returns success response', async () => {
      mockDelete.mockResolvedValue({ data: { success: true, message: 'Deleted' } });
      const result = await favoritesService.deleteFavorite('fav-1');
      expect(mockDelete).toHaveBeenCalledWith('/fav-1');
      expect(result.success).toBe(true);
    });
  });

  // ── Check endpoints ───────────────────────────────────────────────────────
  describe('checkFavorite', () => {
    it('calls GET /check/:entityType/:entityId', async () => {
      mockGet.mockResolvedValue({ data: { success: true, isFavorited: true, favorite: { id: 'fav-1', createdAt: '2026-01-01' } } });
      const result = await favoritesService.checkFavorite(FavoriteType.FLIGHT, 'flight-1');
      expect(mockGet).toHaveBeenCalledWith('/check/FLIGHT/flight-1');
      expect(result.isFavorited).toBe(true);
    });

    it('returns isFavorited=false when not favorited', async () => {
      mockGet.mockResolvedValue({ data: { success: true, isFavorited: false, favorite: null } });
      const result = await favoritesService.checkFavorite(FavoriteType.HOTEL, 'hotel-99');
      expect(result.isFavorited).toBe(false);
    });
  });

  describe('checkFavoritesBatch', () => {
    it('calls POST /check-batch with items array', async () => {
      const items = [
        { entityType: FavoriteType.FLIGHT, entityId: 'f1' },
        { entityType: FavoriteType.HOTEL, entityId: 'h1' },
      ];
      mockPost.mockResolvedValue({ data: { success: true, results: items.map(i => ({ ...i, isFavorited: false, favorite: null })) } });
      const result = await favoritesService.checkFavoritesBatch(items);
      expect(mockPost).toHaveBeenCalledWith('/check-batch', { items });
      expect(result.results).toHaveLength(2);
    });
  });

  // ── Auth interceptor ──────────────────────────────────────────────────────
  describe('Auth interceptor', () => {
    it('adds Bearer token from localStorage to request headers', () => {
      if (!mockRequestInterceptor) return;
      localStorage.setItem('auth-storage', JSON.stringify({ state: { token: 'my-token' } }));
      const config = { headers: {} as Record<string, string> };
      const result = mockRequestInterceptor(config);
      expect(result.headers['Authorization']).toBe('Bearer my-token');
    });

    it('does not add Authorization header when no token in localStorage', () => {
      if (!mockRequestInterceptor) return;
      localStorage.removeItem('auth-storage');
      const config = { headers: {} as Record<string, string> };
      const result = mockRequestInterceptor(config);
      expect(result.headers['Authorization']).toBeUndefined();
    });
  });
});
