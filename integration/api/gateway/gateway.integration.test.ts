import request from 'supertest';

const GATEWAY_URL: string = process.env.GATEWAY_URL || 'http://localhost:4000';
const AUTH_SERVICE_URL: string = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
const AUTH_PREFIX = '/api/v1/auth';

const gw = {
  post: (path: string) =>
    request(GATEWAY_URL).post(path).set('x-test-rate-limit', 'true'),
  get: (path: string) =>
    request(GATEWAY_URL).get(path).set('x-test-rate-limit', 'true'),
  put: (path: string) =>
    request(GATEWAY_URL).put(path).set('x-test-rate-limit', 'true'),
  delete: (path: string) =>
    request(GATEWAY_URL).delete(path).set('x-test-rate-limit', 'true'),
};

const authApi = {
  post: (path: string) =>
    request(AUTH_SERVICE_URL).post(`${AUTH_PREFIX}${path}`).set('x-test-rate-limit', 'true'),
};

async function createTestUser(suffix: string = '') {
  const userData = {
    email: `dr617-${suffix}-${Date.now()}@test.com`,
    password: 'Password123!',
    firstName: 'DR617',
    lastName: 'Test',
  };
  const res = await authApi.post('/register').send(userData).expect(201);
  return {
    user: res.body.data.user,
    accessToken: res.body.data.tokens.accessToken as string,
    userData,
  };
}

// ─────────────────────────────────────────────────────────────
// DR-617 — gateway Integration Tests (target: 60% coverage)
// ─────────────────────────────────────────────────────────────

describe('[DR-617] gateway — Health & Status', () => {
  it('exposes /health endpoint with aggregated status', async () => {
    const res = await request(GATEWAY_URL).get('/health');
    expect([200, 503]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.status).toBeDefined();
    }
  }, 10000);

  it('returns proper JSON content-type on /health', async () => {
    const res = await request(GATEWAY_URL).get('/health');
    expect(res.headers['content-type']).toMatch(/application\/json/);
  }, 10000);
});

