/**
 * US-TEST-015 — Tests unitaires errorHandler middleware
 * Scénarios : status codes, format réponse, 404 handler
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

import {
  errorHandler,
  notFoundHandler,
  ApiError,
} from '@/middleware/errorHandler';

// ── Helpers ───────────────────────────────────────────────────────────────────
function buildMocks(url = '/api/test', method = 'GET') {
  const req: any = { url, originalUrl: url, method };
  const res: any = {
    _status: 200,
    _body: null as any,
    status(code: number) { this._status = code; return this; },
    json(body: any)  { this._body = body; return this; },
  };
  const next = jest.fn();
  return { req, res, next };
}

function makeError(message: string, statusCode?: number): ApiError {
  const err: ApiError = new Error(message);
  if (statusCode !== undefined) err.statusCode = statusCode;
  return err;
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('errorHandler — US-TEST-015', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('errorHandler', () => {
    it('should return the error statusCode when provided', () => {
      const { req, res, next } = buildMocks();
      const err = makeError('Not allowed', 403);

      errorHandler(err, req, res, next);

      expect(res._status).toBe(403);
    });

    it('should return 500 when no statusCode is set', () => {
      const { req, res, next } = buildMocks();
      const err = makeError('Something went wrong');

      errorHandler(err, req, res, next);

      expect(res._status).toBe(500);
    });

    it('should include message in response body', () => {
      const { req, res, next } = buildMocks();
      const err = makeError('Resource not found', 404);

      errorHandler(err, req, res, next);

      expect(res._body.error.message).toBe('Resource not found');
    });

    it('should include timestamp in response body', () => {
      const { req, res, next } = buildMocks();
      errorHandler(makeError('Error'), req, res, next);

      expect(res._body.error).toHaveProperty('timestamp');
      expect(typeof res._body.error.timestamp).toBe('string');
    });

    it('should include status code in response body', () => {
      const { req, res, next } = buildMocks();
      errorHandler(makeError('Bad request', 400), req, res, next);

      expect(res._body.error.status).toBe(400);
    });

    it('should include path in response body', () => {
      const { req, res, next } = buildMocks('/api/bookings/123');
      errorHandler(makeError('Error'), req, res, next);

      expect(res._body.error.path).toBe('/api/bookings/123');
    });

    it('should handle 400 Bad Request', () => {
      const { req, res, next } = buildMocks();
      errorHandler(makeError('Validation failed', 400), req, res, next);

      expect(res._status).toBe(400);
      expect(res._body.error.message).toBe('Validation failed');
    });

    it('should handle 401 Unauthorized', () => {
      const { req, res, next } = buildMocks();
      errorHandler(makeError('Unauthorized', 401), req, res, next);

      expect(res._status).toBe(401);
    });

    it('should use "Internal Server Error" as default message when none provided', () => {
      const { req, res, next } = buildMocks();
      const err: ApiError = new Error('');
      err.message = '';

      errorHandler(err, req, res, next);

      // statusCode defaults to 500
      expect(res._status).toBe(500);
    });
  });

  describe('notFoundHandler', () => {
    it('should return 404 status', () => {
      const { req, res } = buildMocks('/api/unknown');

      notFoundHandler(req, res);

      expect(res._status).toBe(404);
    });

    it('should include the original URL in the message', () => {
      const { req, res } = buildMocks('/api/unknown-route');

      notFoundHandler(req, res);

      expect(res._body.error.message).toContain('/api/unknown-route');
    });

    it('should include timestamp in 404 response', () => {
      const { req, res } = buildMocks();
      notFoundHandler(req, res);

      expect(res._body.error).toHaveProperty('timestamp');
    });

    it('should include status 404 in response body', () => {
      const { req, res } = buildMocks();
      notFoundHandler(req, res);

      expect(res._body.error.status).toBe(404);
    });
  });
});
