/**
 * US-IA-009.1 — Activation CacheService
 *
 * Tests du CacheService Redis :
 * - getRecommendations / setRecommendations (TTL 30 min)
 * - getUserVector / setUserVector (TTL 1 h)
 * - invalidateUserRecommendations
 * - Dégradation gracieuse sur erreur Redis
 * - TTL constants conformes aux specs
 *
 * @ticket US-IA-009.1
 */

// Mock ioredis AVANT tout import du CacheService
jest.mock('ioredis', () => {
  const mockRedis: Record<string, jest.Mock> = {
    get: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
    dbsize: jest.fn(),
    info: jest.fn(),
    ping: jest.fn(),
  };
  return jest.fn(() => mockRedis);
});

import Redis from 'ioredis';
import { CacheService } from '@ai/services/CacheService';

// Helper pour accéder au mock Redis interne
function getMockRedis() {
  const RedisMock = Redis as jest.MockedClass<typeof Redis>;
  return RedisMock.mock.results[0]?.value as Record<string, jest.Mock>;
}

describe('US-IA-009.1 — CacheService', () => {
  let service: CacheService;
  let mockRedis: Record<string, jest.Mock>;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CacheService();
    mockRedis = getMockRedis();
  });

  // ─── TTL Constants ───────────────────────────────────────────────────────────

  describe('TTL constants (specs US-IA-009)', () => {
    it('should set recommendations with TTL = 1800s (30 min)', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      await service.setRecommendations('user-1', [{ id: 'reco-1' }]);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'recommendations:user-1',
        1800,
        expect.any(String)
      );
    });

    it('should set user vector with TTL = 3600s (1 h)', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      await service.setUserVector('user-1', [0.5, 0.3, 0.8]);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'user_vector:user-1',
        3600,
        expect.any(String)
      );
    });
  });

  // ─── getRecommendations ───────────────────────────────────────────────────────

  describe('getRecommendations', () => {
    it('should return parsed data on cache hit', async () => {
      const data = [{ id: 'hotel-1', name: 'Grand Hotel' }];
      mockRedis.get.mockResolvedValue(JSON.stringify(data));

      const result = await service.getRecommendations('user-1');

      expect(result).toEqual(data);
      expect(mockRedis.get).toHaveBeenCalledWith('recommendations:user-1');
    });

    it('should return null on cache miss', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await service.getRecommendations('user-missing');

      expect(result).toBeNull();
    });

    it('should return null and NOT throw on Redis error', async () => {
      mockRedis.get.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(service.getRecommendations('user-error')).resolves.toBeNull();
    });
  });

  // ─── setRecommendations ───────────────────────────────────────────────────────

  describe('setRecommendations', () => {
    it('should serialize data as JSON', async () => {
      mockRedis.setex.mockResolvedValue('OK');
      const recommendations = [{ id: 'r1' }, { id: 'r2' }];

      await service.setRecommendations('user-2', recommendations);

      const calledWith = mockRedis.setex.mock.calls[0][2];
      expect(JSON.parse(calledWith)).toEqual(recommendations);
    });

    it('should NOT throw on Redis write error', async () => {
      mockRedis.setex.mockRejectedValue(new Error('Redis write failed'));

      await expect(service.setRecommendations('user-3', [])).resolves.toBeUndefined();
    });
  });

  // ─── invalidateUserRecommendations ────────────────────────────────────────────

  describe('invalidateUserRecommendations', () => {
    it('should delete the recommendations key for a user', async () => {
      mockRedis.del.mockResolvedValue(1);

      await service.invalidateUserRecommendations('user-4');

      expect(mockRedis.del).toHaveBeenCalledWith('recommendations:user-4');
    });

    it('should NOT throw on Redis error', async () => {
      mockRedis.del.mockRejectedValue(new Error('Redis error'));

      await expect(service.invalidateUserRecommendations('user-5')).resolves.toBeUndefined();
    });
  });

  // ─── getUserVector / setUserVector ────────────────────────────────────────────

  describe('getUserVector', () => {
    it('should return the cached vector on hit', async () => {
      const vector = [0.1, 0.9, 0.3, 0.7, 0.5, 0.2, 0.8, 0.4];
      mockRedis.get.mockResolvedValue(JSON.stringify(vector));

      const result = await service.getUserVector('user-6');

      expect(result).toEqual(vector);
      expect(mockRedis.get).toHaveBeenCalledWith('user_vector:user-6');
    });

    it('should return null on cache miss', async () => {
      mockRedis.get.mockResolvedValue(null);
      expect(await service.getUserVector('user-unknown')).toBeNull();
    });

    it('should return null on Redis error', async () => {
      mockRedis.get.mockRejectedValue(new Error('ECONNREFUSED'));
      expect(await service.getUserVector('user-error')).toBeNull();
    });
  });

  // ─── getTrending / setTrending ────────────────────────────────────────────────

  describe('getTrending', () => {
    it('should return trending destinations on cache hit', async () => {
      const destinations = [{ city: 'Paris' }, { city: 'Tokyo' }];
      mockRedis.get.mockResolvedValue(JSON.stringify(destinations));

      const result = await service.getTrending();

      expect(result).toEqual(destinations);
      expect(mockRedis.get).toHaveBeenCalledWith('trending:destinations');
    });

    it('should return null on cache miss', async () => {
      mockRedis.get.mockResolvedValue(null);
      expect(await service.getTrending()).toBeNull();
    });
  });

  describe('setTrending', () => {
    it('should cache trending with TTL = 300s (5 min)', async () => {
      mockRedis.setex.mockResolvedValue('OK');
      const destinations = [{ city: 'Paris' }];

      await service.setTrending(destinations);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'trending:destinations',
        300,
        JSON.stringify(destinations)
      );
    });
  });

  // ─── Méthodes génériques ──────────────────────────────────────────────────────

  describe('get / setex (generic)', () => {
    it('get should return raw string', async () => {
      mockRedis.get.mockResolvedValue('raw-value');
      expect(await service.get('any:key')).toBe('raw-value');
    });

    it('setex should call Redis with provided key, ttl and value', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      await service.setex('custom:key', 600, 'my-value');

      expect(mockRedis.setex).toHaveBeenCalledWith('custom:key', 600, 'my-value');
    });
  });

  // ─── ping / health ────────────────────────────────────────────────────────────

  describe('ping', () => {
    it('should return PONG', async () => {
      mockRedis.ping.mockResolvedValue('PONG');
      expect(await service.ping()).toBe('PONG');
    });
  });
});
