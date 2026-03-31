import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

const mockPrivacyPolicyFindFirst = jest.fn();
const mockPrivacyPolicyFindMany = jest.fn();
const mockPrivacyPolicyFindUnique = jest.fn();
const mockUserPolicyAcceptanceUpsert = jest.fn();
const mockUserPolicyAcceptanceFindUnique = jest.fn();

jest.mock('@dreamscape/db', () => ({
  prisma: {
    privacyPolicy: {
      findFirst: mockPrivacyPolicyFindFirst,
      findMany: mockPrivacyPolicyFindMany,
      findUnique: mockPrivacyPolicyFindUnique,
    },
    userPolicyAcceptance: {
      upsert: mockUserPolicyAcceptanceUpsert,
      findUnique: mockUserPolicyAcceptanceFindUnique,
    },
  },
}));

import privacyPolicyService from '../../../../dreamscape-services/user/src/services/PrivacyPolicyService';

const mockPolicy = {
  id: 'policy-1',
  version: '1.0',
  content: 'Privacy policy content',
  effectiveAt: new Date('2024-01-01'),
};

const mockAcceptance = {
  userId: 'user-123',
  policyId: 'policy-1',
  policyVersion: '1.0',
  acceptedAt: new Date(),
  ipAddress: '127.0.0.1',
  userAgent: 'Mozilla/5.0',
};