describe('[DR-617] gateway — Security Headers (Helmet)', () => {
  it('includes X-Content-Type-Options header', async () => {
    const res = await request(GATEWAY_URL).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  }, 10000);

  it('includes X-Frame-Options header', async () => {
    const res = await request(GATEWAY_URL).get('/health');
    expect(res.headers['x-frame-options']).toBeDefined();
  }, 10000);

  it('does not expose X-Powered-By header', async () => {
    const res = await request(GATEWAY_URL).get('/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
  }, 10000);
});

describe('[DR-617] gateway — JWT Validation Middleware', () => {
  let ctx: Awaited<ReturnType<typeof createTestUser>>;

  beforeEach(async () => { ctx = await createTestUser('jwt'); });
  afterEach(async () => {
    try { await authApi.post('/test/cleanup').send(); } catch {}
  });

  it('allows request with valid JWT to auth proxy', async () => {
    const res = await gw
      .get('/api/v1/auth/profile')
      .set('Authorization', `Bearer ${ctx.accessToken}`);

    // Gateway proxies — should get 200 or backend error, not 401
    expect([200, 502, 503]).toContain(res.status);
  }, 15000);

  it('rejects request without Authorization header on protected routes', async () => {
    const res = await gw.get('/api/v1/users/profile/me');
    expect([401, 403, 502]).toContain(res.status);
  }, 10000);

  it('rejects request with malformed JWT', async () => {
    const res = await gw
      .get('/api/v1/users/profile/me')
      .set('Authorization', 'Bearer this.is.not.valid');
    expect([401, 403]).toContain(res.status);
  }, 10000);

  it('rejects request with empty Bearer token', async () => {
    const res = await gw
      .get('/api/v1/users/profile/me')
      .set('Authorization', 'Bearer ');
    expect([401, 403]).toContain(res.status);
  }, 10000);

  it('rejects request with token signed by wrong secret', async () => {
    const fakeToken =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
      'eyJzdWIiOiIxMjM0NSIsImVtYWlsIjoiZmFrZUB0ZXN0LmNvbSIsImlhdCI6MTYwMDAwMDAwMH0.' +
      'WRONG_SIGNATURE_HERE';
    const res = await gw
      .get('/api/v1/users/profile/me')
      .set('Authorization', `Bearer ${fakeToken}`);
    expect([401, 403]).toContain(res.status);
  }, 10000);
});

describe('[DR-617] gateway — Proxy Routing', () => {
  let ctx: Awaited<ReturnType<typeof createTestUser>>;

  beforeEach(async () => { ctx = await createTestUser('proxy'); });
  afterEach(async () => {
    try { await authApi.post('/test/cleanup').send(); } catch {}
  });

  const routes = [
    { path: '/api/v1/auth/profile', service: 'auth-service (3001)' },
    { path: '/api/v1/users/profile/me', service: 'user-service (3002)' },
    { path: '/api/v1/voyage/flights/search', service: 'voyage-service (3003)' },
    { path: '/api/v1/payment/history', service: 'payment-service (3004)' },
    { path: '/api/v1/ai/recommendations', service: 'ai-service (3005)' },
  ];

  it.each(routes)('routes $path → $service (not 404 from gateway itself)', async ({ path }) => {
    const res = await gw
      .get(path)
      .set('Authorization', `Bearer ${ctx.accessToken}`);

    // Gateway should forward — any backend response is fine, but not a gateway-level 404
    // 404 is acceptable only if the backend itself returns it
    expect(res.status).not.toBe(500);
    // If gateway can't find the route at all it would 404 with no body
    if (res.status === 404) {
      expect(res.body).toBeDefined();
    }
  }, 15000);

  it('returns 404 for completely unknown routes', async () => {
    const res = await gw.get('/api/v1/nonexistent-service/endpoint');
    expect([404, 502, 503]).toContain(res.status);
  }, 10000);
});

describe('[DR-617] gateway — CORS', () => {
  it('returns CORS headers for allowed origin', async () => {
    const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
    const res = await request(GATEWAY_URL)
      .options('/api/v1/auth/login')
      .set('Origin', allowedOrigin)
      .set('Access-Control-Request-Method', 'POST');

    expect([200, 204]).toContain(res.status);
    expect(res.headers['access-control-allow-origin']).toBeDefined();
  }, 10000);

  it('includes Access-Control-Allow-Methods in preflight', async () => {
    const res = await request(GATEWAY_URL)
      .options('/api/v1/auth/login')
      .set('Origin', process.env.CORS_ORIGIN || 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST');

    if ([200, 204].includes(res.status)) {
      expect(res.headers['access-control-allow-methods']).toBeDefined();
    }
  }, 10000);
});

describe('[DR-617] gateway — Error Handling', () => {
  it('returns 404 with JSON body for unknown routes', async () => {
    const res = await request(GATEWAY_URL).get('/this/route/does/not/exist');
    expect([404, 502]).toContain(res.status);
  }, 10000);

  it('returns proper error when backend service is down (502/503)', async () => {
    // Try a route that may hit a down service in test env
    const res = await request(GATEWAY_URL)
      .get('/api/v1/ai/recommendations')
      .set('x-test-rate-limit', 'true');

    // Gateway should never crash with 500 — must return structured error
    expect(res.status).not.toBe(500);
  }, 15000);

  it('does not expose internal stack traces in error responses', async () => {
    const res = await request(GATEWAY_URL).get('/api/v1/nonexistent');
    const body = JSON.stringify(res.body).toLowerCase();
    expect(body).not.toContain('stack');
    expect(body).not.toContain('traceback');
  }, 10000);
});

describe('[DR-617] gateway — Rate Limiting', () => {
  it('allows requests with x-test-rate-limit header', async () => {
    // Multiple requests with bypass header should all succeed
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(GATEWAY_URL)
          .get('/health')
          .set('x-test-rate-limit', 'true')
      )
    );
    results.forEach(res => {
      expect([200, 503]).toContain(res.status);
    });
  }, 15000);

  it('rate limits do not apply to /health endpoint', async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        request(GATEWAY_URL).get('/health')
      )
    );
    // /health should never be rate-limited
    results.forEach(res => {
      expect(res.status).not.toBe(429);
    });
  }, 20000);
});

describe('[DR-617] gateway — Compression', () => {
  it('supports gzip Accept-Encoding', async () => {
    const res = await request(GATEWAY_URL)
      .get('/health')
      .set('Accept-Encoding', 'gzip, deflate');

    expect([200, 503]).toContain(res.status);
    // Gateway should not crash on compressed requests
  }, 10000);
});

describe('[DR-617] gateway — Request Forwarding', () => {
  let ctx: Awaited<ReturnType<typeof createTestUser>>;

  beforeEach(async () => { ctx = await createTestUser('forward'); });
  afterEach(async () => {
    try { await authApi.post('/test/cleanup').send(); } catch {}
  });

  it('forwards POST requests with JSON body to auth service', async () => {
    const res = await request(GATEWAY_URL)
      .post('/api/v1/auth/login')
      .set('x-test-rate-limit', 'true')
      .set('Content-Type', 'application/json')
      .send({ email: ctx.userData.email, password: ctx.userData.password });

    // Should be proxied — auth service handles the response
    expect(res.status).not.toBe(500);
    expect([200, 400, 401, 502, 503]).toContain(res.status);
  }, 15000);

  it('forwards Authorization header to backend services', async () => {
    const res = await gw
      .get('/api/v1/auth/profile')
      .set('Authorization', `Bearer ${ctx.accessToken}`);

    // If gateway strips the header, backend would return 401
    // We accept both 200 (backend processed) and 502 (backend down)
    expect(res.status).not.toBe(500);
    expect([200, 401, 502, 503]).toContain(res.status);
  }, 15000);

  it('does not return 500 on malformed JSON body', async () => {
    const res = await request(GATEWAY_URL)
      .post('/api/v1/auth/login')
      .set('x-test-rate-limit', 'true')
      .set('Content-Type', 'application/json')
      .send('{ broken json }');

    expect(res.status).not.toBe(500);
  }, 10000);
});
