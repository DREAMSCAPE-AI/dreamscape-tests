/**
 * US-TEST-021 — Auth Middleware Unit Tests
 *
 * Tests for middleware/auth.ts:
 * - authenticateToken
 * - optionalAuth
 */

jest.mock('jsonwebtoken', () => {
  const actual = jest.requireActual('jsonwebtoken');
  const mock = {
    ...actual,
    verify: jest.fn(),
  };
  return { __esModule: true, ...mock, default: mock };
});

jest.mock('@dreamscape/db', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

import express, { Response } from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { prisma } from '@dreamscape/db';
import { authenticateToken, optionalAuth } from '@ai/middleware/auth';

const mockVerify = jwt.verify as jest.Mock;
const mockFindUnique = (prisma as any).user.findUnique as jest.Mock;

beforeEach(() => {
  mockVerify.mockReset();
  mockFindUnique.mockReset();
});

function makeApp(middleware: any) {
  const app = express();
  app.use(express.json());
  app.get('/test', middleware, (req: any, res: Response) => {
    res.status(200).json({ user: req.user ?? null });
  });
  return app;
}

// ─── authenticateToken ────────────────────────────────────────────────────────

describe('authenticateToken', () => {
  const originalSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret';
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalSecret;
    }
  });

  it('should return 401 when Authorization header is missing', async () => {
    const app = makeApp(authenticateToken);
    const res = await request(app).get('/test');

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Access token required');
    expect(res.body.success).toBe(false);
  });

  it('should return 401 when Authorization header has no Bearer token', async () => {
    const app = makeApp(authenticateToken);
    const res = await request(app).get('/test').set('Authorization', 'Bearer ');

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Access token required');
  });

  it('should return 500 when JWT_SECRET is not configured', async () => {
    delete process.env.JWT_SECRET;
    const app = makeApp(authenticateToken);
    const res = await request(app).get('/test').set('Authorization', 'Bearer sometoken');

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('JWT secret not configured');
    expect(res.body.success).toBe(false);
  });

  it('should return 401 when jwt.verify throws JsonWebTokenError', async () => {
    mockVerify.mockImplementation(() => {
      throw new jwt.JsonWebTokenError('invalid signature');
    });

    const app = makeApp(authenticateToken);
    const res = await request(app).get('/test').set('Authorization', 'Bearer badtoken');

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid token');
    expect(res.body.success).toBe(false);
  });

  it('should return 401 when user is not found in DB', async () => {
    mockVerify.mockReturnValue({ userId: 'user-ghost', email: 'ghost@test.com' });
    mockFindUnique.mockResolvedValue(null);

    const app = makeApp(authenticateToken);
    const res = await request(app).get('/test').set('Authorization', 'Bearer validtoken');

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('User not found');
    expect(res.body.success).toBe(false);
  });

  it('should call next() and set req.user on success', async () => {
    const user = { id: 'user-1', email: 'user@test.com' };
    mockVerify.mockReturnValue({ userId: 'user-1', email: 'user@test.com' });
    mockFindUnique.mockResolvedValue(user);

    const app = makeApp(authenticateToken);
    const res = await request(app).get('/test').set('Authorization', 'Bearer goodtoken');

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual(user);
  });

  it('should return 500 on generic (non-JWT) error', async () => {
    mockVerify.mockImplementation(() => {
      throw new Error('Unexpected failure');
    });

    const app = makeApp(authenticateToken);
    const res = await request(app).get('/test').set('Authorization', 'Bearer token');

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Internal server error');
    expect(res.body.success).toBe(false);
  });
});

// ─── optionalAuth ─────────────────────────────────────────────────────────────

describe('optionalAuth', () => {
  const originalSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret';
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalSecret;
    }
  });

  it('should call next() without error when no Authorization header', async () => {
    const app = makeApp(optionalAuth);
    const res = await request(app).get('/test');

    expect(res.status).toBe(200);
    expect(res.body.user).toBeNull();
  });

  it('should call next() when JWT_SECRET is not set', async () => {
    delete process.env.JWT_SECRET;
    const app = makeApp(optionalAuth);
    const res = await request(app).get('/test').set('Authorization', 'Bearer sometoken');

    expect(res.status).toBe(200);
    expect(res.body.user).toBeNull();
  });

  it('should call next() (without error) when token is invalid', async () => {
    mockVerify.mockImplementation(() => {
      throw new jwt.JsonWebTokenError('invalid');
    });

    const app = makeApp(optionalAuth);
    const res = await request(app).get('/test').set('Authorization', 'Bearer badtoken');

    expect(res.status).toBe(200);
    expect(res.body.user).toBeNull();
  });

  it('should call next() when verify throws a generic error (swallowed)', async () => {
    mockVerify.mockImplementation(() => {
      throw new Error('Something broke');
    });

    const app = makeApp(optionalAuth);
    const res = await request(app).get('/test').set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.user).toBeNull();
  });

  it('should set req.user and call next() when user is found', async () => {
    const user = { id: 'user-2', email: 'opt@test.com' };
    mockVerify.mockReturnValue({ userId: 'user-2', email: 'opt@test.com' });
    mockFindUnique.mockResolvedValue(user);

    const app = makeApp(optionalAuth);
    const res = await request(app).get('/test').set('Authorization', 'Bearer validtoken');

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual(user);
  });

  it('should call next() without setting req.user when user is not found', async () => {
    mockVerify.mockReturnValue({ userId: 'user-gone', email: 'gone@test.com' });
    mockFindUnique.mockResolvedValue(null);

    const app = makeApp(optionalAuth);
    const res = await request(app).get('/test').set('Authorization', 'Bearer validtoken');

    expect(res.status).toBe(200);
    expect(res.body.user).toBeNull();
  });
});
