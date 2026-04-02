import { Request, Response, NextFunction } from 'express';
import mockRedisClient, { mockRawClient } from '../../../../dreamscape-tests/__mocks__/redis';
import {
  cacheMiddleware,
  CacheInvalidator,
  cache,
} from '../../../../dreamscape-services/auth/src/middleware/cache';

const mockRedis = mockRedisClient as jest.Mocked<typeof mockRedisClient>;
const mockRaw = mockRawClient as jest.Mocked<typeof mockRawClient>;

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    method: 'GET',
    path: '/api/profile',
    query: {},
    get: jest.fn().mockReturnValue(undefined),
    body: {},
    ...overrides,
  } as unknown as Request;
}

function makeRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.set = jest.fn().mockReturnValue(res);
  res.get = jest.fn().mockReturnValue('application/json');
  res.statusCode = 200;
  return res;
}

// ─── cacheMiddleware ──────────────────────────────────────────────────────────

describe('cacheMiddleware', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    (mockRedis.isReady as jest.Mock).mockReturnValue(true);
    (mockRedis.get as jest.Mock).mockResolvedValue(null);
    (mockRedis.set as jest.Mock).mockResolvedValue(true);
  });

  it('calls next immediately for non-GET requests', async () => {
    const middleware = cacheMiddleware();
    const req = makeReq({ method: 'POST' });
    const res = makeRes();
    const next = jest.fn();
    await middleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(mockRedis.get).not.toHaveBeenCalled();
  });

  it('calls next immediately when Redis is not ready', async () => {
    (mockRedis.isReady as jest.Mock).mockReturnValue(false);
    const middleware = cacheMiddleware();
    const req = makeReq();
    const res = makeRes();
    const next = jest.fn();
    await middleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(mockRedis.get).not.toHaveBeenCalled();
  });

  it('returns cached response on cache HIT and sets X-Cache: HIT', async () => {
    const cachedData = JSON.stringify({
      status: 200,
      body: { user: 'data' },
      headers: { 'content-type': 'application/json' },
    });
    (mockRedis.get as jest.Mock).mockResolvedValue(cachedData);

    const middleware = cacheMiddleware();
    const req = makeReq();
    const res = makeRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(res.set).toHaveBeenCalledWith('X-Cache', 'HIT');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ user: 'data' });
    expect(next).not.toHaveBeenCalled();
  });

  it('on cache HIT restores cached headers', async () => {
    const cachedData = JSON.stringify({
      status: 200,
      body: {},
      headers: { 'content-type': 'application/json', 'x-custom': 'value' },
    });
    (mockRedis.get as jest.Mock).mockResolvedValue(cachedData);

    const middleware = cacheMiddleware();
    const req = makeReq();
    const res = makeRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(res.set).toHaveBeenCalledWith('x-custom', 'value');
  });

  it('on cache HIT uses status 200 as default when cached.status is missing', async () => {
    const cachedData = JSON.stringify({ body: { ok: true } });
    (mockRedis.get as jest.Mock).mockResolvedValue(cachedData);

    const middleware = cacheMiddleware();
    const req = makeReq();
    const res = makeRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('sets X-Cache: MISS on cache miss and calls next', async () => {
    const middleware = cacheMiddleware();
    const req = makeReq();
    const res = makeRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(res.set).toHaveBeenCalledWith('X-Cache', 'MISS');
    expect(next).toHaveBeenCalled();
  });

  it('on cache MISS, res.json is overridden and stores response in Redis', async () => {
    const middleware = cacheMiddleware({ ttl: 120 });
    const req = makeReq();
    const res = makeRes();
    const next = jest.fn();

    await middleware(req, res, next);

    // Call the overridden res.json with a body
    res.json({ result: 'ok' });

    // Wait for async Redis.set call
    await new Promise(resolve => setImmediate(resolve));

    expect(mockRedis.set).toHaveBeenCalledWith(
      expect.stringContaining('cache:'),
      expect.stringContaining('"result":"ok"'),
      120
    );
  });

  it('handles Redis.set rejection in the async .catch (does not throw)', async () => {
    (mockRedis.set as jest.Mock).mockRejectedValue(new Error('set fail'));
    const middleware = cacheMiddleware({ ttl: 60 });
    const req = makeReq();
    const res = makeRes();
    const next = jest.fn();

    await middleware(req, res, next);
    res.json({ ok: true });

    // Wait for the async .catch to execute — should not throw
    await new Promise(resolve => setImmediate(resolve));

    expect(next).toHaveBeenCalled();
  });

  it('does not cache non-2xx responses', async () => {
    const middleware = cacheMiddleware();
    const req = makeReq();
    const res = makeRes();
    res.statusCode = 404;
    const next = jest.fn();

    await middleware(req, res, next);
    res.json({ error: 'not found' });

    await new Promise(resolve => setImmediate(resolve));

    expect(mockRedis.set).not.toHaveBeenCalled();
  });

  it('calls next on Redis error', async () => {
    (mockRedis.get as jest.Mock).mockRejectedValue(new Error('Redis error'));
    const middleware = cacheMiddleware();
    const req = makeReq();
    const res = makeRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('includes query params in cache key', async () => {
    const middleware = cacheMiddleware();
    const req = makeReq({
      query: { page: '2', limit: '10' } as any,
    });
    const res = makeRes();
    const next = jest.fn();

    await middleware(req, res, next);

    const cacheKeyCall = (mockRedis.get as jest.Mock).mock.calls[0][0];
    expect(cacheKeyCall).toContain('page');
  });

  it('excludes query params from cache key when excludeQuery=true', async () => {
    const middleware = cacheMiddleware({ excludeQuery: true });
    const req1 = makeReq({ query: { page: '1' } as any });
    const req2 = makeReq({ query: { page: '2' } as any });
    const res = makeRes();

    await middleware(req1, res, jest.fn());
    await middleware(req2, res, jest.fn());

    const key1 = (mockRedis.get as jest.Mock).mock.calls[0][0];
    const key2 = (mockRedis.get as jest.Mock).mock.calls[1][0];
    expect(key1).toBe(key2);
  });

  it('includes varyBy header in cache key when present via req.get', async () => {
    const middleware = cacheMiddleware({ varyBy: ['accept-language'] });
    const req = makeReq();
    (req.get as jest.Mock).mockImplementation((h: string) =>
      h === 'accept-language' ? 'fr-FR' : undefined
    );
    const res = makeRes();
    const next = jest.fn();

    await middleware(req, res, next);

    const cacheKeyCall = (mockRedis.get as jest.Mock).mock.calls[0][0];
    expect(cacheKeyCall).toContain('fr-FR');
  });

  it('uses req.body value for varyBy when req.get returns nothing', async () => {
    const middleware = cacheMiddleware({ varyBy: ['x-tenant'] });
    const req = makeReq({ body: { 'x-tenant': 'acme' } });
    (req.get as jest.Mock).mockReturnValue(undefined);
    const res = makeRes();
    const next = jest.fn();

    await middleware(req, res, next);

    const cacheKeyCall = (mockRedis.get as jest.Mock).mock.calls[0][0];
    expect(cacheKeyCall).toContain('acme');
  });

  it('omits varyBy entry from cache key when neither req.get nor req.body has a value', async () => {
    const middleware = cacheMiddleware({ varyBy: ['x-tenant'] });
    const req = makeReq({ body: {} });
    (req.get as jest.Mock).mockReturnValue(undefined);
    const res = makeRes();
    const next = jest.fn();

    await middleware(req, res, next);

    const cacheKeyCall = (mockRedis.get as jest.Mock).mock.calls[0][0];
    expect(cacheKeyCall).not.toContain('x-tenant:');
  });

  it('omits varyBy entry when req.body is undefined (optional chaining null branch)', async () => {
    const middleware = cacheMiddleware({ varyBy: ['x-tenant'] });
    const req = makeReq({ body: undefined });
    (req.get as jest.Mock).mockReturnValue(undefined);
    const res = makeRes();
    const next = jest.fn();

    await middleware(req, res, next);

    const cacheKeyCall = (mockRedis.get as jest.Mock).mock.calls[0][0];
    expect(cacheKeyCall).not.toContain('x-tenant:');
  });

  it('hashes cache key when it exceeds 100 chars', async () => {
    const middleware = cacheMiddleware({
      keyPrefix: 'a'.repeat(50),
    });
    const req = makeReq({
      path: '/very/long/path/that/makes/the/key/exceed/100/characters/easily',
    });
    const res = makeRes();
    const next = jest.fn();

    await middleware(req, res, next);

    const cacheKeyCall = (mockRedis.get as jest.Mock).mock.calls[0][0];
    // Hashed key contains only the prefix + md5 hash (32 hex chars)
    expect(cacheKeyCall).toMatch(/^cache:.+:[a-f0-9]{32}$/);
  });
});

// ─── CacheInvalidator ─────────────────────────────────────────────────────────

describe('CacheInvalidator', () => {
  beforeEach(() => {
    (mockRedis.getClient as jest.Mock).mockReturnValue(mockRaw);
    (mockRaw.keys as jest.Mock).mockResolvedValue([]);
    (mockRaw.del as jest.Mock).mockResolvedValue(1);
  });

  it('invalidateByPattern returns 0 when no client', async () => {
    (mockRedis.getClient as jest.Mock).mockReturnValue(null);
    const result = await CacheInvalidator.invalidateByPattern('test');
    expect(result).toBe(0);
  });

  it('invalidateByPattern returns 0 when no matching keys', async () => {
    (mockRaw.keys as jest.Mock).mockResolvedValue([]);
    const result = await CacheInvalidator.invalidateByPattern('test');
    expect(result).toBe(0);
  });

  it('invalidateByPattern deletes matching keys and returns count', async () => {
    (mockRaw.keys as jest.Mock).mockResolvedValue(['cache:key1', 'cache:key2']);
    const result = await CacheInvalidator.invalidateByPattern('test');
    expect(mockRaw.del).toHaveBeenCalledWith(['cache:key1', 'cache:key2']);
    expect(result).toBe(2);
  });

  it('invalidatePath delegates to invalidateByPattern', async () => {
    (mockRaw.keys as jest.Mock).mockResolvedValue(['cache:GET:/api/users']);
    const result = await CacheInvalidator.invalidatePath('/api/users');
    expect(result).toBe(1);
  });

  it('invalidateAll calls invalidateByPattern with empty string', async () => {
    (mockRaw.keys as jest.Mock).mockResolvedValue(['cache:x', 'cache:y', 'cache:z']);
    const result = await CacheInvalidator.invalidateAll();
    expect(result).toBe(3);
  });

  it('invalidateByPrefix delegates to invalidateByPattern', async () => {
    (mockRaw.keys as jest.Mock).mockResolvedValue(['cache:user:1']);
    const result = await CacheInvalidator.invalidateByPrefix('user:');
    expect(result).toBe(1);
  });

  it('invalidateByPattern returns 0 on error', async () => {
    (mockRaw.keys as jest.Mock).mockRejectedValue(new Error('Redis error'));
    const result = await CacheInvalidator.invalidateByPattern('test');
    expect(result).toBe(0);
  });
});

// ─── pre-configured cache exports ─────────────────────────────────────────────

describe('cache pre-configured instances', () => {
  it('cache.short, medium, long, veryLong are functions (middleware)', () => {
    expect(typeof cache.short).toBe('function');
    expect(typeof cache.medium).toBe('function');
    expect(typeof cache.long).toBe('function');
    expect(typeof cache.veryLong).toBe('function');
  });

  it('cache.custom returns a middleware function', () => {
    const mw = cache.custom({ ttl: 45 });
    expect(typeof mw).toBe('function');
  });
});
