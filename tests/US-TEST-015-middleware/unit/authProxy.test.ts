/**
 * US-TEST-015 — Tests unitaires authProxy middleware
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

process.env.VITE_AUTH_SERVICE_URL = 'http://auth.test';

// ── Mock axios ─────────────────────────────────────────────────────────────────
const mockAxiosPost    = jest.fn();
const mockIsAxiosError = jest.fn();

function axiosMockFactory() {
  return {
    __esModule:   true,
    default: {
      post:         mockAxiosPost,
      isAxiosError: mockIsAxiosError,
    },
    post:         mockAxiosPost,
    isAxiosError: mockIsAxiosError,
  };
}

jest.mock('axios', axiosMockFactory);

// ── Import middleware ──────────────────────────────────────────────────────────
import {
  authenticateToken,
  optionalAuth,
} from '@/middleware/authProxy';

// ── Helpers ────────────────────────────────────────────────────────────────────
function buildReqResMock(authHeader?: string) {
  const req: any = {
    headers: authHeader ? { authorization: authHeader } : {},
  };
  const res: any = {
    _status: 200,
    _body:   null as any,
    status(code: number) { this._status = code; return this; },
    json(body: any)      { this._body = body;   return this; },
    set:     jest.fn(),
  };
  const next = jest.fn();
  return { req, res, next };
}

const mockUser = { id: 'user-001', email: 'alice@test.com' };

// ── Tests ───────────────────────────────────────────────────────────────────────
describe('authProxy — US-TEST-015', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAxiosError.mockImplementation((e: any) => Boolean(e?.isAxiosError));
  });

  // ── authenticateToken ────────────────────────────────────────────────────
  describe('authenticateToken', () => {
    it('should call next() and attach user to req when token is valid', async () => {
      mockAxiosPost.mockResolvedValue({
        data: { success: true, data: { user: mockUser } },
      } as never);

      const { req, res, next } = buildReqResMock('Bearer valid-token');

      await authenticateToken(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toEqual(mockUser);
    });

    it('should return 401 when Authorization header is missing', async () => {
      const { req, res, next } = buildReqResMock();

      await authenticateToken(req, res, next);

      expect(res._status).toBe(401);
      expect(res._body).toMatchObject({ success: false });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 when auth-service returns success:false', async () => {
      mockAxiosPost.mockResolvedValue({
        data: { success: false, data: { user: null } },
      } as never);

      const { req, res, next } = buildReqResMock('Bearer bad-token');

      await authenticateToken(req, res, next);

      expect(res._status).toBe(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 when auth-service responds with 401', async () => {
      const err: any = new Error('Unauthorized');
      err.isAxiosError = true;
      err.response = { status: 401 };
      mockAxiosPost.mockRejectedValue(err as never);

      const { req, res, next } = buildReqResMock('Bearer expired-token');

      await authenticateToken(req, res, next);

      expect(res._status).toBe(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 503 when auth-service is unreachable (ECONNREFUSED)', async () => {
      const err: any = new Error('Connection refused');
      err.isAxiosError = true;
      err.code         = 'ECONNREFUSED';
      err.response     = undefined;
      mockAxiosPost.mockRejectedValue(err as never);

      const { req, res, next } = buildReqResMock('Bearer some-token');

      await authenticateToken(req, res, next);

      expect(res._status).toBe(503);
      expect(next).not.toHaveBeenCalled();
    });

    it('should call auth-service with Bearer token', async () => {
      mockAxiosPost.mockResolvedValue({
        data: { success: true, data: { user: mockUser } },
      } as never);

      const { req, res, next } = buildReqResMock('Bearer my-jwt-token');

      await authenticateToken(req, res, next);

      expect(mockAxiosPost).toHaveBeenCalledWith(
        expect.stringContaining('/v1/auth/verify-token'),
        {},
        expect.objectContaining({
          headers: { Authorization: 'Bearer my-jwt-token' },
          timeout: 5000,
        })
      );
    });
  });

  // ── optionalAuth ─────────────────────────────────────────────────────────
  describe('optionalAuth', () => {
    it('should call next() without user when no token is provided', async () => {
      const { req, res, next } = buildReqResMock();

      await optionalAuth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeUndefined();
    });

    it('should attach user when token is valid', async () => {
      mockAxiosPost.mockResolvedValue({
        data: { success: true, data: { user: mockUser } },
      } as never);

      const { req, res, next } = buildReqResMock('Bearer valid-token');

      await optionalAuth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toEqual(mockUser);
    });

    it('should call next() without error when token is invalid', async () => {
      const err: any = new Error('Invalid');
      err.isAxiosError = true;
      err.response     = { status: 401 };
      mockAxiosPost.mockRejectedValue(err as never);

      const { req, res, next } = buildReqResMock('Bearer invalid-token');

      await optionalAuth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeUndefined();
    });

    it('should call next() without error when auth-service is down', async () => {
      const err: any = new Error('ECONNREFUSED');
      err.isAxiosError = true;
      err.code         = 'ECONNREFUSED';
      mockAxiosPost.mockRejectedValue(err as never);

      const { req, res, next } = buildReqResMock('Bearer some-token');

      await optionalAuth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeUndefined();
    });
  });
});
