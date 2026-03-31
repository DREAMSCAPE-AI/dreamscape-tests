import { jest, describe, it, expect, beforeAll } from '@jest/globals';

jest.mock('express-rate-limit', () => {
  return jest.fn().mockImplementation((_options: any) => {
    return (_req: any, _res: any, next: any) => next();
  });
});

import rateLimit from 'express-rate-limit';
import { apiLimiter, searchLimiter, favoritesCheckLimiter } from '../../../../dreamscape-services/user/src/middleware/rateLimiter';

describe('Rate Limiter Middleware', () => {
  const mockRateLimit = rateLimit as unknown as jest.Mock;

  // Capture options before the global afterEach (jest.setup.js) clears mock.calls
  let apiOpts: any;
  let searchOpts: any;
  let favoritesOpts: any;

  beforeAll(() => {
    apiOpts = mockRateLimit.mock.calls[0]?.[0];
    searchOpts = mockRateLimit.mock.calls[1]?.[0];
    favoritesOpts = mockRateLimit.mock.calls[2]?.[0];
  });

  describe('apiLimiter', () => {
    it('should be defined', () => {
      expect(apiLimiter).toBeDefined();
    });

    it('should be configured with 15 minute window', () => {
      expect(apiOpts.windowMs).toBe(15 * 60 * 1000);
    });

    it('should allow max 100 requests per window', () => {
      expect(apiOpts.max).toBe(100);
    });

    it('should have standard headers enabled', () => {
      expect(apiOpts.standardHeaders).toBe(true);
    });

    it('should have legacy headers disabled', () => {
      expect(apiOpts.legacyHeaders).toBe(false);
    });

    it('should have a custom error message', () => {
      expect(apiOpts.message).toEqual(
        expect.objectContaining({
          error: expect.any(String),
          retryAfter: '15 minutes',
        })
      );
    });
  });

  describe('searchLimiter', () => {
    it('should be defined', () => {
      expect(searchLimiter).toBeDefined();
    });

    it('should be configured with 1 minute window', () => {
      expect(searchOpts.windowMs).toBe(1 * 60 * 1000);
    });

    it('should allow max 20 requests per window', () => {
      expect(searchOpts.max).toBe(20);
    });

    it('should have standard headers enabled', () => {
      expect(searchOpts.standardHeaders).toBe(true);
    });

    it('should have legacy headers disabled', () => {
      expect(searchOpts.legacyHeaders).toBe(false);
    });

    it('should have a custom error message with retryAfter 1 minute', () => {
      expect(searchOpts.message).toEqual(
        expect.objectContaining({
          error: expect.any(String),
          retryAfter: '1 minute',
        })
      );
    });
  });

  describe('favoritesCheckLimiter', () => {
    it('should be defined', () => {
      expect(favoritesCheckLimiter).toBeDefined();
    });

    it('should be configured with 1 minute window', () => {
      expect(favoritesOpts.windowMs).toBe(1 * 60 * 1000);
    });

    it('should allow max 50 requests per window', () => {
      expect(favoritesOpts.max).toBe(50);
    });

    it('should have standard headers enabled', () => {
      expect(favoritesOpts.standardHeaders).toBe(true);
    });

    it('should have legacy headers disabled', () => {
      expect(favoritesOpts.legacyHeaders).toBe(false);
    });

    it('should have a custom error message with retryAfter 1 minute', () => {
      expect(favoritesOpts.message).toEqual(
        expect.objectContaining({
          error: expect.any(String),
          retryAfter: '1 minute',
        })
      );
    });
  });
});
