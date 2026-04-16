/**
 * US-TEST-017 — AnalyticsService Unit Tests
 *
 * Tests for AnalyticsService (IA-001.4):
 * - getOverallMetrics (with/without dateRange, zero values, rate calculations)
 * - getDestinationPerformance (sortBy variants, limit)
 * - getUserEngagement (single user, all users)
 * - getTimeSeriesData (grouping by date)
 * - getReasonAnalysis (counting reasons, empty booked list)
 * - getContextTypeComparison
 * - getDashboardSummary
 *
 * CacheService is covered by the reused cache-service.test.ts from US-IA-009.
 */

jest.mock('@dreamscape/db', () => ({
  prisma: {
    recommendation: {
      count: jest.fn(),
      aggregate: jest.fn(),
      groupBy: jest.fn(),
      findMany: jest.fn(),
    },
  },
  RecommendationStatus: {},
}));

import { prisma } from '@dreamscape/db';
import { AnalyticsService } from '@ai/services/AnalyticsService';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

const mockCount = mockPrisma.recommendation.count as jest.Mock;
const mockAggregate = mockPrisma.recommendation.aggregate as jest.Mock;
const mockGroupBy = mockPrisma.recommendation.groupBy as jest.Mock;
const mockFindMany = mockPrisma.recommendation.findMany as jest.Mock;

