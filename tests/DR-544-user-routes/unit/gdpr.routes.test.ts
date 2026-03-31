import request from 'supertest';
import express, { Express } from 'express';
import { jest, describe, it, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';

// ── Auth middleware mock (gdpr.ts uses relative '../middleware/auth') ──────────
const userId = 'user-123';
let authShouldReject = false;

jest.mock('../../../../dreamscape-services/user/src/middleware/auth', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    if (authShouldReject) {
      return res.status(401).json({ success: false, message: 'Access token required' });
    }
    req.user = { id: userId, email: 'test@example.com', role: 'user' };
    next();
  },
}));

// ── Service mocks ─────────────────────────────────────────────────────────────
const mockConsentServiceGetUserConsent = jest.fn();
const mockConsentServiceUpdateConsent = jest.fn();
const mockConsentServiceGetConsentHistory = jest.fn();

jest.mock('../../../../dreamscape-services/user/src/services/ConsentService', () => ({
  __esModule: true,
  default: {
    getUserConsent: mockConsentServiceGetUserConsent,
    updateConsent: mockConsentServiceUpdateConsent,
    getConsentHistory: mockConsentServiceGetConsentHistory,
  },
}));

const mockPrivacyPolicyGetCurrent = jest.fn();
const mockPrivacyPolicyGetAllVersions = jest.fn();
const mockPrivacyPolicyAccept = jest.fn();

jest.mock('../../../../dreamscape-services/user/src/services/PrivacyPolicyService', () => ({
  __esModule: true,
  default: {
    getCurrentPolicy: mockPrivacyPolicyGetCurrent,
    getAllVersions: mockPrivacyPolicyGetAllVersions,
    acceptPolicy: mockPrivacyPolicyAccept,
  },
}));

const mockGdprRequestDataExport = jest.fn();
const mockGdprRequestDataDeletion = jest.fn();
const mockGdprRequestGetUserRequests = jest.fn();
const mockGdprRequestGetRequestById = jest.fn();
const mockGdprRequestProcessExport = jest.fn();
const mockGdprRequestGetExportData = jest.fn();

jest.mock('../../../../dreamscape-services/user/src/services/GdprRequestService', () => ({
  __esModule: true,
  default: {
    requestDataExport: mockGdprRequestDataExport,
    requestDataDeletion: mockGdprRequestDataDeletion,
    getUserRequests: mockGdprRequestGetUserRequests,
    getRequestById: mockGdprRequestGetRequestById,
    processExport: mockGdprRequestProcessExport,
    getExportData: mockGdprRequestGetExportData,
  },
}));

// ── Kafka mock ────────────────────────────────────────────────────────────────
const mockPublishConsentUpdated = jest.fn().mockResolvedValue(undefined as never);
const mockPublishGdprExportRequested = jest.fn().mockResolvedValue(undefined as never);
const mockPublishGdprDeletionRequested = jest.fn().mockResolvedValue(undefined as never);

jest.mock('../../../../dreamscape-services/user/src/services/KafkaService', () => ({
  userKafkaService: {
    publishConsentUpdated: mockPublishConsentUpdated,
    publishGdprExportRequested: mockPublishGdprExportRequested,
    publishGdprDeletionRequested: mockPublishGdprDeletionRequested,
  },
}));

import gdprRouter from '../../../../dreamscape-services/user/src/routes/gdpr';

// ── Test data ─────────────────────────────────────────────────────────────────
const mockPolicy = {
  id: 'policy-1',
  version: '1.0',
  content: 'Privacy policy content',
  effectiveAt: new Date('2024-01-01'),
};

const mockConsent = {
  id: 'consent-1',
  userId,
  analytics: false,
  marketing: false,
  functional: true,
  preferences: true,
  lastUpdatedAt: new Date(),
  createdAt: new Date(),
};

const mockGdprRequest = {
  id: 'req-1',
  userId,
  requestType: 'DATA_EXPORT',
  status: 'PENDING',
  requestedAt: new Date(),
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  processedAt: null,
  completedAt: null,
  exportData: null,
  notes: null,
  reason: null,
};

