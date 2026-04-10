/**
 * US-TEST-016 — RecommendationService Unit Tests
 *
 * Tests for RecommendationService (IA-001.4):
 * - generateRecommendations (with/without excludeBooked, various options)
 * - getActiveRecommendations (cache hit/miss, status filter, includeItemVector)
 * - trackInteraction (all 4 actions, Kafka publish, rating)
 * - cleanupExpiredRecommendations
 * - getSimilarDestinations (found/not found)
 * - batchUpdateFromBooking (itemVector found/not found)
 * - refreshUserRecommendations
 * - getRecommendationsByDestination
 */

jest.mock('@dreamscape/db', () => ({
  prisma: {
    recommendation: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    userVector: {
      findUnique: jest.fn(),
    },
    itemVector: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('@ai/services/ScoringService', () => ({
  __esModule: true,
  default: {
    generateRecommendations: jest.fn(),
    diversifyRecommendations: jest.fn(),
    cosineSimilarity: jest.fn(),
  },
}));

jest.mock('@ai/services/CacheService', () => ({
  __esModule: true,
  default: {
    getRecommendations: jest.fn(),
    setRecommendations: jest.fn(),
    invalidateUserRecommendations: jest.fn(),
  },
}));

jest.mock('@ai/services/KafkaService', () => ({
  __esModule: true,
  default: {
    publishRecommendationInteracted: jest.fn(),
  },
}));

jest.mock('@ai/services/VectorizationService', () => ({
  __esModule: true,
  default: {
    saveUserVector: jest.fn(),
    getUserVector: jest.fn(),
  },
}));

import { prisma } from '@dreamscape/db';
import ScoringService from '@ai/services/ScoringService';
import CacheService from '@ai/services/CacheService';
import KafkaService from '@ai/services/KafkaService';
import VectorizationService from '@ai/services/VectorizationService';
import { RecommendationService } from '@ai/services/RecommendationService';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockScoring = ScoringService as jest.Mocked<typeof ScoringService>;
const mockCache = CacheService as jest.Mocked<typeof CacheService>;
const mockKafka = KafkaService as jest.Mocked<typeof KafkaService>;
const mockVecto = VectorizationService as jest.Mocked<typeof VectorizationService>;

const makeRec = (overrides: any = {}) => ({
  id: 'rec-1',
  userId: 'user-1',
  destinationId: 'dest-1',
  destinationName: 'Paris',
  destinationType: 'city',
  score: 0.85,
  confidence: 0.9,
  reasons: ['Cultural match'],
  contextType: 'general',
  status: 'GENERATED',
  isActive: true,
  viewedAt: null,
  clickedAt: null,
  bookedAt: null,
  rejectedAt: null,
  expiresAt: new Date(Date.now() + 86400000),
  userVectorId: 'uv-1',
  itemVectorId: 'iv-1',
  userVector: null,
  itemVector: null,
  ...overrides,
});

describe('US-TEST-016 — RecommendationService', () => {
  let service: RecommendationService;

  beforeEach(() => {
    service = new RecommendationService();
  });

  // ─── generateRecommendations ──────────────────────────────────────────────────

  describe('generateRecommendations', () => {
    const scoredItems = [
      {
        item: { id: 'iv-1', destinationId: 'dest-1', name: 'Paris', destinationType: 'city' },
        score: 0.9,
        confidence: 0.85,
        reasons: ['Budget match'],
      },
    ];

    it('should fetch booked destinations to exclude when excludeBooked is true (default)', async () => {
      (mockPrisma.recommendation.findMany as jest.Mock).mockResolvedValueOnce([
        { destinationId: 'dest-old' },
      ]);
      (mockScoring.generateRecommendations as jest.Mock).mockResolvedValue(scoredItems);
      (mockScoring.diversifyRecommendations as jest.Mock).mockReturnValue(scoredItems);
      (mockPrisma.userVector.findUnique as jest.Mock).mockResolvedValue({ id: 'uv-1' });
      (mockPrisma.recommendation.create as jest.Mock).mockResolvedValue(makeRec());

      await service.generateRecommendations('user-1');

      expect(mockPrisma.recommendation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: 'BOOKED' }) })
      );
      expect(mockScoring.generateRecommendations).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ excludeIds: ['dest-old'] })
      );
    });

    it('should skip booked-exclusion query when excludeBooked is false', async () => {
      (mockScoring.generateRecommendations as jest.Mock).mockResolvedValue(scoredItems);
      (mockScoring.diversifyRecommendations as jest.Mock).mockReturnValue(scoredItems);
      (mockPrisma.userVector.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.recommendation.create as jest.Mock).mockResolvedValue(makeRec());

      await service.generateRecommendations('user-1', { excludeBooked: false });

      expect(mockPrisma.recommendation.findMany).not.toHaveBeenCalled();
      expect(mockScoring.generateRecommendations).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ excludeIds: [] })
      );
    });

    it('should pass destinationType and minScore options to ScoringService', async () => {
      (mockPrisma.recommendation.findMany as jest.Mock).mockResolvedValue([]);
      (mockScoring.generateRecommendations as jest.Mock).mockResolvedValue([]);
      (mockScoring.diversifyRecommendations as jest.Mock).mockReturnValue([]);
      (mockPrisma.userVector.findUnique as jest.Mock).mockResolvedValue(null);

      await service.generateRecommendations('user-1', {
        destinationType: 'beach',
        minScore: 0.5,
        limit: 5,
      });

      expect(mockScoring.generateRecommendations).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ destinationType: 'beach', minScore: 0.5, limit: 10 })
      );
    });

    it('should set userVectorId when userVector exists', async () => {
      (mockPrisma.recommendation.findMany as jest.Mock).mockResolvedValue([]);
      (mockScoring.generateRecommendations as jest.Mock).mockResolvedValue(scoredItems);
      (mockScoring.diversifyRecommendations as jest.Mock).mockReturnValue(scoredItems);
      (mockPrisma.userVector.findUnique as jest.Mock).mockResolvedValue({ id: 'uv-42' });
      (mockPrisma.recommendation.create as jest.Mock).mockResolvedValue(makeRec());

      await service.generateRecommendations('user-1');

      expect(mockPrisma.recommendation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userVectorId: 'uv-42' }),
        })
      );
    });

    it('should set userVectorId to undefined when no userVector', async () => {
      (mockPrisma.recommendation.findMany as jest.Mock).mockResolvedValue([]);
      (mockScoring.generateRecommendations as jest.Mock).mockResolvedValue(scoredItems);
      (mockScoring.diversifyRecommendations as jest.Mock).mockReturnValue(scoredItems);
      (mockPrisma.userVector.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.recommendation.create as jest.Mock).mockResolvedValue(makeRec());

      await service.generateRecommendations('user-1');

      expect(mockPrisma.recommendation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userVectorId: undefined }),
        })
      );
    });

    it('should return the saved recommendations array', async () => {
      (mockPrisma.recommendation.findMany as jest.Mock).mockResolvedValue([]);
      (mockScoring.generateRecommendations as jest.Mock).mockResolvedValue(scoredItems);
      (mockScoring.diversifyRecommendations as jest.Mock).mockReturnValue(scoredItems);
      (mockPrisma.userVector.findUnique as jest.Mock).mockResolvedValue(null);
      const saved = makeRec();
      (mockPrisma.recommendation.create as jest.Mock).mockResolvedValue(saved);

      const result = await service.generateRecommendations('user-1');

      expect(result).toEqual([saved]);
    });
  });

  // ─── getActiveRecommendations ─────────────────────────────────────────────────

  describe('getActiveRecommendations', () => {
    it('should return cached recommendations on cache hit', async () => {
      const cached = [makeRec(), makeRec({ id: 'rec-2' })];
      (mockCache.getRecommendations as jest.Mock).mockResolvedValue(cached);

      const result = await service.getActiveRecommendations('user-1', { limit: 1 });

      expect(mockPrisma.recommendation.findMany).not.toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });

    it('should query DB when cache is empty array', async () => {
      (mockCache.getRecommendations as jest.Mock).mockResolvedValue([]);
      const dbRecs = [makeRec()];
      (mockPrisma.recommendation.findMany as jest.Mock).mockResolvedValue(dbRecs);

      const result = await service.getActiveRecommendations('user-1');

      expect(mockPrisma.recommendation.findMany).toHaveBeenCalled();
      expect(result).toEqual(dbRecs);
    });

    it('should query DB and populate cache when cache miss (null)', async () => {
      (mockCache.getRecommendations as jest.Mock).mockResolvedValue(null);
      const dbRecs = [makeRec()];
      (mockPrisma.recommendation.findMany as jest.Mock).mockResolvedValue(dbRecs);

      await service.getActiveRecommendations('user-1');

      expect(mockCache.setRecommendations).toHaveBeenCalledWith('user-1', dbRecs);
    });

    it('should skip cache when status filter is provided', async () => {
      const dbRecs = [makeRec({ status: 'VIEWED' })];
      (mockPrisma.recommendation.findMany as jest.Mock).mockResolvedValue(dbRecs);

      await service.getActiveRecommendations('user-1', { status: 'VIEWED' as any });

      expect(mockCache.getRecommendations).not.toHaveBeenCalled();
      expect(mockCache.setRecommendations).not.toHaveBeenCalled();
    });

    it('should skip cache when includeItemVector is true', async () => {
      (mockPrisma.recommendation.findMany as jest.Mock).mockResolvedValue([]);

      await service.getActiveRecommendations('user-1', { includeItemVector: true });

      expect(mockCache.getRecommendations).not.toHaveBeenCalled();
    });

    it('should not cache when DB returns empty array', async () => {
      (mockCache.getRecommendations as jest.Mock).mockResolvedValue(null);
      (mockPrisma.recommendation.findMany as jest.Mock).mockResolvedValue([]);

      await service.getActiveRecommendations('user-1');

      expect(mockCache.setRecommendations).not.toHaveBeenCalled();
    });
  });

  // ─── trackInteraction ─────────────────────────────────────────────────────────

  describe('trackInteraction', () => {
    it('should throw when recommendation not found', async () => {
      (mockPrisma.recommendation.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.trackInteraction('rec-missing', { action: 'viewed' })).rejects.toThrow(
        'Recommendation rec-missing not found'
      );
    });

    it('should set status VIEWED and viewedAt on "viewed" action', async () => {
      const rec = makeRec();
      (mockPrisma.recommendation.findUnique as jest.Mock).mockResolvedValue(rec);
      const updated = makeRec({ status: 'VIEWED' });
      (mockPrisma.recommendation.update as jest.Mock).mockResolvedValue(updated);

      await service.trackInteraction('rec-1', { action: 'viewed' });

      expect(mockPrisma.recommendation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'VIEWED', viewedAt: expect.any(Date) }),
        })
      );
    });

    it('should set status CLICKED and also set viewedAt when not yet viewed', async () => {
      const rec = makeRec({ viewedAt: null });
      (mockPrisma.recommendation.findUnique as jest.Mock).mockResolvedValue(rec);
      (mockPrisma.recommendation.update as jest.Mock).mockResolvedValue(makeRec());

      await service.trackInteraction('rec-1', { action: 'clicked' });

      expect(mockPrisma.recommendation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'CLICKED',
            clickedAt: expect.any(Date),
            viewedAt: expect.any(Date),
          }),
        })
      );
    });

    it('should NOT overwrite viewedAt when already viewed and action is "clicked"', async () => {
      const existingViewedAt = new Date('2024-01-01');
      const rec = makeRec({ viewedAt: existingViewedAt });
      (mockPrisma.recommendation.findUnique as jest.Mock).mockResolvedValue(rec);
      (mockPrisma.recommendation.update as jest.Mock).mockResolvedValue(makeRec());

      await service.trackInteraction('rec-1', { action: 'clicked' });

      const callData = (mockPrisma.recommendation.update as jest.Mock).mock.calls[0][0].data;
      expect(callData.viewedAt).toBeUndefined();
    });

    it('should set status BOOKED with rating when provided', async () => {
      const rec = makeRec({ itemVector: null });
      (mockPrisma.recommendation.findUnique as jest.Mock)
        .mockResolvedValueOnce(rec)    // trackInteraction initial fetch
        .mockResolvedValueOnce(null);  // updateItemVectorStats (rec has no itemVector)
      (mockPrisma.recommendation.update as jest.Mock).mockResolvedValue(makeRec());

      await service.trackInteraction('rec-1', { action: 'booked', rating: 5 });

      expect(mockPrisma.recommendation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'BOOKED', userRating: 5 }),
        })
      );
    });

    it('should set status BOOKED without userRating when no rating provided', async () => {
      const rec = makeRec({ itemVector: null });
      (mockPrisma.recommendation.findUnique as jest.Mock)
        .mockResolvedValueOnce(rec)
        .mockResolvedValueOnce(null);
      (mockPrisma.recommendation.update as jest.Mock).mockResolvedValue(makeRec());

      await service.trackInteraction('rec-1', { action: 'booked' });

      const callData = (mockPrisma.recommendation.update as jest.Mock).mock.calls[0][0].data;
      expect(callData.userRating).toBeUndefined();
    });

    it('should update itemVector stats on booked action when itemVector exists', async () => {
      const rec = makeRec({ itemVector: null });
      const recWithIV = makeRec({ itemVector: { id: 'iv-1' } });
      (mockPrisma.recommendation.findUnique as jest.Mock)
        .mockResolvedValueOnce(rec)       // initial fetch
        .mockResolvedValueOnce(recWithIV); // updateItemVectorStats fetch
      (mockPrisma.recommendation.update as jest.Mock).mockResolvedValue(makeRec());
      (mockPrisma.itemVector.update as jest.Mock).mockResolvedValue({});

      await service.trackInteraction('rec-1', { action: 'booked' });

      expect(mockPrisma.itemVector.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ bookingCount: { increment: 1 } }),
        })
      );
    });

    it('should set status REJECTED on "rejected" action', async () => {
      const rec = makeRec();
      (mockPrisma.recommendation.findUnique as jest.Mock).mockResolvedValue(rec);
      (mockPrisma.recommendation.update as jest.Mock).mockResolvedValue(makeRec());

      await service.trackInteraction('rec-1', { action: 'rejected' });

      expect(mockPrisma.recommendation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'REJECTED', rejectedAt: expect.any(Date) }),
        })
      );
    });

    it('should publish Kafka event when userVector is present', async () => {
      const rec = makeRec({ userVector: { userId: 'user-1' } });
      (mockPrisma.recommendation.findUnique as jest.Mock).mockResolvedValue(rec);
      (mockPrisma.recommendation.update as jest.Mock).mockResolvedValue(makeRec());
      (mockKafka.publishRecommendationInteracted as jest.Mock).mockResolvedValue(undefined);

      await service.trackInteraction('rec-1', { action: 'viewed' });

      expect(mockKafka.publishRecommendationInteracted).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'viewed', userId: 'user-1' })
      );
    });

    it('should NOT publish Kafka event when userVector is absent', async () => {
      const rec = makeRec({ userVector: null });
      (mockPrisma.recommendation.findUnique as jest.Mock).mockResolvedValue(rec);
      (mockPrisma.recommendation.update as jest.Mock).mockResolvedValue(makeRec());

      await service.trackInteraction('rec-1', { action: 'viewed' });

      expect(mockKafka.publishRecommendationInteracted).not.toHaveBeenCalled();
    });

    it('should swallow Kafka publish errors and still return the updated recommendation', async () => {
      const rec = makeRec({ userVector: { userId: 'user-1' } });
      (mockPrisma.recommendation.findUnique as jest.Mock).mockResolvedValue(rec);
      const updated = makeRec({ status: 'VIEWED' });
      (mockPrisma.recommendation.update as jest.Mock).mockResolvedValue(updated);
      (mockKafka.publishRecommendationInteracted as jest.Mock).mockRejectedValue(
        new Error('Kafka timeout')
      );

      const result = await service.trackInteraction('rec-1', { action: 'viewed' });

      expect(result).toEqual(updated);
    });

    it('should use itemVector.destinationId as itemId fallback when destinationId is null', async () => {
      const rec = makeRec({
        destinationId: null,
        userVector: { userId: 'user-1' },
        itemVector: { destinationId: 'iv-dest', destinationType: 'hotel' },
      });
      (mockPrisma.recommendation.findUnique as jest.Mock).mockResolvedValue(rec);
      (mockPrisma.recommendation.update as jest.Mock).mockResolvedValue(makeRec());
      (mockKafka.publishRecommendationInteracted as jest.Mock).mockResolvedValue(undefined);

      await service.trackInteraction('rec-1', { action: 'viewed' });

      expect(mockKafka.publishRecommendationInteracted).toHaveBeenCalledWith(
        expect.objectContaining({ itemId: 'iv-dest' })
      );
    });

    it('should fallback to unknown itemId and general contextType when recommendation lacks both', async () => {
      const rec = makeRec({
        destinationId: null,
        contextType: null,
        userVector: { userId: 'user-1' },
        itemVector: null,
      });
      (mockPrisma.recommendation.findUnique as jest.Mock).mockResolvedValue(rec);
      (mockPrisma.recommendation.update as jest.Mock).mockResolvedValue(makeRec());
      (mockKafka.publishRecommendationInteracted as jest.Mock).mockResolvedValue(undefined);

      await service.trackInteraction('rec-1', { action: 'viewed' });

      expect(mockKafka.publishRecommendationInteracted).toHaveBeenCalledWith(
        expect.objectContaining({
          itemId: 'unknown',
          contextType: 'general',
        })
      );
    });
  });

  // ─── cleanupExpiredRecommendations ────────────────────────────────────────────

  describe('cleanupExpiredRecommendations', () => {
    it('should mark expired active recommendations as EXPIRED and return count', async () => {
      (mockPrisma.recommendation.updateMany as jest.Mock).mockResolvedValue({ count: 3 });

      const count = await service.cleanupExpiredRecommendations();

      expect(count).toBe(3);
      expect(mockPrisma.recommendation.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: true }),
          data: expect.objectContaining({ isActive: false, status: 'EXPIRED' }),
        })
      );
    });
  });

  // ─── getRecommendationsByDestination ─────────────────────────────────────────

  describe('getRecommendationsByDestination', () => {
    it('should return recommendations for the given destination', async () => {
      const recs = [makeRec(), makeRec({ id: 'rec-2' })];
      (mockPrisma.recommendation.findMany as jest.Mock).mockResolvedValue(recs);

      const result = await service.getRecommendationsByDestination('dest-1');

      expect(result).toEqual(recs);
      expect(mockPrisma.recommendation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { destinationId: 'dest-1', isActive: true } })
      );
    });
  });

  // ─── getSimilarDestinations ───────────────────────────────────────────────────

  describe('getSimilarDestinations', () => {
    it('should return empty array when destinationId has no itemVector', async () => {
      (mockPrisma.itemVector.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.getSimilarDestinations('dest-unknown');

      expect(result).toEqual([]);
      expect(mockPrisma.itemVector.findMany).not.toHaveBeenCalled();
    });

    it('should return similar items sorted by cosine similarity', async () => {
      const sourceIV = { id: 'iv-src', destinationId: 'dest-1', vector: [1, 0, 0, 0, 0, 0, 0, 0] };
      const otherIVs = [
        { id: 'iv-a', destinationId: 'dest-a', vector: [0.9, 0.1, 0, 0, 0, 0, 0, 0] },
        { id: 'iv-b', destinationId: 'dest-b', vector: [0, 1, 0, 0, 0, 0, 0, 0] },
      ];
      (mockPrisma.itemVector.findFirst as jest.Mock).mockResolvedValue(sourceIV);
      (mockPrisma.itemVector.findMany as jest.Mock).mockResolvedValue(otherIVs);
      (mockScoring.cosineSimilarity as jest.Mock)
        .mockReturnValueOnce(0.9)  // dest-a
        .mockReturnValueOnce(0.1); // dest-b

      const result = await service.getSimilarDestinations('dest-1', 2);

      expect(result[0].similarityScore).toBe(0.9);
      expect(result[1].similarityScore).toBe(0.1);
    });
  });

  // ─── batchUpdateFromBooking ───────────────────────────────────────────────────

  describe('batchUpdateFromBooking', () => {
    it('should mark matching recommendations as BOOKED', async () => {
      (mockPrisma.recommendation.updateMany as jest.Mock).mockResolvedValue({ count: 2 });
      (mockPrisma.itemVector.findFirst as jest.Mock).mockResolvedValue(null);

      await service.batchUpdateFromBooking('user-1', 'dest-1');

      expect(mockPrisma.recommendation.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'user-1', destinationId: 'dest-1' }),
          data: expect.objectContaining({ status: 'BOOKED' }),
        })
      );
    });

    it('should update itemVector stats when itemVector exists', async () => {
      (mockPrisma.recommendation.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (mockPrisma.itemVector.findFirst as jest.Mock).mockResolvedValue({ id: 'iv-1' });
      (mockPrisma.itemVector.update as jest.Mock).mockResolvedValue({});

      await service.batchUpdateFromBooking('user-1', 'dest-1');

      expect(mockPrisma.itemVector.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ bookingCount: { increment: 1 } }),
        })
      );
    });

    it('should skip itemVector update when no itemVector found', async () => {
      (mockPrisma.recommendation.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
      (mockPrisma.itemVector.findFirst as jest.Mock).mockResolvedValue(null);

      await service.batchUpdateFromBooking('user-1', 'dest-none');

      expect(mockPrisma.itemVector.update).not.toHaveBeenCalled();
    });
  });

  describe('updateItemVectorStats', () => {
    it('should increment searchCount when called with search type', async () => {
      (mockPrisma.recommendation.findUnique as jest.Mock).mockResolvedValue({
        itemVector: { id: 'iv-search' },
      });
      (mockPrisma.itemVector.update as jest.Mock).mockResolvedValue({});

      await (service as any).updateItemVectorStats('rec-1', 'search');

      expect(mockPrisma.itemVector.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'iv-search' },
          data: { searchCount: { increment: 1 } },
        })
      );
    });
  });

  // ─── refreshUserRecommendations ───────────────────────────────────────────────

  describe('refreshUserRecommendations', () => {
    it('should regenerate vector, deactivate old recs, and return new ones', async () => {
      (mockVecto.saveUserVector as jest.Mock).mockResolvedValue(undefined);
      (mockPrisma.recommendation.updateMany as jest.Mock).mockResolvedValue({ count: 5 });
      // generateRecommendations dependencies
      (mockPrisma.recommendation.findMany as jest.Mock).mockResolvedValue([]);
      (mockScoring.generateRecommendations as jest.Mock).mockResolvedValue([]);
      (mockScoring.diversifyRecommendations as jest.Mock).mockReturnValue([]);
      (mockPrisma.userVector.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.refreshUserRecommendations('user-1');

      expect(mockVecto.saveUserVector).toHaveBeenCalledWith('user-1', 'refresh');
      expect(mockPrisma.recommendation.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'user-1', isActive: true }),
          data: { isActive: false },
        })
      );
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
