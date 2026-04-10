/**
 * US-TEST-019 — OnboardingOrchestratorService Unit Tests
 *
 * Tests for OnboardingOrchestratorService (IA-002.3):
 * - processOnboardingComplete (success, onboardingData provided, fetch from API, not completed, fallback)
 * - refineUserProfile (no vector, small change, > 0.15 change, > 0.2 change, error)
 */

import * as http from 'http';

jest.mock('@dreamscape/db', () => ({
  prisma: {
    userVector: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('axios', () => ({
  __esModule: true,
  default: jest.requireActual('axios').default,
}));

jest.mock('@ai/onboarding/onboarding-to-vector.service', () => ({
  OnboardingToVectorService: jest.fn().mockImplementation(() => ({
    transformToEnrichedVector: jest.fn(),
    refineVectorFromInteraction: jest.fn(),
    segmentEngine: {
      assignSegment: jest.fn(),
    },
  })),
}));

jest.mock('@ai/recommendations/cold-start.service', () => ({
  ColdStartService: jest.fn().mockImplementation(() => ({
    getHybridRecommendations: jest.fn(),
    getRecommendationsForNewUser: jest.fn(),
  })),
}));

import { prisma } from '@dreamscape/db';
import { OnboardingOrchestratorService } from '@ai/onboarding/onboarding-orchestrator.service';
import { OnboardingToVectorService } from '@ai/onboarding/onboarding-to-vector.service';
import { ColdStartService } from '@ai/recommendations/cold-start.service';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

const getAxiosClient = () => {
  const axiosModule = require('axios');
  return axiosModule.default || axiosModule;
};

const makeEnrichedVector = (overrides: any = {}) => ({
  vector: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
  primarySegment: 'BUDGET_BACKPACKER',
  confidence: 0.85,
  source: 'segment_blended',
  baseVector: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
  ...overrides,
});

describe('US-TEST-019 — OnboardingOrchestratorService', () => {
  let service: OnboardingOrchestratorService;
  let mockOTV: any;
  let mockColdStart: any;

  beforeEach(() => {
    jest.clearAllMocks();
    getAxiosClient().get = jest.fn();
    service = new OnboardingOrchestratorService();
    const otvMock = OnboardingToVectorService as jest.MockedClass<typeof OnboardingToVectorService>;
    const coldStartMock = ColdStartService as jest.MockedClass<typeof ColdStartService>;
    mockOTV = otvMock.mock.results[otvMock.mock.results.length - 1]?.value;
    mockColdStart = coldStartMock.mock.results[coldStartMock.mock.results.length - 1]?.value;
  });

  // ─── processOnboardingComplete ────────────────────────────────────────────────

  describe('processOnboardingComplete', () => {
    it('should use provided onboardingData without fetching from API', async () => {
      const profile = { isOnboardingCompleted: true, travelStyle: 'adventure' };
      const enrichedVec = makeEnrichedVector();
      const recommendations = [{ id: 'rec-1' }, { id: 'rec-2' }];

      mockOTV.transformToEnrichedVector.mockResolvedValue(enrichedVec);
      (mockPrisma.userVector.upsert as jest.Mock).mockResolvedValue({});
      mockColdStart.getHybridRecommendations.mockResolvedValue(recommendations);

      const result = await service.processOnboardingComplete('user-1', profile);

      expect(getAxiosClient().get).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.fallback).toBeFalsy();
    });

    it('should fetch preferences from API when onboardingData is not provided', async () => {
      const profile = { isOnboardingCompleted: true };
      const fetchSpy = jest
        .spyOn(service as any, 'fetchUserPreferences')
        .mockResolvedValue(profile);
      mockOTV.transformToEnrichedVector.mockResolvedValue(makeEnrichedVector());
      (mockPrisma.userVector.upsert as jest.Mock).mockResolvedValue({});
      mockColdStart.getHybridRecommendations.mockResolvedValue([]);

      const result = await service.processOnboardingComplete('user-1');

      expect(fetchSpy).toHaveBeenCalledWith('user-1');
      expect(result.success).toBe(true);
    });

    it('should return failure when onboarding is not completed', async () => {
      const profile = { isOnboardingCompleted: false };

      const result = await service.processOnboardingComplete('user-1', profile);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Onboarding not completed');
      expect(result.recommendations).toHaveLength(0);
    });

    it('should return failure when profile is null (fetched but null)', async () => {
      jest.spyOn(service as any, 'fetchUserPreferences').mockResolvedValue(null);

      const result = await service.processOnboardingComplete('user-1');

      expect(result.success).toBe(false);
    });

    it('should include userVector info in success response', async () => {
      const profile = { isOnboardingCompleted: true };
      const enrichedVec = makeEnrichedVector({ primarySegment: 'LUXURY_TRAVELER', confidence: 0.9 });
      mockOTV.transformToEnrichedVector.mockResolvedValue(enrichedVec);
      (mockPrisma.userVector.upsert as jest.Mock).mockResolvedValue({});
      mockColdStart.getHybridRecommendations.mockResolvedValue([{ id: 'r1' }, { id: 'r2' }]);

      const result = await service.processOnboardingComplete('user-1', profile);

      expect(result.userVector?.primarySegment).toBe('LUXURY_TRAVELER');
      expect(result.metadata.segmentAssigned).toBe('LUXURY_TRAVELER');
      expect(result.metadata.confidence).toBe(0.9);
    });

    it('should return top 10 recommendations from generated list', async () => {
      const profile = { isOnboardingCompleted: true };
      mockOTV.transformToEnrichedVector.mockResolvedValue(makeEnrichedVector());
      (mockPrisma.userVector.upsert as jest.Mock).mockResolvedValue({});
      // Generate 15 recommendations
      const recs = Array.from({ length: 15 }, (_, i) => ({ id: `rec-${i}` }));
      mockColdStart.getHybridRecommendations.mockResolvedValue(recs);

      const result = await service.processOnboardingComplete('user-1', profile);

      expect(result.recommendations).toHaveLength(10);
    });

    it('should fall back to popularity when main flow throws, and return fallback:true', async () => {
      const profile = { isOnboardingCompleted: true };
      mockOTV.transformToEnrichedVector.mockRejectedValue(new Error('Vector generation failed'));
      const fallbackRecs = [{ id: 'fallback-rec' }];
      mockColdStart.getRecommendationsForNewUser.mockResolvedValue(fallbackRecs);

      const result = await service.processOnboardingComplete('user-1', profile);

      expect(result.success).toBe(true);
      expect(result.fallback).toBe(true);
      expect(result.metadata.strategy).toBe('popularity_fallback');
    });

    it('should return failure when both main flow and fallback fail', async () => {
      const profile = { isOnboardingCompleted: true };
      mockOTV.transformToEnrichedVector.mockRejectedValue(new Error('Vector error'));
      mockColdStart.getRecommendationsForNewUser.mockRejectedValue(new Error('Fallback also failed'));

      const result = await service.processOnboardingComplete('user-1', profile);

      expect(result.success).toBe(false);
      expect(result.error).toBe('All recommendation strategies failed');
    });

    it('should save enriched vector with baseVector (segments populated)', async () => {
      const profile = { isOnboardingCompleted: true };
      const enrichedVec = makeEnrichedVector({ baseVector: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5] });
      mockOTV.transformToEnrichedVector.mockResolvedValue(enrichedVec);
      (mockPrisma.userVector.upsert as jest.Mock).mockResolvedValue({});
      mockColdStart.getHybridRecommendations.mockResolvedValue([]);

      await service.processOnboardingComplete('user-1', profile);

      expect(mockPrisma.userVector.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ userId: 'user-1' }),
        })
      );
    });
  });

  // ─── refineUserProfile ────────────────────────────────────────────────────────

  describe('refineUserProfile', () => {
    const interaction = { type: 'view' as const, destinationId: 'dest-1' };

    it('should return all-false result when no userVector found', async () => {
      (mockPrisma.userVector.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.refineUserProfile('user-1', interaction);

      expect(result).toEqual({
        vectorUpdated: false,
        segmentsChanged: false,
        newRecommendationsGenerated: false,
      });
    });

    it('should return all-false when an error occurs', async () => {
      (mockPrisma.userVector.findUnique as jest.Mock).mockRejectedValue(new Error('DB error'));

      const result = await service.refineUserProfile('user-1', interaction);

      expect(result.vectorUpdated).toBe(false);
      expect(result.segmentsChanged).toBe(false);
    });

    it('should update vector and return vectorUpdated:true on small change (no regen)', async () => {
      const existingVec = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
      // Small change: only 0.01 diff in one dimension → distance ≈ 0.0035 (< 0.15)
      const updatedVec = [0.51, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];

      (mockPrisma.userVector.findUnique as jest.Mock).mockResolvedValue({
        id: 'uv-1',
        vector: existingVec,
        segments: [],
        usageCount: 1,
        primarySegment: 'BUDGET_BACKPACKER',
      });
      mockOTV.refineVectorFromInteraction.mockResolvedValue(updatedVec);
      (mockPrisma.userVector.update as jest.Mock).mockResolvedValue({});

      const result = await service.refineUserProfile('user-1', interaction);

      expect(result.vectorUpdated).toBe(true);
      expect(result.segmentsChanged).toBe(false);
      expect(result.newRecommendationsGenerated).toBe(false);
    });

    it('should regenerate recommendations when vectorChange > 0.15', async () => {
      const existingVec = [0, 0, 0, 0, 0, 0, 0, 0];
      // Large change: all 1s → distance = sqrt(8)/sqrt(8) = 1.0 > 0.15
      const updatedVec = [1, 1, 1, 1, 1, 1, 1, 1];

      (mockPrisma.userVector.findUnique as jest.Mock).mockResolvedValue({
        id: 'uv-1',
        vector: existingVec,
        segments: [],
        usageCount: 1,
        primarySegment: 'BUDGET_BACKPACKER',
      });
      mockOTV.refineVectorFromInteraction.mockResolvedValue(updatedVec);
      // segment engine for > 0.2 change
      mockOTV.segmentEngine = {
        assignSegment: jest.fn().mockResolvedValue([
          { segment: 'LUXURY_TRAVELER', score: 0.8, reasons: [], assignedAt: new Date() },
        ]),
      };
      jest
        .spyOn(service as any, 'fetchUserPreferences')
        .mockResolvedValue({ isOnboardingCompleted: true });
      (mockPrisma.userVector.update as jest.Mock).mockResolvedValue({});

      const result = await service.refineUserProfile('user-1', interaction);

      expect(result.vectorUpdated).toBe(true);
      expect(result.newRecommendationsGenerated).toBe(true);
      expect(result.segmentsChanged).toBe(true);
    });

    it('should regenerate recommendations when usageCount is multiple of 10', async () => {
      const vec = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
      // Same vector → change ≈ 0 (< 0.15), but usageCount=10
      (mockPrisma.userVector.findUnique as jest.Mock).mockResolvedValue({
        id: 'uv-1',
        vector: vec,
        segments: [],
        usageCount: 10,
        primarySegment: 'BUDGET_BACKPACKER',
      });
      mockOTV.refineVectorFromInteraction.mockResolvedValue(vec);
      (mockPrisma.userVector.update as jest.Mock).mockResolvedValue({});

      const result = await service.refineUserProfile('user-1', interaction);

      expect(result.newRecommendationsGenerated).toBe(true);
    });
  });

  describe('private helpers', () => {
    it('should fetch preferences from user service on success', async () => {
      const server = http.createServer((req, res) => {
        if (req.url === '/api/v1/users/user-42/ai-preferences') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ data: { isOnboardingCompleted: true, foo: 'bar' } }));
          return;
        }

        res.writeHead(404);
        res.end();
      });

      await new Promise<void>((resolve) => server.listen(3001, resolve));

      try {
        await expect((service as any).fetchUserPreferences('user-42')).resolves.toEqual({
          isOnboardingCompleted: true,
          foo: 'bar',
        });
      } finally {
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve()))
        );
      }
    });

    it('should throw normalized error when fetchUserPreferences fails', async () => {
      (getAxiosClient().get as jest.Mock).mockRejectedValue(new Error('network down'));

      await expect((service as any).fetchUserPreferences('user-42')).rejects.toThrow(
        'Failed to fetch user preferences'
      );
    });

    it('should save enriched vector with and without baseVector segments', async () => {
      (mockPrisma.userVector.upsert as jest.Mock).mockResolvedValue({});

      await (service as any).saveEnrichedVector('user-1', makeEnrichedVector());
      await (service as any).saveEnrichedVector(
        'user-2',
        makeEnrichedVector({ baseVector: undefined })
      );

      expect(mockPrisma.userVector.upsert).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          create: expect.objectContaining({ segments: expect.any(Array) }),
          update: expect.objectContaining({ segments: expect.any(Array) }),
        })
      );
      expect(mockPrisma.userVector.upsert).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          create: expect.objectContaining({ segments: undefined }),
          update: expect.objectContaining({ segments: undefined }),
        })
      );
    });

    it('should return fallback recommendations when fallbackToPopularity succeeds', async () => {
      mockColdStart.getRecommendationsForNewUser.mockResolvedValue([{ id: 'fallback-1' }]);

      const result = await (service as any).fallbackToPopularity('user-1', { foo: 'bar' });

      expect(result).toEqual({
        success: true,
        fallback: true,
        recommendations: [{ id: 'fallback-1' }],
        metadata: { strategy: 'popularity_fallback' },
      });
    });

    it('should compute vector distance and log helper actions without throwing', async () => {
      const distance = (service as any).calculateVectorDistance(
        [0, 0, 0, 0, 0, 0, 0, 0],
        [1, 1, 1, 1, 1, 1, 1, 1]
      );

      expect(distance).toBe(1);

      await expect(
        (service as any).publishOnboardingCompletedEvent(
          'user-1',
          makeEnrichedVector(),
          [{ id: 'r1' }, { id: 'r2' }]
        )
      ).resolves.toBeUndefined();

      await expect(
        (service as any).logOnboardingCompletion('user-1', makeEnrichedVector(), [{ id: 'r1' }])
      ).resolves.toBeUndefined();

      await expect(
        (service as any).regenerateRecommendations('user-1', [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8])
      ).resolves.toBeUndefined();
    });
  });
});
