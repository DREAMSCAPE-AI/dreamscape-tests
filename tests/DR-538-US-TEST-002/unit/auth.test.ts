import { prisma } from '@dreamscape/db';
import jwt from 'jsonwebtoken';
import {
  authenticateToken,
  optionalAuth,
  authenticateRefreshToken,
  AuthRequest,
} from '../../.././../dreamscape-services/auth/src/middleware/auth';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

function makeReq(overrides: Partial<AuthRequest> = {}): AuthRequest {
  return {
    headers: {},
    cookies: {},
    body: {},
    ...overrides,
  } as AuthRequest;
}

function makeRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

const JWT_SECRET = 'test-secret';
const JWT_REFRESH_SECRET = 'test-refresh-secret';

beforeEach(() => {
  process.env.JWT_SECRET = JWT_SECRET;
  process.env.JWT_REFRESH_SECRET = JWT_REFRESH_SECRET;
});

function signAccess(payload: object = {}) {
  return jwt.sign({ userId: 'u1', email: 'a@b.com', type: 'access', ...payload }, JWT_SECRET, { expiresIn: '1h' });
}
function signRefresh(payload: object = {}) {
  return jwt.sign({ userId: 'u1', email: 'a@b.com', type: 'refresh', ...payload }, JWT_REFRESH_SECRET, { expiresIn: '7d' });
}

// ─── authenticateToken ───────────────────────────────────────────────────────

