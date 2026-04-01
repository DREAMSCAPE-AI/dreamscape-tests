import request from 'supertest';
import express, { Express } from 'express';
import { jest, describe, it, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';

// ── Prisma mock ───────────────────────────────────────────────────────────────
const mockUserFindUnique = jest.fn();
const mockUserFindMany = jest.fn();
const mockUserCount = jest.fn();
const mockTravelOnboardingProfileCount = jest.fn();
const mockAnalyticsCreate = jest.fn();
const mockAnalyticsCount = jest.fn();

jest.mock('@dreamscape/db', () => ({
  prisma: {
    user: {
      findUnique: mockUserFindUnique,
      findMany: mockUserFindMany,
      count: mockUserCount,
    },
    travelOnboardingProfile: {
      count: mockTravelOnboardingProfileCount,
    },
    analytics: {
      create: mockAnalyticsCreate,
      count: mockAnalyticsCount,
    },
  },
}));

import aiIntegrationRouter from '../../../../dreamscape-services/user/src/routes/aiIntegration';

// ── Test data ─────────────────────────────────────────────────────────────────
const userId = 'user-123';

const mockUser = {
  id: userId,
  email: 'test@example.com',
  onboardingCompleted: true,
  onboardingCompletedAt: new Date(),
  updatedAt: new Date(),
  travelOnboarding: {
    id: 'profile-1',
    userId,
    isCompleted: true,
    completedSteps: ['destinations', 'budget', 'travel_types'],
    version: 1,
    travelTypes: ['ADVENTURE'],
    accommodationTypes: ['HOTEL'],
    preferredDestinations: { regions: ['Europe'], countries: ['France'], climates: ['temperate'] },
    globalBudgetRange: { min: 500, max: 2000, currency: 'EUR' },
    budgetByCategory: null,
    travelStyle: 'PLANNED',
    comfortLevel: null,
    accommodationLevel: 'STANDARD',
    activityLevel: 'MODERATE',
    riskTolerance: 'MODERATE',
    budgetFlexibility: 'FLEXIBLE',
    dateFlexibility: 'FLEXIBLE',
    travelGroupTypes: [],
    travelWithChildren: false,
    childrenAges: [],
    preferredSeasons: ['SPRING'],
    weatherTolerances: null,
    preferredTripDuration: null,
    roomPreferences: null,
    groupSize: null,
    loyaltyPrograms: null,
    paymentPreferences: [],
    preferredAirlines: [],
    cabinClassPreference: null,
    transportModes: [],
    transportBudgetShare: null,
    activityTypes: ['hiking'],
    interestCategories: ['culture'],
    dietaryRequirements: [],
    accessibilityNeeds: [],
    healthConsiderations: [],
    culturalConsiderations: [],
    languageBarriers: [],
    experienceLevel: null,
    culturalImmersion: null,
    climatePreferences: [],
    travelPurposes: [],
    serviceLevel: null,
    privacyPreference: null,
    updatedAt: new Date(),
  },
  settings: null,
  preferences: null,
};

describe('AI Integration Routes', () => {
  let app: Express;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/ai', aiIntegrationRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockAnalyticsCreate.mockResolvedValue({} as never);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  // ─── GET /users/:userId/preferences ───────────────────────────────────────
  describe('GET /users/:userId/preferences', () => {
    it('should return 404 when user does not exist', async () => {
      mockUserFindUnique.mockResolvedValue(null as never);

      const res = await request(app)
        .get(`/api/v1/ai/users/${userId}/preferences`)
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it('should return 200 with AI-formatted preferences', async () => {
      mockUserFindUnique.mockResolvedValue(mockUser as never);

      const res = await request(app)
        .get(`/api/v1/ai/users/${userId}/preferences`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.userId).toBe(userId);
      expect(res.body.data.preferences).toBeDefined();
      expect(res.body.data.metadata).toBeDefined();
    });

    it('should return 200 with empty preferences when user has no onboarding', async () => {
      mockUserFindUnique.mockResolvedValue({ ...mockUser, travelOnboarding: null } as never);

      const res = await request(app)
        .get(`/api/v1/ai/users/${userId}/preferences`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.preferences.destinations.regions).toEqual([]);
    });

    it('should return 500 on internal error', async () => {
      mockUserFindUnique.mockRejectedValue(new Error('DB error') as never);

      const res = await request(app)
        .get(`/api/v1/ai/users/${userId}/preferences`)
        .expect(500);

      expect(res.body.success).toBe(false);
    });
  });

  // ─── POST /users/preferences/batch ────────────────────────────────────────
  describe('POST /users/preferences/batch', () => {
    it('should return 400 when userIds is not an array', async () => {
      const res = await request(app)
        .post('/api/v1/ai/users/preferences/batch')
        .send({ userIds: 'not-array' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should return 400 when userIds is empty', async () => {
      const res = await request(app)
        .post('/api/v1/ai/users/preferences/batch')
        .send({ userIds: [] })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should return 400 when more than 100 userIds are provided', async () => {
      const userIds = Array.from({ length: 101 }, (_, i) => `user-${i}`);

      const res = await request(app)
        .post('/api/v1/ai/users/preferences/batch')
        .send({ userIds })
        .expect(400);

      expect(res.body.error).toContain('Maximum 100');
    });

    it('should return 200 with batch preferences and meta', async () => {
      mockUserFindMany.mockResolvedValue([mockUser] as never);

      const res = await request(app)
        .post('/api/v1/ai/users/preferences/batch')
        .send({ userIds: [userId] })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.users).toHaveLength(1);
      expect(res.body.data.meta.requested).toBe(1);
      expect(res.body.data.meta.found).toBe(1);
    });

    it('should report not-found users in meta', async () => {
      mockUserFindMany.mockResolvedValue([mockUser] as never);

      const res = await request(app)
        .post('/api/v1/ai/users/preferences/batch')
        .send({ userIds: [userId, 'missing-user'] })
        .expect(200);

      expect(res.body.data.meta.notFound).toContain('missing-user');
    });

    it('should return 500 on internal error', async () => {
      mockUserFindMany.mockRejectedValue(new Error('DB error') as never);

      const res = await request(app)
        .post('/api/v1/ai/users/preferences/batch')
        .send({ userIds: [userId] })
        .expect(500);

      expect(res.body.success).toBe(false);
    });
  });

  // ─── GET /health ───────────────────────────────────────────────────────────
  describe('GET /health', () => {
    beforeEach(() => {
      mockUserCount
        .mockResolvedValueOnce(100 as never)
        .mockResolvedValueOnce(60 as never);
      mockTravelOnboardingProfileCount
        .mockResolvedValueOnce(80 as never)
        .mockResolvedValueOnce(50 as never);
      mockAnalyticsCount.mockResolvedValue(25 as never);
    });

    it('should return 200 with health data structure', async () => {
      const res = await request(app)
        .get('/api/v1/ai/health')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.totalUsers).toBeDefined();
      expect(res.body.data.onboardingStats).toBeDefined();
      expect(res.body.data.healthStatus).toBeDefined();
    });

    it('should return healthStatus "healthy" when completedProfiles > 0', async () => {
      const res = await request(app)
        .get('/api/v1/ai/health')
        .expect(200);

      expect(res.body.data.healthStatus.overall).toBe('healthy');
    });

    it('should return 500 on internal error', async () => {
      jest.resetAllMocks();
      mockUserCount.mockRejectedValue(new Error('DB error') as never);
      mockAnalyticsCreate.mockResolvedValue({} as never);

      const res = await request(app)
        .get('/api/v1/ai/health')
        .expect(500);

      expect(res.body.success).toBe(false);
    });
  });
});
