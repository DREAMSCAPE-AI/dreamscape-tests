/**
 * AssetCache Unit Tests
 * DR-568: US-TEST-031
 *
 * Tests: get/set, LRU eviction, max items/memory limits,
 * blob URL management, stats, pruning.
 */

import AssetCache, { getAssetCache } from '../../../../dreamscape-frontend/panorama/src/services/AssetCache';

describe('AssetCache (DR-568)', () => {
  let cache;

  beforeEach(() => {
    cache = new AssetCache({ maxItems: 5, maxMemoryMB: 100 });
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const c = new AssetCache();
      expect(c.maxItems).toBe(50);
      expect(c.maxMemoryMB).toBe(500);
      expect(c.cache.size).toBe(0);
    });

    it('should accept custom options', () => {
      expect(cache.maxItems).toBe(5);
      expect(cache.maxMemoryMB).toBe(100);
    });
  });

  describe('set()', () => {
    it('should store a string URL asset', () => {
      const result = cache.set('http://img.com/a.jpg', 'http://cdn.com/a.jpg', { width: 100, height: 100 });
      expect(result).toBe('http://cdn.com/a.jpg');
      expect(cache.cache.size).toBe(1);
    });

    it('should store a Blob and create a blob URL', () => {
      const blob = new Blob(['data'], { type: 'image/jpeg' });
      cache.set('http://img.com/a.jpg', blob);
      expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
      expect(cache.cache.get('http://img.com/a.jpg').isBlob).toBe(true);
    });

    it('should calculate size from metadata dimensions', () => {
      cache.set('http://img.com/a.jpg', 'url', { width: 1024, height: 512 });
      const entry = cache.cache.get('http://img.com/a.jpg');
      // 1024 * 512 * 4 / 1024 / 1024 = 2MB
      expect(entry.sizeMB).toBeCloseTo(2, 0);
    });

    it('should default to 10MB when no metadata', () => {
      cache.set('http://img.com/a.jpg', 'url');
      expect(cache.cache.get('http://img.com/a.jpg').sizeMB).toBe(10);
    });

    it('should track cumulative memory usage', () => {
      cache.set('http://img.com/1.jpg', 'u1', { width: 1024, height: 512 });
      cache.set('http://img.com/2.jpg', 'u2', { width: 1024, height: 512 });
      expect(cache.currentMemoryMB).toBeCloseTo(4, 0);
    });
  });

  describe('get()', () => {
    it('should return cached entry on hit', () => {
      cache.set('http://img.com/a.jpg', 'http://cdn/a.jpg');
      const entry = cache.get('http://img.com/a.jpg');
      expect(entry).not.toBeNull();
      expect(entry.cachedUrl).toBe('http://cdn/a.jpg');
    });

    it('should return null on miss', () => {
      expect(cache.get('http://missing.com')).toBeNull();
    });

    it('should increment accessCount', () => {
      cache.set('http://img.com/a.jpg', 'url');
      cache.get('http://img.com/a.jpg');
      cache.get('http://img.com/a.jpg');
      expect(cache.cache.get('http://img.com/a.jpg').accessCount).toBe(2);
    });

    it('should update lastAccessedAt', () => {
      cache.set('http://img.com/a.jpg', 'url');
      const before = cache.cache.get('http://img.com/a.jpg').lastAccessedAt;
      cache.get('http://img.com/a.jpg');
      expect(cache.cache.get('http://img.com/a.jpg').lastAccessedAt).toBeGreaterThanOrEqual(before);
    });
  });

  describe('has()', () => {
    it('should return true for existing entry', () => {
      cache.set('http://img.com/a.jpg', 'url');
      expect(cache.has('http://img.com/a.jpg')).toBe(true);
    });

    it('should return false for missing entry', () => {
      expect(cache.has('http://missing.com')).toBe(false);
    });
  });

  describe('delete()', () => {
    it('should remove entry and free memory', () => {
      cache.set('http://img.com/a.jpg', 'url', { width: 1024, height: 512 });
      const memBefore = cache.currentMemoryMB;
      cache.delete('http://img.com/a.jpg');
      expect(cache.cache.size).toBe(0);
      expect(cache.currentMemoryMB).toBeLessThan(memBefore);
    });

    it('should revoke blob URL on delete', () => {
      const blob = new Blob(['data']);
      cache.set('http://img.com/a.jpg', blob);
      const blobUrl = cache.cache.get('http://img.com/a.jpg').cachedUrl;
      cache.delete('http://img.com/a.jpg');
      expect(URL.revokeObjectURL).toHaveBeenCalledWith(blobUrl);
    });

    it('should handle deleting non-existent entry', () => {
      expect(() => cache.delete('http://missing.com')).not.toThrow();
    });
  });

  describe('clear()', () => {
    it('should empty cache and reset memory', () => {
      cache.set('http://img.com/1.jpg', 'u1');
      cache.set('http://img.com/2.jpg', 'u2');
      cache.clear();
      expect(cache.cache.size).toBe(0);
      expect(cache.currentMemoryMB).toBe(0);
      expect(cache.accessOrder).toEqual([]);
    });

    it('should revoke all blob URLs', () => {
      cache.set('http://img.com/1.jpg', new Blob(['a']));
      cache.set('http://img.com/2.jpg', new Blob(['b']));
      cache.clear();
      expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
    });
  });

  describe('LRU eviction (max items)', () => {
    it('should evict LRU item when maxItems reached', () => {
      for (let i = 0; i < 5; i++) {
        cache.set(`http://img.com/${i}.jpg`, `u${i}`, { width: 10, height: 10 });
      }
      // Access item 0 to make it recent
      cache.get('http://img.com/0.jpg');
      // Add 6th → should evict item 1 (LRU)
      cache.set('http://img.com/5.jpg', 'u5', { width: 10, height: 10 });

      expect(cache.cache.size).toBe(5);
      expect(cache.has('http://img.com/1.jpg')).toBe(false);
      expect(cache.has('http://img.com/0.jpg')).toBe(true);
    });
  });

  describe('LRU eviction (max memory)', () => {
    it('should evict items when memory limit exceeded', () => {
      const small = new AssetCache({ maxItems: 100, maxMemoryMB: 25 });
      small.set('http://img.com/1.jpg', 'u1'); // 10MB default
      small.set('http://img.com/2.jpg', 'u2'); // 10MB
      small.set('http://img.com/3.jpg', 'u3'); // 10MB → evicts first
      expect(small.has('http://img.com/1.jpg')).toBe(false);
      expect(small.has('http://img.com/3.jpg')).toBe(true);
    });
  });

  describe('getStats()', () => {
    it('should return correct stats for empty cache', () => {
      const stats = cache.getStats();
      expect(stats.itemCount).toBe(0);
      expect(stats.memoryUsedMB).toBe(0);
      expect(stats.oldestEntry).toBeNull();
      expect(stats.totalAccesses).toBe(0);
      expect(stats.avgAccessCount).toBe(0);
    });

    it('should return correct stats for populated cache', () => {
      cache.set('http://img.com/1.jpg', 'u1');
      cache.get('http://img.com/1.jpg');
      cache.get('http://img.com/1.jpg');
      const stats = cache.getStats();
      expect(stats.itemCount).toBe(1);
      expect(stats.totalAccesses).toBe(2);
      expect(stats.avgAccessCount).toBe(2);
      expect(stats.memoryUsagePercent).toBeGreaterThan(0);
    });
  });

  describe('logStats()', () => {
    it('should not throw', () => {
      cache.set('http://img.com/1.jpg', 'u1');
      expect(() => cache.logStats()).not.toThrow();
    });
  });

  describe('pruneOld()', () => {
    it('should remove entries older than maxAgeMinutes', () => {
      cache.set('http://img.com/old.jpg', 'u');
      cache.cache.get('http://img.com/old.jpg').lastAccessedAt = Date.now() - 60 * 60 * 1000;
      cache.set('http://img.com/new.jpg', 'u2');
      cache.pruneOld(30);
      expect(cache.has('http://img.com/old.jpg')).toBe(false);
      expect(cache.has('http://img.com/new.jpg')).toBe(true);
    });

    it('should keep recent entries', () => {
      cache.set('http://img.com/recent.jpg', 'u');
      cache.pruneOld(30);
      expect(cache.has('http://img.com/recent.jpg')).toBe(true);
    });
  });

  describe('_calculateSize()', () => {
    it('should calculate from Blob size', () => {
      const blob = new Blob([new ArrayBuffer(1024 * 1024)]);
      const size = cache._calculateSize(blob, {});
      expect(size).toBeCloseTo(1, 0);
    });

    it('should calculate from dimensions', () => {
      const size = cache._calculateSize('url', { width: 2048, height: 1024 });
      expect(size).toBeCloseTo(8, 0);
    });

    it('should default to 10MB', () => {
      expect(cache._calculateSize('url', {})).toBe(10);
    });
  });

  describe('getAssetCache() singleton', () => {
    it('should return an AssetCache instance', () => {
      const instance = getAssetCache();
      expect(instance).toBeInstanceOf(AssetCache);
    });
  });
});
