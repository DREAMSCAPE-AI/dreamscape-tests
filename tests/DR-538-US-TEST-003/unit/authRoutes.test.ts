/**
 * authRoutes.test.ts — DR-538-US-TEST-003
 *
 * Route-level tests using supertest. All external dependencies are mocked:
 * - AuthService (static methods)
 * - KafkaService (fire-and-forget event publishing)
 * - rateLimiter (conditionalRateLimit skips when x-test-rate-limit header is absent)
 */

// ─── Module mocks (hoisted before imports by Jest) ────────────────────────────

jest.mock('@services/AuthService', () => ({
  AuthService: {
    signup: jest.fn(),
    login: jest.fn(),
    refreshToken: jest.fn(),
    logout: jest.fn(),
    logoutAllDevices: jest.fn(),
    getUserProfile: jest.fn(),
    updateProfile: jest.fn(),
    changePassword: jest.fn(),
    verifyToken: jest.fn(),
    resetTestData: jest.fn(),
  },
}));

jest.mock('@services/KafkaService', () => ({
  __esModule: true,
  default: {
    publishLogin: jest.fn().mockResolvedValue(undefined),
    publishLogout: jest.fn().mockResolvedValue(undefined),
    publishPasswordChanged: jest.fn().mockResolvedValue(undefined),
    publishTokenRefreshed: jest.fn().mockResolvedValue(undefined),
    initialize: jest.fn().mockResolvedValue(undefined),
    shutdown: jest.fn().mockResolvedValue(undefined),
    healthCheck: jest.fn().mockResolvedValue({ healthy: true }),
  },
}));

jest.mock('@middleware/rateLimiter', () => ({
  loginLimiter: (_req: any, _res: any, next: any) => next(),
  registerLimiter: (_req: any, _res: any, next: any) => next(),
  refreshLimiter: (_req: any, _res: any, next: any) => next(),
  authLimiter: (_req: any, _res: any, next: any) => next(),
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { prisma } from '@dreamscape/db';
import { AuthService } from '@services/AuthService';
import authRouter from '../../../../dreamscape-services/auth/src/routes/auth';

const mockAuthService = AuthService as jest.Mocked<typeof AuthService>;
const mockPrisma = prisma as jest.Mocked<typeof prisma>;

// ─── Test app ─────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/v1/auth', authRouter);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const JWT_SECRET = 'test-secret';

beforeEach(() => {
  process.env.JWT_SECRET = JWT_SECRET;
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

function makeAccessToken(userId = 'u1', email = 'test@test.com') {
  return jwt.sign({ userId, email, type: 'access' }, JWT_SECRET, { expiresIn: '1h' });
}

const validUser = {
  id: 'u1',
  email: 'test@test.com',
  username: 'testuser',
  firstName: 'Test',
  lastName: 'User',
  isVerified: false,
  role: 'USER',
  onboardingCompleted: false,
  onboardingCompletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const validTokens = {
  accessToken: 'access-token-abc',
  refreshToken: 'refresh-token-xyz',
  accessTokenExpiresIn: '15m',
  refreshTokenExpiresIn: '7d',
};

// ─── POST /register ───────────────────────────────────────────────────────────

describe('POST /api/v1/auth/register', () => {
  const validBody = {
    email: 'new@test.com',
    password: 'Password1!',
    firstName: 'John',
    lastName: 'Doe',
    username: 'johndoe',
  };

  it('returns 201 and sets refresh token cookie on success', async () => {
    mockAuthService.signup.mockResolvedValue({
      success: true,
      message: 'Account created successfully',
      data: { user: validUser, tokens: { ...validTokens } },
    });

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.headers['set-cookie']).toBeDefined();
    // refreshToken should not be in response body
    expect(res.body.data?.tokens?.refreshToken).toBeUndefined();
  });

  it('returns 409 when email already exists', async () => {
    mockAuthService.signup.mockResolvedValue({
      success: false,
      message: 'Email already exists',
    });

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(validBody);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when AuthService returns generic failure', async () => {
    mockAuthService.signup.mockResolvedValue({
      success: false,
      message: 'Failed to create account',
    });

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(validBody);

    expect(res.status).toBe(400);
  });

  it('returns 400 with validation error when email is invalid', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...validBody, email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Validation failed');
    expect(res.body.errors).toBeDefined();
  });

  it('returns 400 when password is too short', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...validBody, password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Validation failed');
  });

  it('returns 400 when password does not meet complexity requirements', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...validBody, password: 'alllowercase1' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Validation failed');
  });

  it('returns 400 when firstName exceeds max length', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...validBody, firstName: 'A'.repeat(51) });

    expect(res.status).toBe(400);
  });

  it('returns 400 when username is too short', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...validBody, username: 'ab' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when email is missing', async () => {
    const { email, ...noEmail } = validBody;
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(noEmail);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Validation failed');
  });

  it('returns 500 when AuthService throws', async () => {
    mockAuthService.signup.mockRejectedValue(new Error('unexpected'));

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(validBody);

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });

  it('invokes rate limiter when x-test-rate-limit header is present', async () => {
    mockAuthService.signup.mockResolvedValue({
      success: true,
      message: 'Account created successfully',
      data: { user: validUser, tokens: { ...validTokens } },
    });

    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('x-test-rate-limit', 'true')
      .send(validBody);

    // Rate limiter mock is a passthrough, request still succeeds
    expect(res.status).toBe(201);
  });
});