describe('GDPR Routes', () => {
  let app: Express;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/users/gdpr', gdprRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    authShouldReject = false;
    mockPublishConsentUpdated.mockResolvedValue(undefined as never);
    mockPublishGdprExportRequested.mockResolvedValue(undefined as never);
    mockPublishGdprDeletionRequested.mockResolvedValue(undefined as never);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  // ─── GET /privacy-policy (public) ─────────────────────────────────────────
  describe('GET /privacy-policy', () => {
    it('should return 200 with the current policy', async () => {
      mockPrivacyPolicyGetCurrent.mockResolvedValue(mockPolicy as never);

      const res = await request(app)
        .get('/api/v1/users/gdpr/privacy-policy')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('policy-1');
    });

    it('should return 404 when no active policy exists', async () => {
      mockPrivacyPolicyGetCurrent.mockRejectedValue(
        new Error('No active privacy policy found') as never
      );

      const res = await request(app)
        .get('/api/v1/users/gdpr/privacy-policy')
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it('should return 500 on unexpected error', async () => {
      mockPrivacyPolicyGetCurrent.mockRejectedValue(new Error('DB error') as never);

      const res = await request(app)
        .get('/api/v1/users/gdpr/privacy-policy')
        .expect(500);

      expect(res.body.success).toBe(false);
    });
  });

  // ─── GET /privacy-policy/versions (public) ────────────────────────────────
  describe('GET /privacy-policy/versions', () => {
    it('should return 200 with all policy versions', async () => {
      mockPrivacyPolicyGetAllVersions.mockResolvedValue([mockPolicy] as never);

      const res = await request(app)
        .get('/api/v1/users/gdpr/privacy-policy/versions')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  // ─── POST /privacy-policy/accept (auth required) ──────────────────────────
  describe('POST /privacy-policy/accept', () => {
    it('should return 401 when not authenticated', async () => {
      authShouldReject = true;

      const res = await request(app)
        .post('/api/v1/users/gdpr/privacy-policy/accept')
        .send({ policyId: 'policy-1' })
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it('should return 400 when policyId is missing', async () => {
      const res = await request(app)
        .post('/api/v1/users/gdpr/privacy-policy/accept')
        .send({})
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should return 200 on successful acceptance', async () => {
      const mockAcceptance = { userId, policyId: 'policy-1', policyVersion: '1.0', acceptedAt: new Date() };
      mockPrivacyPolicyAccept.mockResolvedValue(mockAcceptance as never);

      const res = await request(app)
        .post('/api/v1/users/gdpr/privacy-policy/accept')
        .send({ policyId: 'policy-1' })
        .expect(200);

      expect(res.body.success).toBe(true);
    });
  });

  // ─── GET /consent ──────────────────────────────────────────────────────────
  describe('GET /consent', () => {
    it('should return 401 when not authenticated', async () => {
      authShouldReject = true;
      const res = await request(app).get('/api/v1/users/gdpr/consent').expect(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 200 with user consent', async () => {
      mockConsentServiceGetUserConsent.mockResolvedValue(mockConsent as never);

      const res = await request(app)
        .get('/api/v1/users/gdpr/consent')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.userId).toBe(userId);
    });
  });

  // ─── PUT /consent ──────────────────────────────────────────────────────────
  describe('PUT /consent', () => {
    it('should return 401 when not authenticated', async () => {
      authShouldReject = true;
      await request(app).put('/api/v1/users/gdpr/consent').send({ analytics: true }).expect(401);
    });

    it('should return 400 when no field is provided', async () => {
      const res = await request(app)
        .put('/api/v1/users/gdpr/consent')
        .send({})
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('At least one');
    });

    it('should return 400 when analytics is not boolean', async () => {
      const res = await request(app)
        .put('/api/v1/users/gdpr/consent')
        .send({ analytics: 'yes' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should return 200 and trigger Kafka event on success', async () => {
      const updatedConsent = { ...mockConsent, analytics: true };
      mockConsentServiceUpdateConsent.mockResolvedValue(updatedConsent as never);

      const res = await request(app)
        .put('/api/v1/users/gdpr/consent')
        .send({ analytics: true })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(mockPublishConsentUpdated).toHaveBeenCalled();
    });
  });

  // ─── GET /consent/history ──────────────────────────────────────────────────
  describe('GET /consent/history', () => {
    it('should return 401 when not authenticated', async () => {
      authShouldReject = true;
      await request(app).get('/api/v1/users/gdpr/consent/history').expect(401);
    });

    it('should return 200 with consent history', async () => {
      mockConsentServiceGetConsentHistory.mockResolvedValue([] as never);

      const res = await request(app)
        .get('/api/v1/users/gdpr/consent/history')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  // ─── POST /data-export ─────────────────────────────────────────────────────
  describe('POST /data-export', () => {
    it('should return 401 when not authenticated', async () => {
      authShouldReject = true;
      await request(app).post('/api/v1/users/gdpr/data-export').expect(401);
    });

    it('should return 201 and trigger Kafka event on success', async () => {
      mockGdprRequestDataExport.mockResolvedValue(mockGdprRequest as never);
      mockGdprRequestProcessExport.mockResolvedValue({ ...mockGdprRequest, status: 'COMPLETED' } as never);

      const res = await request(app)
        .post('/api/v1/users/gdpr/data-export')
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(mockPublishGdprExportRequested).toHaveBeenCalled();
    });
  });

  // ─── POST /data-deletion ───────────────────────────────────────────────────
  describe('POST /data-deletion', () => {
    it('should return 401 when not authenticated', async () => {
      authShouldReject = true;
      await request(app).post('/api/v1/users/gdpr/data-deletion').expect(401);
    });

    it('should return 201 with optional reason', async () => {
      const deletionReq = { ...mockGdprRequest, requestType: 'DATA_DELETION' };
      mockGdprRequestDataDeletion.mockResolvedValue(deletionReq as never);

      const res = await request(app)
        .post('/api/v1/users/gdpr/data-deletion')
        .send({ reason: 'No longer needed' })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(mockPublishGdprDeletionRequested).toHaveBeenCalled();
    });

    it('should return 400 when reason is not a string', async () => {
      const res = await request(app)
        .post('/api/v1/users/gdpr/data-deletion')
        .send({ reason: 123 })
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  // ─── GET /requests ─────────────────────────────────────────────────────────
  describe('GET /requests', () => {
    it('should return 401 when not authenticated', async () => {
      authShouldReject = true;
      await request(app).get('/api/v1/users/gdpr/requests').expect(401);
    });

    it('should return 200 with list of requests', async () => {
      mockGdprRequestGetUserRequests.mockResolvedValue([mockGdprRequest] as never);

      const res = await request(app)
        .get('/api/v1/users/gdpr/requests')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  // ─── GET /requests/:id ─────────────────────────────────────────────────────
  describe('GET /requests/:id', () => {
    it('should return 401 when not authenticated', async () => {
      authShouldReject = true;
      await request(app).get('/api/v1/users/gdpr/requests/req-1').expect(401);
    });

    it('should return 200 with the request', async () => {
      mockGdprRequestGetRequestById.mockResolvedValue(mockGdprRequest as never);

      const res = await request(app)
        .get('/api/v1/users/gdpr/requests/req-1')
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('should return 404 when request not found', async () => {
      mockGdprRequestGetRequestById.mockRejectedValue(new Error('Request not found') as never);

      const res = await request(app)
        .get('/api/v1/users/gdpr/requests/missing')
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it('should return 403 when request belongs to another user', async () => {
      mockGdprRequestGetRequestById.mockRejectedValue(new Error('Unauthorized access') as never);

      const res = await request(app)
        .get('/api/v1/users/gdpr/requests/req-other')
        .expect(403);

      expect(res.body.success).toBe(false);
    });
  });

  // ─── GET /data-export/:id/download ────────────────────────────────────────
  describe('GET /data-export/:id/download', () => {
    it('should return 401 when not authenticated', async () => {
      authShouldReject = true;
      await request(app).get('/api/v1/users/gdpr/data-export/req-1/download').expect(401);
    });

    it('should return JSON file with Content-Disposition header', async () => {
      const exportData = { user: { id: userId }, requests: [] };
      mockGdprRequestGetExportData.mockResolvedValue(exportData as never);

      const res = await request(app)
        .get('/api/v1/users/gdpr/data-export/req-1/download')
        .expect(200);

      expect(res.headers['content-disposition']).toContain('dreamscape-data-export.json');
    });

    it('should return 400 when export is not completed', async () => {
      mockGdprRequestGetExportData.mockRejectedValue(
        new Error('Export is not completed yet') as never
      );

      const res = await request(app)
        .get('/api/v1/users/gdpr/data-export/req-1/download')
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });
});
