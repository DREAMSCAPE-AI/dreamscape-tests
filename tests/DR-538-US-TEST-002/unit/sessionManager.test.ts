import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import mockRedisClient, { mockRawClient } from '../../../../dreamscape-tests/__mocks__/redis';
import {
  SessionManager,
  validateSession,
} from '../../../../dreamscape-services/auth/src/middleware/sessionManager';

const mockRedis = mockRedisClient as jest.Mocked<typeof mockRedisClient>;
const mockRaw = mockRawClient as jest.Mocked<typeof mockRawClient>;

const SESSION_DATA = {
  userId: 'u1',
  email: 'test@test.com',
  createdAt: Date.now(),
  lastActivity: Date.now(),
  ipAddress: '127.0.0.1',
  userAgent: 'jest',
};

function makeReq(overrides: any = {}): Request {
  return {
    ip: '127.0.0.1',
    get: jest.fn().mockReturnValue('jest-agent'),
    headers: {},
    ...overrides,
  } as unknown as Request;
}

function makeRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  (mockRedis.get as jest.Mock).mockResolvedValue(null);
  (mockRedis.set as jest.Mock).mockResolvedValue(true);
  (mockRedis.del as jest.Mock).mockResolvedValue(1);
  (mockRedis.exists as jest.Mock).mockResolvedValue(false);
  (mockRedis.expire as jest.Mock).mockResolvedValue(true);
  (mockRedis.getClient as jest.Mock).mockReturnValue(mockRaw);
  (mockRaw.sAdd as jest.Mock).mockResolvedValue(1);
  (mockRaw.sRem as jest.Mock).mockResolvedValue(1);
  (mockRaw.sMembers as jest.Mock).mockResolvedValue([]);
});

// ─── createSession ────────────────────────────────────────────────────────────

describe('SessionManager.createSession', () => {
  it('returns true on successful session creation', async () => {
    (mockRedis.set as jest.Mock).mockResolvedValue(true);
    const req = makeReq();
    const result = await SessionManager.createSession('u1', 'test@test.com', 'tok1', req);
    expect(result).toBe(true);
    expect(mockRedis.set).toHaveBeenCalledWith(
      'session:tok1',
      expect.stringContaining('"userId":"u1"'),
      86400
    );
  });

  it('adds token to user sessions set via sAdd', async () => {
    const req = makeReq();
    await SessionManager.createSession('u1', 'test@test.com', 'tok1', req);
    expect(mockRaw.sAdd).toHaveBeenCalledWith('user_sessions:u1', 'tok1');
  });

  it('returns false when Redis.set fails', async () => {
    (mockRedis.set as jest.Mock).mockResolvedValue(false);
    const req = makeReq();
    const result = await SessionManager.createSession('u1', 'test@test.com', 'tok1', req);
    expect(result).toBe(false);
  });

  it('skips sAdd when getClient returns null', async () => {
    (mockRedis.getClient as jest.Mock).mockReturnValue(null);
    const req = makeReq();
    await SessionManager.createSession('u1', 'test@test.com', 'tok1', req);
    expect(mockRaw.sAdd).not.toHaveBeenCalled();
  });

  it('returns false on Redis error', async () => {
    (mockRedis.set as jest.Mock).mockRejectedValue(new Error('Redis down'));
    const req = makeReq();
    const result = await SessionManager.createSession('u1', 'test@test.com', 'tok1', req);
    expect(result).toBe(false);
  });
});

// ─── getSession ───────────────────────────────────────────────────────────────

describe('SessionManager.getSession', () => {
  it('returns parsed session data when found', async () => {
    (mockRedis.get as jest.Mock).mockResolvedValue(JSON.stringify(SESSION_DATA));
    const result = await SessionManager.getSession('tok1');
    expect(result).toMatchObject({ userId: 'u1', email: 'test@test.com' });
  });

  it('returns null when session not found', async () => {
    const result = await SessionManager.getSession('tok1');
    expect(result).toBeNull();
  });

  it('returns null on Redis error', async () => {
    (mockRedis.get as jest.Mock).mockRejectedValue(new Error('fail'));
    const result = await SessionManager.getSession('tok1');
    expect(result).toBeNull();
  });
});

// ─── updateSessionActivity ────────────────────────────────────────────────────

describe('SessionManager.updateSessionActivity', () => {
  it('returns false when session not found', async () => {
    const result = await SessionManager.updateSessionActivity('tok1');
    expect(result).toBe(false);
  });

  it('updates lastActivity and returns true', async () => {
    (mockRedis.get as jest.Mock).mockResolvedValue(JSON.stringify(SESSION_DATA));
    (mockRedis.set as jest.Mock).mockResolvedValue(true);
    const before = SESSION_DATA.lastActivity;
    const result = await SessionManager.updateSessionActivity('tok1');
    expect(result).toBe(true);
    const savedArg = JSON.parse((mockRedis.set as jest.Mock).mock.calls[0][1]);
    expect(savedArg.lastActivity).toBeGreaterThanOrEqual(before);
  });

  it('returns false when Redis.set throws after session found', async () => {
    (mockRedis.get as jest.Mock).mockResolvedValue(JSON.stringify(SESSION_DATA));
    (mockRedis.set as jest.Mock).mockRejectedValue(new Error('set fail'));
    const result = await SessionManager.updateSessionActivity('tok1');
    expect(result).toBe(false);
  });

  it('returns false on Redis.get error', async () => {
    (mockRedis.get as jest.Mock).mockRejectedValue(new Error('fail'));
    const result = await SessionManager.updateSessionActivity('tok1');
    expect(result).toBe(false);
  });
});

