import { Request, Response, NextFunction } from 'express';
import { errorHandler, notFoundHandler, ApiError } from '../../../../dreamscape-services/auth/src/middleware/errorHandler';

function makeRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    url: '/test',
    method: 'GET',
    originalUrl: '/test',
    ...overrides,
  } as Request;
}

// ─── errorHandler ─────────────────────────────────────────────────────────────

describe('errorHandler', () => {
  it('uses err.statusCode and err.message when provided', () => {
    const err: ApiError = Object.assign(new Error('Not allowed'), { statusCode: 403 });
    const req = makeReq({ url: '/secure' });
    const res = makeRes();
    const next = jest.fn() as unknown as NextFunction;

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({
        message: 'Not allowed',
        status: 403,
        path: '/secure',
      }),
    }));
  });

  it('defaults to 500 and "Internal Server Error" when statusCode/message missing', () => {
    const err: ApiError = new Error('');
    err.message = '';
    const req = makeReq();
    const res = makeRes();
    const next = jest.fn() as unknown as NextFunction;

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({
        status: 500,
        message: 'Internal Server Error',
      }),
    }));
  });

  it('includes timestamp in the response body', () => {
    const err: ApiError = new Error('oops');
    const req = makeReq();
    const res = makeRes();
    const next = jest.fn() as unknown as NextFunction;

    errorHandler(err, req, res, next);

    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.error.timestamp).toBeDefined();
    expect(() => new Date(body.error.timestamp)).not.toThrow();
  });

  it('uses err.statusCode 400 correctly', () => {
    const err: ApiError = Object.assign(new Error('Bad input'), { statusCode: 400 });
    const req = makeReq();
    const res = makeRes();
    const next = jest.fn() as unknown as NextFunction;

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

// ─── notFoundHandler ──────────────────────────────────────────────────────────

describe('notFoundHandler', () => {
  it('returns 404 with the original URL in the message', () => {
    const req = makeReq({ originalUrl: '/api/v1/missing' });
    const res = makeRes();

    notFoundHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({
        status: 404,
        message: expect.stringContaining('/api/v1/missing'),
        path: '/api/v1/missing',
      }),
    }));
  });

  it('includes a timestamp in the 404 response', () => {
    const req = makeReq({ originalUrl: '/nope' });
    const res = makeRes();

    notFoundHandler(req, res);

    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.error.timestamp).toBeDefined();
  });
});