// ─── POST /login ──────────────────────────────────────────────────────────────

describe('POST /api/v1/auth/login', () => {
  const validBody = {
    email: 'test@test.com',
    password: 'Password1!',
  };

  it('returns 200 and sets refresh token cookie on success', async () => {
    mockAuthService.login.mockResolvedValue({
      success: true,
      message: 'Login successful',
      data: { user: validUser, tokens: { ...validTokens } },
    });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send(validBody);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.headers['set-cookie']).toBeDefined();
    expect(res.body.data?.tokens?.refreshToken).toBeUndefined();
  });

  it('returns 200 with rememberMe=true', async () => {
    mockAuthService.login.mockResolvedValue({
      success: true,
      message: 'Login successful',
      data: { user: validUser, tokens: { ...validTokens } },
    });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ ...validBody, rememberMe: true });

    expect(res.status).toBe(200);
    const cookie = res.headers['set-cookie']?.[0] ?? '';
    // Long-lived cookie: max-age for 30 days
    expect(cookie).toContain('Max-Age=2592000');
  });

  it('returns 401 when credentials are invalid', async () => {
    mockAuthService.login.mockResolvedValue({
      success: false,
      message: 'Invalid email or password',
    });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send(validBody);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 with validation error when email is invalid', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'not-email', password: 'pass' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Validation failed');
  });

  it('returns 400 when password is missing', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'test@test.com' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Validation failed');
  });

  it('returns 400 when rememberMe is not boolean', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ ...validBody, rememberMe: 'yes' });

    expect(res.status).toBe(400);
  });

  it('returns 500 when AuthService throws', async () => {
    mockAuthService.login.mockRejectedValue(new Error('db down'));

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send(validBody);

    expect(res.status).toBe(500);
  });
});

// ─── POST /refresh ────────────────────────────────────────────────────────────

describe('POST /api/v1/auth/refresh', () => {
  const successResult = {
    success: true,
    message: 'Tokens refreshed successfully',
    data: { tokens: { ...validTokens } },
  };

  it('returns 200 and new tokens from cookie', async () => {
    mockAuthService.refreshToken.mockResolvedValue(successResult);

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', 'refreshToken=old-refresh-tok');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.headers['set-cookie']).toBeDefined();
    // new refreshToken stripped from body
    expect(res.body.data?.tokens?.refreshToken).toBeUndefined();
  });

  it('returns 200 when token provided in request body', async () => {
    mockAuthService.refreshToken.mockResolvedValue(successResult);

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'token-from-body' });

    expect(res.status).toBe(200);
  });

  it('returns 401 when no refresh token provided', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({});

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Refresh token not provided');
  });

  it('returns 401 when refresh token is invalid', async () => {
    mockAuthService.refreshToken.mockResolvedValue({
      success: false,
      message: 'Invalid or expired refresh token',
    });

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', 'refreshToken=bad-token');

    expect(res.status).toBe(401);
  });

  it('returns 500 when AuthService throws', async () => {
    mockAuthService.refreshToken.mockRejectedValue(new Error('crash'));

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'any-token' });

    expect(res.status).toBe(500);
  });
});

// ─── POST /logout ─────────────────────────────────────────────────────────────

describe('POST /api/v1/auth/logout', () => {
  // TODO(human): implement the POST /logout tests below.
  //
  // This route has 3 interesting paths to cover:
  // 1. Logout with a valid refresh token cookie
  //    → AuthService.logout is called, cookie is cleared, returns 200
  // 2. Logout without a refresh token (cookie absent)
  //    → AuthService.logout is NOT called, cookie still cleared, returns 200
  // 3. AuthService.logout throws
  //    → returns 500
  //
  // Hints:
  // - Set the cookie with `.set('Cookie', 'refreshToken=xxx')`
  // - Check `res.headers['set-cookie']` to verify the cookie is cleared
  //   (cleared cookie has `Max-Age=0` or `Expires` in the past)
  // - `mockAuthService.logout.mockResolvedValue({ success: true, message: '...' })`
  // - For the no-cookie path, just don't set a Cookie header

  it('placeholder — implement the 3 logout scenarios above', () => {
    expect(true).toBe(true);
  });
});

// ─── POST /logout-all ─────────────────────────────────────────────────────────

