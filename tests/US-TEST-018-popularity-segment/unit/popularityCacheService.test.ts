/**
 * US-TEST-018 — PopularityCacheService Unit Tests
 *
 * Tests for PopularityCacheService (IA-002.2):
 * - cacheTopDestinations / getTopDestinations (TTL 24h, hit/miss)
 * - cacheTopBySegment / getTopBySegment (TTL 12h, hit/miss)
 * - cacheTopByCategory / getTopByCategory (TTL 12h, hit/miss)
 * - cacheAllScores / getAllScores (Map serialization, hit/miss)
 * - invalidateAll (with keys / empty keys)
 * - invalidateDestination (delegates to invalidateAll)
 * - invalidateSegment, invalidateCategory
 * - warmupCache (calls popularityService methods)
 * - getCacheStats, calculateHitRate
 */

jest.mock('ioredis', () => {
  const mockRedis: Record<string, jest.Mock> = {
    get: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
    info: jest.fn(),
    quit: jest.fn(),
    on: jest.fn(),
  };
  return jest.fn(() => mockRedis);
});

import Redis from 'ioredis';
import { PopularityCacheService } from '@ai/recommendations/popularity-cache.service';
import { UserSegment } from '@ai/segments/types/segment.types';

function getMockRedis() {
  const RedisMock = Redis as jest.MockedClass<typeof Redis>;
  return RedisMock.mock.results[0]?.value as Record<string, jest.Mock>;
}

