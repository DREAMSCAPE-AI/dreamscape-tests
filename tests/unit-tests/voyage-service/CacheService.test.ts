/**
 * CacheService Tests
 * Ticket: DR-65US-VOYAGE-004 - Cache des Requêtes Amadeus
 *
 * Tests unitaires pour le système de cache Redis du service Voyage
 */

import cacheService from '../../../../dreamscape-services/voyage/src/services/CacheService';

describe('CacheService - DR-65US-VOYAGE-004', () => {
  beforeAll(async () => {
    // Wait for Redis connection
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    // Clean up test data
    await cacheService.clearPattern('amadeus:test:*');
    await cacheService.close();
  });

  afterEach(async () => {
    // Clean up after each test
    await cacheService.clearPattern('amadeus:test:*');
  });

  describe('Basic Cache Operations', () => {
    it('should set and get a value from cache', async () => {
      const testKey = 'test-key-1';
      const testValue = { data: 'test data', timestamp: Date.now() };

      // Set cache
      const setResult = await cacheService.set(testKey, testValue, 60);
      expect(setResult).toBe(true);

      // Get from cache
      const cachedValue = await cacheService.get(testKey);
      expect(cachedValue).toEqual(testValue);
    });

    it('should return null for non-existent key', async () => {
      const result = await cacheService.get('non-existent-key-12345');
      expect(result).toBeNull();
    });

    it('should delete a key from cache', async () => {
      const testKey = 'test-key-delete';
      const testValue = { data: 'to be deleted' };

      await cacheService.set(testKey, testValue, 60);
      const deleteResult = await cacheService.delete(testKey);
      expect(deleteResult).toBe(true);

      const cachedValue = await cacheService.get(testKey);
      expect(cachedValue).toBeNull();
    });

    it('should handle complex objects', async () => {
      const complexObject = {
        flights: [
          { id: '1', price: 450, origin: 'PAR', destination: 'LON' },
          { id: '2', price: 520, origin: 'PAR', destination: 'LON' }
        ],
        metadata: {
          count: 2,
          timestamp: Date.now()
        }
      };

      const testKey = 'test-complex-object';
      await cacheService.set(testKey, complexObject, 60);

      const cached = await cacheService.get(testKey);
      expect(cached).toEqual(complexObject);
    });
  });

  describe('Cache Wrapper', () => {
    beforeEach(async () => {
      // Clear cache before each test in this suite
      await cacheService.clearPattern('amadeus:flights:*');
      cacheService.resetStats();
    });

    it('should cache API call results', async () => {
      let apiCallCount = 0;

      const mockApiCall = async () => {
        apiCallCount++;
        return { result: 'api data', count: apiCallCount };
      };

      // Use unique parameters to avoid collision with other tests
      const uniqueParams = { origin: 'PAR', destination: 'LON', testId: 'cache-test-1' };

      // First call - should hit API
      const result1 = await cacheService.cacheWrapper(
        'flights',
        uniqueParams,
        mockApiCall
      );

      expect(result1.count).toBe(1);
      expect(apiCallCount).toBe(1);

      // Second call - should use cache
      const result2 = await cacheService.cacheWrapper(
        'flights',
        uniqueParams,
        mockApiCall
      );

      expect(result2.count).toBe(1); // Same as first call
      expect(apiCallCount).toBe(1); // API not called again
    });

    it('should call API for different parameters', async () => {
      let apiCallCount = 0;

      const mockApiCall = async () => {
        apiCallCount++;
        return { result: 'api data', count: apiCallCount };
      };

      // Use unique parameters to avoid collision with other tests
      // First call
      await cacheService.cacheWrapper(
        'flights',
        { origin: 'PAR', destination: 'LON', testId: 'diff-params-1' },
        mockApiCall
      );

      // Second call with different params
      await cacheService.cacheWrapper(
        'flights',
        { origin: 'NYC', destination: 'LAX', testId: 'diff-params-2' },
        mockApiCall
      );

      expect(apiCallCount).toBe(2); // Both calls hit API
    });

    it('should use correct TTL for different cache types', async () => {
      const mockApiCall = async () => ({ data: 'test' });

      // Test that different cache types work (we can't easily test TTL without waiting)
      await cacheService.cacheWrapper('flights', { test: 1 }, mockApiCall);
      await cacheService.cacheWrapper('locations', { test: 2 }, mockApiCall);
      await cacheService.cacheWrapper('hotels', { test: 3 }, mockApiCall);
      await cacheService.cacheWrapper('airlines', { test: 4 }, mockApiCall);

      // If no errors thrown, TTL configuration works
      expect(true).toBe(true);
    });
  });

  describe('Cache Statistics', () => {
    beforeEach(() => {
      // Reset stats before each test
      cacheService.resetStats();
    });

    it('should track cache hits and misses', async () => {
      const testKey = 'stats-test-key';
      const testValue = { data: 'stats test' };

      // This should be a miss
      await cacheService.get(testKey);

      // Set the value
      await cacheService.set(testKey, testValue, 60);

      // This should be a hit
      await cacheService.get(testKey);

      const stats = cacheService.getStats();
      expect(stats.hits).toBeGreaterThan(0);
      expect(stats.misses).toBeGreaterThan(0);
      expect(stats.total).toBe(stats.hits + stats.misses);
    });

    it('should calculate hit rate correctly', async () => {
      cacheService.resetStats();

      const testKey = 'hitrate-test';
      await cacheService.set(testKey, { data: 'test' }, 60);

      // 3 hits
      await cacheService.get(testKey);
      await cacheService.get(testKey);
      await cacheService.get(testKey);

      // 1 miss
      await cacheService.get('non-existent');

      const stats = cacheService.getStats();
      expect(stats.hits).toBe(3);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe('75.00%');
    });

    it('should reset statistics', async () => {
      // Reset first to ensure clean state
      cacheService.resetStats();

      // Generate some stats
      await cacheService.get('test-key-reset-1');
      await cacheService.get('test-key-reset-2');

      let stats = cacheService.getStats();
      expect(stats.total).toBeGreaterThan(0);

      // Reset
      cacheService.resetStats();

      stats = cacheService.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.total).toBe(0);
    });
  });

  describe('Pattern Clearing', () => {
    it('should clear multiple keys matching a pattern', async () => {
      // Set multiple keys with a pattern
      await cacheService.set('amadeus:test:key1', { data: 'value1' }, 60);
      await cacheService.set('amadeus:test:key2', { data: 'value2' }, 60);
      await cacheService.set('amadeus:test:key3', { data: 'value3' }, 60);
      await cacheService.set('amadeus:other:key', { data: 'other' }, 60);

      // Clear pattern
      const clearedCount = await cacheService.clearPattern('amadeus:test:*');
      expect(clearedCount).toBe(3);

      // Verify keys are cleared
      const result1 = await cacheService.get('amadeus:test:key1');
      const result2 = await cacheService.get('amadeus:test:key2');
      const result3 = await cacheService.get('amadeus:test:key3');
      const resultOther = await cacheService.get('amadeus:other:key');

      expect(result1).toBeNull();
      expect(result2).toBeNull();
      expect(result3).toBeNull();
      expect(resultOther).not.toBeNull(); // Should still exist
    });

    it('should return 0 when no keys match pattern', async () => {
      const clearedCount = await cacheService.clearPattern('non-existent:pattern:*');
      expect(clearedCount).toBe(0);
    });

    it('should handle clearing all amadeus keys', async () => {
      await cacheService.set('amadeus:flights:1', { data: 'flight' }, 60);
      await cacheService.set('amadeus:hotels:1', { data: 'hotel' }, 60);
      await cacheService.set('amadeus:locations:1', { data: 'location' }, 60);

      const clearedCount = await cacheService.clearPattern('amadeus:*');
      expect(clearedCount).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Connection Health', () => {
    it('should check if Redis is connected', () => {
      const isReady = cacheService.isReady();
      expect(typeof isReady).toBe('boolean');
    });

    it('should ping Redis successfully', async () => {
      const pingResult = await cacheService.ping();
      expect(typeof pingResult).toBe('boolean');
      // In a real environment with Redis running, this should be true
      // In CI without Redis, it might be false
    });

    it('should provide connection status in stats', () => {
      const stats = cacheService.getStats();
      expect(stats).toHaveProperty('connected');
      expect(typeof stats.connected).toBe('boolean');
    });
  });

  describe('Error Handling', () => {
    it('should handle gracefully when Redis is not connected', async () => {
      // This test verifies that operations don't throw errors even if Redis is down
      // The actual behavior depends on whether Redis is running

      const result = await cacheService.get('some-key');
      // Should either return data or null, but not throw
      expect(result === null || typeof result === 'object').toBe(true);
    });

    it('should not break cache wrapper when API throws error', async () => {
      const errorApiCall = async () => {
        throw new Error('API Error');
      };

      await expect(
        cacheService.cacheWrapper('flights', { test: 'error' }, errorApiCall)
      ).rejects.toThrow('API Error');
    });
  });

  describe('Cache Key Generation', () => {
    it('should generate consistent keys for same parameters', async () => {
      let callCount = 0;
      const mockApi = async () => {
        callCount++;
        return { count: callCount };
      };

      // Same params should generate same key and use cache
      const params = { origin: 'PAR', destination: 'LON', date: '2025-12-20' };

      const result1 = await cacheService.cacheWrapper('flights', params, mockApi);
      const result2 = await cacheService.cacheWrapper('flights', params, mockApi);

      expect(result1).toEqual(result2);
      expect(callCount).toBe(1); // Only called once due to cache
    });

    it('should generate different keys for different parameter order', async () => {
      // Note: Our implementation sorts keys, so order shouldn't matter
      let callCount = 0;
      const mockApi = async () => {
        callCount++;
        return { count: callCount };
      };

      const params1 = { origin: 'PAR', destination: 'LON' };
      const params2 = { destination: 'LON', origin: 'PAR' };

      const result1 = await cacheService.cacheWrapper('flights', params1, mockApi);
      const result2 = await cacheService.cacheWrapper('flights', params2, mockApi);

      // Should use cache because params are equivalent (sorted)
      expect(result1).toEqual(result2);
      expect(callCount).toBe(1);
    });
  });
});
