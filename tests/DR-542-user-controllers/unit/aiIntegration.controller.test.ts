import request from 'supertest';
import express, { Express } from 'express';
import { jest, describe, it, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';

// Mock Prisma — no auth needed for these internal endpoints
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
    travelTypes: ['ADVENTURE', 'CULTURAL'],
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

describe('AI Integration Controller', () => {
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

  // ─── getUserPreferencesForAI ─────────────────────────────────────────────────
  describe('GET /api/v1/ai/users/:userId/preferences', () => {
    it('should return 400 when userId param is missing', async () => {
      // Route requires a userId param — calling without it hits a different route
      const res = await request(app)
        .get('/api/v1/ai/users//preferences')
        .expect(404); // express returns 404 for empty segment

      // Confirm no data leak
      expect(res.body.data).toBeUndefined();
    });

    it('should return 404 when user does not exist', async () => {
      mockUserFindUnique.mockResolvedValue(null as never);

      const res = await request(app)
        .get(`/api/v1/ai/users/${userId}/preferences`)
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('not found');
    });

    it('should return 200 with AI-formatted preferences for a user with onboarding profile', async () => {
      mockUserFindUnique.mockResolvedValue(mockUser as never);

      const res = await request(app)
        .get(`/api/v1/ai/users/${userId}/preferences`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.userId).toBe(userId);
      expect(res.body.data.isOnboardingCompleted).toBe(true);
      expect(res.body.data.preferences).toBeDefined();
      expect(res.body.data.metadata).toBeDefined();
    });

    it('should return 200 with empty preferences when user has no onboarding profile', async () => {
      mockUserFindUnique.mockResolvedValue({ ...mockUser, travelOnboarding: null } as never);

      const res = await request(app)
        .get(`/api/v1/ai/users/${userId}/preferences`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.preferences.destinations.regions).toEqual([]);
      expect(res.body.data.preferences.travel.types).toEqual([]);
    });

    it('should include data quality metrics in metadata', async () => {
      mockUserFindUnique.mockResolvedValue(mockUser as never);

      const res = await request(app)
        .get(`/api/v1/ai/users/${userId}/preferences`)
        .expect(200);

      expect(res.body.data.metadata.dataQuality.completeness).toBeGreaterThanOrEqual(0);
      expect(res.body.data.metadata.dataQuality.completeness).toBeLessThanOrEqual(100);
      expect(res.body.data.metadata.dataQuality.confidence).toBeGreaterThanOrEqual(0);
    });

    it('should create an analytics event on success', async () => {
      mockUserFindUnique.mockResolvedValue(mockUser as never);

      await request(app).get(`/api/v1/ai/users/${userId}/preferences`).expect(200);

      expect(mockAnalyticsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            event: 'ai_preferences_requested',
            userId,
          }),
        })
      );
    });

    it('should return 500 on internal error', async () => {
      mockUserFindUnique.mockRejectedValue(new Error('DB error') as never);

      const res = await request(app)
        .get(`/api/v1/ai/users/${userId}/preferences`)
        .expect(500);

      expect(res.body.success).toBe(false);
    });

    it('should map loyaltyPrograms when profile has loyalty entries', async () => {
      const userWithLoyalty = {
        ...mockUser,
        travelOnboarding: {
          ...mockUser.travelOnboarding,
          loyaltyPrograms: [
            { program: 'Air France Flying Blue', level: 'Gold', priority: 1 },
            { program: 'Marriott Bonvoy', level: 'Platinum', priority: 2 },
          ],
        },
      };
      mockUserFindUnique.mockResolvedValue(userWithLoyalty as never);

      const res = await request(app)
        .get(`/api/v1/ai/users/${userId}/preferences`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.preferences.loyalty.programs).toHaveLength(2);
      expect(res.body.data.preferences.loyalty.programs[0].program).toBe('Air France Flying Blue');
    });
  });

  // ─── getBatchUserPreferencesForAI ────────────────────────────────────────────
  describe('POST /api/v1/ai/users/preferences/batch', () => {
    it('should return 400 when userIds is not an array', async () => {
      const res = await request(app)
        .post('/api/v1/ai/users/preferences/batch')
        .send({ userIds: 'not-an-array' })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('array');
    });

    it('should return 400 when userIds is empty array', async () => {
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
      expect(res.body.data.meta.notFound).toHaveLength(0);
    });

    it('should correctly report notFound users in meta', async () => {
      mockUserFindMany.mockResolvedValue([mockUser] as never);

      const res = await request(app)
        .post('/api/v1/ai/users/preferences/batch')
        .send({ userIds: [userId, 'missing-user-id'] })
        .expect(200);

      expect(res.body.data.meta.requested).toBe(2);
      expect(res.body.data.meta.found).toBe(1);
      expect(res.body.data.meta.notFound).toContain('missing-user-id');
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

  // ─── getAIIntegrationHealth ──────────────────────────────────────────────────
  describe('GET /api/v1/ai/health', () => {
    beforeEach(() => {
      mockUserCount
        .mockResolvedValueOnce(100 as never)  // totalUsers
        .mockResolvedValueOnce(60 as never);  // completedUsers
      mockTravelOnboardingProfileCount
        .mockResolvedValueOnce(80 as never)   // totalProfiles
        .mockResolvedValueOnce(50 as never);  // completedProfiles
      mockAnalyticsCount.mockResolvedValue(25 as never);
    });

    it('should return 200 with health data structure', async () => {
      const res = await request(app)
        .get('/api/v1/ai/health')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.totalUsers).toBeDefined();
      expect(res.body.data.onboardingStats).toBeDefined();
      expect(res.body.data.aiIntegration).toBeDefined();
      expect(res.body.data.healthStatus).toBeDefined();
    });

    it('should calculate completionRate correctly', async () => {
      const res = await request(app)
        .get('/api/v1/ai/health')
        .expect(200);

      // 60 completed / 100 total = 60%
      expect(res.body.data.onboardingStats.completionRate).toBe(60);
    });

    it('should return healthStatus.overall as "healthy" when completedProfiles > 0', async () => {
      const res = await request(app)
        .get('/api/v1/ai/health')
        .expect(200);

      expect(res.body.data.healthStatus.overall).toBe('healthy');
    });

    it('should return healthStatus.overall as "warning" when completedProfiles is 0', async () => {
      // Reset and re-mock with 0 completedProfiles
      jest.resetAllMocks();
      mockAnalyticsCreate.mockResolvedValue({} as never);
      mockUserCount
        .mockResolvedValueOnce(10 as never)
        .mockResolvedValueOnce(0 as never);
      mockTravelOnboardingProfileCount
        .mockResolvedValueOnce(5 as never)
        .mockResolvedValueOnce(0 as never); // completedProfiles = 0
      mockAnalyticsCount.mockResolvedValue(0 as never);
      mockAnalyticsCreate.mockResolvedValue({} as never);

      const res = await request(app)
        .get('/api/v1/ai/health')
        .expect(200);

      expect(res.body.data.healthStatus.overall).toBe('warning');
    });

    it('should safely handle 0 total users (avoid division by zero)', async () => {
      jest.resetAllMocks();
      mockAnalyticsCreate.mockResolvedValue({} as never);
      mockUserCount.mockResolvedValue(0 as never);
      mockTravelOnboardingProfileCount.mockResolvedValue(0 as never);
      mockAnalyticsCount.mockResolvedValue(0 as never);
      mockAnalyticsCreate.mockResolvedValue({} as never);

      const res = await request(app)
        .get('/api/v1/ai/health')
        .expect(200);

      expect(res.body.data.onboardingStats.completionRate).toBe(0);
    });

    it('should return 500 on internal error', async () => {
      jest.resetAllMocks();
      mockAnalyticsCreate.mockResolvedValue({} as never);
      mockUserCount.mockRejectedValue(new Error('DB error') as never);

      const res = await request(app)
        .get('/api/v1/ai/health')
        .expect(500);

      expect(res.body.success).toBe(false);
    });
  });
});