// ─── deleteSession ────────────────────────────────────────────────────────────

describe('SessionManager.deleteSession', () => {
  it('deletes the session key', async () => {
    await SessionManager.deleteSession('tok1', 'u1');
    expect(mockRedis.del).toHaveBeenCalledWith('session:tok1');
  });

  it('calls sRem to remove token from user session set', async () => {
    await SessionManager.deleteSession('tok1', 'u1');
    expect(mockRaw.sRem).toHaveBeenCalledWith('user_sessions:u1', 'tok1');
  });

  it('looks up userId from session when not provided', async () => {
    (mockRedis.get as jest.Mock).mockResolvedValue(JSON.stringify(SESSION_DATA));
    await SessionManager.deleteSession('tok1');
    expect(mockRaw.sRem).toHaveBeenCalledWith('user_sessions:u1', 'tok1');
  });

  it('skips sRem when getClient returns null', async () => {
    (mockRedis.getClient as jest.Mock).mockReturnValue(null);
    await SessionManager.deleteSession('tok1', 'u1');
    expect(mockRaw.sRem).not.toHaveBeenCalled();
  });

  it('returns true on success', async () => {
    const result = await SessionManager.deleteSession('tok1', 'u1');
    expect(result).toBe(true);
  });

  it('returns false on Redis error', async () => {
    (mockRedis.del as jest.Mock).mockRejectedValue(new Error('fail'));
    const result = await SessionManager.deleteSession('tok1', 'u1');
    expect(result).toBe(false);
  });
});

// ─── deleteAllUserSessions ────────────────────────────────────────────────────

describe('SessionManager.deleteAllUserSessions', () => {
  it('returns false when getClient returns null', async () => {
    (mockRedis.getClient as jest.Mock).mockReturnValue(null);
    const result = await SessionManager.deleteAllUserSessions('u1');
    expect(result).toBe(false);
  });

  it('deletes each session and the user sessions set', async () => {
    (mockRaw.sMembers as jest.Mock).mockResolvedValue(['tok1', 'tok2']);
    const result = await SessionManager.deleteAllUserSessions('u1');
    expect(mockRedis.del).toHaveBeenCalledWith('session:tok1');
    expect(mockRedis.del).toHaveBeenCalledWith('session:tok2');
    expect(mockRedis.del).toHaveBeenCalledWith('user_sessions:u1');
    expect(result).toBe(true);
  });

  it('returns true when no sessions exist for user', async () => {
    (mockRaw.sMembers as jest.Mock).mockResolvedValue([]);
    const result = await SessionManager.deleteAllUserSessions('u1');
    expect(result).toBe(true);
  });

  it('returns false on error', async () => {
    (mockRaw.sMembers as jest.Mock).mockRejectedValue(new Error('fail'));
    const result = await SessionManager.deleteAllUserSessions('u1');
    expect(result).toBe(false);
  });
});

// ─── getUserSessions ──────────────────────────────────────────────────────────

describe('SessionManager.getUserSessions', () => {
  it('returns empty array when getClient returns null', async () => {
    (mockRedis.getClient as jest.Mock).mockReturnValue(null);
    const result = await SessionManager.getUserSessions('u1');
    expect(result).toEqual([]);
  });

  it('returns active sessions data', async () => {
    (mockRaw.sMembers as jest.Mock).mockResolvedValue(['tok1', 'tok2']);
    (mockRedis.get as jest.Mock)
      .mockResolvedValueOnce(JSON.stringify(SESSION_DATA))
      .mockResolvedValueOnce(JSON.stringify({ ...SESSION_DATA, userId: 'u1', email: 'other@b.com' }));
    const result = await SessionManager.getUserSessions('u1');
    expect(result).toHaveLength(2);
  });

  it('skips tokens with no session data', async () => {
    (mockRaw.sMembers as jest.Mock).mockResolvedValue(['tok1', 'tok2']);
    (mockRedis.get as jest.Mock)
      .mockResolvedValueOnce(JSON.stringify(SESSION_DATA))
      .mockResolvedValueOnce(null);
    const result = await SessionManager.getUserSessions('u1');
    expect(result).toHaveLength(1);
  });

  it('returns empty array on error', async () => {
    (mockRaw.sMembers as jest.Mock).mockRejectedValue(new Error('fail'));
    const result = await SessionManager.getUserSessions('u1');
    expect(result).toEqual([]);
  });
});

