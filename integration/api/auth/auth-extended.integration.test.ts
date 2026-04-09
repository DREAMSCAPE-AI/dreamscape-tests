import request from 'supertest';

const AUTH_SERVICE_URL: string = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
const API_PREFIX = '/api/v1/auth';

const makeRequest = (url: string = AUTH_SERVICE_URL) => ({
  post: (path: string) =>
    request(url).post(`${API_PREFIX}${path}`).set('x-test-rate-limit', 'true'),
  get: (path: string) =>
    request(url).get(`${API_PREFIX}${path}`).set('x-test-rate-limit', 'true'),
  put: (path: string) =>
    request(url).put(`${API_PREFIX}${path}`).set('x-test-rate-limit', 'true'),
  delete: (path: string) =>
    request(url).delete(`${API_PREFIX}${path}`).set('x-test-rate-limit', 'true'),
});

const api = makeRequest();

interface RegisteredUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

async function registerUser(suffix: string = '') {
  const userData = {
    email: `dr612-${suffix}-${Date.now()}@test.com`,
    password: 'Password123!',
    firstName: 'DR612',
    lastName: 'Test',
  };
  const res = await api.post('/register').send(userData).expect(201);
  return {
    user: res.body.data.user as RegisteredUser,
    accessToken: res.body.data.tokens.accessToken as string,
    cookies: res.headers['set-cookie'] as string | string[],
    userData,
  };
}

// ─────────────────────────────────────────────────────────────
// DR-612 — auth-service Integration Tests (target: 60% coverage)
// ─────────────────────────────────────────────────────────────

