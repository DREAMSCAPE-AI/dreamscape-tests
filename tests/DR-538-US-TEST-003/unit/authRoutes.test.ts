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

// App without cookieParser — used to cover the `if (!req.cookies)` branch in /logout
const appNoCookies = express();
appNoCookies.use(express.json());
appNoCookies.use('/api/v1/auth', authRouter);

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

  it('covers Kafka publishLogin .catch when publishLogin rejects', async () => {
    const KafkaService = require('@services/KafkaService').default;
    KafkaService.publishLogin.mockRejectedValueOnce(new Error('kafka fail'));
    mockAuthService.login.mockResolvedValue({
      success: true,
      message: 'Login successful',
      data: { user: validUser, tokens: { ...validTokens } },
    });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send(validBody);

    // .catch swallows the error — route still returns 200
    expect(res.status).toBe(200);
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

  it('parses refresh token from raw Cookie header when cookieParser is absent', async () => {
    mockAuthService.refreshToken.mockResolvedValue(successResult);

    // appNoCookies has no cookieParser → req.cookies is undefined
    // the route falls back to manually parsing req.headers.cookie (lines 302-306)
    const res = await request(appNoCookies)
      .post('/api/v1/auth/refresh')
      .set('Cookie', 'refreshToken=raw-cookie-token');

    expect(res.status).toBe(200);
    expect(mockAuthService.refreshToken).toHaveBeenCalledWith('raw-cookie-token');
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
  it('returns 200 and clears cookie when refresh token cookie is present', async () => {
    mockAuthService.logout.mockResolvedValue({ success: true, message: 'Logged out successfully' });

    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', 'refreshToken=some-refresh-token');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockAuthService.logout).toHaveBeenCalledWith('some-refresh-token', undefined);
    const cookie = res.headers['set-cookie']?.[0] ?? '';
    expect(cookie).toContain('refreshToken=;');
  });

  it('returns 200 and clears cookie when no refresh token cookie is present', async () => {
    const res = await request(app)
      .post('/api/v1/auth/logout');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockAuthService.logout).not.toHaveBeenCalled();
    const cookie = res.headers['set-cookie']?.[0] ?? '';
    expect(cookie).toContain('refreshToken=;');
  });

  it('publishes Kafka logout event when logout result contains userId', async () => {
    const KafkaService = require('@services/KafkaService').default;
    mockAuthService.logout.mockResolvedValue({
      success: true,
      message: 'Logged out',
      userId: 'u1',
    });

    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', 'refreshToken=tok-with-user');

    expect(res.status).toBe(200);
    expect(KafkaService.publishLogout).toHaveBeenCalled();
  });

  it('covers Kafka publishLogout .catch when publishLogout rejects', async () => {
    const KafkaService = require('@services/KafkaService').default;
    KafkaService.publishLogout.mockRejectedValueOnce(new Error('kafka fail'));
    mockAuthService.logout.mockResolvedValue({
      success: true,
      message: 'Logged out',
      userId: 'u1',
    });

    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', 'refreshToken=tok-with-user');

    // .catch swallows the error — route still returns 200
    expect(res.status).toBe(200);
  });

  it('returns 500 when AuthService.logout throws', async () => {
    mockAuthService.logout.mockRejectedValue(new Error('crash'));

    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', 'refreshToken=some-token');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });

  it('returns 500 with server configuration error when cookieParser is missing', async () => {
    const res = await request(appNoCookies)
      .post('/api/v1/auth/logout');

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Server configuration error');
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

  it('returns 500 when AuthService.logoutAllDevices throws', async () => {
    const token = makeAccessToken();
    (mockPrisma.tokenBlacklist.findUnique as jest.Mock).mockResolvedValue(null);
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'u1', email: 'test@test.com' });
    mockAuthService.logoutAllDevices.mockRejectedValue(new Error('crash'));

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

  it('returns 500 when AuthService.updateProfile throws', async () => {
    authSetup();
    mockAuthService.updateProfile.mockRejectedValue(new Error('crash'));

    const res = await request(app)
      .put('/api/v1/auth/profile')
      .set('Authorization', `Bearer ${makeAccessToken()}`)
      .send({ firstName: 'New' });

    expect(res.status).toBe(500);
  });
});

// ─── POST /change-password ───────────────────────────────────────────────────

describe('POST /api/v1/auth/change-password', () => {
  const validBody = {
    currentPassword: 'OldPass1!',
    newPassword: 'NewPass1!',
  };

  function authSetup() {
    (mockPrisma.tokenBlacklist.findUnique as jest.Mock).mockResolvedValue(null);
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'u1', email: 'test@test.com' });
  }

  it('returns 200 and clears cookie on successful password change', async () => {
    authSetup();
    mockAuthService.changePassword.mockResolvedValue({ success: true, message: 'Password changed' });

    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${makeAccessToken()}`)
      .send(validBody);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const cookie = res.headers['set-cookie']?.[0] ?? '';
    expect(cookie).toContain('refreshToken=;');
  });

  it('covers Kafka publishPasswordChanged .catch when it rejects', async () => {
    authSetup();
    const KafkaService = require('@services/KafkaService').default;
    KafkaService.publishPasswordChanged.mockRejectedValueOnce(new Error('kafka fail'));
    mockAuthService.changePassword.mockResolvedValue({ success: true, message: 'Password changed' });

    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${makeAccessToken()}`)
      .send(validBody);

    expect(res.status).toBe(200);
  });

  it('returns 400 when password change fails', async () => {
    authSetup();
    mockAuthService.changePassword.mockResolvedValue({
      success: false,
      message: 'Current password is incorrect',
    });

    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${makeAccessToken()}`)
      .send(validBody);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when validation fails (newPassword too short)', async () => {
    authSetup();
    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${makeAccessToken()}`)
      .send({ currentPassword: 'OldPass1!', newPassword: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Validation failed');
  });

  it('returns 400 when currentPassword is missing', async () => {
    authSetup();
    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${makeAccessToken()}`)
      .send({ newPassword: 'NewPass1!' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Validation failed');
  });

  it('returns 401 when not authenticated', async () => {
    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .send(validBody);

    expect(res.status).toBe(401);
  });

  it('returns 500 when AuthService.changePassword throws', async () => {
    authSetup();
    mockAuthService.changePassword.mockRejectedValue(new Error('crash'));

    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${makeAccessToken()}`)
      .send(validBody);

    expect(res.status).toBe(500);
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

// ─── if (!req.user) guard coverage ───────────────────────────────────────────
// These defensive guards are unreachable via the real authenticateToken.
// We re-require the router in an isolated module registry with a stub
// authenticateToken that calls next() without setting req.user.

describe('if (!req.user) guard branches', () => {
  let appNoUser: express.Application;

  beforeAll(() => {
    jest.isolateModules(() => {
      jest.mock('@middleware/auth', () => ({
        authenticateToken: (_req: any, _res: any, next: any) => next(),
        authenticateRefreshToken: (_req: any, _res: any, next: any) => next(),
        optionalAuth: (_req: any, _res: any, next: any) => next(),
      }));
      jest.mock('@services/AuthService', () => ({
        AuthService: {
          signup: jest.fn(), login: jest.fn(), refreshToken: jest.fn(),
          logout: jest.fn(), logoutAllDevices: jest.fn(),
          getUserProfile: jest.fn(), updateProfile: jest.fn(),
          changePassword: jest.fn(), verifyToken: jest.fn(), resetTestData: jest.fn(),
        },
      }));
      jest.mock('@services/KafkaService', () => ({
        __esModule: true,
        default: {
          publishLogin: jest.fn().mockResolvedValue(undefined),
          publishLogout: jest.fn().mockResolvedValue(undefined),
          publishPasswordChanged: jest.fn().mockResolvedValue(undefined),
        },
      }));
      jest.mock('@middleware/rateLimiter', () => ({
        loginLimiter: (_req: any, _res: any, next: any) => next(),
        registerLimiter: (_req: any, _res: any, next: any) => next(),
        refreshLimiter: (_req: any, _res: any, next: any) => next(),
        authLimiter: (_req: any, _res: any, next: any) => next(),
      }));
      const freshRouter = require('../../../../dreamscape-services/auth/src/routes/auth').default;
      appNoUser = express();
      appNoUser.use(express.json());
      appNoUser.use(cookieParser());
      appNoUser.use('/api/v1/auth', freshRouter);
    });
  });

  it('GET /profile returns 401 when req.user is not set', async () => {
    const res = await request(appNoUser).get('/api/v1/auth/profile');
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('User not authenticated');
  });

  it('PUT /profile returns 401 when req.user is not set', async () => {
    const res = await request(appNoUser)
      .put('/api/v1/auth/profile')
      .send({ firstName: 'Test' });
    expect(res.status).toBe(401);
  });

  it('POST /change-password returns 401 when req.user is not set', async () => {
    const res = await request(appNoUser)
      .post('/api/v1/auth/change-password')
      .send({ currentPassword: 'OldPass1!', newPassword: 'NewPass1!' });
    expect(res.status).toBe(401);
  });

  it('POST /logout-all returns 401 when req.user is not set', async () => {
    const res = await request(appNoUser).post('/api/v1/auth/logout-all');
    expect(res.status).toBe(401);
  });
});
