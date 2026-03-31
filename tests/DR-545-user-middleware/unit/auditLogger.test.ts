import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { EventEmitter } from 'events';
import { NextFunction } from 'express';

// Mock Prisma
const mockDataAccessLogCreate = jest.fn();
jest.mock('@dreamscape/db', () => ({
  prisma: {
    dataAccessLog: {
      create: mockDataAccessLogCreate,
    },
  },
}));

import { auditLogger } from '../../../../dreamscape-services/user/src/middleware/auditLogger';

// Helper: create a mock response that extends EventEmitter
const createMockRes = () => {
  const res = new EventEmitter() as any;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

// Helper: create an authenticated mock request
const createAuthReq = (overrides: any = {}) => ({
  user: { id: 'user-123', email: 'test@example.com' },
  originalUrl: '/api/v1/users/profile',
  method: 'GET',
  ip: '127.0.0.1',
  socket: { remoteAddress: '127.0.0.1' },
  headers: { 'user-agent': 'jest-test-agent' },
  ...overrides,
});

// Helper: trigger res.finish and wait for async listener
const triggerFinish = async (res: any) => {
  res.emit('finish');
  await new Promise(resolve => setTimeout(resolve, 20));
};

describe('auditLogger middleware', () => {
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockNext = jest.fn();
    mockDataAccessLogCreate.mockResolvedValue({} as never);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('next() call behaviour', () => {
    it('should call next() immediately for audited routes', () => {
      const req = createAuthReq();
      const res = createMockRes();

      auditLogger(req, res, mockNext as NextFunction);

      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should call next() immediately for non-audited routes', () => {
      const req = createAuthReq({ originalUrl: '/api/v1/health' });
      const res = createMockRes();

      auditLogger(req, res, mockNext as NextFunction);

      expect(mockNext).toHaveBeenCalledTimes(1);
    });
  });

  describe('audit log creation', () => {
    it('should create a log entry for GET /api/v1/users/profile', async () => {
      const req = createAuthReq({ originalUrl: '/api/v1/users/profile', method: 'GET' });
      const res = createMockRes();

      auditLogger(req, res, mockNext as NextFunction);
      await triggerFinish(res);

      expect(mockDataAccessLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          accessorId: 'user-123',
          accessorType: 'user',
          action: 'READ',
          resource: 'UserProfile',
          ipAddress: '127.0.0.1',
          userAgent: 'jest-test-agent',
          endpoint: '/api/v1/users/profile',
          method: 'GET',
        }),
      });
    });

    it('should create a log entry for /api/v1/users/favorites', async () => {
      const req = createAuthReq({ originalUrl: '/api/v1/users/favorites', method: 'GET' });
      const res = createMockRes();

      auditLogger(req, res, mockNext as NextFunction);
      await triggerFinish(res);

      expect(mockDataAccessLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ resource: 'Favorite', action: 'READ' }),
      });
    });

    it('should create a log entry for /api/v1/users/history', async () => {
      const req = createAuthReq({ originalUrl: '/api/v1/users/history', method: 'DELETE' });
      const res = createMockRes();

      auditLogger(req, res, mockNext as NextFunction);
      await triggerFinish(res);

      expect(mockDataAccessLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ resource: 'UserHistory', action: 'DELETE' }),
      });
    });

    it('should create a log entry for /api/v1/users/onboarding', async () => {
      const req = createAuthReq({ originalUrl: '/api/v1/users/onboarding', method: 'PUT' });
      const res = createMockRes();

      auditLogger(req, res, mockNext as NextFunction);
      await triggerFinish(res);

      expect(mockDataAccessLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ resource: 'TravelOnboardingProfile', action: 'UPDATE' }),
      });
    });

    it('should create a log entry for /api/v1/users/gdpr', async () => {
      const req = createAuthReq({ originalUrl: '/api/v1/users/gdpr/consent', method: 'POST' });
      const res = createMockRes();

      auditLogger(req, res, mockNext as NextFunction);
      await triggerFinish(res);

      expect(mockDataAccessLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ resource: 'GdprData', action: 'CREATE' }),
      });
    });
  });

  describe('action mapping', () => {
    const actions: Array<[string, string]> = [
      ['GET', 'READ'],
      ['POST', 'CREATE'],
      ['PUT', 'UPDATE'],
      ['PATCH', 'UPDATE'],
      ['DELETE', 'DELETE'],
    ];

    for (const [method, expectedAction] of actions) {
      it(`should map ${method} to ${expectedAction}`, async () => {
        const req = createAuthReq({ method, originalUrl: '/api/v1/users/profile' });
        const res = createMockRes();

        auditLogger(req, res, mockNext as NextFunction);
        await triggerFinish(res);

        expect(mockDataAccessLogCreate).toHaveBeenCalledWith({
          data: expect.objectContaining({ action: expectedAction }),
        });
      });
    }

    it('should fall back to READ for unknown HTTP methods (e.g. OPTIONS)', async () => {
      const req = createAuthReq({ method: 'OPTIONS', originalUrl: '/api/v1/users/profile' });
      const res = createMockRes();

      auditLogger(req, res, mockNext as NextFunction);
      await triggerFinish(res);

      expect(mockDataAccessLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ action: 'READ' }),
      });
    });
  });

  describe('no log for unauthenticated or non-audited requests', () => {
    it('should NOT create a log when req.user is absent', async () => {
      const req = { ...createAuthReq(), user: undefined };
      const res = createMockRes();

      auditLogger(req, res, mockNext as NextFunction);
      await triggerFinish(res);

      expect(mockDataAccessLogCreate).not.toHaveBeenCalled();
    });

    it('should NOT create a log for a non-audited route', async () => {
      const req = createAuthReq({ originalUrl: '/api/v1/health' });
      const res = createMockRes();

      auditLogger(req, res, mockNext as NextFunction);
      await triggerFinish(res);

      expect(mockDataAccessLogCreate).not.toHaveBeenCalled();
    });

    it('should NOT create a log for /api/v1/users/admin', async () => {
      const req = createAuthReq({ originalUrl: '/api/v1/users/admin' });
      const res = createMockRes();

      auditLogger(req, res, mockNext as NextFunction);
      await triggerFinish(res);

      expect(mockDataAccessLogCreate).not.toHaveBeenCalled();
    });
  });

  describe('fallback values', () => {
    it('should use socket.remoteAddress when req.ip is undefined', async () => {
      const req = { ...createAuthReq(), ip: undefined, socket: { remoteAddress: '10.0.0.1' } };
      const res = createMockRes();

      auditLogger(req, res, mockNext as NextFunction);
      await triggerFinish(res);

      expect(mockDataAccessLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ ipAddress: '10.0.0.1' }),
      });
    });

    it('should use "unknown" when both ip and socket.remoteAddress are absent', async () => {
      const req = { ...createAuthReq(), ip: undefined, socket: {} };
      const res = createMockRes();

      auditLogger(req, res, mockNext as NextFunction);
      await triggerFinish(res);

      expect(mockDataAccessLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ ipAddress: 'unknown' }),
      });
    });

    it('should use "unknown" when user-agent header is absent', async () => {
      const req = { ...createAuthReq(), headers: {} };
      const res = createMockRes();

      auditLogger(req, res, mockNext as NextFunction);
      await triggerFinish(res);

      expect(mockDataAccessLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ userAgent: 'unknown' }),
      });
    });
  });

  describe('silent failure on prisma error', () => {
    it('should NOT throw when prisma.dataAccessLog.create fails', async () => {
      mockDataAccessLogCreate.mockRejectedValue(new Error('DB error') as never);
      const req = createAuthReq();
      const res = createMockRes();

      auditLogger(req, res, mockNext as NextFunction);

      // Should not throw
      await expect(triggerFinish(res)).resolves.not.toThrow();
      expect(mockNext).toHaveBeenCalledTimes(1);
    });
  });
});