describe('[DR-612] auth-service — Registration', () => {
  let createdUser: RegisteredUser | null = null;

  afterEach(async () => {
    if (createdUser?.email) {
      try {
        await api.delete(`/test/users/${createdUser.email}`).send();
      } catch {}
      createdUser = null;
    }
  });

  it('registers a new user with all required fields', async () => {
    const data = {
      email: `dr612-reg-${Date.now()}@test.com`,
      password: 'Password123!',
      firstName: 'Kevin',
      lastName: 'Test',
    };
    const res = await api.post('/register').send(data).expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(data.email);
    expect(res.body.data.tokens.accessToken).toBeDefined();
    expect(res.headers['set-cookie']).toBeDefined();

    createdUser = res.body.data.user;
  }, 15000);

  it('registers a user and creates a session', async () => {
    const { user, accessToken } = await registerUser('session');
    createdUser = user;

    const profile = await api
      .get('/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(profile.body.data.user.id).toBe(user.id);
  }, 15000);

  it('rejects registration with missing email', async () => {
    await api
      .post('/register')
      .send({ password: 'Password123!', firstName: 'A', lastName: 'B' })
      .expect(400);
  });

  it('rejects registration with missing password', async () => {
    await api
      .post('/register')
      .send({ email: `nopass-${Date.now()}@test.com`, firstName: 'A', lastName: 'B' })
      .expect(400);
  });

  it('rejects registration with missing firstName', async () => {
    await api
      .post('/register')
      .send({ email: `nofirst-${Date.now()}@test.com`, password: 'Password123!', lastName: 'B' })
      .expect(400);
  });

  it('rejects duplicate email registration', async () => {
    const { user, userData } = await registerUser('dup');
    createdUser = user;

    await api.post('/register').send(userData).expect(409);
  }, 15000);

  it('rejects weak passwords (too short)', async () => {
    await api
      .post('/register')
      .send({ email: `weakpw-${Date.now()}@test.com`, password: 'abc', firstName: 'A', lastName: 'B' })
      .expect(400);
  });

  it('rejects passwords without uppercase letter', async () => {
    await api
      .post('/register')
      .send({ email: `weakpw2-${Date.now()}@test.com`, password: 'password123!', firstName: 'A', lastName: 'B' })
      .expect(400);
  });

  it('rejects passwords without digit', async () => {
    await api
      .post('/register')
      .send({ email: `weakpw3-${Date.now()}@test.com`, password: 'Password!!!', firstName: 'A', lastName: 'B' })
      .expect(400);
  });

  it('rejects invalid email format', async () => {
    await api
      .post('/register')
      .send({ email: 'not-an-email', password: 'Password123!', firstName: 'A', lastName: 'B' })
      .expect(400);
  });

  it('rejects XSS in firstName/lastName', async () => {
    await api
      .post('/register')
      .send({
        email: `xss-${Date.now()}@test.com`,
        password: 'Password123!',
        firstName: '<script>alert(1)</script>',
        lastName: 'User',
      })
      .expect(400);
  });
});

describe('[DR-612] auth-service — Login', () => {
  let registeredUser: Awaited<ReturnType<typeof registerUser>> | null = null;

  beforeEach(async () => {
    registeredUser = await registerUser('login');
  });

  afterEach(async () => {
    if (registeredUser?.user?.email) {
      try {
        await api.delete(`/test/users/${registeredUser.user.email}`).send();
      } catch {}
    }
    registeredUser = null;
  });

  it('logs in with valid credentials', async () => {
    const res = await api
      .post('/login')
      .send({ email: registeredUser!.userData.email, password: 'Password123!' })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.tokens.accessToken).toBeDefined();
    expect(res.headers['set-cookie']).toBeDefined();
  }, 15000);

  it('rejects login with wrong password', async () => {
    await api
      .post('/login')
      .send({ email: registeredUser!.userData.email, password: 'WrongPassword1!' })
      .expect(401);
  }, 10000);

  it('rejects login for non-existent user', async () => {
    await api
      .post('/login')
      .send({ email: `nobody-${Date.now()}@test.com`, password: 'Password123!' })
      .expect(401);
  }, 10000);

  it('rejects login with missing email', async () => {
    await api.post('/login').send({ password: 'Password123!' }).expect(400);
  });

  it('rejects login with missing password', async () => {
    await api
      .post('/login')
      .send({ email: registeredUser!.userData.email })
      .expect(400);
  });

  it('login with rememberMe=true sets longer cookie', async () => {
    const res = await api
      .post('/login')
      .send({ email: registeredUser!.userData.email, password: 'Password123!', rememberMe: true })
      .expect(200);

    const cookies: string[] = Array.isArray(res.headers['set-cookie'])
      ? res.headers['set-cookie']
      : [res.headers['set-cookie']];
    const refreshCookie = cookies.find((c: string) => c.startsWith('refreshToken='));
    expect(refreshCookie).toContain('Max-Age=2592000');
  }, 15000);

  it('login with rememberMe=false sets shorter cookie', async () => {
    const res = await api
      .post('/login')
      .send({ email: registeredUser!.userData.email, password: 'Password123!', rememberMe: false })
      .expect(200);

    const cookies: string[] = Array.isArray(res.headers['set-cookie'])
      ? res.headers['set-cookie']
      : [res.headers['set-cookie']];
    const refreshCookie = cookies.find((c: string) => c.startsWith('refreshToken='));
    expect(refreshCookie).toContain('Max-Age=604800');
  }, 15000);
});

describe('[DR-612] auth-service — Logout & Token Blacklist', () => {
  it('invalidates access token after logout', async () => {
    const { user, accessToken, cookies } = await registerUser('logout');

    const cookieArr: string[] = Array.isArray(cookies) ? cookies : [cookies];
    const refreshCookie = cookieArr.find((c: string) => c.startsWith('refreshToken='));

    await api
      .post('/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', refreshCookie || '')
      .expect(200);

    // Token should now be blacklisted
    await api
      .get('/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401);

    try { await api.delete(`/test/users/${user.email}`).send(); } catch {}
  }, 20000);

  it('returns 401 on logout without token', async () => {
    await api.post('/logout').expect(401);
  });
});

describe('[DR-612] auth-service — Refresh Token', () => {
  it('issues new access token with valid refresh token', async () => {
    const { user, cookies } = await registerUser('refresh');
    const cookieArr: string[] = Array.isArray(cookies) ? cookies : [cookies];
    const refreshCookie = cookieArr.find((c: string) => c.startsWith('refreshToken='));
    const refreshTokenValue = refreshCookie?.match(/refreshToken=([^;]+)/)?.[1];

    const res = await api
      .post('/refresh')
      .send({ refreshToken: refreshTokenValue })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.tokens?.accessToken || res.body.data.accessToken).toBeDefined();

    try { await api.delete(`/test/users/${user.email}`).send(); } catch {}
  }, 20000);

  it('rejects expired/invalid refresh token', async () => {
    await api
      .post('/refresh')
      .send({ refreshToken: 'definitely-not-a-valid-token' })
      .expect(401);
  });

  it('rejects replay of already-used refresh token', async () => {
    const { user, cookies } = await registerUser('refresh-replay');
    const cookieArr: string[] = Array.isArray(cookies) ? cookies : [cookies];
    const refreshCookie = cookieArr.find((c: string) => c.startsWith('refreshToken='));
    const refreshTokenValue = refreshCookie?.match(/refreshToken=([^;]+)/)?.[1];

    // First use — should succeed
    await api.post('/refresh').send({ refreshToken: refreshTokenValue }).expect(200);

    // Second use of same token — should fail
    await api.post('/refresh').send({ refreshToken: refreshTokenValue }).expect(401);

    try { await api.delete(`/test/users/${user.email}`).send(); } catch {}
  }, 20000);
});