describe('US-TEST-017 — AnalyticsService', () => {
  let service: AnalyticsService;

  beforeEach(() => {
    mockCount.mockReset();
    mockAggregate.mockReset();
    mockGroupBy.mockReset();
    mockFindMany.mockReset();
    service = new AnalyticsService();
  });

  // ─── getOverallMetrics ────────────────────────────────────────────────────────

  describe('getOverallMetrics', () => {
    const setupCounts = (
      generated: number,
      viewed: number,
      clicked: number,
      booked: number,
      rejected: number,
      expired: number,
      avgScore = 0.8,
      avgConfidence = 0.75
    ) => {
      // count is called 6 times in sequence: GENERATED, VIEWED, CLICKED, BOOKED, REJECTED, EXPIRED
      mockCount
        .mockResolvedValueOnce(generated)
        .mockResolvedValueOnce(viewed)
        .mockResolvedValueOnce(clicked)
        .mockResolvedValueOnce(booked)
        .mockResolvedValueOnce(rejected)
        .mockResolvedValueOnce(expired);
      mockAggregate.mockResolvedValue({
        _avg: { score: avgScore, confidence: avgConfidence },
      });
    };

    it('should return correct metrics without dateRange', async () => {
      setupCounts(5, 3, 2, 1, 1, 1);

      const result = await service.getOverallMetrics();

      expect(result.totalGenerated).toBe(5);
      expect(result.totalBooked).toBe(1);
      expect(result.averageScore).toBe(0.8);
    });

    it('should pass dateRange where clause when provided', async () => {
      setupCounts(10, 5, 2, 1, 1, 1);
      const from = new Date('2024-01-01');
      const to = new Date('2024-01-31');

      await service.getOverallMetrics({ from, to });

      expect(mockCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.objectContaining({ gte: from, lte: to }),
          }),
        })
      );
    });

    it('should calculate viewRate correctly', async () => {
      // total=10: generated=4, viewed=2, clicked=2, booked=1, rejected=0, expired=1
      setupCounts(4, 2, 2, 1, 0, 1);

      const result = await service.getOverallMetrics();

      // viewedOrBeyond = 2+2+1=5; total=10; viewRate=50%
      expect(result.viewRate).toBeCloseTo(50, 1);
    });

    it('should calculate clickThroughRate correctly', async () => {
      // viewed=3, clicked=2, booked=1
      setupCounts(0, 3, 2, 1, 0, 0);

      const result = await service.getOverallMetrics();

      // viewedOrBeyond=6, clickedOrBeyond=3; CTR=50%
      expect(result.clickThroughRate).toBeCloseTo(50, 1);
    });

    it('should calculate conversionRate correctly', async () => {
      // clicked=4, booked=2
      setupCounts(0, 0, 4, 2, 0, 0);

      const result = await service.getOverallMetrics();

      // clickedOrBeyond=6; booked=2; conversion=33.3%
      expect(result.conversionRate).toBeCloseTo(33.3, 0);
    });

    it('should return zero rates when totals are zero', async () => {
      setupCounts(0, 0, 0, 0, 0, 0, 0, 0);

      const result = await service.getOverallMetrics();

      expect(result.viewRate).toBe(0);
      expect(result.clickThroughRate).toBe(0);
      expect(result.conversionRate).toBe(0);
      expect(result.averageScore).toBe(0);
      expect(result.averageConfidence).toBe(0);
    });

    it('should default averageScore to 0 when aggregate returns null', async () => {
      setupCounts(1, 0, 0, 0, 0, 0);
      mockAggregate.mockResolvedValue({ _avg: { score: null, confidence: null } });

      const result = await service.getOverallMetrics();

      expect(result.averageScore).toBe(0);
      expect(result.averageConfidence).toBe(0);
    });
  });

  // ─── getDestinationPerformance ────────────────────────────────────────────────

  describe('getDestinationPerformance', () => {
    const destGroups = [
      { destinationId: 'dest-1', destinationName: 'Paris', _count: { id: 10 }, _avg: { score: 0.8, userRating: 4.5 } },
      { destinationId: 'dest-2', destinationName: 'Tokyo', _count: { id: 5 }, _avg: { score: 0.7, userRating: null } },
    ];

    beforeEach(() => {
      mockGroupBy.mockResolvedValue(destGroups);
      // For each destination: count(bookings), count(views), count(clicks)
      mockCount
        .mockResolvedValueOnce(3).mockResolvedValueOnce(8).mockResolvedValueOnce(5) // dest-1
        .mockResolvedValueOnce(1).mockResolvedValueOnce(3).mockResolvedValueOnce(2); // dest-2
    });

    it('should return destination performance sorted by bookings by default', async () => {
      const result = await service.getDestinationPerformance();

      expect(result[0].destinationId).toBe('dest-1');
      expect(result[0].bookings).toBe(3);
    });

    it('should sort by conversionRate when sortBy is conversionRate', async () => {
      mockCount.mockReset();
      mockGroupBy.mockResolvedValue(destGroups);
      mockCount
        .mockResolvedValueOnce(1).mockResolvedValueOnce(2).mockResolvedValueOnce(5)  // dest-1: 1/5=20%
        .mockResolvedValueOnce(2).mockResolvedValueOnce(3).mockResolvedValueOnce(2); // dest-2: 2/2=100%

      const result = await service.getDestinationPerformance({ sortBy: 'conversionRate' });

      expect(result[0].destinationId).toBe('dest-2');
    });

    it('should sort by totalRecommendations', async () => {
      mockCount.mockReset();
      mockGroupBy.mockResolvedValue(destGroups);
      mockCount
        .mockResolvedValueOnce(1).mockResolvedValueOnce(2).mockResolvedValueOnce(3)
        .mockResolvedValueOnce(1).mockResolvedValueOnce(2).mockResolvedValueOnce(3);

      const result = await service.getDestinationPerformance({ sortBy: 'totalRecommendations' });

      expect(result[0].totalRecommendations).toBe(10); // dest-1 has more
    });

    it('should apply limit', async () => {
      const result = await service.getDestinationPerformance({ limit: 1 });

      expect(result).toHaveLength(1);
    });

    it('should compute conversionRate as 0 when clicks is 0', async () => {
      mockCount.mockReset();
      mockGroupBy.mockResolvedValue([destGroups[0]]);
      mockCount
        .mockResolvedValueOnce(0).mockResolvedValueOnce(0).mockResolvedValueOnce(0);

      const result = await service.getDestinationPerformance();

      expect(result[0].conversionRate).toBe(0);
    });

    it('should default averageScore to 0 when destination average score is null', async () => {
      mockCount.mockReset();
      mockGroupBy.mockResolvedValue([
        {
          destinationId: 'dest-3',
          destinationName: 'Rome',
          _count: { id: 2 },
          _avg: { score: null, userRating: 5 },
        },
      ]);
      mockCount
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(1);

      const result = await service.getDestinationPerformance();

      expect(result[0].averageScore).toBe(0);
    });

    it('should pass dateRange to groupBy when provided', async () => {
      mockGroupBy.mockResolvedValue([]);
      const from = new Date('2024-01-01');
      const to = new Date('2024-01-31');

      await service.getDestinationPerformance({ dateRange: { from, to } });

      expect(mockGroupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ createdAt: expect.objectContaining({ gte: from }) }),
        })
      );
    });

    it('should hit the default sort branch when sortBy is unknown', async () => {
      mockCount.mockReset();
      mockGroupBy.mockResolvedValue(destGroups);
      mockCount
        .mockResolvedValueOnce(3).mockResolvedValueOnce(8).mockResolvedValueOnce(5)
        .mockResolvedValueOnce(1).mockResolvedValueOnce(3).mockResolvedValueOnce(2);

      const result = await service.getDestinationPerformance({ sortBy: 'unknown' as any });

      expect(result).toHaveLength(2);
      expect(result[0].destinationId).toBe('dest-1');
    });
  });

  // ─── getUserEngagement ────────────────────────────────────────────────────────

  describe('getUserEngagement', () => {
    it('should return single user engagement when userId provided', async () => {
      mockCount.mockReset();
      mockAggregate.mockReset();
      mockCount
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(7)  // viewed
        .mockResolvedValueOnce(4)  // clicked
        .mockResolvedValueOnce(2); // booked
      mockAggregate.mockResolvedValue({ _avg: { userRating: 4.2 } });

      const result = await service.getUserEngagement('user-1') as any;

      expect(result.userId).toBe('user-1');
      expect(result.totalRecommendationsReceived).toBe(10);
      expect(result.viewedCount).toBe(7);
      expect(result.bookedCount).toBe(2);
      expect(result.engagementRate).toBe(130);
      expect(result.averageRating).toBe(4.2);
    });

    it('should compute engagementRate = 0 when total is 0', async () => {
      mockCount.mockReset();
      mockAggregate.mockReset();
      mockCount
        .mockResolvedValueOnce(0).mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0).mockResolvedValueOnce(0);
      mockAggregate.mockResolvedValue({ _avg: { userRating: null } });

      const result = await service.getUserEngagement('user-1') as any;

      expect(result.engagementRate).toBe(0);
    });

    it('should return array of user engagements when no userId provided', async () => {
      mockCount.mockReset();
      mockGroupBy.mockReset();
      mockGroupBy.mockResolvedValue([
        { userId: 'u1', _count: { id: 5 }, _avg: { userRating: 4.0 } },
      ]);
      mockCount
        .mockResolvedValueOnce(3)  // viewed
        .mockResolvedValueOnce(2)  // clicked
        .mockResolvedValueOnce(1); // booked

      const result = await service.getUserEngagement() as any[];

      expect(Array.isArray(result)).toBe(true);
      expect(result[0].userId).toBe('u1');
    });

    it('should support dateRange and return 0 engagement for grouped users with no recommendations', async () => {
      mockCount.mockReset();
      mockGroupBy.mockReset();
      const from = new Date('2024-02-01');
      const to = new Date('2024-02-29');
      mockGroupBy.mockResolvedValue([
        { userId: 'u-empty', _count: { id: 0 }, _avg: { userRating: null } },
      ]);
      mockCount
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      const result = await service.getUserEngagement(undefined, { from, to }) as any[];

      expect(mockGroupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.objectContaining({ gte: from, lte: to }),
          }),
        })
      );
      expect(result[0].engagementRate).toBe(0);
    });
  });

  // ─── getTimeSeriesData ────────────────────────────────────────────────────────

  describe('getTimeSeriesData', () => {
    it('should group recommendations by date and return sorted array', async () => {
      mockFindMany.mockResolvedValue([
        { createdAt: new Date('2024-01-02'), status: 'BOOKED' },
        { createdAt: new Date('2024-01-01'), status: 'VIEWED' },
        { createdAt: new Date('2024-01-01'), status: 'CLICKED' },
      ]);

      const result = await service.getTimeSeriesData('day', {
        from: new Date('2024-01-01'),
        to: new Date('2024-01-31'),
      });

      expect(result).toHaveLength(2);
      expect(result[0].date).toBe('2024-01-01');
      expect(result[1].date).toBe('2024-01-02');
      expect(result[1].booked).toBe(1);
    });

    it('should count statuses per date correctly', async () => {
      mockFindMany.mockResolvedValue([
        { createdAt: new Date('2024-03-01'), status: 'VIEWED' },
        { createdAt: new Date('2024-03-01'), status: 'CLICKED' },
        { createdAt: new Date('2024-03-01'), status: 'BOOKED' },
        { createdAt: new Date('2024-03-01'), status: 'GENERATED' },
      ]);

      const result = await service.getTimeSeriesData('day', {
        from: new Date('2024-03-01'),
        to: new Date('2024-03-31'),
      });

      expect(result[0].viewed).toBe(1);
      expect(result[0].clicked).toBe(1);
      expect(result[0].booked).toBe(1);
      expect(result[0].generated).toBe(4);
    });
  });

  // ─── getReasonAnalysis ────────────────────────────────────────────────────────

  describe('getReasonAnalysis', () => {
    it('should count reason frequencies and sort by count', async () => {
      mockFindMany.mockResolvedValue([
        { reasons: ['Budget match', 'Climate match'] },
        { reasons: ['Budget match'] },
        { reasons: ['Climate match'] },
      ]);

      const result = await service.getReasonAnalysis();

      expect(result[0].reason).toBe('Budget match');
      expect(result[0].count).toBe(2);
      expect(result[1].reason).toBe('Climate match');
      expect(result[1].count).toBe(2);
    });

    it('should return empty array when no booked recommendations', async () => {
      mockFindMany.mockResolvedValue([]);

      const result = await service.getReasonAnalysis();

      expect(result).toEqual([]);
    });

    it('should pass dateRange where clause when provided', async () => {
      mockFindMany.mockResolvedValue([]);
      const from = new Date('2024-01-01');
      const to = new Date('2024-01-31');

      await service.getReasonAnalysis({ from, to });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.objectContaining({ gte: from }),
          }),
        })
      );
    });

    it('should treat null reasons as an empty list', async () => {
      mockFindMany.mockResolvedValue([
        { reasons: null },
      ]);

      const result = await service.getReasonAnalysis();

      expect(result).toEqual([]);
    });
  });

  // ─── getContextTypeComparison ─────────────────────────────────────────────────

  describe('getContextTypeComparison', () => {
    it('should return conversion rate per context type', async () => {
      mockCount.mockReset();
      mockGroupBy.mockReset();
      mockGroupBy.mockResolvedValue([
        { contextType: 'general', _count: { id: 100 }, _avg: { score: 0.7, confidence: 0.8 } },
        { contextType: 'onboarding', _count: { id: 50 }, _avg: { score: 0.9, confidence: 0.85 } },
      ]);
      mockCount
        .mockResolvedValueOnce(10)  // general booked
        .mockResolvedValueOnce(8);  // onboarding booked

      const result = await service.getContextTypeComparison();

      expect(result).toHaveLength(2);
      expect(result[0].conversionRate).toBeCloseTo(10, 0);
      expect(result[1].conversionRate).toBeCloseTo(16, 0);
    });

    it('should pass dateRange where clause to context comparison when provided', async () => {
      const from = new Date('2024-01-01');
      const to = new Date('2024-01-31');
      mockGroupBy.mockResolvedValue([]);

      await service.getContextTypeComparison({ from, to });

      expect(mockGroupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.objectContaining({ gte: from, lte: to }),
          }),
        })
      );
    });
  });

  // ─── getDashboardSummary ──────────────────────────────────────────────────────

  describe('getDashboardSummary', () => {
    it('should return summary with period, metrics, destinations, and active users', async () => {
      // getOverallMetrics calls
      mockCount
        .mockResolvedValueOnce(100).mockResolvedValueOnce(60)
        .mockResolvedValueOnce(30).mockResolvedValueOnce(10)
        .mockResolvedValueOnce(5).mockResolvedValueOnce(5);
      mockAggregate.mockResolvedValueOnce({ _avg: { score: 0.75, confidence: 0.8 } });

      // getDestinationPerformance groupBy + counts
      mockGroupBy
        .mockResolvedValueOnce([
          { destinationId: 'd1', destinationName: 'Paris', _count: { id: 20 }, _avg: { score: 0.8, userRating: null } },
        ])
        .mockResolvedValueOnce([  // activeUsers groupBy
          { userId: 'u1', _count: { id: 5 } },
          { userId: 'u2', _count: { id: 3 } },
        ]);

      mockCount
        .mockResolvedValueOnce(5)  // bookings for d1
        .mockResolvedValueOnce(15) // views for d1
        .mockResolvedValueOnce(8); // clicks for d1

      const result = await service.getDashboardSummary();

      expect(result.period).toBe('Last 30 days');
      expect(result.totalActiveUsers).toBe(2);
      expect(result.averageRecommendationsPerUser).toBe(4); // (5+3)/2
      expect(result.overallMetrics).toBeDefined();
      expect(Array.isArray(result.topDestinations)).toBe(true);
    });

    it('should return averageRecommendationsPerUser = 0 when no active users exist', async () => {
      mockCount
        .mockResolvedValueOnce(0).mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0).mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0).mockResolvedValueOnce(0);
      mockAggregate.mockResolvedValueOnce({ _avg: { score: 0, confidence: 0 } });
      mockGroupBy
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.getDashboardSummary();

      expect(result.totalActiveUsers).toBe(0);
      expect(result.averageRecommendationsPerUser).toBe(0);
    });
  });
});
