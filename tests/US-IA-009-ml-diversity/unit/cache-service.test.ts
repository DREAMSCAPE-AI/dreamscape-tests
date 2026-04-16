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
  return (
    RedisMock.mock.results[0]?.value ||
    new (Redis as any)()
  ) as Record<string, jest.Mock>;
}

describe('US-IA-009.1 — CacheService', () => {
  let service: CacheService;
  let mockRedis: Record<string, jest.Mock>;

  beforeEach(() => {
    mockRedis = getMockRedis();
    Object.values(mockRedis).forEach((fn) => fn.mockReset());
    service = new CacheService();
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

  describe('setUserVector', () => {
    it('should swallow Redis errors when setting a user vector', async () => {
      mockRedis.setex.mockRejectedValue(new Error('user vector write failed'));

      await expect(service.setUserVector('user-7', [0.1, 0.2])).resolves.toBeUndefined();
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

    it('should return null on Redis error', async () => {
      mockRedis.get.mockRejectedValue(new Error('trending read failed'));

      await expect(service.getTrending()).resolves.toBeNull();
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

    it('should swallow Redis errors when setting trending destinations', async () => {
      mockRedis.setex.mockRejectedValue(new Error('trend write failed'));

      await expect(service.setTrending([{ city: 'Oslo' }])).resolves.toBeUndefined();
    });
  });

  // ─── Méthodes génériques ──────────────────────────────────────────────────────

  describe('get / setex (generic)', () => {
    it('get should return raw string', async () => {
      mockRedis.get.mockResolvedValue('raw-value');
      expect(await service.get('any:key')).toBe('raw-value');
    });

    it('get should return null on Redis error', async () => {
      mockRedis.get.mockRejectedValue(new Error('generic get failed'));

      await expect(service.get('any:key')).resolves.toBeNull();
    });

    it('setex should call Redis with provided key, ttl and value', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      await service.setex('custom:key', 600, 'my-value');

      expect(mockRedis.setex).toHaveBeenCalledWith('custom:key', 600, 'my-value');
    });

    it('setex should swallow Redis errors', async () => {
      mockRedis.setex.mockRejectedValue(new Error('generic write failed'));

      await expect(service.setex('custom:key', 600, 'my-value')).resolves.toBeUndefined();
    });
  });

  // ─── ping / health ────────────────────────────────────────────────────────────

  describe('ping', () => {
    it('should return PONG', async () => {
      mockRedis.ping.mockResolvedValue('PONG');
      expect(await service.ping()).toBe('PONG');
    });
  });

  describe('additional cache methods', () => {
    it('should warm up cache with top 50 popular destinations sorted by popularityScore', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      await service.warmUpCache([
        { id: 'a', popularityScore: 1 },
        { id: 'b', popularityScore: 3 },
        { id: 'c', popularityScore: 2 },
      ]);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'cache:popular_destinations',
        7200,
        JSON.stringify([
          { id: 'b', popularityScore: 3 },
          { id: 'c', popularityScore: 2 },
          { id: 'a', popularityScore: 1 },
        ])
      );
    });

    it('should swallow warmUpCache errors', async () => {
      mockRedis.setex.mockRejectedValue(new Error('redis down'));

      await expect(service.warmUpCache([{ popularityScore: 1 }])).resolves.toBeUndefined();
    });

    it('should warm up cache even when there are no item vectors', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      await service.warmUpCache([]);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'cache:popular_destinations',
        7200,
        JSON.stringify([])
      );
    });

    it('should return cache stats when Redis responds', async () => {
      mockRedis.info.mockResolvedValue('stats-info');
      mockRedis.dbsize.mockResolvedValue(12);

      await expect(service.getStats()).resolves.toEqual({
        totalKeys: 12,
        info: 'stats-info',
      });
    });

    it('should return null when getStats fails', async () => {
      mockRedis.info.mockRejectedValue(new Error('stats failed'));

      await expect(service.getStats()).resolves.toBeNull();
    });

    it('should clear all recommendation caches when keys exist', async () => {
      mockRedis.keys.mockResolvedValue(['recommendations:u1', 'recommendations:u2']);
      mockRedis.del.mockResolvedValue(2);

      await service.clearAll();

      expect(mockRedis.del).toHaveBeenCalledWith('recommendations:u1', 'recommendations:u2');
    });

    it('should not call del when clearAll finds no keys', async () => {
      mockRedis.keys.mockResolvedValue([]);

      await service.clearAll();

      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it('should swallow clearAll errors', async () => {
      mockRedis.keys.mockRejectedValue(new Error('clear failed'));

      await expect(service.clearAll()).resolves.toBeUndefined();
    });
  });

  describe('redis bootstrap', () => {
    it('should configure retryStrategy with capped delay', () => {
      jest.resetModules();

      let config: any;
      jest.isolateModules(() => {
        const RedisModule = require('ioredis');
        const RedisMock = RedisModule.default || RedisModule;
        require('@ai/services/CacheService');
        config = RedisMock.mock.calls.find(
          (call: any[]) => call[0] && typeof call[0] === 'object' && 'retryStrategy' in call[0]
        )?.[0];
      });

      expect(config).toBeDefined();
      expect(config.retryStrategy(1)).toBe(50);
      expect(config.retryStrategy(100)).toBe(2000);
    });
  });
});
