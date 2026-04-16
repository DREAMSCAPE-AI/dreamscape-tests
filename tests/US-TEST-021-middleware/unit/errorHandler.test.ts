/**
 * US-TEST-021 — Error Handler Middleware Unit Tests
 *
 * Tests for middleware/errorHandler.ts:
 * - errorHandler
 * - notFoundHandler
 */

import { Request, Response, NextFunction } from 'express';
import { errorHandler, notFoundHandler, ApiError } from '@ai/middleware/errorHandler';

function makeResMock() {
  const res: Partial<Response> = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res as Response;
}

function makeReqMock(overrides: Partial<Request> = {}): Request {
  return {
    url: '/test-path',
    method: 'GET',
    originalUrl: '/test-path',
    ...overrides,
  } as unknown as Request;
}

// ─── errorHandler ─────────────────────────────────────────────────────────────

describe('errorHandler', () => {
  const next: NextFunction = jest.fn();

  it('should use err.statusCode when provided', () => {
    const err: ApiError = Object.assign(new Error('Not found'), { statusCode: 404 });
    const req = makeReqMock();
    const res = makeResMock();

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          message: 'Not found',
          status: 404,
          path: '/test-path',
        }),
      })
    );
  });

  it('should default to 500 when statusCode is not set', () => {
    const err: ApiError = new Error('Something went wrong');
    const req = makeReqMock();
    const res = makeResMock();

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          status: 500,
          message: 'Something went wrong',
        }),
      })
    );
  });

  it('should use "Internal Server Error" when err.message is empty', () => {
    const err: ApiError = new Error('');
    const req = makeReqMock();
    const res = makeResMock();

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.error.message).toBe('Internal Server Error');
  });

  it('should include a timestamp in the response', () => {
    const err: ApiError = new Error('Timed');
    const req = makeReqMock();
    const res = makeResMock();

    errorHandler(err, req, res, next);

    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.error.timestamp).toBeDefined();
    expect(typeof body.error.timestamp).toBe('string');
  });

  it('should use req.url as path in response', () => {
    const err: ApiError = new Error('Err');
    const req = makeReqMock({ url: '/specific/path' });
    const res = makeResMock();

    errorHandler(err, req, res, next);

    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.error.path).toBe('/specific/path');
  });
});

// ─── notFoundHandler ──────────────────────────────────────────────────────────

describe('notFoundHandler', () => {
  it('should always respond with 404', () => {
    const req = makeReqMock({ originalUrl: '/missing/route' });
    const res = makeResMock();

    notFoundHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('should include the originalUrl in the error message', () => {
    const req = makeReqMock({ originalUrl: '/api/v1/unknown' });
    const res = makeResMock();

    notFoundHandler(req, res);

    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.error.message).toContain('/api/v1/unknown');
    expect(body.error.status).toBe(404);
    expect(body.error.path).toBe('/api/v1/unknown');
  });

  it('should include a timestamp in the response', () => {
    const req = makeReqMock({ originalUrl: '/any' });
    const res = makeResMock();

    notFoundHandler(req, res);

    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(typeof body.error.timestamp).toBe('string');
  });
});