describe('PrivacyPolicyService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('getCurrentPolicy', () => {
    it('should return the most recent active policy', async () => {
      mockPrivacyPolicyFindFirst.mockResolvedValue(mockPolicy as never);

      const result = await privacyPolicyService.getCurrentPolicy();

      expect(mockPrivacyPolicyFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { effectiveAt: { lte: expect.any(Date) } },
          orderBy: { effectiveAt: 'desc' },
        })
      );
      expect(result).toEqual(mockPolicy);
    });

    it('should throw when no active policy is found', async () => {
      mockPrivacyPolicyFindFirst.mockResolvedValue(null as never);

      await expect(privacyPolicyService.getCurrentPolicy()).rejects.toThrow(
        'Failed to get current policy'
      );
    });

    it('should throw when prisma fails', async () => {
      mockPrivacyPolicyFindFirst.mockRejectedValue(new Error('DB error') as never);

      await expect(privacyPolicyService.getCurrentPolicy()).rejects.toThrow(
        'Failed to get current policy'
      );
    });

    it('should throw with "Unknown error" when a non-Error is thrown', async () => {
      mockPrivacyPolicyFindFirst.mockRejectedValue('string error' as never);

      await expect(privacyPolicyService.getCurrentPolicy()).rejects.toThrow(
        'Failed to get current policy: Unknown error'
      );
    });
  });

  describe('getAllVersions', () => {
    it('should return all policy versions ordered by effectiveAt DESC', async () => {
      const policies = [
        { ...mockPolicy, id: 'policy-2', version: '2.0' },
        mockPolicy,
      ];
      mockPrivacyPolicyFindMany.mockResolvedValue(policies as never);

      const result = await privacyPolicyService.getAllVersions();

      expect(mockPrivacyPolicyFindMany).toHaveBeenCalledWith({
        orderBy: { effectiveAt: 'desc' },
      });
      expect(result).toHaveLength(2);
      expect(result[0].version).toBe('2.0');
    });

    it('should return empty array when no policies exist', async () => {
      mockPrivacyPolicyFindMany.mockResolvedValue([] as never);

      const result = await privacyPolicyService.getAllVersions();

      expect(result).toEqual([]);
    });

    it('should throw when prisma fails', async () => {
      mockPrivacyPolicyFindMany.mockRejectedValue(new Error('DB error') as never);

      await expect(privacyPolicyService.getAllVersions()).rejects.toThrow(
        'Failed to get policy versions'
      );
    });

    it('should throw with "Unknown error" when a non-Error is thrown', async () => {
      mockPrivacyPolicyFindMany.mockRejectedValue(null as never);

      await expect(privacyPolicyService.getAllVersions()).rejects.toThrow(
        'Failed to get policy versions: Unknown error'
      );
    });
  });

  describe('acceptPolicy', () => {
    it('should upsert an acceptance record with ipAddress and userAgent', async () => {
      mockPrivacyPolicyFindUnique.mockResolvedValue(mockPolicy as never);
      mockUserPolicyAcceptanceUpsert.mockResolvedValue(mockAcceptance as never);

      const result = await privacyPolicyService.acceptPolicy(
        'user-123',
        'policy-1',
        '127.0.0.1',
        'Mozilla/5.0'
      );

      expect(mockUserPolicyAcceptanceUpsert).toHaveBeenCalledWith({
        where: { userId_policyId: { userId: 'user-123', policyId: 'policy-1' } },
        update: expect.objectContaining({ ipAddress: '127.0.0.1', userAgent: 'Mozilla/5.0' }),
        create: expect.objectContaining({
          userId: 'user-123',
          policyId: 'policy-1',
          policyVersion: '1.0',
        }),
      });
      expect(result).toEqual(mockAcceptance);
    });

    it('should work without optional ipAddress and userAgent', async () => {
      mockPrivacyPolicyFindUnique.mockResolvedValue(mockPolicy as never);
      mockUserPolicyAcceptanceUpsert.mockResolvedValue(mockAcceptance as never);

      await privacyPolicyService.acceptPolicy('user-123', 'policy-1');

      expect(mockUserPolicyAcceptanceUpsert).toHaveBeenCalled();
    });

    it('should throw when policy is not found', async () => {
      mockPrivacyPolicyFindUnique.mockResolvedValue(null as never);

      await expect(
        privacyPolicyService.acceptPolicy('user-123', 'policy-nonexistent')
      ).rejects.toThrow('Failed to accept policy');
    });

    it('should throw when prisma fails', async () => {
      mockPrivacyPolicyFindUnique.mockRejectedValue(new Error('DB error') as never);

      await expect(
        privacyPolicyService.acceptPolicy('user-123', 'policy-1')
      ).rejects.toThrow('Failed to accept policy');
    });

    it('should throw with "Unknown error" when a non-Error is thrown', async () => {
      mockPrivacyPolicyFindUnique.mockRejectedValue(123 as never);

      await expect(
        privacyPolicyService.acceptPolicy('user-123', 'policy-1')
      ).rejects.toThrow('Failed to accept policy: Unknown error');
    });
  });

  describe('hasAcceptedCurrentPolicy', () => {
    it('should return true when user has accepted current policy', async () => {
      mockPrivacyPolicyFindFirst.mockResolvedValue(mockPolicy as never);
      mockUserPolicyAcceptanceFindUnique.mockResolvedValue(mockAcceptance as never);

      const result = await privacyPolicyService.hasAcceptedCurrentPolicy('user-123');

      expect(result).toBe(true);
      expect(mockUserPolicyAcceptanceFindUnique).toHaveBeenCalledWith({
        where: { userId_policyId: { userId: 'user-123', policyId: 'policy-1' } },
      });
    });

    it('should return false when user has NOT accepted current policy', async () => {
      mockPrivacyPolicyFindFirst.mockResolvedValue(mockPolicy as never);
      mockUserPolicyAcceptanceFindUnique.mockResolvedValue(null as never);

      const result = await privacyPolicyService.hasAcceptedCurrentPolicy('user-123');

      expect(result).toBe(false);
    });

    it('should throw when there is no active policy', async () => {
      mockPrivacyPolicyFindFirst.mockResolvedValue(null as never);

      await expect(
        privacyPolicyService.hasAcceptedCurrentPolicy('user-123')
      ).rejects.toThrow('Failed to check policy acceptance');
    });

    it('should throw when prisma fails', async () => {
      mockPrivacyPolicyFindFirst.mockRejectedValue(new Error('DB error') as never);

      await expect(
        privacyPolicyService.hasAcceptedCurrentPolicy('user-123')
      ).rejects.toThrow('Failed to check policy acceptance');
    });

    it('should throw with "Unknown error" when findUnique throws a non-Error', async () => {
      // getCurrentPolicy succeeds, then userPolicyAcceptance.findUnique throws a non-Error
      mockPrivacyPolicyFindFirst.mockResolvedValue(mockPolicy as never);
      mockUserPolicyAcceptanceFindUnique.mockRejectedValue(42 as never);

      await expect(
        privacyPolicyService.hasAcceptedCurrentPolicy('user-123')
      ).rejects.toThrow('Failed to check policy acceptance: Unknown error');
    });
  });
});
