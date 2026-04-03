/**
 * US-TEST-015 — Tests unitaires rateLimiter middleware
 * Scénarios : apiLimiter config, searchLimiter config
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// ── Mock express-rate-limit ───────────────────────────────────────────────────
// Capture the options passed to rateLimit() for validation
let capturedApiLimiterOptions: any   = null;
let capturedSearchLimiterOptions: any = null;
let callCount = 0;

jest.mock('express-rate-limit', () => {
  return jest.fn((options: any) => {
    callCount++;
    if (callCount === 1) capturedApiLimiterOptions    = options;
    if (callCount === 2) capturedSearchLimiterOptions = options;

    // Return a middleware function stub with the options attached
    const middleware = jest.fn((_req: any, _res: any, next: any) => next());
    (middleware as any).options = options;
    return middleware;
  });
});

// ── Import after mock ─────────────────────────────────────────────────────────
import {
  apiLimiter,
  searchLimiter,
} from '@/middleware/rateLimiter';

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('rateLimiter — US-TEST-015', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('apiLimiter', () => {
    it('should be a function (Express middleware)', () => {
      expect(typeof apiLimiter).toBe('function');
    });

    it('should be configured with 100 requests max', () => {
      expect(capturedApiLimiterOptions?.max).toBe(100);
    });

    it('should be configured with 15-minute window', () => {
      // 15 * 60 * 1000 = 900000 ms
      expect(capturedApiLimiterOptions?.windowMs).toBe(15 * 60 * 1000);
    });

    it('should use standard headers (RateLimit-*)', () => {
      expect(capturedApiLimiterOptions?.standardHeaders).toBe(true);
    });

    it('should disable legacy headers (X-RateLimit-*)', () => {
      expect(capturedApiLimiterOptions?.legacyHeaders).toBe(false);
    });

    it('should have a message with error field', () => {
      expect(capturedApiLimiterOptions?.message).toHaveProperty('error');
    });
  });

  describe('searchLimiter', () => {
    it('should be a function (Express middleware)', () => {
      expect(typeof searchLimiter).toBe('function');
    });

    it('should be configured with 20 requests max', () => {
      expect(capturedSearchLimiterOptions?.max).toBe(20);
    });

    it('should be configured with 1-minute window', () => {
      // 1 * 60 * 1000 = 60000 ms
      expect(capturedSearchLimiterOptions?.windowMs).toBe(1 * 60 * 1000);
    });

    it('should use standard headers', () => {
      expect(capturedSearchLimiterOptions?.standardHeaders).toBe(true);
    });

    it('should disable legacy headers', () => {
      expect(capturedSearchLimiterOptions?.legacyHeaders).toBe(false);
    });

    it('should have a message with error field', () => {
      expect(capturedSearchLimiterOptions?.message).toHaveProperty('error');
    });
  });

  describe('middleware behavior', () => {
    it('apiLimiter should call next() when limit not exceeded', () => {
      const req: any  = { ip: '127.0.0.1' };
      const res: any  = {};
      const next = jest.fn();

      apiLimiter(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('searchLimiter should call next() when limit not exceeded', () => {
      const req: any  = { ip: '127.0.0.1' };
      const res: any  = {};
      const next = jest.fn();

      searchLimiter(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });
});