describe('authenticateToken', () => {
  it('returns 401 when no Authorization header', async () => {
    const req = makeReq({ headers: {} });
    const res = makeRes();
    const next = jest.fn();
    await authenticateToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'TOKEN_MISSING' }));
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when token is blacklisted', async () => {
    const token = signAccess();
    const req = makeReq({ headers: { authorization: `Bearer ${token}` } });
    const res = makeRes();
    const next = jest.fn();
    (mockPrisma.tokenBlacklist.findUnique as jest.Mock).mockResolvedValue({ token });
    await authenticateToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'TOKEN_REVOKED' }));
  });

  it('returns 500 when JWT_SECRET is missing', async () => {
    delete process.env.JWT_SECRET;
    const token = 'any.token.here';
    const req = makeReq({ headers: { authorization: `Bearer ${token}` } });
    const res = makeRes();
    const next = jest.fn();
    (mockPrisma.tokenBlacklist.findUnique as jest.Mock).mockResolvedValue(null);
    await authenticateToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('returns 401 when token type is not access', async () => {
    const token = signRefresh();
    const req = makeReq({ headers: { authorization: `Bearer ${token}` } });
    const res = makeRes();
    const next = jest.fn();
    (mockPrisma.tokenBlacklist.findUnique as jest.Mock).mockResolvedValue(null);
    // JWT_REFRESH_SECRET !== JWT_SECRET, so jwt.verify with JWT_SECRET will throw
    await authenticateToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 401 when token type field is wrong but signed with access secret', async () => {
    const token = jwt.sign({ userId: 'u1', email: 'a@b.com', type: 'refresh' }, JWT_SECRET, { expiresIn: '1h' });
    const req = makeReq({ headers: { authorization: `Bearer ${token}` } });
    const res = makeRes();
    const next = jest.fn();
    (mockPrisma.tokenBlacklist.findUnique as jest.Mock).mockResolvedValue(null);
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    await authenticateToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_TOKEN_TYPE' }));
  });

  it('returns 401 when user not found', async () => {
    const token = signAccess();
    const req = makeReq({ headers: { authorization: `Bearer ${token}` } });
    const res = makeRes();
    const next = jest.fn();
    (mockPrisma.tokenBlacklist.findUnique as jest.Mock).mockResolvedValue(null);
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    await authenticateToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'USER_INACTIVE' }));
  });

  it('calls next and sets req.user when valid', async () => {
    const token = signAccess();
    const req = makeReq({ headers: { authorization: `Bearer ${token}` } });
    const res = makeRes();
    const next = jest.fn();
    (mockPrisma.tokenBlacklist.findUnique as jest.Mock).mockResolvedValue(null);
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'u1', email: 'a@b.com' });
    await authenticateToken(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual({ id: 'u1', email: 'a@b.com' });
  });

  it('returns 401 with TOKEN_EXPIRED when token is expired', async () => {
    const token = jwt.sign({ userId: 'u1', email: 'a@b.com', type: 'access' }, JWT_SECRET, { expiresIn: -1 });
    const req = makeReq({ headers: { authorization: `Bearer ${token}` } });
    const res = makeRes();
    const next = jest.fn();
    (mockPrisma.tokenBlacklist.findUnique as jest.Mock).mockResolvedValue(null);
    await authenticateToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'TOKEN_EXPIRED' }));
  });

  it('returns 401 with INVALID_TOKEN when token is malformed', async () => {
    const req = makeReq({ headers: { authorization: 'Bearer not.a.real.jwt' } });
    const res = makeRes();
    const next = jest.fn();
    (mockPrisma.tokenBlacklist.findUnique as jest.Mock).mockResolvedValue(null);
    await authenticateToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_TOKEN' }));
  });

  it('returns 500 when an unexpected error occurs', async () => {
    const token = signAccess();
    const req = makeReq({ headers: { authorization: `Bearer ${token}` } });
    const res = makeRes();
    const next = jest.fn();
    (mockPrisma.tokenBlacklist.findUnique as jest.Mock).mockRejectedValue(new Error('DB down'));
    await authenticateToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─── optionalAuth ─────────────────────────────────────────────────────────────

describe('optionalAuth', () => {
  it('calls next immediately when no token provided', async () => {
    const req = makeReq({ headers: {} });
    const res = makeRes();
    const next = jest.fn();
    await optionalAuth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toBeUndefined();
  });

  it('calls next without setting user when token is blacklisted', async () => {
    const token = signAccess();
    const req = makeReq({ headers: { authorization: `Bearer ${token}` } });
    const res = makeRes();
    const next = jest.fn();
    (mockPrisma.tokenBlacklist.findUnique as jest.Mock).mockResolvedValue({ token });
    await optionalAuth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toBeUndefined();
  });

  it('calls next without user when JWT_SECRET missing', async () => {
    delete process.env.JWT_SECRET;
    const token = signAccess();
    const req = makeReq({ headers: { authorization: `Bearer ${token}` } });
    const res = makeRes();
    const next = jest.fn();
    (mockPrisma.tokenBlacklist.findUnique as jest.Mock).mockResolvedValue(null);
    await optionalAuth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toBeUndefined();
  });

  it('sets req.user when valid access token', async () => {
    const token = signAccess();
    const req = makeReq({ headers: { authorization: `Bearer ${token}` } });
    const res = makeRes();
    const next = jest.fn();
    (mockPrisma.tokenBlacklist.findUnique as jest.Mock).mockResolvedValue(null);
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'u1', email: 'a@b.com' });
    await optionalAuth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual({ id: 'u1', email: 'a@b.com' });
  });

  it('calls next without user when user not found', async () => {
    const token = signAccess();
    const req = makeReq({ headers: { authorization: `Bearer ${token}` } });
    const res = makeRes();
    const next = jest.fn();
    (mockPrisma.tokenBlacklist.findUnique as jest.Mock).mockResolvedValue(null);
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    await optionalAuth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toBeUndefined();
  });

  it('calls next on token error (error catch → next)', async () => {
    const req = makeReq({ headers: { authorization: 'Bearer bad.token' } });
    const res = makeRes();
    const next = jest.fn();
    (mockPrisma.tokenBlacklist.findUnique as jest.Mock).mockResolvedValue(null);
    await optionalAuth(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

// ─── authenticateRefreshToken ─────────────────────────────────────────────────

describe('authenticateRefreshToken', () => {
  it('returns 401 when no refresh token', async () => {
    const req = makeReq({ cookies: {}, body: {} });
    const res = makeRes();
    const next = jest.fn();
    await authenticateRefreshToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'REFRESH_TOKEN_MISSING' }));
  });

  it('returns 500 when JWT secret not configured', async () => {
    delete process.env.JWT_SECRET;
    delete process.env.JWT_REFRESH_SECRET;
    const req = makeReq({ cookies: {}, body: { refreshToken: 'any' } });
    const res = makeRes();
    const next = jest.fn();
    await authenticateRefreshToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('returns 401 when token type is not refresh', async () => {
    const token = jwt.sign({ userId: 'u1', email: 'a@b.com', type: 'access' }, JWT_REFRESH_SECRET, { expiresIn: '1h' });
    const req = makeReq({ cookies: { refreshToken: token }, body: {} });
    const res = makeRes();
    const next = jest.fn();
    await authenticateRefreshToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_REFRESH_TOKEN' }));
  });

  it('returns 401 when session not found in DB', async () => {
    const token = signRefresh();
    const req = makeReq({ cookies: { refreshToken: token }, body: {} });
    const res = makeRes();
    const next = jest.fn();
    (mockPrisma.session.findFirst as jest.Mock).mockResolvedValue(null);
    await authenticateRefreshToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('calls next and sets req.user when valid', async () => {
    const token = signRefresh();
    const req = makeReq({ cookies: { refreshToken: token }, body: {} });
    const res = makeRes();
    const next = jest.fn();
    (mockPrisma.session.findFirst as jest.Mock).mockResolvedValue({
      id: 's1',
      user: { id: 'u1', email: 'a@b.com' }
    });
    await authenticateRefreshToken(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual({ id: 'u1', email: 'a@b.com' });
  });

  it('picks refresh token from body when cookie missing', async () => {
    const token = signRefresh();
    const req = makeReq({ cookies: {}, body: { refreshToken: token } });
    const res = makeRes();
    const next = jest.fn();
    (mockPrisma.session.findFirst as jest.Mock).mockResolvedValue({
      id: 's1',
      user: { id: 'u1', email: 'a@b.com' }
    });
    await authenticateRefreshToken(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('returns 401 with REFRESH_TOKEN_EXPIRED on expired token', async () => {
    const token = jwt.sign({ userId: 'u1', email: 'a@b.com', type: 'refresh' }, JWT_REFRESH_SECRET, { expiresIn: -1 });
    const req = makeReq({ cookies: { refreshToken: token }, body: {} });
    const res = makeRes();
    const next = jest.fn();
    await authenticateRefreshToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'REFRESH_TOKEN_EXPIRED' }));
  });

  it('returns 401 with INVALID_REFRESH_TOKEN on malformed token', async () => {
    const req = makeReq({ cookies: { refreshToken: 'bad.token' }, body: {} });
    const res = makeRes();
    const next = jest.fn();
    await authenticateRefreshToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_REFRESH_TOKEN' }));
  });

  it('returns 500 on unexpected DB error', async () => {
    const token = signRefresh();
    const req = makeReq({ cookies: { refreshToken: token }, body: {} });
    const res = makeRes();
    const next = jest.fn();
    (mockPrisma.session.findFirst as jest.Mock).mockRejectedValue(new Error('DB down'));
    await authenticateRefreshToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
