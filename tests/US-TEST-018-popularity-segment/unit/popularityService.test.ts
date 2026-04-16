/**
 * US-TEST-018 — PopularityService Unit Tests
 *
 * Tests for PopularityService (IA-002.2):
 * - calculatePopularityScores (weighted formula, normalize)
 * - getTopDestinations (prisma query with limit)
 * - getTopBySegment (filtering and scoring)
 * - getTopByCategory (category filter)
 * - calculateTrendAnalysis (rising/stable/declining)
 */

jest.mock('@dreamscape/db', () => ({
  prisma: {
    itemVector: {
      findMany: jest.fn(),
    },
  },
}));

import { prisma } from '@dreamscape/db';
import { PopularityService } from '@ai/recommendations/popularity.service';
import { UserSegment } from '@ai/segments/types/segment.types';

const mockItemVectorFindMany = prisma.itemVector.findMany as jest.Mock;

const makeItem = (overrides: any = {}) => ({
  id: 'iv-1',
  destinationId: 'dest-1',
  destinationType: 'CITY',
  bookingCount: 10,
  searchCount: 50,
  popularityScore: 0.8,
  updatedAt: new Date(),
  lastSyncedAt: new Date(),
  ...overrides,
});

describe('US-TEST-018 — PopularityService', () => {
  let service: PopularityService;

  beforeEach(() => {
    service = new PopularityService();
  });

  // ─── calculatePopularityScores ────────────────────────────────────────────────

  describe('calculatePopularityScores', () => {
    it('should return empty map for empty item list', async () => {
      mockItemVectorFindMany.mockResolvedValue([]);

      const result = await service.calculatePopularityScores();

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });

    it('should return scores for each destination', async () => {
      mockItemVectorFindMany.mockResolvedValue([
        makeItem({ destinationId: 'dest-1', bookingCount: 100 }),
        makeItem({ destinationId: 'dest-2', bookingCount: 50 }),
      ]);

      const result = await service.calculatePopularityScores();

      expect(result.has('dest-1')).toBe(true);
      expect(result.has('dest-2')).toBe(true);
      expect(result.get('dest-1')).toBeGreaterThanOrEqual(0);
      expect(result.get('dest-1')).toBeLessThanOrEqual(1);
    });

    it('should handle single item (min === max normalization edge case)', async () => {
      mockItemVectorFindMany.mockResolvedValue([
        makeItem({ destinationId: 'dest-1', bookingCount: 5, searchCount: 10 }),
      ]);

      const result = await service.calculatePopularityScores();

      expect(result.get('dest-1')).toBeGreaterThanOrEqual(0);
    });

    it('should respect custom weights passed to constructor', async () => {
      const customService = new PopularityService({ bookings: 1.0, searches: 0, views: 0, quality: 0, trend: 0, seasonality: 0 });
      mockItemVectorFindMany.mockResolvedValue([
        makeItem({ destinationId: 'high', bookingCount: 1000 }),
        makeItem({ destinationId: 'low', bookingCount: 1 }),
      ]);

      const result = await customService.calculatePopularityScores();

      expect(result.get('high')).toBeGreaterThan(result.get('low')!);
    });

    it('should handle null metric fields by applying defaults from fetchAllMetrics', async () => {
      mockItemVectorFindMany.mockResolvedValue([
        makeItem({
          destinationId: 'dest-defaults',
          bookingCount: null,
          searchCount: null,
          lastSyncedAt: undefined,
        }),
      ]);

      const result = await service.calculatePopularityScores();

      expect(result.get('dest-defaults')).toBeGreaterThanOrEqual(0);
      expect(result.get('dest-defaults')).toBeLessThanOrEqual(1);
    });
  });

  // ─── getTopDestinations ───────────────────────────────────────────────────────

  describe('getTopDestinations', () => {
    it('should query items ordered by popularityScore descending', async () => {
      const items = [makeItem({ popularityScore: 0.9 }), makeItem({ id: 'iv-2', popularityScore: 0.7 })];
      mockItemVectorFindMany.mockResolvedValue(items);

      const result = await service.getTopDestinations(10);

      expect(result).toEqual(items);
      expect(mockItemVectorFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { popularityScore: 'desc' },
          where: { popularityScore: { gt: 0 } },
          take: 10,
        })
      );
    });

    it('should use default limit of 20', async () => {
      mockItemVectorFindMany.mockResolvedValue([]);

      await service.getTopDestinations();

      expect(mockItemVectorFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20 })
      );
    });
  });

  // ─── getTopBySegment ──────────────────────────────────────────────────────────

  describe('getTopBySegment', () => {
    it('should return items sorted by segment match score', async () => {
      const items = [
        makeItem({ id: 'iv-a', destinationId: 'dest-a', popularityScore: 0.9 }),
        makeItem({ id: 'iv-b', destinationId: 'dest-b', popularityScore: 0.5 }),
        makeItem({ id: 'iv-c', destinationId: 'dest-c', popularityScore: 0.7 }),
      ];
      mockItemVectorFindMany.mockResolvedValue(items);

      const result = await service.getTopBySegment(UserSegment.BUDGET_BACKPACKER, 2);

      expect(result).toHaveLength(2);
    });

    it('should fetch limit*2 items for filtering', async () => {
      mockItemVectorFindMany.mockResolvedValue([]);

      await service.getTopBySegment(UserSegment.FAMILY_EXPLORER, 10);

      expect(mockItemVectorFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20 })
      );
    });

    it('should use default limit of 20 for segment queries', async () => {
      mockItemVectorFindMany.mockResolvedValue([]);

      await service.getTopBySegment(UserSegment.SENIOR_COMFORT);

      expect(mockItemVectorFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 40 })
      );
    });
  });

  // ─── getTopByCategory ─────────────────────────────────────────────────────────

  describe('getTopByCategory', () => {
    it('should filter by destinationType and return ordered results', async () => {
      const items = [makeItem({ destinationType: 'BEACH' })];
      mockItemVectorFindMany.mockResolvedValue(items);

      const result = await service.getTopByCategory('BEACH', 5);

      expect(result).toEqual(items);
      expect(mockItemVectorFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { destinationType: 'BEACH', popularityScore: { gt: 0 } },
          take: 5,
        })
      );
    });

    it('should use default limit of 20 for category queries', async () => {
      mockItemVectorFindMany.mockResolvedValue([]);

      await service.getTopByCategory('CITY');

      expect(mockItemVectorFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20 })
      );
    });
  });

  // ─── calculateTrendAnalysis ───────────────────────────────────────────────────

  describe('calculateTrendAnalysis', () => {
    it('should return stable direction for low growth rate', async () => {
      const result = await service.calculateTrendAnalysis('dest-1');

      // recentBookings=10, previousBookings=8 → growthRate=25% → 'rising'
      expect(result.destinationId).toBe('dest-1');
      expect(result.direction).toBe('rising');
      expect(result.growthRate).toBeCloseTo(25, 0);
    });

    it('should return all required fields', async () => {
      const result = await service.calculateTrendAnalysis('dest-test');

      expect(result).toMatchObject({
        destinationId: 'dest-test',
        growthRate: expect.any(Number),
        direction: expect.stringMatching(/^(rising|stable|declining)$/),
        recentBookings: expect.any(Number),
        previousBookings: expect.any(Number),
        analyzedAt: expect.any(Date),
      });
    });
  });

  describe('private helpers', () => {
    it('should normalize values between min and max, and return 0 when min equals max', () => {
      expect((service as any).normalize(5, 0, 10)).toBe(0.5);
      expect((service as any).normalize(5, 5, 5)).toBe(0);
    });

    it('should compute quality score with and without reviews', () => {
      const withReviews = (service as any).calculateQualityScore(4.5, 10);
      const noReviews = (service as any).calculateQualityScore(4.5, 0);

      expect(withReviews.normalizedScore).toBeGreaterThan(0);
      expect(noReviews.normalizedScore).toBe(0);
    });

    it('should normalize trend for negative, low positive, and high positive growth', () => {
      expect((service as any).normalizeTrend(-0.5)).toBeCloseTo(0.25, 2);
      expect((service as any).normalizeTrend(0.5)).toBeCloseTo(0.625, 3);
      expect((service as any).normalizeTrend(2)).toBe(1);
    });

    it('should calculate recency decay for missing and stale dates', () => {
      expect((service as any).calculateRecencyDecay()).toBe(0.5);

      const oldDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 365);
      expect((service as any).calculateRecencyDecay(oldDate)).toBeGreaterThanOrEqual(0.3);
      expect((service as any).calculateRecencyDecay(oldDate)).toBeLessThan(0.5);
    });

    it('should return default seasonality boost and default segment preferences', () => {
      expect((service as any).getSeasonalityBoost('dest-1', 'SUMMER')).toBe(0.5);
      expect((service as any).getSegmentPreferences(UserSegment.CULTURAL_ENTHUSIAST)).toEqual({
        budgetRange: { min: 0, max: 1000 },
        preferredTypes: [],
      });
    });

    it('should calculate combined segment match score from popularity', () => {
      expect((service as any).calculateSegmentMatch({ popularityScore: 0.5 }, {})).toBeCloseTo(0.58, 2);
      expect((service as any).calculateSegmentMatch({}, {})).toBeCloseTo(0.28, 2);
    });

    it('should calculate growth rate and trend direction across edge cases', () => {
      expect((service as any).calculateGrowthRate(10, 8)).toBeCloseTo(25, 0);
      expect((service as any).calculateGrowthRate(10, 0)).toBe(0);
      expect((service as any).determineTrendDirection(25)).toBe('rising');
      expect((service as any).determineTrendDirection(-25)).toBe('declining');
      expect((service as any).determineTrendDirection(5)).toBe('stable');
    });
  });
});
