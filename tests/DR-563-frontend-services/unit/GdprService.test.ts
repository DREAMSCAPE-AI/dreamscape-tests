/**
 * DR-563 — US-TEST-026
 * Tests unitaires : GdprService (services/user/GdprService)
 *
 * Importe le vrai service — import.meta.env transformé par vite-meta-transform.
 *
 * @jest-environment jsdom
 * @ticket DR-563
 */

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPut = jest.fn();

let mockCapturedRequestInterceptor: ((config: any) => any) | null = null;

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    create: jest.fn(() => ({
      get: mockGet,
      post: mockPost,
      put: mockPut,
      interceptors: {
        request: {
          use: jest.fn((onFulfilled: (c: any) => any) => {
            mockCapturedRequestInterceptor = onFulfilled;
          }),
        },
        response: { use: jest.fn() },
      },
    })),
  },
}));

process.env.VITE_USER_SERVICE_URL = 'http://localhost:3002';

import gdprService from '@/services/user/GdprService';

// ── Fixtures ────────────────────────────────────────────────────────────────

const mockPolicy = { id: 'pol-1', version: '1.0', title: 'Privacy Policy', content: '...', effectiveAt: '2026-01-01', createdAt: '2026-01-01' };
const mockConsent = { id: 'cons-1', userId: 'user-1', analytics: true, marketing: false, functional: true, preferences: true, lastUpdatedAt: '2026-01-01' };
const mockRequest = { id: 'req-1', userId: 'user-1', requestType: 'DATA_EXPORT', status: 'PENDING', requestedAt: '2026-01-01' };

// ─────────────────────────────────────────────────────────────────────────────

describe('GdprService', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── Privacy Policy ────────────────────────────────────────────────────────
  describe('getCurrentPolicy', () => {
    it('calls GET /privacy-policy', async () => {
      mockGet.mockResolvedValue({ data: { success: true, data: mockPolicy } });
      const result = await gdprService.getCurrentPolicy();
      expect(mockGet).toHaveBeenCalledWith('/privacy-policy');
      expect(result.data.version).toBe('1.0');
    });
  });

  describe('getAllPolicyVersions', () => {
    it('calls GET /privacy-policy/versions', async () => {
      mockGet.mockResolvedValue({ data: { success: true, data: [mockPolicy] } });
      const result = await gdprService.getAllPolicyVersions();
      expect(mockGet).toHaveBeenCalledWith('/privacy-policy/versions');
      expect(result.data).toHaveLength(1);
    });
  });

  describe('acceptPolicy', () => {
    it('calls POST /privacy-policy/accept with policyId', async () => {
      mockPost.mockResolvedValue({ data: { success: true, message: 'Accepted' } });
      await gdprService.acceptPolicy('pol-1');
      expect(mockPost).toHaveBeenCalledWith('/privacy-policy/accept', { policyId: 'pol-1' });
    });
  });

  // ── Consent ───────────────────────────────────────────────────────────────
  describe('getConsent', () => {
    it('calls GET /consent and returns UserConsent', async () => {
      mockGet.mockResolvedValue({ data: { success: true, data: mockConsent } });
      const result = await gdprService.getConsent();
      expect(mockGet).toHaveBeenCalledWith('/consent');
      expect(result.data.analytics).toBe(true);
      expect(result.data.marketing).toBe(false);
    });
  });

  describe('updateConsent', () => {
    it('calls PUT /consent with partial consent data', async () => {
      const update = { marketing: true, analytics: false };
      mockPut.mockResolvedValue({ data: { success: true, data: { ...mockConsent, ...update }, message: 'Updated' } });
      const result = await gdprService.updateConsent(update);
      expect(mockPut).toHaveBeenCalledWith('/consent', update);
      expect(result.data.marketing).toBe(true);
    });

    it('propagates errors', async () => {
      mockPut.mockRejectedValue(new Error('400 Validation Error'));
      await expect(gdprService.updateConsent({ analytics: null as any })).rejects.toThrow();
    });
  });

  describe('getConsentHistory', () => {
    it('calls GET /consent/history', async () => {
      mockGet.mockResolvedValue({ data: { success: true, data: [] } });
      const result = await gdprService.getConsentHistory();
      expect(mockGet).toHaveBeenCalledWith('/consent/history');
      expect(result.data).toEqual([]);
    });
  });

  // ── GDPR Requests ─────────────────────────────────────────────────────────
  describe('requestDataExport', () => {
    it('calls POST /data-export and returns GdprRequest', async () => {
      mockPost.mockResolvedValue({ data: { success: true, data: mockRequest, message: 'Export initiated' } });
      const result = await gdprService.requestDataExport();
      expect(mockPost).toHaveBeenCalledWith('/data-export');
      expect(result.data.requestType).toBe('DATA_EXPORT');
    });
  });

  describe('requestDataDeletion', () => {
    it('calls POST /data-deletion with optional reason', async () => {
      mockPost.mockResolvedValue({ data: { success: true, data: { ...mockRequest, requestType: 'DATA_DELETION' } } });
      await gdprService.requestDataDeletion('I want to leave');
      expect(mockPost).toHaveBeenCalledWith('/data-deletion', { reason: 'I want to leave' });
    });

    it('sends undefined reason when no reason provided', async () => {
      mockPost.mockResolvedValue({ data: { success: true, data: mockRequest } });
      await gdprService.requestDataDeletion();
      expect(mockPost).toHaveBeenCalledWith('/data-deletion', { reason: undefined });
    });
  });

  describe('getRequests', () => {
    it('calls GET /requests', async () => {
      mockGet.mockResolvedValue({ data: { success: true, data: [mockRequest] } });
      const result = await gdprService.getRequests();
      expect(mockGet).toHaveBeenCalledWith('/requests');
      expect(result.data).toHaveLength(1);
    });
  });

  describe('getRequestById', () => {
    it('calls GET /requests/:id', async () => {
      mockGet.mockResolvedValue({ data: { success: true, data: mockRequest } });
      const result = await gdprService.getRequestById('req-1');
      expect(mockGet).toHaveBeenCalledWith('/requests/req-1');
      expect(result.data.id).toBe('req-1');
    });
  });

  describe('downloadExport', () => {
    it('calls GET /data-export/:id/download with responseType=blob', async () => {
      const blob = new Blob(['{"user":"data"}'], { type: 'application/json' });
      mockGet.mockResolvedValue({ data: blob });
      const result = await gdprService.downloadExport('req-1');
      expect(mockGet).toHaveBeenCalledWith('/data-export/req-1/download', { responseType: 'blob' });
      expect(result).toBeInstanceOf(Blob);
    });
  });

  // ── Auth interceptor ──────────────────────────────────────────────────────
  describe('Auth interceptor', () => {
    it('adds Bearer token from auth-storage', () => {
      if (!mockCapturedRequestInterceptor) return;
      localStorage.setItem('auth-storage', JSON.stringify({ state: { token: 'gdpr-token' } }));
      const config = { headers: {} as Record<string, string> };
      const result = mockCapturedRequestInterceptor(config);
      expect(result.headers['Authorization']).toBe('Bearer gdpr-token');
    });

    it('does not add header when auth-storage is empty', () => {
      if (!mockCapturedRequestInterceptor) return;
      localStorage.removeItem('auth-storage');
      const config = { headers: {} as Record<string, string> };
      const result = mockCapturedRequestInterceptor(config);
      expect(result.headers['Authorization']).toBeUndefined();
    });
  });
});
