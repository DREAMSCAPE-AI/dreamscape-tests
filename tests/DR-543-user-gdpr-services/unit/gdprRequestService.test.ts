import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

const mockGdprRequestCreate = jest.fn();
const mockGdprRequestFindMany = jest.fn();
const mockGdprRequestFindUnique = jest.fn();
const mockGdprRequestUpdate = jest.fn();
const mockUserFindUnique = jest.fn();

jest.mock('@dreamscape/db', () => ({
  prisma: {
    gdprRequest: {
      create: mockGdprRequestCreate,
      findMany: mockGdprRequestFindMany,
      findUnique: mockGdprRequestFindUnique,
      update: mockGdprRequestUpdate,
    },
    user: {
      findUnique: mockUserFindUnique,
    },
  },
  GdprRequestType: {
    DATA_EXPORT: 'DATA_EXPORT',
    DATA_DELETION: 'DATA_DELETION',
  },
  GdprRequestStatus: {
    PENDING: 'PENDING',
    IN_PROGRESS: 'IN_PROGRESS',
    COMPLETED: 'COMPLETED',
    REJECTED: 'REJECTED',
  },
}));

import gdprRequestService from '../../../../dreamscape-services/user/src/services/GdprRequestService';

const userId = 'user-123';
const requestId = 'req-456';

const mockExportRequest = {
  id: requestId,
  userId,
  requestType: 'DATA_EXPORT',
  status: 'PENDING',
  expiresAt: null,
  processedAt: null,
  completedAt: null,
  exportData: null,
  notes: null,
  reason: null,
  requestedAt: new Date(),
};

const mockCompletedRequest = {
  ...mockExportRequest,
  status: 'COMPLETED',
  exportData: { user: { id: userId } },
};

const mockUserData = {
  id: userId,
  email: 'test@example.com',
  username: 'testuser',
  firstName: 'Test',
  lastName: 'User',
  phoneNumber: null,
  dateOfBirth: null,
  nationality: null,
  userCategory: 'STANDARD',
  isVerified: true,
  role: 'USER',
  createdAt: new Date(),
  updatedAt: new Date(),
  profile: null,
  preferences: null,
  settings: null,
  favorites: [],
  history: [],
  travelOnboarding: null,
  consent: null,
  searches: [],
  policyAcceptances: [],
};

