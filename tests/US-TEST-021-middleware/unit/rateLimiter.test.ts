/**
 * US-TEST-021 — Rate Limiter Middleware Unit Tests
 *
 * Tests for middleware/rateLimiter.ts:
 * - apiLimiter (100 req / 15 min)
 * - searchLimiter (20 req / 1 min)
 */

import { apiLimiter, searchLimiter } from '@ai/middleware/rateLimiter';

describe('rateLimiter', () => {
  describe('apiLimiter', () => {
    it('should be defined', () => {
      expect(apiLimiter).toBeDefined();
    });

    it('should be a middleware function (arity 3)', () => {
      expect(typeof apiLimiter).toBe('function');
      expect(apiLimiter.length).toBe(3);
    });
  });

  describe('searchLimiter', () => {
    it('should be defined', () => {
      expect(searchLimiter).toBeDefined();
    });

    it('should be a middleware function (arity 3)', () => {
      expect(typeof searchLimiter).toBe('function');
      expect(searchLimiter.length).toBe(3);
    });
  });

  it('apiLimiter and searchLimiter should be distinct middleware instances', () => {
    expect(apiLimiter).not.toBe(searchLimiter);
  });
});