describe('[DR-612] auth-service — Profile (/me)', () => {
  let registered: Awaited<ReturnType<typeof registerUser>>;

  beforeEach(async () => {
    registered = await registerUser('profile');
  });

  afterEach(async () => {
    try { await api.delete(`/test/users/${registered.user.email}`).send(); } catch {}
  });

  it('returns profile for authenticated user', async () => {
    const res = await api
      .get('/profile')
      .set('Authorization', `Bearer ${registered.accessToken}`)
      .expect(200);

    expect(res.body.data.user.email).toBe(registered.userData.email);
    expect(res.body.data.user.firstName).toBe('DR612');
  }, 10000);

  it('rejects profile request without token', async () => {
    await api.get('/profile').expect(401);
  });

  it('rejects profile request with malformed token', async () => {
    await api
      .get('/profile')
      .set('Authorization', 'Bearer malformed.jwt.token')
      .expect(401);
  });

  it('rejects profile request with empty bearer', async () => {
    await api
      .get('/profile')
      .set('Authorization', 'Bearer ')
      .expect(401);
  });

  it('updates profile fields', async () => {
    const res = await api
      .put('/profile')
      .set('Authorization', `Bearer ${registered.accessToken}`)
      .send({ firstName: 'Updated', phoneNumber: '+33612345678' })
      .expect(200);

    expect(res.body.data.user.firstName).toBe('Updated');
  }, 10000);
});

describe('[DR-612] auth-service — Change Password', () => {
  let registered: Awaited<ReturnType<typeof registerUser>>;

  beforeEach(async () => {
    registered = await registerUser('changepw');
  });

  afterEach(async () => {
    try { await api.delete(`/test/users/${registered.user.email}`).send(); } catch {}
  });

  it('changes password with correct current password', async () => {
    const res = await api
      .post('/change-password')
      .set('Authorization', `Bearer ${registered.accessToken}`)
      .send({ currentPassword: 'Password123!', newPassword: 'NewPassword456!' })
      .expect(200);

    expect(res.body.success).toBe(true);
  }, 15000);

  it('rejects change with wrong current password', async () => {
    await api
      .post('/change-password')
      .set('Authorization', `Bearer ${registered.accessToken}`)
      .send({ currentPassword: 'WrongPass1!', newPassword: 'NewPassword456!' })
      .expect(401);
  }, 10000);

  it('rejects weak new password', async () => {
    await api
      .post('/change-password')
      .set('Authorization', `Bearer ${registered.accessToken}`)
      .send({ currentPassword: 'Password123!', newPassword: 'weak' })
      .expect(400);
  }, 10000);
});

describe('[DR-612] auth-service — JWT Middleware', () => {
  const protectedRoutes = ['/profile', '/change-password'];

  it.each(protectedRoutes)('rejects unauthenticated request to %s', async (route) => {
    const method = route === '/change-password' ? 'post' : 'get';
    const res = await (method === 'post' ? api.post(route) : api.get(route));
    expect([401, 403]).toContain(res.status);
  });

  it('rejects token with wrong signature', async () => {
    const fakeToken =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
      'eyJzdWIiOiIxMjM0NSIsImVtYWlsIjoiZmFrZUB0ZXN0LmNvbSIsImlhdCI6MTYwMDAwMDAwMH0.' +
      'INVALIDSIGNATURE';
    await api.get('/profile').set('Authorization', `Bearer ${fakeToken}`).expect(401);
  });
});