describe('US-TEST-018 — PopularityCacheService', () => {
  let service: PopularityCacheService;
  let mockRedis: Record<string, jest.Mock>;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PopularityCacheService();
    mockRedis = getMockRedis();
  });

  describe('constructor', () => {
    it('should register connect and error handlers that log expected messages', () => {
      const connectHandler = mockRedis.on.mock.calls.find((call) => call[0] === 'connect')?.[1];
      const errorHandler = mockRedis.on.mock.calls.find((call) => call[0] === 'error')?.[1];
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

      connectHandler?.();
      errorHandler?.(new Error('redis down'));

      expect(logSpy).toHaveBeenCalledWith('✓ Redis connected (Popularity Cache)');
      expect(errorSpy).toHaveBeenCalledWith('✗ Redis error:', expect.any(Error));
    });

    it('should prefer explicit redisUrl, then REDIS_URL env, then default localhost url', () => {
      const RedisMock = Redis as jest.MockedClass<typeof Redis>;

      new PopularityCacheService('redis://explicit:6379');
      process.env.REDIS_URL = 'redis://env:6379';
      new PopularityCacheService();
      delete process.env.REDIS_URL;
      new PopularityCacheService();

      expect(RedisMock.mock.calls.at(-3)?.[0]).toBe('redis://explicit:6379');
      expect(RedisMock.mock.calls.at(-2)?.[0]).toBe('redis://env:6379');
      expect(RedisMock.mock.calls.at(-1)?.[0]).toBe('redis://localhost:6379');
    });
  });

  // ─── cacheTopDestinations / getTopDestinations ────────────────────────────────

  describe('cacheTopDestinations / getTopDestinations', () => {
    it('should cache with TTL 86400 (24h) and update metadata', async () => {
      mockRedis.setex.mockResolvedValue('OK');
      mockRedis.get.mockResolvedValue(null); // metadata miss

      const destinations = [{ id: 'dest-1', name: 'Paris' }];
      await service.cacheTopDestinations(destinations);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'popularity:top:global',
        86400,
        JSON.stringify(destinations)
      );
    });

    it('should use custom TTL when provided', async () => {
      mockRedis.setex.mockResolvedValue('OK');
      mockRedis.get.mockResolvedValue(null);

      await service.cacheTopDestinations([{ id: 'd1' }], 3600);

      const firstCall = mockRedis.setex.mock.calls[0];
      expect(firstCall[1]).toBe(3600);
    });

    it('should return parsed destinations on cache hit', async () => {
      const destinations = [{ id: 'dest-2', name: 'Tokyo' }];
      mockRedis.get.mockResolvedValue(JSON.stringify(destinations));

      const result = await service.getTopDestinations();

      expect(result).toEqual(destinations);
    });

    it('should return null on cache miss', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await service.getTopDestinations();

      expect(result).toBeNull();
    });
  });

  // ─── cacheTopBySegment / getTopBySegment ──────────────────────────────────────

  describe('cacheTopBySegment / getTopBySegment', () => {
    it('should cache with correct key and TTL 43200 (12h)', async () => {
      mockRedis.setex.mockResolvedValue('OK');
      const destinations = [{ id: 'd-budget' }];

      await service.cacheTopBySegment(UserSegment.BUDGET_BACKPACKER, destinations);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        `popularity:top:segment:${UserSegment.BUDGET_BACKPACKER}`,
        43200,
        JSON.stringify(destinations)
      );
    });

    it('should return parsed destinations for segment on hit', async () => {
      const destinations = [{ id: 'd-family' }];
      mockRedis.get.mockResolvedValue(JSON.stringify(destinations));

      const result = await service.getTopBySegment(UserSegment.FAMILY_EXPLORER);

      expect(result).toEqual(destinations);
    });

    it('should return null on segment cache miss', async () => {
      mockRedis.get.mockResolvedValue(null);

      expect(await service.getTopBySegment(UserSegment.LUXURY_TRAVELER)).toBeNull();
    });
  });

  // ─── cacheTopByCategory / getTopByCategory ────────────────────────────────────

  describe('cacheTopByCategory / getTopByCategory', () => {
    it('should cache category with TTL 43200', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      await service.cacheTopByCategory('BEACH', [{ id: 'd-beach' }]);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'popularity:top:category:BEACH',
        43200,
        expect.any(String)
      );
    });

    it('should return null on category cache miss', async () => {
      mockRedis.get.mockResolvedValue(null);

      expect(await service.getTopByCategory('MOUNTAIN')).toBeNull();
    });

    it('should return parsed data on category cache hit', async () => {
      const data = [{ id: 'd-city' }];
      mockRedis.get.mockResolvedValue(JSON.stringify(data));

      expect(await service.getTopByCategory('CITY')).toEqual(data);
    });
  });

  // ─── cacheAllScores / getAllScores ────────────────────────────────────────────

  describe('cacheAllScores / getAllScores', () => {
    it('should serialize Map to JSON object', async () => {
      mockRedis.setex.mockResolvedValue('OK');
      const scores = new Map([['dest-1', 0.9], ['dest-2', 0.6]]);

      await service.cacheAllScores(scores);

      const serialized = mockRedis.setex.mock.calls[0][2];
      expect(JSON.parse(serialized)).toEqual({ 'dest-1': 0.9, 'dest-2': 0.6 });
    });

    it('should return null on scores cache miss', async () => {
      mockRedis.get.mockResolvedValue(null);

      expect(await service.getAllScores()).toBeNull();
    });

    it('should deserialize cached JSON object back to Map', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ 'dest-1': 0.85 }));

      const result = await service.getAllScores();

      expect(result).toBeInstanceOf(Map);
      expect(result!.get('dest-1')).toBe(0.85);
    });
  });

  // ─── invalidateAll ────────────────────────────────────────────────────────────

  describe('invalidateAll', () => {
    it('should delete all popularity keys when keys exist', async () => {
      mockRedis.keys.mockResolvedValue(['popularity:top:global', 'popularity:top:segment:BUDGET_BACKPACKER']);
      mockRedis.del.mockResolvedValue(2);

      await service.invalidateAll();

      expect(mockRedis.del).toHaveBeenCalledWith(
        'popularity:top:global',
        'popularity:top:segment:BUDGET_BACKPACKER'
      );
    });

    it('should not call del when no keys found', async () => {
      mockRedis.keys.mockResolvedValue([]);

      await service.invalidateAll();

      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });

  // ─── invalidateDestination ────────────────────────────────────────────────────

  describe('invalidateDestination', () => {
    it('should call invalidateAll (full cache invalidation)', async () => {
      mockRedis.keys.mockResolvedValue(['popularity:top:global']);
      mockRedis.del.mockResolvedValue(1);

      await service.invalidateDestination('dest-1');

      expect(mockRedis.keys).toHaveBeenCalledWith('popularity:*');
    });
  });

  // ─── invalidateSegment / invalidateCategory ───────────────────────────────────

  describe('invalidateSegment', () => {
    it('should delete the specific segment key', async () => {
      mockRedis.del.mockResolvedValue(1);

      await service.invalidateSegment(UserSegment.ADVENTURE_SEEKER);

      expect(mockRedis.del).toHaveBeenCalledWith(
        `popularity:top:segment:${UserSegment.ADVENTURE_SEEKER}`
      );
    });
  });

  describe('invalidateCategory', () => {
    it('should delete the specific category key', async () => {
      mockRedis.del.mockResolvedValue(1);

      await service.invalidateCategory('NATURE');

      expect(mockRedis.del).toHaveBeenCalledWith('popularity:top:category:NATURE');
    });
  });

  // ─── warmupCache ──────────────────────────────────────────────────────────────

  describe('warmupCache', () => {
    it('should call getTopDestinations, getTopBySegment for all segments, and getTopByCategory for all categories', async () => {
      mockRedis.setex.mockResolvedValue('OK');
      mockRedis.get.mockResolvedValue(null); // metadata miss

      const mockPopularityService = {
        getTopDestinations: jest.fn().mockResolvedValue([{ id: 'd1' }]),
        getTopBySegment: jest.fn().mockResolvedValue([]),
        getTopByCategory: jest.fn().mockResolvedValue([]),
      };

      await service.warmupCache(mockPopularityService);

      expect(mockPopularityService.getTopDestinations).toHaveBeenCalledWith(50);
      expect(mockPopularityService.getTopBySegment).toHaveBeenCalledTimes(
        Object.values(UserSegment).length
      );
      expect(mockPopularityService.getTopByCategory).toHaveBeenCalledTimes(5);
    });

    it('should throw when popularityService throws', async () => {
      const mockPopularityService = {
        getTopDestinations: jest.fn().mockRejectedValue(new Error('DB error')),
      };

      await expect(service.warmupCache(mockPopularityService)).rejects.toThrow('DB error');
    });
  });

  // ─── getCacheStats ────────────────────────────────────────────────────────────

  describe('getCacheStats', () => {
    it('should return keys count, memory info, hit rate, and metadata', async () => {
      mockRedis.keys.mockResolvedValue(['popularity:top:global', 'popularity:scores:all']);
      mockRedis.info
        .mockResolvedValueOnce('used_memory_human:1.5M\r\n') // memory info
        .mockResolvedValueOnce('keyspace_hits:100\r\nkeyspace_misses:20\r\n'); // stats for hitRate
      mockRedis.get.mockResolvedValue(null); // metadata miss

      const result = await service.getCacheStats();

      expect(result.keys).toBe(2);
      expect(result.memory).toBe('1.5M');
      expect(result.hitRate).toBeCloseTo(83.3, 0);
      expect(result.metadata).toBeNull();
    });

    it('should return 0 hitRate when no requests', async () => {
      mockRedis.keys.mockResolvedValue([]);
      mockRedis.info
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('keyspace_hits:0\r\nkeyspace_misses:0\r\n');
      mockRedis.get.mockResolvedValue(null);

      const result = await service.getCacheStats();

      expect(result.hitRate).toBe(0);
    });

    it('should return unknown memory when used_memory_human is absent and expose metadata when present', async () => {
      mockRedis.keys.mockResolvedValue([]);
      mockRedis.info
        .mockResolvedValueOnce('allocator:jemalloc\r\n')
        .mockResolvedValueOnce('keyspace_hits:1\r\nkeyspace_misses:1\r\n');
      mockRedis.get.mockResolvedValue(JSON.stringify({
        lastUpdated: new Date().toISOString(),
        ttl: 86400,
        itemCount: 10,
        algorithmVersion: '1.0.0',
        scope: 'global',
      }));

      const result = await service.getCacheStats();

      expect(result.memory).toBe('unknown');
      expect(result.metadata).toEqual(expect.objectContaining({ itemCount: 10, scope: 'global' }));
    });
  });

  describe('metadata updates', () => {
    it('should preserve existing itemCount when updateMetadata is called without a new count', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({
        lastUpdated: new Date().toISOString(),
        ttl: 86400,
        itemCount: 7,
        algorithmVersion: '1.0.0',
        scope: 'global',
      }));
      mockRedis.setex.mockResolvedValue('OK');

      await (service as any).updateMetadata({ scope: 'segment' });

      const payload = JSON.parse(mockRedis.setex.mock.calls.at(-1)?.[2]);
      expect(payload.itemCount).toBe(7);
      expect(payload.scope).toBe('segment');
    });

    it('should default itemCount to 0 when there is no existing metadata and no new count', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.setex.mockResolvedValue('OK');

      await (service as any).updateMetadata({ scope: 'category' });

      const payload = JSON.parse(mockRedis.setex.mock.calls.at(-1)?.[2]);
      expect(payload.itemCount).toBe(0);
      expect(payload.scope).toBe('category');
    });
  });

  // ─── disconnect ───────────────────────────────────────────────────────────────

  describe('disconnect', () => {
    it('should call redis.quit()', async () => {
      mockRedis.quit.mockResolvedValue('OK');

      await service.disconnect();

      expect(mockRedis.quit).toHaveBeenCalled();
    });
  });
});