// ─── isTokenBlacklisted ───────────────────────────────────────────────────────

describe('SessionManager.isTokenBlacklisted', () => {
  it('returns false when token not in blacklist', async () => {
    (mockRedis.exists as jest.Mock).mockResolvedValue(false);
    const result = await SessionManager.isTokenBlacklisted('tok1');
    expect(result).toBe(false);
  });

  it('returns true when token is blacklisted', async () => {
    (mockRedis.exists as jest.Mock).mockResolvedValue(true);
    const result = await SessionManager.isTokenBlacklisted('tok1');
    expect(result).toBe(true);
  });

  it('checks blacklist: prefixed key', async () => {
    await SessionManager.isTokenBlacklisted('tok1');
    expect(mockRedis.exists).toHaveBeenCalledWith('blacklist:tok1');
  });

  it('returns false on Redis error', async () => {
    (mockRedis.exists as jest.Mock).mockRejectedValue(new Error('fail'));
    const result = await SessionManager.isTokenBlacklisted('tok1');
    expect(result).toBe(false);
  });
});

// ─── blacklistToken ───────────────────────────────────────────────────────────

describe('SessionManager.blacklistToken', () => {
  it('uses provided TTL directly', async () => {
    await SessionManager.blacklistToken('tok1', 300);
    expect(mockRedis.set).toHaveBeenCalledWith('blacklist:tok1', '1', 300);
  });

  it('extracts TTL from JWT exp when no TTL provided', async () => {
    const futureExp = Math.floor(Date.now() / 1000) + 600;
    const token = jwt.sign({ exp: futureExp }, 'secret');
    await SessionManager.blacklistToken(token);
    const call = (mockRedis.set as jest.Mock).mock.calls[0];
    expect(call[0]).toBe(`blacklist:${token}`);
    expect(call[2]).toBeGreaterThan(0);
    expect(call[2]).toBeLessThanOrEqual(600);
  });

  it('falls back to SESSION_TTL when token has no exp', async () => {
    await SessionManager.blacklistToken('not-a-jwt');
    const call = (mockRedis.set as jest.Mock).mock.calls[0];
    expect(call[2]).toBe(86400);
  });

  it('falls back to SESSION_TTL when jwt.decode throws', async () => {
    const jwtModule = require('jsonwebtoken');
    jest.spyOn(jwtModule, 'decode').mockImplementationOnce(() => { throw new Error('decode error'); });
    await SessionManager.blacklistToken('any-token');
    const call = (mockRedis.set as jest.Mock).mock.calls[0];
    expect(call[2]).toBe(86400);
  });

  it('returns false on Redis error', async () => {
    (mockRedis.set as jest.Mock).mockRejectedValue(new Error('fail'));
    const result = await SessionManager.blacklistToken('tok1', 60);
    expect(result).toBe(false);
  });
});

// ─── validateSession middleware ───────────────────────────────────────────────

describe('validateSession middleware', () => {
  it('returns 401 when no token in Authorization header', async () => {
    const req = makeReq({ headers: {} });
    const res = makeRes();
    const next = jest.fn();

    await validateSession(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'No token provided' });
  });

  it('returns 401 when token is blacklisted', async () => {
    const req = makeReq({ headers: { authorization: 'Bearer tok-blacklisted' } });
    const res = makeRes();
    const next = jest.fn();
    (mockRedis.exists as jest.Mock).mockResolvedValue(true);
    await validateSession(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token has been revoked' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when session not found in Redis', async () => {
    const req = makeReq({ headers: { authorization: 'Bearer tok-no-session' } });
    const res = makeRes();
    const next = jest.fn();
    (mockRedis.exists as jest.Mock).mockResolvedValue(false);
    (mockRedis.get as jest.Mock).mockResolvedValue(null);
    await validateSession(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired session' });
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next and attaches session data when valid', async () => {
    const req = makeReq({ headers: { authorization: 'Bearer tok-valid' } });
    const res = makeRes();
    const next = jest.fn();
    (mockRedis.exists as jest.Mock).mockResolvedValue(false);
    (mockRedis.get as jest.Mock).mockResolvedValue(JSON.stringify(SESSION_DATA));
    (mockRedis.set as jest.Mock).mockResolvedValue(true);
    await validateSession(req, res, next);
    expect(next).toHaveBeenCalled();
    expect((req as any).session).toMatchObject({ userId: 'u1', email: 'test@test.com' });
  });

  it('returns 500 on unexpected error', async () => {
    const req = makeReq({ headers: { authorization: 'Bearer tok-error' } });
    const res = makeRes();
    const next = jest.fn();
    // SessionManager methods catch their own errors internally, so we spy directly
    // on the static method to simulate an unhandled exception reaching validateSession
    jest.spyOn(SessionManager, 'isTokenBlacklisted').mockRejectedValueOnce(new Error('unexpected'));
    await validateSession(req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});
