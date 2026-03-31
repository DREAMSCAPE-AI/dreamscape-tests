import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

const mockUserConsentUpsert = jest.fn();
const mockUserConsentUpdate = jest.fn();
const mockUserConsentFindUnique = jest.fn();
const mockConsentHistoryCreate = jest.fn();
const mockConsentHistoryFindMany = jest.fn();

jest.mock('@dreamscape/db', () => ({
  prisma: {
    userConsent: {
      upsert: mockUserConsentUpsert,
      update: mockUserConsentUpdate,
      findUnique: mockUserConsentFindUnique,
    },
    consentHistory: {
      create: mockConsentHistoryCreate,
      findMany: mockConsentHistoryFindMany,
    },
  },
}));

import consentService from '../../../../dreamscape-services/user/src/services/ConsentService';

const mockConsent = {
  id: 'consent-id-1',
  userId: 'user-123',
  analytics: false,
  marketing: false,
  functional: true,
  preferences: true,
  lastUpdatedAt: new Date(),
  ipAddress: null,
};

describe('ConsentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('getUserConsent', () => {
    it('should upsert consent with default values for new user', async () => {
      mockUserConsentUpsert.mockResolvedValue(mockConsent as never);

      const result = await consentService.getUserConsent('user-123');

      expect(mockUserConsentUpsert).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        update: {},
        create: {
          userId: 'user-123',
          analytics: false,
          marketing: false,
          functional: true,
          preferences: true,
        },
      });
      expect(result).toEqual(mockConsent);
    });

    it('should return existing consent record', async () => {
      const existingConsent = { ...mockConsent, analytics: true, marketing: true };
      mockUserConsentUpsert.mockResolvedValue(existingConsent as never);

      const result = await consentService.getUserConsent('user-123');

      expect(result.analytics).toBe(true);
      expect(result.marketing).toBe(true);
    });

    it('should throw an error when prisma fails', async () => {
      mockUserConsentUpsert.mockRejectedValue(new Error('DB error') as never);

      await expect(consentService.getUserConsent('user-123')).rejects.toThrow(
        'Failed to get user consent: DB error'
      );
    });

    it('should throw with "Unknown error" when a non-Error is thrown', async () => {
      mockUserConsentUpsert.mockRejectedValue('string error' as never);

      await expect(consentService.getUserConsent('user-123')).rejects.toThrow(
        'Failed to get user consent: Unknown error'
      );
    });
  });

  describe('updateConsent', () => {
    const updatedConsent = { ...mockConsent, analytics: true, lastUpdatedAt: new Date() };

    beforeEach(() => {
      mockUserConsentUpsert.mockResolvedValue(mockConsent as never);
      mockUserConsentUpdate.mockResolvedValue(updatedConsent as never);
      mockConsentHistoryCreate.mockResolvedValue({} as never);
    });

    it('should update consent fields and create history entry', async () => {
      const result = await consentService.updateConsent('user-123', { analytics: true });

      expect(mockUserConsentUpdate).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        data: expect.objectContaining({ analytics: true }),
      });
      expect(mockConsentHistoryCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          consentId: mockConsent.id,
          userId: 'user-123',
          analytics: updatedConsent.analytics,
        }),
      });
      expect(result).toEqual(updatedConsent);
    });

    it('should pass ipAddress and userAgent to update and history', async () => {
      await consentService.updateConsent(
        'user-123',
        { marketing: true },
        '192.168.1.1',
        'Mozilla/5.0'
      );

      expect(mockUserConsentUpdate).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        data: expect.objectContaining({ ipAddress: '192.168.1.1' }),
      });
      expect(mockConsentHistoryCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        }),
      });
    });

    it('should throw an error when update fails', async () => {
      mockUserConsentUpdate.mockRejectedValue(new Error('Update failed') as never);

      await expect(
        consentService.updateConsent('user-123', { analytics: true })
      ).rejects.toThrow('Failed to update consent');
    });

    it('should throw with "Unknown error" when a non-Error is thrown during update', async () => {
      mockUserConsentUpdate.mockRejectedValue(42 as never);

      await expect(
        consentService.updateConsent('user-123', { analytics: true })
      ).rejects.toThrow('Failed to update consent: Unknown error');
    });
  });

  describe('getConsentHistory', () => {
    it('should return empty array when no consent record exists', async () => {
      mockUserConsentFindUnique.mockResolvedValue(null as never);

      const result = await consentService.getConsentHistory('user-123');

      expect(result).toEqual([]);
      expect(mockConsentHistoryFindMany).not.toHaveBeenCalled();
    });

    it('should return ordered consent history', async () => {
      const historyEntries = [
        { id: 'h2', changedAt: new Date('2024-02-01') },
        { id: 'h1', changedAt: new Date('2024-01-01') },
      ];
      mockUserConsentFindUnique.mockResolvedValue(mockConsent as never);
      mockConsentHistoryFindMany.mockResolvedValue(historyEntries as never);

      const result = await consentService.getConsentHistory('user-123');

      expect(mockConsentHistoryFindMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        orderBy: { changedAt: 'desc' },
      });
      expect(result).toEqual(historyEntries);
    });

    it('should throw an error when prisma fails', async () => {
      mockUserConsentFindUnique.mockRejectedValue(new Error('DB error') as never);

      await expect(consentService.getConsentHistory('user-123')).rejects.toThrow(
        'Failed to get consent history'
      );
    });

    it('should throw with "Unknown error" when a non-Error is thrown in getConsentHistory', async () => {
      mockUserConsentFindUnique.mockRejectedValue({ code: 'P2000' } as never);

      await expect(consentService.getConsentHistory('user-123')).rejects.toThrow(
        'Failed to get consent history: Unknown error'
      );
    });
  });
});