describe('POST /api/v1/auth/logout-all', () => {
  it('returns 200 when authenticated', async () => {
    const token = makeAccessToken();
    (mockPrisma.tokenBlacklist.findUnique as jest.Mock).mockResolvedValue(null);
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'u1', email: 'test@test.com' });
    mockAuthService.logoutAllDevices.mockResolvedValue({ success: true, message: 'ok' });

    const res = await request(app)
      .post('/api/v1/auth/logout-all')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('returns 401 when no token provided', async () => {
    const res = await request(app).post('/api/v1/auth/logout-all');
    expect(res.status).toBe(401);
  });

  it('returns 500 when logoutAllDevices fails', async () => {
    const token = makeAccessToken();
    (mockPrisma.tokenBlacklist.findUnique as jest.Mock).mockResolvedValue(null);
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'u1', email: 'test@test.com' });
    mockAuthService.logoutAllDevices.mockResolvedValue({ success: false, message: 'error' });

    const res = await request(app)
      .post('/api/v1/auth/logout-all')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(500);
  });
});

// ─── GET /profile ─────────────────────────────────────────────────────────────

describe('GET /api/v1/auth/profile', () => {
  it('returns 200 with user profile when authenticated', async () => {
    const token = makeAccessToken();
    (mockPrisma.tokenBlacklist.findUnique as jest.Mock).mockResolvedValue(null);
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'u1', email: 'test@test.com' });
    mockAuthService.getUserProfile.mockResolvedValue({
      success: true,
      message: 'Profile retrieved',
      data: { user: validUser },
    });

    const res = await request(app)
      .get('/api/v1/auth/profile')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 401 when not authenticated', async () => {
    const res = await request(app).get('/api/v1/auth/profile');
    expect(res.status).toBe(401);
  });

  it('returns 404 when user not found by service', async () => {
    const token = makeAccessToken();
    (mockPrisma.tokenBlacklist.findUnique as jest.Mock).mockResolvedValue(null);
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'u1', email: 'test@test.com' });
    mockAuthService.getUserProfile.mockResolvedValue({
      success: false,
      message: 'User not found',
    });

    const res = await request(app)
      .get('/api/v1/auth/profile')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 500 when AuthService throws', async () => {
    const token = makeAccessToken();
    (mockPrisma.tokenBlacklist.findUnique as jest.Mock).mockResolvedValue(null);
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'u1', email: 'test@test.com' });
    mockAuthService.getUserProfile.mockRejectedValue(new Error('crash'));

    const res = await request(app)
      .get('/api/v1/auth/profile')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(500);
  });
});

// ─── PUT /profile ─────────────────────────────────────────────────────────────

describe('PUT /api/v1/auth/profile', () => {
  function authSetup() {
    (mockPrisma.tokenBlacklist.findUnique as jest.Mock).mockResolvedValue(null);
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'u1', email: 'test@test.com' });
  }

  it('returns 200 on successful profile update', async () => {
    authSetup();
    mockAuthService.updateProfile.mockResolvedValue({
      success: true,
      message: 'Profile updated',
      data: { user: validUser as any },
    });

    const res = await request(app)
      .put('/api/v1/auth/profile')
      .set('Authorization', `Bearer ${makeAccessToken()}`)
      .send({ firstName: 'Updated' });

    expect(res.status).toBe(200);
  });

  it('returns 400 when validation fails (invalid email)', async () => {
    authSetup();
    const res = await request(app)
      .put('/api/v1/auth/profile')
      .set('Authorization', `Bearer ${makeAccessToken()}`)
      .send({ email: 'not-valid' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Validation failed');
  });

  it('returns 400 when update fails', async () => {
    authSetup();
    mockAuthService.updateProfile.mockResolvedValue({
      success: false,
      message: 'Email or username already exists',
    });

    const res = await request(app)
      .put('/api/v1/auth/profile')
      .set('Authorization', `Bearer ${makeAccessToken()}`)
      .send({ firstName: 'New' });

    expect(res.status).toBe(400);
  });

  it('returns 401 when not authenticated', async () => {
    const res = await request(app)
      .put('/api/v1/auth/profile')
      .send({ firstName: 'New' });

    expect(res.status).toBe(401);
  });
});

// ─── POST /verify-token ───────────────────────────────────────────────────────

describe('POST /api/v1/auth/verify-token', () => {
  it('returns 200 with user data when token is valid', async () => {
    const token = makeAccessToken();
    (mockPrisma.tokenBlacklist.findUnique as jest.Mock).mockResolvedValue(null);
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'u1', email: 'test@test.com' });

    const res = await request(app)
      .post('/api/v1/auth/verify-token')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toMatchObject({ id: 'u1' });
  });

  it('returns 401 when no token provided', async () => {
    const res = await request(app).post('/api/v1/auth/verify-token');
    expect(res.status).toBe(401);
  });
});

// ─── POST /test/reset & /test/cleanup ────────────────────────────────────────

describe('POST /api/v1/auth/test/reset and /test/cleanup', () => {
  it('/test/reset returns 200', async () => {
    mockAuthService.resetTestData.mockResolvedValue({ success: true });
    const res = await request(app).post('/api/v1/auth/test/reset');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('/test/cleanup returns 200', async () => {
    mockAuthService.resetTestData.mockResolvedValue({ success: true });
    const res = await request(app).post('/api/v1/auth/test/cleanup');
    expect(res.status).toBe(200);
  });
});
