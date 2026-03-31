import request from 'supertest';
import express, { Express } from 'express';
import { jest, describe, it, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'test-secret';
process.env.JWT_SECRET = JWT_SECRET;

// ── Prisma mock ───────────────────────────────────────────────────────────────
const mockTravelOnboardingProfileFindUnique = jest.fn();
const mockTravelOnboardingProfileCreate = jest.fn();
const mockTravelOnboardingProfileUpdate = jest.fn();
const mockTravelOnboardingProfileDelete = jest.fn();
const mockUserFindUnique = jest.fn();
const mockUserUpdate = jest.fn();
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

// ── Test data ─────────────────────────────────────────────────────────────────
const userId = 'user-123';
const validToken = jwt.sign({ userId, email: 'test@example.com', type: 'access' }, JWT_SECRET, { expiresIn: '7d' });

const mockProfile = {
  id: 'profile-1',
  userId,
  isCompleted: false,
  completedSteps: [],
  version: 1,
  travelTypes: [],
  accommodationTypes: [],
  preferredDestinations: null,
  globalBudgetRange: null,
  budgetByCategory: null,
  travelStyle: null,
  comfortLevel: null,
  accommodationLevel: null,
  activityLevel: null,
  riskTolerance: null,
  budgetFlexibility: null,
  dateFlexibility: null,
  travelGroupTypes: [],
  travelWithChildren: false,
  childrenAges: [],
  preferredSeasons: [],
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
  activityTypes: [],
  interestCategories: [],
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
};

const mockUser = {
  id: userId,
  email: 'test@example.com',
  onboardingCompleted: false,
  onboardingCompletedAt: null,
};

describe('Onboarding Routes', () => {
  let app: Express;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/users/onboarding', onboardingRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockTokenBlacklistFindUnique.mockResolvedValue(null as never);
    mockAnalyticsCreate.mockResolvedValue({} as never);
    mockUserFindUnique.mockResolvedValue(mockUser as never);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  // ─── GET / ────────────────────────────────────────────────────────────────
  describe('GET /', () => {
    it('should return 401 without token', async () => {
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

      expect(res.body).toHaveProperty('error');
    });

    it('should return 200 with the onboarding profile', async () => {
      mockTravelOnboardingProfileFindUnique.mockResolvedValue(mockProfile as never);

      const res = await request(app)
        .get('/api/v1/users/onboarding')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('profile-1');
    });
  });

  // ─── POST / ───────────────────────────────────────────────────────────────
  describe('POST /', () => {
    it('should return 401 without token', async () => {
      await request(app).post('/api/v1/users/onboarding').expect(401);
    });

    it('should return 200 when profile is created successfully', async () => {
      mockTravelOnboardingProfileFindUnique.mockResolvedValue(null as never);
      mockTravelOnboardingProfileCreate.mockResolvedValue(mockProfile as never);

      const res = await request(app)
        .post('/api/v1/users/onboarding')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('should return 409 when profile already exists', async () => {
      mockTravelOnboardingProfileFindUnique.mockResolvedValue(mockProfile as never);

      const res = await request(app)
        .post('/api/v1/users/onboarding')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(409);

      expect(res.body).toHaveProperty('error');
    });
  });

  // ─── PUT /step ────────────────────────────────────────────────────────────
  describe('PUT /step', () => {
    it('should return 401 without token', async () => {
      await request(app).put('/api/v1/users/onboarding/step').send({ step: 'destinations', data: {} }).expect(401);
    });

    it('should return 400 when step is missing', async () => {
      const res = await request(app)
        .put('/api/v1/users/onboarding/step')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ data: {} })
        .expect(400);

      expect(res.body).toHaveProperty('error');
    });

    it('should return 400 when data is missing', async () => {
      const res = await request(app)
        .put('/api/v1/users/onboarding/step')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ step: 'destinations' })
        .expect(400);

      expect(res.body).toHaveProperty('error');
    });

    it('should return 200 when step is updated successfully', async () => {
      const updatedProfile = { ...mockProfile, completedSteps: ['destinations'] };
      mockTravelOnboardingProfileFindUnique.mockResolvedValue(mockProfile as never);
      mockTravelOnboardingProfileUpdate.mockResolvedValue(updatedProfile as never);

      const res = await request(app)
        .put('/api/v1/users/onboarding/step')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ step: 'destinations', data: { regions: ['Europe'] } })
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('should return 400 for invalid budget (min >= max)', async () => {
      mockTravelOnboardingProfileFindUnique.mockResolvedValue(mockProfile as never);

      const res = await request(app)
        .put('/api/v1/users/onboarding/step')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ step: 'budget', data: { globalBudgetRange: { min: 1000, max: 500, currency: 'EUR' } } })
        .expect(400);

      expect(res.body).toHaveProperty('error');
    });
  });

  // ─── GET /progress ────────────────────────────────────────────────────────
  describe('GET /progress', () => {
    it('should return 401 without token', async () => {
      await request(app).get('/api/v1/users/onboarding/progress').expect(401);
    });

    it('should return 404 when profile does not exist', async () => {
      mockTravelOnboardingProfileFindUnique.mockResolvedValue(null as never);

      const res = await request(app)
        .get('/api/v1/users/onboarding/progress')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(404);

      expect(res.body).toHaveProperty('error');
    });

    it('should return 200 with progress data', async () => {
      const profileWithUser = { ...mockProfile, user: { onboardingCompleted: false, onboardingCompletedAt: null } };
      mockTravelOnboardingProfileFindUnique.mockResolvedValue(profileWithUser as never);

      const res = await request(app)
        .get('/api/v1/users/onboarding/progress')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('progressPercentage');
    });
  });

  // ─── POST /complete ───────────────────────────────────────────────────────
  describe('POST /complete', () => {
    it('should return 401 without token', async () => {
      await request(app).post('/api/v1/users/onboarding/complete').expect(401);
    });

    it('should return 400 when required steps are not completed', async () => {
      mockTravelOnboardingProfileFindUnique.mockResolvedValue(mockProfile as never);

      const res = await request(app)
        .post('/api/v1/users/onboarding/complete')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);

      expect(res.body).toHaveProperty('error');
    });

    it('should return 200 when onboarding is completed successfully', async () => {
      const completedProfile = {
        ...mockProfile,
        isCompleted: true,
        completedSteps: ['destinations', 'budget', 'travel_types', 'accommodation', 'transport'],
      };
      mockTravelOnboardingProfileFindUnique.mockResolvedValue(completedProfile as never);
      mockTravelOnboardingProfileUpdate.mockResolvedValue(completedProfile as never);
      mockUserUpdate.mockResolvedValue({ ...mockUser, onboardingCompleted: true } as never);

      const res = await request(app)
        .post('/api/v1/users/onboarding/complete')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });
  });

  // ─── DELETE / ─────────────────────────────────────────────────────────────
  describe('DELETE /', () => {
    it('should return 401 without token', async () => {
      await request(app).delete('/api/v1/users/onboarding').expect(401);
    });

    it('should return 200 when profile is deleted successfully', async () => {
      mockTravelOnboardingProfileFindUnique.mockResolvedValue(mockProfile as never);
      mockTravelOnboardingProfileDelete.mockResolvedValue(mockProfile as never);
      mockUserUpdate.mockResolvedValue(mockUser as never);

      const res = await request(app)
        .delete('/api/v1/users/onboarding')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('should return 404 when profile does not exist', async () => {
      const p2025Error = Object.assign(new Error('Not found'), { code: 'P2025' });
      mockTravelOnboardingProfileDelete.mockRejectedValue(p2025Error as never);

      const res = await request(app)
        .delete('/api/v1/users/onboarding')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(404);

      expect(res.body).toHaveProperty('error');
    });
  });
});
