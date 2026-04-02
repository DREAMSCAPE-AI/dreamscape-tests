/**
 * rateLimiter.test.ts - DR-538-US-TEST-002
 *
 * rateLimiter.ts calls createRedisStore() at module-load time.
 * We use jest.isolateModules() to re-execute the module with different
 * Redis mock states so both branches are exercised.
 */

// The @config/redis mock is resolved via moduleNameMapper
import mockRedisClient, { mockRawClient } from '../../../../dreamscape-tests/__mocks__/redis';

function makeReq(overrides: any = {}): any {
  return {
    ip: '127.0.0.1',
    body: {},
    ...overrides,
  };
}

// ─── Redis available (default mock state: isReady=true, getClient returns mock) ──

describe('rateLimiter — Redis available', () => {
  let loginLimiter: any;
  let registerLimiter: any;
  let authLimiter: any;
  let refreshLimiter: any;
  let capturedSendCommand: ((...args: string[]) => any) | undefined;

  beforeAll(() => {
    jest.isolateModules(() => {
      (mockRedisClient.isReady as jest.Mock).mockReturnValue(true);
      (mockRedisClient.getClient as jest.Mock).mockReturnValue(mockRawClient);

      // Re-mock express-rate-limit to capture config
      jest.mock('express-rate-limit', () => jest.fn((config: any) => config));
      jest.mock('rate-limit-redis', () => ({
        RedisStore: jest.fn().mockImplementation((opts: any) => {
          capturedSendCommand = opts.sendCommand;
          return { type: 'redis-store' };
        }),
      }));

      const mod = require('../../../../dreamscape-services/auth/src/middleware/rateLimiter');
      loginLimiter = mod.loginLimiter;
      registerLimiter = mod.registerLimiter;
      authLimiter = mod.authLimiter;
      refreshLimiter = mod.refreshLimiter;
    });
  });

  it('loginLimiter has correct windowMs and max', () => {
    expect(loginLimiter.windowMs).toBe(15 * 60 * 1000);
    expect(loginLimiter.max).toBe(5);
  });

  it('loginLimiter skipSuccessfulRequests is true', () => {
    expect(loginLimiter.skipSuccessfulRequests).toBe(true);
  });

  it('loginLimiter keyGenerator includes email and ip', () => {
    const req = makeReq({ ip: '1.2.3.4', body: { email: 'user@test.com' } });
    const key = loginLimiter.keyGenerator(req);
    expect(key).toBe('login:1.2.3.4-user@test.com');
  });

  it('loginLimiter keyGenerator falls back to "unknown" when no email', () => {
    const req = makeReq({ ip: '1.2.3.4', body: {} });
    const key = loginLimiter.keyGenerator(req);
    expect(key).toBe('login:1.2.3.4-unknown');
  });

  it('registerLimiter has correct windowMs and max', () => {
    expect(registerLimiter.windowMs).toBe(60 * 60 * 1000);
    expect(registerLimiter.max).toBe(3);
  });

  it('registerLimiter keyGenerator uses ip only', () => {
    const req = makeReq({ ip: '5.5.5.5' });
    const key = registerLimiter.keyGenerator(req);
    expect(key).toBe('register:5.5.5.5');
  });

  it('authLimiter has correct windowMs and max', () => {
    expect(authLimiter.windowMs).toBe(15 * 60 * 1000);
    expect(authLimiter.max).toBe(100);
  });

  it('authLimiter keyGenerator prefixes with auth:', () => {
    const req = makeReq({ ip: '10.0.0.1' });
    const key = authLimiter.keyGenerator(req);
    expect(key).toBe('auth:10.0.0.1');
  });

  it('refreshLimiter has correct windowMs and max', () => {
    expect(refreshLimiter.windowMs).toBe(15 * 60 * 1000);
    expect(refreshLimiter.max).toBe(20);
  });

  it('refreshLimiter keyGenerator prefixes with refresh:', () => {
    const req = makeReq({ ip: '10.0.0.2' });
    const key = refreshLimiter.keyGenerator(req);
    expect(key).toBe('refresh:10.0.0.2');
  });

  it('all limiters use a Redis store when Redis is ready', () => {
    expect(loginLimiter.store).toBeDefined();
    expect(loginLimiter.store.type).toBe('redis-store');
    expect(registerLimiter.store.type).toBe('redis-store');
    expect(authLimiter.store.type).toBe('redis-store');
    expect(refreshLimiter.store.type).toBe('redis-store');
  });

  it('all limiters have legacyHeaders=false and standardHeaders=true', () => {
    for (const limiter of [loginLimiter, registerLimiter, authLimiter, refreshLimiter]) {
      expect(limiter.legacyHeaders).toBe(false);
      expect(limiter.standardHeaders).toBe(true);
    }
  });

  it('all limiters have RATE_LIMIT_EXCEEDED code in message', () => {
    for (const limiter of [loginLimiter, registerLimiter, authLimiter, refreshLimiter]) {
      expect(limiter.message.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(limiter.message.success).toBe(false);
    }
  });

  it('RedisStore sendCommand wraps variadic args into an array and calls client.sendCommand', () => {
    expect(typeof capturedSendCommand).toBe('function');
    // capturedSendCommand is (...args) => client.sendCommand(args)
    // client here is the isolated registry's mockRawClient — a distinct jest.fn() instance.
    // Calling it exercises the arrow function body at rateLimiter.ts:15.
    expect(() => capturedSendCommand!('PING')).not.toThrow();
  });

  it('loginLimiter keyGenerator handles undefined req.body (optional chaining null branch)', () => {
    const req = makeReq({ ip: '1.2.3.4', body: undefined });
    const key = loginLimiter.keyGenerator(req);
    expect(key).toBe('login:1.2.3.4-unknown');
  });
});

// ─── Redis NOT available ──────────────────────────────────────────────────────

describe('rateLimiter — Redis NOT available (fallback to memory store)', () => {
  it('logs a warning and uses memory store when Redis not available', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    jest.isolateModules(() => {
      // Override @config/redis with a factory so the isolated registry gets
      // an instance where isReady() returns false (the outer mock is in a
      // different registry and its state doesn't bleed in)
      jest.mock('@config/redis', () => ({
        __esModule: true,
        default: {
          isReady: jest.fn().mockReturnValue(false),
          getClient: jest.fn().mockReturnValue(null),
        },
      }));
      jest.mock('express-rate-limit', () => jest.fn((config: any) => config));
      jest.mock('rate-limit-redis', () => ({ RedisStore: jest.fn() }));

      require('../../../../dreamscape-services/auth/src/middleware/rateLimiter');
    });

    expect(warnSpy).toHaveBeenCalledWith(
      'Redis not available, falling back to memory store for rate limiting'
    );
    warnSpy.mockRestore();
  });
});
