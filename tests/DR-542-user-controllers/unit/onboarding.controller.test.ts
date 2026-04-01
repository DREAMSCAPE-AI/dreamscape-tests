import request from 'supertest';
import express, { Express } from 'express';
import jwt from 'jsonwebtoken';
import { jest, describe, it, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';

// Mock Prisma
const mockTravelOnboardingProfileFindUnique = jest.fn();
const mockTravelOnboardingProfileCreate = jest.fn();
const mockTravelOnboardingProfileUpdate = jest.fn();
const mockTravelOnboardingProfileDelete = jest.fn();
const mockUserUpdate = jest.fn();
const mockUserFindUnique = jest.fn();
const mockAnalyticsCreate = jest.fn();
const mockTokenBlacklistFindUnique = jest.fn();

jest.mock('@dreamscape/db', () => ({
  prisma: {
    travelOnboardingProfile: {
      findUnique: mockTravelOnboardingProfileFindUnique,
      create: mockTravelOnboardingProfileCreate,
      update: mockTravelOnboardingProfileUpdate,
      delete: mockTravelOnboardingProfileDelete,
    },
    user: {
      findUnique: mockUserFindUnique,
      update: mockUserUpdate,
    },
    analytics: {
      create: mockAnalyticsCreate,
    },
    tokenBlacklist: {
      findUnique: mockTokenBlacklistFindUnique,
    },
  },
}));

import onboardingRouter from '../../../../dreamscape-services/user/src/routes/onboarding';

const JWT_SECRET = 'test-jwt-secret-key-for-testing';
const testUserId = 'test-user-id-123';
const testUserEmail = 'test@example.com';

const mockProfile = {
  id: 'profile-1',
  userId: testUserId,
  isCompleted: false,
  completedSteps: [],
  version: 1,
  preferredDestinations: null,
  globalBudgetRange: null,
  budgetByCategory: null,
  preferredTripDuration: null,
  roomPreferences: null,
  groupSize: null,
  weatherTolerances: null,
  loyaltyPrograms: null,
  travelTypes: [],
  accommodationTypes: [],
  completedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  user: {
    onboardingCompleted: false,
    onboardingCompletedAt: null,
  },
};

describe('Onboarding Controller', () => {
  let app: Express;
  let validToken: string;

  beforeAll(() => {
    process.env.JWT_SECRET = JWT_SECRET;

    app = express();
    app.use(express.json());
    app.use('/api/v1/users/onboarding', onboardingRouter);
  });

  beforeEach(() => {
    validToken = jwt.sign(
      { userId: testUserId, email: testUserEmail, type: 'access' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    jest.clearAllMocks();

    // Default mocks for auth middleware
    mockTokenBlacklistFindUnique.mockResolvedValue(null as never);
    mockUserFindUnique.mockResolvedValue({
      id: testUserId,
      email: testUserEmail,
      role: 'USER',
    } as never);
    mockAnalyticsCreate.mockResolvedValue({} as never);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  // ─── getOnboardingProfile ───────────────────────────────────────────────────
  describe('GET /api/v1/users/onboarding', () => {
    it('should return 401 when no token is provided', async () => {
      const res = await request(app)
        .get('/api/v1/users/onboarding')
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it('should return 404 when profile does not exist', async () => {
      mockTravelOnboardingProfileFindUnique.mockResolvedValue(null as never);

      const res = await request(app)
        .get('/api/v1/users/onboarding')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(404);

      expect(res.body.error).toBeDefined();
    });

    it('should return 200 with profile when it exists', async () => {
      mockTravelOnboardingProfileFindUnique.mockResolvedValue(mockProfile as never);

      const res = await request(app)
        .get('/api/v1/users/onboarding')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.userId).toBe(testUserId);
    });

    it('should return 500 on internal error', async () => {
      mockTravelOnboardingProfileFindUnique.mockRejectedValue(new Error('DB error') as never);

      const res = await request(app)
        .get('/api/v1/users/onboarding')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(500);

      expect(res.body.error).toBeDefined();
    });

    it('should return 401 when auth middleware passes but user has no id', async () => {
      // Auth middleware finds user but without id → req.user.id undefined
      mockUserFindUnique.mockResolvedValue({ email: testUserEmail, role: 'USER' } as never);

      const res = await request(app)
        .get('/api/v1/users/onboarding')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(401);

      expect(res.body.error).toBeDefined();
    });
  });

  // ─── createOnboardingProfile ────────────────────────────────────────────────
  describe('POST /api/v1/users/onboarding', () => {
    it('should return 401 when no token is provided', async () => {
      await request(app).post('/api/v1/users/onboarding').expect(401);
    });

    it('should return 201 when profile is successfully created', async () => {
      mockTravelOnboardingProfileFindUnique.mockResolvedValue(null as never);
      mockTravelOnboardingProfileCreate.mockResolvedValue(mockProfile as never);

      const res = await request(app)
        .post('/api/v1/users/onboarding')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('created');
    });

    it('should return 409 when profile already exists', async () => {
      mockTravelOnboardingProfileFindUnique.mockResolvedValue(mockProfile as never);

      const res = await request(app)
        .post('/api/v1/users/onboarding')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(409);

      expect(res.body.error).toBeDefined();
    });

    it('should return 409 on Prisma P2002 unique constraint error', async () => {
      mockTravelOnboardingProfileFindUnique.mockResolvedValue(null as never);
      const p2002Err = Object.assign(new Error('Unique constraint'), { code: 'P2002' });
      mockTravelOnboardingProfileCreate.mockRejectedValue(p2002Err as never);

      const res = await request(app)
        .post('/api/v1/users/onboarding')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(409);

      expect(res.body.error).toBeDefined();
    });

    it('should return 500 on internal error', async () => {
      mockTravelOnboardingProfileFindUnique.mockResolvedValue(null as never);
      mockTravelOnboardingProfileCreate.mockRejectedValue(new Error('DB error') as never);

      const res = await request(app)
        .post('/api/v1/users/onboarding')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(500);

      expect(res.body.error).toBeDefined();
    });

    it('should return 401 when auth middleware passes but user has no id', async () => {
      mockUserFindUnique.mockResolvedValue({ email: testUserEmail, role: 'USER' } as never);

      const res = await request(app)
        .post('/api/v1/users/onboarding')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(401);

      expect(res.body.error).toBeDefined();
    });
  });

  // ─── updateOnboardingStep ───────────────────────────────────────────────────
  describe('PUT /api/v1/users/onboarding/step', () => {
    it('should return 401 when no token is provided', async () => {
      await request(app).put('/api/v1/users/onboarding/step').send({ step: 'budget', data: {} }).expect(401);
    });

    it('should return 400 when step is missing', async () => {
      const res = await request(app)
        .put('/api/v1/users/onboarding/step')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ data: {} })
        .expect(400);

      expect(res.body.error).toContain('Step is required');
    });

    it('should return 400 when data is missing', async () => {
      const res = await request(app)
        .put('/api/v1/users/onboarding/step')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ step: 'budget' })
        .expect(400);

      expect(res.body.error).toContain('Step data is required');
    });

    it('should return 400 when budget globalBudgetRange has min >= max', async () => {
      const res = await request(app)
        .put('/api/v1/users/onboarding/step')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          step: 'budget',
          data: { globalBudgetRange: { min: 1000, max: 500, currency: 'EUR' } },
        })
        .expect(400);

      expect(res.body.validationErrors).toBeDefined();
    });

    it('should return 400 when budget globalBudgetRange has no currency', async () => {
      const res = await request(app)
        .put('/api/v1/users/onboarding/step')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          step: 'budget',
          data: { globalBudgetRange: { min: 100, max: 500 } },
        })
        .expect(400);

      expect(res.body.validationErrors).toBeDefined();
    });

    it('should return 400 when destinations regions is not an array', async () => {
      const res = await request(app)
        .put('/api/v1/users/onboarding/step')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          step: 'destinations',
          data: { preferredDestinations: { regions: 'not-an-array' } },
        })
        .expect(400);

      expect(res.body.validationErrors).toBeDefined();
    });

    it('should return 400 when destinations countries is not an array', async () => {
      const res = await request(app)
        .put('/api/v1/users/onboarding/step')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          step: 'destinations',
          data: { preferredDestinations: { countries: 'France' } },
        })
        .expect(400);

      expect(res.body.validationErrors).toBeDefined();
    });

    it('should return 400 when travel_types contains invalid values', async () => {
      const res = await request(app)
        .put('/api/v1/users/onboarding/step')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          step: 'travel_types',
          data: { travelTypes: ['INVALID_TYPE'] },
        })
        .expect(400);

      expect(res.body.validationErrors).toBeDefined();
    });

    it('should return 400 when travel_types travelStyle is invalid', async () => {
      const res = await request(app)
        .put('/api/v1/users/onboarding/step')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          step: 'travel_types',
          data: { travelStyle: 'INVALID_STYLE' },
        })
        .expect(400);

      expect(res.body.validationErrors).toBeDefined();
    });

    it('should return 400 when group_travel has children but no childrenAges', async () => {
      const res = await request(app)
        .put('/api/v1/users/onboarding/step')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          step: 'group_travel',
          data: { travelWithChildren: true },
        })
        .expect(400);

      expect(res.body.validationErrors).toBeDefined();
    });

    it('should return 400 when comfort_service has invalid comfortLevel', async () => {
      const res = await request(app)
        .put('/api/v1/users/onboarding/step')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          step: 'comfort_service',
          data: { comfortLevel: 'ULTRA' },
        })
        .expect(400);

      expect(res.body.validationErrors).toBeDefined();
    });

    it('should return 400 when timing has invalid dateFlexibility', async () => {
      const res = await request(app)
        .put('/api/v1/users/onboarding/step')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          step: 'timing',
          data: { dateFlexibility: 'VERY_RIGID' },
        })
        .expect(400);

      expect(res.body.validationErrors).toBeDefined();
    });

    it('should return 400 when activities has invalid activityLevel', async () => {
      const res = await request(app)
        .put('/api/v1/users/onboarding/step')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          step: 'activities',
          data: { activityLevel: 'EXTREME' },
        })
        .expect(400);

      expect(res.body.validationErrors).toBeDefined();
    });

    it('should return 400 when experience has invalid riskTolerance', async () => {
      const res = await request(app)
        .put('/api/v1/users/onboarding/step')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          step: 'experience',
          data: { riskTolerance: 'INSANE' },
        })
        .expect(400);

      expect(res.body.validationErrors).toBeDefined();
    });

    it('should return 404 when profile does not exist', async () => {
      mockTravelOnboardingProfileFindUnique.mockResolvedValue(null as never);

      const res = await request(app)
        .put('/api/v1/users/onboarding/step')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          step: 'budget',
          data: { globalBudgetRange: { min: 100, max: 500, currency: 'EUR' } },
        })
        .expect(404);

      expect(res.body.error).toBeDefined();
    });

    it('should return 200 with updated profile and markCompleted=true', async () => {
      mockTravelOnboardingProfileFindUnique.mockResolvedValue(mockProfile as never);
      const updatedProfile = { ...mockProfile, completedSteps: ['budget'] };
      mockTravelOnboardingProfileUpdate.mockResolvedValue(updatedProfile as never);

      const res = await request(app)
        .put('/api/v1/users/onboarding/step')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          step: 'budget',
          data: { globalBudgetRange: { min: 100, max: 500, currency: 'EUR' } },
          markCompleted: true,
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('budget');
    });

    it('should return 500 on internal error', async () => {
      mockTravelOnboardingProfileFindUnique.mockRejectedValue(new Error('DB error') as never);

      const res = await request(app)
        .put('/api/v1/users/onboarding/step')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ step: 'budget', data: { globalBudgetRange: { min: 100, max: 500, currency: 'EUR' } } })
        .expect(500);

      expect(res.body.error).toBeDefined();
    });

    it('should return 400 when budget globalBudgetRange has negative min', async () => {
      const res = await request(app)
        .put('/api/v1/users/onboarding/step')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          step: 'budget',
          data: { globalBudgetRange: { min: -100, max: 500, currency: 'EUR' } },
        })
        .expect(400);

      expect(res.body.validationErrors).toBeDefined();
    });

    it('should return 400 when budget globalBudgetRange has negative max', async () => {
      const res = await request(app)
        .put('/api/v1/users/onboarding/step')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          step: 'budget',
          data: { globalBudgetRange: { min: 100, max: -500, currency: 'EUR' } },
        })
        .expect(400);

      expect(res.body.validationErrors).toBeDefined();
    });

    it('should return 400 when destinations climates is not an array', async () => {
      const res = await request(app)
        .put('/api/v1/users/onboarding/step')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          step: 'destinations',
          data: { preferredDestinations: { climates: 'tropical' } },
        })
        .expect(400);

      expect(res.body.validationErrors).toBeDefined();
    });

    it('should return 400 when travel_types travelTypes is not an array', async () => {
      const res = await request(app)
        .put('/api/v1/users/onboarding/step')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          step: 'travel_types',
          data: { travelTypes: 'ADVENTURE' },
        })
        .expect(400);

      expect(res.body.validationErrors).toBeDefined();
    });

    it('should return 404 on Prisma P2025 when profile not found during update', async () => {
      mockTravelOnboardingProfileFindUnique.mockResolvedValue(mockProfile as never);
      const p2025Err = Object.assign(new Error('Record not found'), { code: 'P2025' });
      mockTravelOnboardingProfileUpdate.mockRejectedValue(p2025Err as never);

      const res = await request(app)
        .put('/api/v1/users/onboarding/step')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          step: 'budget',
          data: { globalBudgetRange: { min: 100, max: 500, currency: 'EUR' } },
          markCompleted: true,
        })
        .expect(404);

      expect(res.body.error).toBeDefined();
    });

    it('should return 401 when auth middleware passes but user has no id', async () => {
      mockUserFindUnique.mockResolvedValue({ email: testUserEmail, role: 'USER' } as never);

      const res = await request(app)
        .put('/api/v1/users/onboarding/step')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ step: 'budget', data: {} })
        .expect(401);

      expect(res.body.error).toBeDefined();
    });
  });

  // ─── getOnboardingProgress ──────────────────────────────────────────────────
  describe('GET /api/v1/users/onboarding/progress', () => {
    it('should return 401 when no token is provided', async () => {
      await request(app).get('/api/v1/users/onboarding/progress').expect(401);
    });

    it('should return 404 when profile does not exist', async () => {
      mockTravelOnboardingProfileFindUnique.mockResolvedValue(null as never);

      await request(app)
        .get('/api/v1/users/onboarding/progress')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(404);
    });

    it('should return correct progress percentage', async () => {
      const profileWith2Steps = {
        ...mockProfile,
        completedSteps: ['destinations', 'budget'],
      };
      mockTravelOnboardingProfileFindUnique.mockResolvedValue(profileWith2Steps as never);

      const res = await request(app)
        .get('/api/v1/users/onboarding/progress')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      // 2 out of 13 steps = ~15%
      expect(res.body.data.progressPercentage).toBe(Math.round((2 / 13) * 100));
      expect(res.body.data.completedSteps).toHaveLength(2);
    });

    it('should return nextRecommendedStep as the first uncompleted step', async () => {
      const profileWith1Step = {
        ...mockProfile,
        completedSteps: ['destinations'],
      };
      mockTravelOnboardingProfileFindUnique.mockResolvedValue(profileWith1Step as never);

      const res = await request(app)
        .get('/api/v1/users/onboarding/progress')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(res.body.data.nextRecommendedStep).toBe('budget');
    });

    it('should return 500 on internal error', async () => {
      mockTravelOnboardingProfileFindUnique.mockRejectedValue(new Error('DB error') as never);

      await request(app)
        .get('/api/v1/users/onboarding/progress')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(500);
    });

    it('should return 401 when auth middleware passes but user has no id', async () => {
      mockUserFindUnique.mockResolvedValue({ email: testUserEmail, role: 'USER' } as never);

      const res = await request(app)
        .get('/api/v1/users/onboarding/progress')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(401);

      expect(res.body.error).toBeDefined();
    });
  });

  // ─── completeOnboarding ─────────────────────────────────────────────────────
  describe('POST /api/v1/users/onboarding/complete', () => {
    it('should return 401 when no token is provided', async () => {
      await request(app).post('/api/v1/users/onboarding/complete').expect(401);
    });

    it('should return 404 when profile does not exist', async () => {
      mockTravelOnboardingProfileFindUnique.mockResolvedValue(null as never);

      await request(app)
        .post('/api/v1/users/onboarding/complete')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(404);
    });

    it('should return 400 when required steps are missing', async () => {
      mockTravelOnboardingProfileFindUnique.mockResolvedValue({
        ...mockProfile,
        completedSteps: ['destinations'], // missing budget, travel_types, accommodation, transport
      } as never);

      const res = await request(app)
        .post('/api/v1/users/onboarding/complete')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);

      expect(res.body.error).toContain('Missing required steps');
    });

    it('should return 200 when all required steps are completed', async () => {
      const requiredSteps = ['destinations', 'budget', 'travel_types', 'accommodation', 'transport'];
      mockTravelOnboardingProfileFindUnique.mockResolvedValue({
        ...mockProfile,
        completedSteps: requiredSteps,
      } as never);
      mockTravelOnboardingProfileUpdate.mockResolvedValue({ ...mockProfile, isCompleted: true } as never);
      mockUserUpdate.mockResolvedValue({ id: testUserId, onboardingCompleted: true, onboardingCompletedAt: new Date() } as never);

      const res = await request(app)
        .post('/api/v1/users/onboarding/complete')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('completed');
    });

    it('should return 500 on internal error', async () => {
      mockTravelOnboardingProfileFindUnique.mockRejectedValue(new Error('DB error') as never);

      await request(app)
        .post('/api/v1/users/onboarding/complete')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(500);
    });

    it('should return 401 when auth middleware passes but user has no id', async () => {
      mockUserFindUnique.mockResolvedValue({ email: testUserEmail, role: 'USER' } as never);

      const res = await request(app)
        .post('/api/v1/users/onboarding/complete')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(401);

      expect(res.body.error).toBeDefined();
    });
  });

  // ─── deleteOnboardingProfile ────────────────────────────────────────────────
  describe('DELETE /api/v1/users/onboarding', () => {
    it('should return 401 when no token is provided', async () => {
      await request(app).delete('/api/v1/users/onboarding').expect(401);
    });

    it('should return 200 when profile is successfully deleted', async () => {
      mockTravelOnboardingProfileDelete.mockResolvedValue(mockProfile as never);
      mockUserUpdate.mockResolvedValue({ id: testUserId } as never);

      const res = await request(app)
        .delete('/api/v1/users/onboarding')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('deleted');
      expect(mockUserUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { onboardingCompleted: false, onboardingCompletedAt: null },
        })
      );
    });

    it('should return 404 on Prisma P2025 (record not found)', async () => {
      const p2025Err = Object.assign(new Error('Record not found'), { code: 'P2025' });
      mockTravelOnboardingProfileDelete.mockRejectedValue(p2025Err as never);

      const res = await request(app)
        .delete('/api/v1/users/onboarding')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(404);

      expect(res.body.error).toBeDefined();
    });

    it('should return 500 on internal error', async () => {
      mockTravelOnboardingProfileDelete.mockRejectedValue(new Error('DB error') as never);

      await request(app)
        .delete('/api/v1/users/onboarding')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(500);
    });

    it('should return 401 when auth middleware passes but user has no id', async () => {
      mockUserFindUnique.mockResolvedValue({ email: testUserEmail, role: 'USER' } as never);

      const res = await request(app)
        .delete('/api/v1/users/onboarding')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(401);

      expect(res.body.error).toBeDefined();
    });
  });
});
