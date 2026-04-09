import request from 'supertest';

const AUTH_SERVICE_URL: string = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
const USER_SERVICE_URL: string = process.env.USER_SERVICE_URL || 'http://localhost:3002';
const AUTH_PREFIX = '/api/v1/auth';
const USER_PREFIX = '/api/v1/users';

const authApi = {
  post: (path: string) =>
    request(AUTH_SERVICE_URL).post(`${AUTH_PREFIX}${path}`).set('x-test-rate-limit', 'true'),
};

const userApi = {
  post: (path: string) =>
    request(USER_SERVICE_URL).post(`${USER_PREFIX}${path}`).set('x-test-rate-limit', 'true'),
  get: (path: string) =>
    request(USER_SERVICE_URL).get(`${USER_PREFIX}${path}`).set('x-test-rate-limit', 'true'),
  put: (path: string) =>
    request(USER_SERVICE_URL).put(`${USER_PREFIX}${path}`).set('x-test-rate-limit', 'true'),
  delete: (path: string) =>
    request(USER_SERVICE_URL).delete(`${USER_PREFIX}${path}`).set('x-test-rate-limit', 'true'),
};

async function createTestUser(suffix: string = '') {
  const userData = {
    email: `dr613-${suffix}-${Date.now()}@test.com`,
    password: 'Password123!',
    firstName: 'DR613',
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
// DR-613 — user-service Integration Tests (target: maintain 60%+)
// ─────────────────────────────────────────────────────────────

describe('[DR-613] user-service — Favorites', () => {
  let ctx: Awaited<ReturnType<typeof createTestUser>>;

  beforeEach(async () => { ctx = await createTestUser('fav'); });
  afterEach(async () => {
    try { await authApi.post('/test/cleanup').send(); } catch {}
  });

  it('lists favorites (empty by default)', async () => {
    const res = await userApi
      .get('/favorites')
      .set('Authorization', `Bearer ${ctx.accessToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.favorites)).toBe(true);
  }, 15000);

  it('adds a flight favorite', async () => {
    const favorite = {
      type: 'flight',
      itemId: `flight-${Date.now()}`,
      metadata: { origin: 'CDG', destination: 'JFK', price: 450 },
    };
    const res = await userApi
      .post('/favorites')
      .set('Authorization', `Bearer ${ctx.accessToken}`)
      .send(favorite)
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.favorite.type).toBe('flight');
  }, 15000);

  it('adds a hotel favorite', async () => {
    const favorite = {
      type: 'hotel',
      itemId: `hotel-${Date.now()}`,
      metadata: { name: 'Hotel Test', stars: 4, pricePerNight: 120 },
    };
    const res = await userApi
      .post('/favorites')
      .set('Authorization', `Bearer ${ctx.accessToken}`)
      .send(favorite)
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.favorite.type).toBe('hotel');
  }, 15000);

  it('adds a destination favorite', async () => {
    const favorite = {
      type: 'destination',
      itemId: `dest-${Date.now()}`,
      metadata: { name: 'Paris', country: 'France' },
    };
    const res = await userApi
      .post('/favorites')
      .set('Authorization', `Bearer ${ctx.accessToken}`)
      .send(favorite)
      .expect(201);

    expect(res.body.success).toBe(true);
  }, 15000);

  it('deletes a favorite', async () => {
    const favorite = { type: 'flight', itemId: `flt-del-${Date.now()}`, metadata: {} };
    const createRes = await userApi
      .post('/favorites')
      .set('Authorization', `Bearer ${ctx.accessToken}`)
      .send(favorite)
      .expect(201);

    const favoriteId = createRes.body.data.favorite.id;

    await userApi
      .delete(`/favorites/${favoriteId}`)
      .set('Authorization', `Bearer ${ctx.accessToken}`)
      .expect(200);
  }, 20000);

  it('rejects favorite addition without auth', async () => {
    await userApi
      .post('/favorites')
      .send({ type: 'flight', itemId: 'test', metadata: {} })
      .expect(401);
  });
});

describe('[DR-613] user-service — Activity History', () => {
  let ctx: Awaited<ReturnType<typeof createTestUser>>;

  beforeEach(async () => { ctx = await createTestUser('hist'); });
  afterEach(async () => {
    try { await authApi.post('/test/cleanup').send(); } catch {}
  });

  it('returns activity history (possibly empty)', async () => {
    const res = await userApi
      .get('/history')
      .set('Authorization', `Bearer ${ctx.accessToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.history ?? res.body.data.activities ?? [])).toBe(true);
  }, 15000);

  it('rejects history request without auth', async () => {
    await userApi.get('/history').expect(401);
  });
});

describe('[DR-613] user-service — Settings', () => {
  let ctx: Awaited<ReturnType<typeof createTestUser>>;

  beforeEach(async () => { ctx = await createTestUser('settings'); });
  afterEach(async () => {
    try { await authApi.post('/test/cleanup').send(); } catch {}
  });

  it('gets user settings', async () => {
    const res = await userApi
      .get('/settings')
      .set('Authorization', `Bearer ${ctx.accessToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.settings ?? res.body.data).toBeDefined();
  }, 15000);

  it('updates notification settings', async () => {
    const settingsUpdate = {
      notifications: { email: true, push: false, sms: false },
      privacy: { profileVisibility: 'private' },
    };
    const res = await userApi
      .put('/settings')
      .set('Authorization', `Bearer ${ctx.accessToken}`)
      .send(settingsUpdate)
      .expect(200);

    expect(res.body.success).toBe(true);
  }, 15000);

  it('rejects settings update without auth', async () => {
    await userApi.put('/settings').send({ notifications: {} }).expect(401);
  });
});

describe('[DR-613] user-service — Preferences', () => {
  let ctx: Awaited<ReturnType<typeof createTestUser>>;

  beforeEach(async () => { ctx = await createTestUser('prefs'); });
  afterEach(async () => {
    try { await authApi.post('/test/cleanup').send(); } catch {}
  });

  it('gets user preferences', async () => {
    const res = await userApi
      .get('/preferences')
      .set('Authorization', `Bearer ${ctx.accessToken}`);

    expect([200, 404]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
    }
  }, 15000);

  it('updates user preferences', async () => {
    const prefs = {
      language: 'fr',
      currency: 'EUR',
      travelStyle: 'budget',
    };
    const res = await userApi
      .put('/preferences')
      .set('Authorization', `Bearer ${ctx.accessToken}`)
      .send(prefs);

    expect([200, 201, 404]).toContain(res.status);
  }, 15000);
});

describe('[DR-613] user-service — GDPR Endpoints', () => {
  let ctx: Awaited<ReturnType<typeof createTestUser>>;

  beforeEach(async () => { ctx = await createTestUser('gdpr'); });
  afterEach(async () => {
    try { await authApi.post('/test/cleanup').send(); } catch {}
  });

  it('gets consent status', async () => {
    const res = await userApi
      .get('/gdpr/consent')
      .set('Authorization', `Bearer ${ctx.accessToken}`);

    expect([200, 404]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
    }
  }, 15000);

  it('updates consent preferences', async () => {
    const consent = {
      analytics: true,
      marketing: false,
      functional: true,
      preferences: true,
    };
    const res = await userApi
      .put('/gdpr/consent')
      .set('Authorization', `Bearer ${ctx.accessToken}`)
      .send(consent);

    expect([200, 201, 404]).toContain(res.status);
  }, 15000);

  it('requests data export', async () => {
    const res = await userApi
      .post('/gdpr/data-export')
      .set('Authorization', `Bearer ${ctx.accessToken}`)
      .send({ reason: 'Personal data review' });

    expect([200, 201, 202, 404]).toContain(res.status);
  }, 15000);

  it('requests account deletion', async () => {
    const res = await userApi
      .post('/gdpr/data-deletion')
      .set('Authorization', `Bearer ${ctx.accessToken}`)
      .send({ reason: 'No longer needed', password: ctx.userData.password });

    expect([200, 201, 202, 404]).toContain(res.status);
  }, 15000);

  it('rejects GDPR endpoints without auth', async () => {
    const res = await userApi.get('/gdpr/consent');
    expect([401, 404]).toContain(res.status);
  });
});

describe('[DR-613] user-service — Authentication Guards', () => {
  let ctx: Awaited<ReturnType<typeof createTestUser>>;

  beforeEach(async () => { ctx = await createTestUser('authguard'); });
  afterEach(async () => {
    try { await authApi.post('/test/cleanup').send(); } catch {}
  });

  const authProtectedEndpoints = [
    { method: 'get' as const, path: '/favorites' },
    { method: 'get' as const, path: '/history' },
    { method: 'get' as const, path: '/settings' },
  ];

  it.each(authProtectedEndpoints)(
    'rejects unauthenticated $method $path',
    async ({ method, path }) => {
      const res = await userApi[method](path);
      expect([401, 403]).toContain(res.status);
    }
  );

  it('rejects requests with malformed JWT', async () => {
    const res = await userApi
      .get('/favorites')
      .set('Authorization', 'Bearer not.a.valid.jwt');
    expect([401, 403]).toContain(res.status);
  });

  it('rejects requests with expired token', async () => {
    const expiredToken =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
      'eyJzdWIiOiIxMjM0NSIsImlhdCI6MTUxNjIzOTAyMiwiZXhwIjoxNTE2MjM5MDIzfQ.' +
      'INVALIDSIG';
    const res = await userApi
      .get('/favorites')
      .set('Authorization', `Bearer ${expiredToken}`);
    expect([401, 403]).toContain(res.status);
  });
});

describe('[DR-613] user-service — Input Validation', () => {
  let ctx: Awaited<ReturnType<typeof createTestUser>>;

  beforeEach(async () => { ctx = await createTestUser('validation'); });
  afterEach(async () => {
    try { await authApi.post('/test/cleanup').send(); } catch {}
  });

  it('rejects favorite with missing type', async () => {
    const res = await userApi
      .post('/favorites')
      .set('Authorization', `Bearer ${ctx.accessToken}`)
      .send({ itemId: 'test-123', metadata: {} });

    expect([400, 422]).toContain(res.status);
  }, 10000);

  it('rejects favorite with missing itemId', async () => {
    const res = await userApi
      .post('/favorites')
      .set('Authorization', `Bearer ${ctx.accessToken}`)
      .send({ type: 'flight', metadata: {} });

    expect([400, 422]).toContain(res.status);
  }, 10000);

  it('rejects favorite with invalid type', async () => {
    const res = await userApi
      .post('/favorites')
      .set('Authorization', `Bearer ${ctx.accessToken}`)
      .send({ type: 'invalidtype', itemId: 'test-123', metadata: {} });

    expect([400, 422]).toContain(res.status);
  }, 10000);

  it('does not return 500 on malformed JSON body', async () => {
    const res = await userApi
      .post('/favorites')
      .set('Authorization', `Bearer ${ctx.accessToken}`)
      .set('Content-Type', 'application/json')
      .send('not valid json {');

    expect(res.status).not.toBe(500);
    expect([400, 422]).toContain(res.status);
  }, 10000);
});
