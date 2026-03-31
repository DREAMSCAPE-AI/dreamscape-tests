import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

const mockDataAccessLogCreate = jest.fn();
const mockDataAccessLogFindMany = jest.fn();

jest.mock('@dreamscape/db', () => ({
  prisma: {
    dataAccessLog: {
      create: mockDataAccessLogCreate,
      findMany: mockDataAccessLogFindMany,
    },
  },
  DataAccessAction: {
    READ: 'READ',
    CREATE: 'CREATE',
    UPDATE: 'UPDATE',
    DELETE: 'DELETE',
  },
}));

import auditLogService from '../../../../dreamscape-services/user/src/services/AuditLogService';

const userId = 'user-123';

const mockLogEntry = {
  id: 'log-1',
  userId,
  accessorId: 'user-123',
  accessorType: 'user',
  action: 'READ',
  resource: 'UserProfile',
  resourceId: null,
  ipAddress: '127.0.0.1',
  userAgent: 'Mozilla/5.0',
  endpoint: '/api/v1/users/profile',
  method: 'GET',
  accessedAt: new Date(),
};

describe('AuditLogService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('logAccess', () => {
    it('should create a log entry with all required fields', async () => {
      mockDataAccessLogCreate.mockResolvedValue(mockLogEntry as never);

      const input = {
        userId,
        accessorId: userId,
        accessorType: 'user' as const,
        action: 'READ' as any,
        resource: 'UserProfile',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        endpoint: '/api/v1/users/profile',
        method: 'GET',
      };

      const result = await auditLogService.logAccess(input);

      expect(mockDataAccessLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId,
          accessorId: userId,
          accessorType: 'user',
          action: 'READ',
          resource: 'UserProfile',
          ipAddress: '127.0.0.1',
          accessedAt: expect.any(Date),
        }),
      });
      expect(result).toEqual(mockLogEntry);
    });

    it('should create a log entry with optional fields as undefined', async () => {
      mockDataAccessLogCreate.mockResolvedValue(mockLogEntry as never);

      await auditLogService.logAccess({
        userId,
        accessorType: 'user',
        action: 'READ' as any,
        resource: 'UserProfile',
      });

      expect(mockDataAccessLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId,
          accessorId: undefined,
          resourceId: undefined,
          ipAddress: undefined,
          userAgent: undefined,
          endpoint: undefined,
          method: undefined,
        }),
      });
    });

    it('should throw when prisma fails', async () => {
      mockDataAccessLogCreate.mockRejectedValue(new Error('DB error') as never);

      await expect(
        auditLogService.logAccess({
          userId,
          accessorType: 'user',
          action: 'READ' as any,
          resource: 'UserProfile',
        })
      ).rejects.toThrow('Failed to log access: DB error');
    });

    it('should throw with "Unknown error" when a non-Error is thrown', async () => {
      mockDataAccessLogCreate.mockRejectedValue('string error' as never);

      await expect(
        auditLogService.logAccess({
          userId,
          accessorType: 'user',
          action: 'READ' as any,
          resource: 'UserProfile',
        })
      ).rejects.toThrow('Failed to log access: Unknown error');
    });
  });

  describe('getAccessLogs', () => {
    it('should return all logs for a user without filters', async () => {
      const logs = [mockLogEntry];
      mockDataAccessLogFindMany.mockResolvedValue(logs as never);

      const result = await auditLogService.getAccessLogs(userId);

      expect(mockDataAccessLogFindMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { accessedAt: 'desc' },
        take: undefined,
        skip: undefined,
      });
      expect(result).toEqual(logs);
    });

    it('should filter by resource when provided', async () => {
      mockDataAccessLogFindMany.mockResolvedValue([mockLogEntry] as never);

      await auditLogService.getAccessLogs(userId, { resource: 'UserProfile' });

      expect(mockDataAccessLogFindMany).toHaveBeenCalledWith({
        where: { userId, resource: 'UserProfile' },
        orderBy: { accessedAt: 'desc' },
        take: undefined,
        skip: undefined,
      });
    });

    it('should apply pagination (take/skip)', async () => {
      mockDataAccessLogFindMany.mockResolvedValue([mockLogEntry] as never);

      await auditLogService.getAccessLogs(userId, { limit: 10, offset: 20 });

      expect(mockDataAccessLogFindMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { accessedAt: 'desc' },
        take: 10,
        skip: 20,
      });
    });

    it('should return empty array when no logs exist', async () => {
      mockDataAccessLogFindMany.mockResolvedValue([] as never);

      const result = await auditLogService.getAccessLogs(userId);

      expect(result).toEqual([]);
    });

    it('should throw when prisma fails', async () => {
      mockDataAccessLogFindMany.mockRejectedValue(new Error('DB error') as never);

      await expect(auditLogService.getAccessLogs(userId)).rejects.toThrow(
        'Failed to get access logs: DB error'
      );
    });

    it('should throw with "Unknown error" when a non-Error is thrown', async () => {
      mockDataAccessLogFindMany.mockRejectedValue(null as never);

      await expect(auditLogService.getAccessLogs(userId)).rejects.toThrow(
        'Failed to get access logs: Unknown error'
      );
    });
  });
});