describe('GdprRequestService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('requestDataExport', () => {
    it('should create a DATA_EXPORT request with 30-day expiry', async () => {
      mockGdprRequestCreate.mockResolvedValue(mockExportRequest as never);

      const result = await gdprRequestService.requestDataExport(userId);

      const call = (mockGdprRequestCreate as jest.Mock).mock.calls[0][0] as any;
      expect(call.data.userId).toBe(userId);
      expect(call.data.requestType).toBe('DATA_EXPORT');
      expect(call.data.status).toBe('PENDING');
      // expiresAt should be ~30 days from now
      const diffDays = Math.round(
        (call.data.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      expect(diffDays).toBe(30);
      expect(result).toEqual(mockExportRequest);
    });

    it('should throw an error when prisma fails', async () => {
      mockGdprRequestCreate.mockRejectedValue(new Error('DB error') as never);

      await expect(gdprRequestService.requestDataExport(userId)).rejects.toThrow(
        'Failed to create data export request'
      );
    });

    it('should throw with "Unknown error" when a non-Error is thrown', async () => {
      mockGdprRequestCreate.mockRejectedValue('string error' as never);

      await expect(gdprRequestService.requestDataExport(userId)).rejects.toThrow(
        'Failed to create data export request: Unknown error'
      );
    });
  });

  describe('requestDataDeletion', () => {
    it('should create a DATA_DELETION request without reason', async () => {
      const deletionRequest = { ...mockExportRequest, requestType: 'DATA_DELETION', reason: null };
      mockGdprRequestCreate.mockResolvedValue(deletionRequest as never);

      const result = await gdprRequestService.requestDataDeletion(userId);

      expect(mockGdprRequestCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          requestType: 'DATA_DELETION',
          status: 'PENDING',
          reason: undefined,
        }),
      });
      expect(result.requestType).toBe('DATA_DELETION');
    });

    it('should create a DATA_DELETION request with reason', async () => {
      const deletionRequest = { ...mockExportRequest, requestType: 'DATA_DELETION', reason: 'No longer needed' };
      mockGdprRequestCreate.mockResolvedValue(deletionRequest as never);

      await gdprRequestService.requestDataDeletion(userId, 'No longer needed');

      expect(mockGdprRequestCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ reason: 'No longer needed' }),
      });
    });

    it('should throw an error when prisma fails', async () => {
      mockGdprRequestCreate.mockRejectedValue(new Error('DB error') as never);

      await expect(gdprRequestService.requestDataDeletion(userId)).rejects.toThrow(
        'Failed to create data deletion request'
      );
    });

    it('should throw with "Unknown error" when a non-Error is thrown', async () => {
      mockGdprRequestCreate.mockRejectedValue(null as never);

      await expect(gdprRequestService.requestDataDeletion(userId)).rejects.toThrow(
        'Failed to create data deletion request: Unknown error'
      );
    });
  });

  describe('getUserRequests', () => {
    it('should return empty array when no requests', async () => {
      mockGdprRequestFindMany.mockResolvedValue([] as never);

      const result = await gdprRequestService.getUserRequests(userId);

      expect(result).toEqual([]);
      expect(mockGdprRequestFindMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { requestedAt: 'desc' },
      });
    });

    it('should return all requests for a user ordered by date desc', async () => {
      const requests = [mockExportRequest, { ...mockExportRequest, id: 'req-789' }];
      mockGdprRequestFindMany.mockResolvedValue(requests as never);

      const result = await gdprRequestService.getUserRequests(userId);

      expect(result).toHaveLength(2);
    });

    it('should throw an error when prisma fails', async () => {
      mockGdprRequestFindMany.mockRejectedValue(new Error('DB error') as never);

      await expect(gdprRequestService.getUserRequests(userId)).rejects.toThrow(
        'Failed to get user requests'
      );
    });

    it('should throw with "Unknown error" when a non-Error is thrown', async () => {
      mockGdprRequestFindMany.mockRejectedValue(42 as never);

      await expect(gdprRequestService.getUserRequests(userId)).rejects.toThrow(
        'Failed to get user requests: Unknown error'
      );
    });
  });

  describe('getRequestById', () => {
    it('should return request when found and userId matches', async () => {
      mockGdprRequestFindUnique.mockResolvedValue(mockExportRequest as never);

      const result = await gdprRequestService.getRequestById(requestId, userId);

      expect(result).toEqual(mockExportRequest);
    });

    it('should throw when request is not found', async () => {
      mockGdprRequestFindUnique.mockResolvedValue(null as never);

      await expect(gdprRequestService.getRequestById(requestId, userId)).rejects.toThrow(
        'Failed to get request'
      );
    });

    it('should throw when request belongs to another user', async () => {
      mockGdprRequestFindUnique.mockResolvedValue({
        ...mockExportRequest,
        userId: 'other-user',
      } as never);

      await expect(gdprRequestService.getRequestById(requestId, userId)).rejects.toThrow(
        'Failed to get request'
      );
    });

    it('should throw when prisma fails', async () => {
      mockGdprRequestFindUnique.mockRejectedValue(new Error('DB error') as never);

      await expect(gdprRequestService.getRequestById(requestId, userId)).rejects.toThrow(
        'Failed to get request'
      );
    });

    it('should throw with "Unknown error" when a non-Error is thrown', async () => {
      mockGdprRequestFindUnique.mockRejectedValue({ code: 'P2000' } as never);

      await expect(gdprRequestService.getRequestById(requestId, userId)).rejects.toThrow(
        'Failed to get request: Unknown error'
      );
    });
  });

  describe('processExport', () => {
    it('should process export through full sequence and return COMPLETED request', async () => {
      mockGdprRequestFindUnique.mockResolvedValue(mockExportRequest as never);
      mockGdprRequestUpdate
        .mockResolvedValueOnce({ ...mockExportRequest, status: 'IN_PROGRESS' } as never)
        .mockResolvedValueOnce(mockCompletedRequest as never);
      mockUserFindUnique.mockResolvedValue(mockUserData as never);

      const result = await gdprRequestService.processExport(requestId);

      // Step 1: status updated to IN_PROGRESS
      expect(mockGdprRequestUpdate).toHaveBeenNthCalledWith(1, {
        where: { id: requestId },
        data: expect.objectContaining({ status: 'IN_PROGRESS' }),
      });
      // Step 2: user data fetched with includes
      expect(mockUserFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: userId },
          include: expect.objectContaining({ profile: true, favorites: true }),
        })
      );
      // Step 3: status updated to COMPLETED with exportData
      expect(mockGdprRequestUpdate).toHaveBeenNthCalledWith(2, {
        where: { id: requestId },
        data: expect.objectContaining({
          status: 'COMPLETED',
          exportData: expect.any(Object),
        }),
      });
      expect(result).toEqual(mockCompletedRequest);
    });

    it('should throw when request is not found', async () => {
      mockGdprRequestFindUnique.mockResolvedValue(null as never);
      mockGdprRequestUpdate.mockResolvedValue({} as never);

      await expect(gdprRequestService.processExport(requestId)).rejects.toThrow(
        'Failed to process export'
      );
    });

    it('should throw and set REJECTED status when request type is not DATA_EXPORT', async () => {
      mockGdprRequestFindUnique.mockResolvedValue({
        ...mockExportRequest,
        requestType: 'DATA_DELETION',
      } as never);
      mockGdprRequestUpdate.mockResolvedValue({} as never);

      await expect(gdprRequestService.processExport(requestId)).rejects.toThrow(
        'Failed to process export'
      );
      expect(mockGdprRequestUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'REJECTED' }),
        })
      );
    });

    it('should throw and set REJECTED status when user is not found', async () => {
      mockGdprRequestFindUnique.mockResolvedValue(mockExportRequest as never);
      mockGdprRequestUpdate.mockResolvedValueOnce({ status: 'IN_PROGRESS' } as never);
      mockUserFindUnique.mockResolvedValue(null as never);
      mockGdprRequestUpdate.mockResolvedValueOnce({} as never);

      await expect(gdprRequestService.processExport(requestId)).rejects.toThrow(
        'Failed to process export'
      );
    });

    it('should throw with "Unknown error" when a non-Error is thrown in processExport', async () => {
      mockGdprRequestFindUnique.mockResolvedValue(mockExportRequest as never);
      mockGdprRequestUpdate
        .mockResolvedValueOnce({ status: 'IN_PROGRESS' } as never)
        .mockResolvedValueOnce({} as never);
      mockUserFindUnique.mockRejectedValue('non-error value' as never);

      await expect(gdprRequestService.processExport(requestId)).rejects.toThrow(
        'Failed to process export: Unknown error'
      );
    });

    it('should silently handle REJECTED status update failure in catch block', async () => {
      mockGdprRequestFindUnique.mockResolvedValue(mockExportRequest as never);
      mockGdprRequestUpdate
        .mockResolvedValueOnce({ status: 'IN_PROGRESS' } as never)
        .mockRejectedValueOnce(new Error('Update to REJECTED also failed') as never);
      mockUserFindUnique.mockRejectedValue(new Error('User fetch failed') as never);

      await expect(gdprRequestService.processExport(requestId)).rejects.toThrow(
        'Failed to process export'
      );
    });
  });

  describe('getExportData', () => {
    it('should return export data for a completed request', async () => {
      mockGdprRequestFindUnique.mockResolvedValue(mockCompletedRequest as never);

      const result = await gdprRequestService.getExportData(requestId, userId);

      expect(result).toEqual(mockCompletedRequest.exportData);
    });

    it('should throw when export is not completed', async () => {
      mockGdprRequestFindUnique.mockResolvedValue({
        ...mockExportRequest,
        status: 'PENDING',
      } as never);

      await expect(gdprRequestService.getExportData(requestId, userId)).rejects.toThrow(
        'Failed to get export data'
      );
    });

    it('should throw when export data is null', async () => {
      mockGdprRequestFindUnique.mockResolvedValue({
        ...mockExportRequest,
        status: 'COMPLETED',
        exportData: null,
      } as never);

      await expect(gdprRequestService.getExportData(requestId, userId)).rejects.toThrow(
        'Failed to get export data'
      );
    });

    it('should throw when request belongs to another user', async () => {
      mockGdprRequestFindUnique.mockResolvedValue({
        ...mockCompletedRequest,
        userId: 'other-user',
      } as never);

      await expect(gdprRequestService.getExportData(requestId, userId)).rejects.toThrow(
        'Failed to get export data'
      );
    });

    it('should propagate inner "Unknown error" when getRequestById receives a non-Error', async () => {
      // getRequestById catches the non-Error and wraps it; getExportData then re-wraps that Error
      mockGdprRequestFindUnique.mockRejectedValue(999 as never);

      await expect(gdprRequestService.getExportData(requestId, userId)).rejects.toThrow(
        'Failed to get export data: Failed to get request: Unknown error'
      );
    });
  });
});
