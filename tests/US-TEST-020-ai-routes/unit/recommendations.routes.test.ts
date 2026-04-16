/**
 * US-TEST-020 — Recommendations Routes Unit Tests
 *
 * Tests for routes/recommendations.ts key endpoints:
 * - POST /generate, GET /personalized, POST /:id/track, POST /refresh
 * - GET /trending, GET /similar/:destinationId
 * - GET /analytics (all 6 type variants + invalid type)
 * - POST /vectors/user, GET /vectors/user/:userId
 * - POST /cleanup
 * - GET /deals (with/without userId), GET /activities/:location
 * - GET /popular (global, segment, category — cache hit and miss)
 */

jest.mock('@/services/RecommendationService', () => ({
  __esModule: true,
  default: {
    generateRecommendations: jest.fn(),
    getActiveRecommendations: jest.fn(),
    trackInteraction: jest.fn(),
    refreshUserRecommendations: jest.fn(),
    getSimilarDestinations: jest.fn(),
    cleanupExpiredRecommendations: jest.fn(),
  },
}));

jest.mock('@/services/VectorizationService', () => ({
  __esModule: true,
  default: {
    saveUserVector: jest.fn(),
    getUserVector: jest.fn(),
  },
}));

jest.mock('@/services/ScoringService', () => ({
  __esModule: true,
  default: {
    getTrendingDestinations: jest.fn(),
    getDestinationsByCriteria: jest.fn(),
  },
}));

jest.mock('@/services/AnalyticsService', () => ({
  __esModule: true,
  default: {
    getDashboardSummary: jest.fn(),
    getOverallMetrics: jest.fn(),
    getDestinationPerformance: jest.fn(),
    getUserEngagement: jest.fn(),
    getReasonAnalysis: jest.fn(),
    getContextTypeComparison: jest.fn(),
  },
}));

// Mock popularity services (used via dynamic import in /popular route)
jest.mock('@ai/recommendations/popularity.service', () => ({
  PopularityService: jest.fn().mockImplementation(() => ({
    getTopDestinations: jest.fn().mockResolvedValue([]),
    getTopBySegment: jest.fn().mockResolvedValue([]),
    getTopByCategory: jest.fn().mockResolvedValue([]),
  })),
}));

jest.mock('@ai/recommendations/popularity-cache.service', () => ({
  PopularityCacheService: jest.fn().mockImplementation(() => ({
    getTopDestinations: jest.fn(),
    getTopBySegment: jest.fn(),
    getTopByCategory: jest.fn(),
  })),
}));

// Mock the accommodations sub-router to avoid loading its transitive deps
jest.mock('@ai/routes/accommodations', () => {
  const { Router } = require('express');
  return { __esModule: true, default: Router() };
});

import express from 'express';
import request from 'supertest';
import RecommendationService from '@/services/RecommendationService';
import VectorizationService from '@/services/VectorizationService';
import ScoringService from '@/services/ScoringService';
import AnalyticsService from '@/services/AnalyticsService';
import { PopularityCacheService } from '@ai/recommendations/popularity-cache.service';
import recommendationsRouter from '@ai/routes/recommendations';

const mockReco = RecommendationService as jest.Mocked<typeof RecommendationService>;
const mockVecto = VectorizationService as jest.Mocked<typeof VectorizationService>;
const mockScoring = ScoringService as jest.Mocked<typeof ScoringService>;
const mockAnalytics = AnalyticsService as jest.Mocked<typeof AnalyticsService>;

let app: express.Application;

beforeEach(() => {
  app = express();
  app.use(express.json());
  app.use('/', recommendationsRouter);
});

// ─── POST /generate ───────────────────────────────────────────────────────────

describe('POST /generate', () => {
  it('should return 400 when userId is missing', async () => {
    const res = await request(app).post('/generate').send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('userId is required');
  });

  it('should return 200 with generated recommendations', async () => {
    const recs = [{ id: 'r1' }, { id: 'r2' }];
    (mockReco.generateRecommendations as jest.Mock).mockResolvedValue(recs);

    const res = await request(app).post('/generate').send({ userId: 'user-1' });

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
    expect(res.body.recommendations).toEqual(recs);
  });

  it('should return 500 with "Unknown error" for non-Error throws', async () => {
    (mockReco.generateRecommendations as jest.Mock).mockRejectedValue('fail');

    const res = await request(app).post('/generate').send({ userId: 'user-1' });

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Unknown error');
  });
});

// ─── GET /personalized ────────────────────────────────────────────────────────

describe('GET /personalized', () => {
  it('should return 400 when userId is missing', async () => {
    const res = await request(app).get('/personalized');

    expect(res.status).toBe(400);
  });

  it('should return cached recommendations when they exist', async () => {
    const recs = [{ id: 'r1' }];
    (mockReco.getActiveRecommendations as jest.Mock).mockResolvedValue(recs);

    const res = await request(app).get('/personalized').query({ userId: 'user-1' });

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(mockReco.generateRecommendations).not.toHaveBeenCalled();
  });

  it('should auto-generate when no active recommendations found', async () => {
    (mockReco.getActiveRecommendations as jest.Mock).mockResolvedValue([]);
    const newRecs = [{ id: 'gen-1' }];
    (mockReco.generateRecommendations as jest.Mock).mockResolvedValue(newRecs);

    const res = await request(app).get('/personalized').query({ userId: 'user-1' });

    expect(res.status).toBe(200);
    expect(mockReco.generateRecommendations).toHaveBeenCalled();
  });

  it('should return 500 with error message on failure', async () => {
    (mockReco.getActiveRecommendations as jest.Mock).mockRejectedValue(new Error('DB error'));

    const res = await request(app).get('/personalized').query({ userId: 'user-1' });

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('DB error');
  });
});

// ─── POST /:id/track ──────────────────────────────────────────────────────────

describe('POST /:id/track', () => {
  it('should return 400 for missing action', async () => {
    const res = await request(app).post('/rec-1/track').send({});

    expect(res.status).toBe(400);
  });

  it('should return 400 for invalid action value', async () => {
    const res = await request(app).post('/rec-1/track').send({ action: 'skipped' });

    expect(res.status).toBe(400);
  });

  it('should return 200 on valid viewed action', async () => {
    const updated = { id: 'rec-1', status: 'VIEWED' };
    (mockReco.trackInteraction as jest.Mock).mockResolvedValue(updated);

    const res = await request(app).post('/rec-1/track').send({ action: 'viewed' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.recommendation).toEqual(updated);
  });

  it('should return 200 on booked action with rating', async () => {
    (mockReco.trackInteraction as jest.Mock).mockResolvedValue({ id: 'rec-1', status: 'BOOKED' });

    const res = await request(app).post('/rec-1/track').send({ action: 'booked', rating: 5 });

    expect(res.status).toBe(200);
    expect(mockReco.trackInteraction).toHaveBeenCalledWith('rec-1', { action: 'booked', rating: 5 });
  });

  it('should return 500 with "Unknown error" for non-Error throws', async () => {
    (mockReco.trackInteraction as jest.Mock).mockRejectedValue('oops');

    const res = await request(app).post('/rec-1/track').send({ action: 'clicked' });

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Unknown error');
  });
});

// ─── POST /refresh ────────────────────────────────────────────────────────────

describe('POST /refresh', () => {
  it('should return 400 when userId is missing', async () => {
    const res = await request(app).post('/refresh').send({});

    expect(res.status).toBe(400);
  });

  it('should return 200 with refreshed recommendations', async () => {
    (mockReco.refreshUserRecommendations as jest.Mock).mockResolvedValue([{ id: 'new-rec' }]);

    const res = await request(app).post('/refresh').send({ userId: 'user-1' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.count).toBe(1);
  });

  it('should return 500 on error', async () => {
    (mockReco.refreshUserRecommendations as jest.Mock).mockRejectedValue(new Error('refresh failed'));

    const res = await request(app).post('/refresh').send({ userId: 'user-1' });

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('refresh failed');
  });
});

// ─── GET /trending ────────────────────────────────────────────────────────────

describe('GET /trending', () => {
  it('should return 200 with trending destinations', async () => {
    (mockScoring.getTrendingDestinations as jest.Mock).mockResolvedValue([
      { name: 'Paris' }, { name: 'Tokyo' },
    ]);

    const res = await request(app).get('/trending');

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
  });

  it('should return 500 with "Unknown error" for non-Error throws', async () => {
    (mockScoring.getTrendingDestinations as jest.Mock).mockRejectedValue('fail');

    const res = await request(app).get('/trending');

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Unknown error');
  });
});

// ─── GET /similar/:destinationId ─────────────────────────────────────────────

describe('GET /similar/:destinationId', () => {
  it('should return similar destinations with custom limit', async () => {
    const similar = [{ id: 'iv-1', similarityScore: 0.9 }];
    (mockReco.getSimilarDestinations as jest.Mock).mockResolvedValue(similar);

    const res = await request(app).get('/similar/dest-paris').query({ limit: '3' });

    expect(res.status).toBe(200);
    expect(res.body.destinationId).toBe('dest-paris');
    expect(res.body.count).toBe(1);
    expect(mockReco.getSimilarDestinations).toHaveBeenCalledWith('dest-paris', 3);
  });

  it('should return 500 on error', async () => {
    (mockReco.getSimilarDestinations as jest.Mock).mockRejectedValue(new Error('DB error'));

    const res = await request(app).get('/similar/dest-x');

    expect(res.status).toBe(500);
  });
});

// ─── GET /analytics ───────────────────────────────────────────────────────────

describe('GET /analytics', () => {
  it('should call getDashboardSummary for type=dashboard (default)', async () => {
    (mockAnalytics.getDashboardSummary as jest.Mock).mockResolvedValue({ period: 'Last 30 days' });

    const res = await request(app).get('/analytics');

    expect(res.status).toBe(200);
    expect(mockAnalytics.getDashboardSummary).toHaveBeenCalled();
  });

  it('should call getOverallMetrics for type=metrics with dateRange', async () => {
    (mockAnalytics.getOverallMetrics as jest.Mock).mockResolvedValue({ totalGenerated: 5 });

    const res = await request(app).get('/analytics').query({
      type: 'metrics',
      from: '2024-01-01',
      to: '2024-01-31',
    });

    expect(res.status).toBe(200);
    expect(mockAnalytics.getOverallMetrics).toHaveBeenCalledWith(
      expect.objectContaining({ from: expect.any(Date), to: expect.any(Date) })
    );
  });

  it('should call getOverallMetrics without dateRange when from/to absent', async () => {
    (mockAnalytics.getOverallMetrics as jest.Mock).mockResolvedValue({});

    await request(app).get('/analytics').query({ type: 'metrics' });

    expect(mockAnalytics.getOverallMetrics).toHaveBeenCalledWith(undefined);
  });

  it('should call getDestinationPerformance for type=destinations', async () => {
    (mockAnalytics.getDestinationPerformance as jest.Mock).mockResolvedValue([]);

    const res = await request(app).get('/analytics').query({ type: 'destinations' });

    expect(res.status).toBe(200);
    expect(mockAnalytics.getDestinationPerformance).toHaveBeenCalled();
  });

  it('should call getUserEngagement with userId for type=user when userId provided', async () => {
    (mockAnalytics.getUserEngagement as jest.Mock).mockResolvedValue({ userId: 'user-1' });

    const res = await request(app).get('/analytics').query({ type: 'user', userId: 'user-1' });

    expect(res.status).toBe(200);
    expect(mockAnalytics.getUserEngagement).toHaveBeenCalledWith('user-1', undefined);
  });

  it('should call getUserEngagement without userId for type=user when no userId', async () => {
    (mockAnalytics.getUserEngagement as jest.Mock).mockResolvedValue([]);

    await request(app).get('/analytics').query({ type: 'user' });

    expect(mockAnalytics.getUserEngagement).toHaveBeenCalledWith(undefined, undefined);
  });

  it('should call getReasonAnalysis for type=reasons', async () => {
    (mockAnalytics.getReasonAnalysis as jest.Mock).mockResolvedValue([]);

    const res = await request(app).get('/analytics').query({ type: 'reasons' });

    expect(res.status).toBe(200);
    expect(mockAnalytics.getReasonAnalysis).toHaveBeenCalled();
  });

  it('should call getContextTypeComparison for type=context', async () => {
    (mockAnalytics.getContextTypeComparison as jest.Mock).mockResolvedValue([]);

    const res = await request(app).get('/analytics').query({ type: 'context' });

    expect(res.status).toBe(200);
    expect(mockAnalytics.getContextTypeComparison).toHaveBeenCalled();
  });

  it('should return 400 for unknown analytics type', async () => {
    const res = await request(app).get('/analytics').query({ type: 'unknown' });

    expect(res.status).toBe(400);
  });

  it('should return 500 with "Unknown error" for non-Error throws', async () => {
    (mockAnalytics.getDashboardSummary as jest.Mock).mockRejectedValue('crash');

    const res = await request(app).get('/analytics');

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Unknown error');
  });
});

// ─── POST /vectors/user ───────────────────────────────────────────────────────

describe('POST /vectors/user', () => {
  it('should return 400 when userId is missing', async () => {
    const res = await request(app).post('/vectors/user').send({});

    expect(res.status).toBe(400);
  });

  it('should return 200 with created vector', async () => {
    (mockVecto.saveUserVector as jest.Mock).mockResolvedValue(undefined);
    (mockVecto.getUserVector as jest.Mock).mockResolvedValue([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]);

    const res = await request(app)
      .post('/vectors/user')
      .send({ userId: 'user-1', source: 'onboarding' });

    expect(res.status).toBe(200);
    expect(res.body.dimensions).toBe(8);
  });

  it('should return 500 on error', async () => {
    (mockVecto.saveUserVector as jest.Mock).mockRejectedValue(new Error('save failed'));

    const res = await request(app).post('/vectors/user').send({ userId: 'user-1' });

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('save failed');
  });
});

// ─── GET /vectors/user/:userId ────────────────────────────────────────────────

describe('GET /vectors/user/:userId', () => {
  it('should return 200 with the user vector', async () => {
    const vec = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8];
    (mockVecto.getUserVector as jest.Mock).mockResolvedValue(vec);

    const res = await request(app).get('/vectors/user/user-1');

    expect(res.status).toBe(200);
    expect(res.body.vector).toEqual(vec);
    expect(res.body.dimensions).toBe(8);
  });

  it('should return 500 with "Unknown error" for non-Error throws', async () => {
    (mockVecto.getUserVector as jest.Mock).mockRejectedValue('fail');

    const res = await request(app).get('/vectors/user/user-1');

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Unknown error');
  });
});

// ─── POST /cleanup ────────────────────────────────────────────────────────────

describe('POST /cleanup', () => {
  it('should return 200 with expired count', async () => {
    (mockReco.cleanupExpiredRecommendations as jest.Mock).mockResolvedValue(7);

    const res = await request(app).post('/cleanup');

    expect(res.status).toBe(200);
    expect(res.body.expiredCount).toBe(7);
  });

  it('should return 500 on error', async () => {
    (mockReco.cleanupExpiredRecommendations as jest.Mock).mockRejectedValue(new Error('cleanup failed'));

    const res = await request(app).post('/cleanup');

    expect(res.status).toBe(500);
  });
});

// ─── GET /deals ───────────────────────────────────────────────────────────────

describe('GET /deals', () => {
  it('should return trending destinations when no userId (anonymous)', async () => {
    const trending = [{ name: 'Barcelona' }];
    (mockScoring.getTrendingDestinations as jest.Mock).mockResolvedValue(trending);

    const res = await request(app).get('/deals');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(trending);
  });

  it('should return active recommendations when userId is provided', async () => {
    const recs = [{ id: 'deal-1' }];
    (mockReco.getActiveRecommendations as jest.Mock).mockResolvedValue(recs);

    const res = await request(app).get('/deals').query({ userId: 'user-1' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(recs);
  });

  it('should return 500 on error', async () => {
    (mockScoring.getTrendingDestinations as jest.Mock).mockRejectedValue(new Error('trending failed'));

    const res = await request(app).get('/deals');

    expect(res.status).toBe(500);
  });
});

// ─── GET /activities/:location ────────────────────────────────────────────────

describe('GET /activities/:location', () => {
  it('should return activities filtered by location name', async () => {
    const destinations = [
      { name: 'Paris city tour', country: 'France' },
      { name: 'Berlin museum', country: 'Germany' },
    ];
    (mockScoring.getDestinationsByCriteria as jest.Mock).mockResolvedValue(destinations);

    const res = await request(app).get('/activities/paris');

    expect(res.status).toBe(200);
    expect(res.body.location).toBe('paris');
    expect(res.body.count).toBe(1); // Only Paris matches
  });

  it('should match on country field as well', async () => {
    const destinations = [
      { name: 'Tour de Vins', country: 'France' },
      { name: 'Oktoberfest', country: 'Germany' },
    ];
    (mockScoring.getDestinationsByCriteria as jest.Mock).mockResolvedValue(destinations);

    const res = await request(app).get('/activities/france');

    expect(res.body.count).toBe(1);
  });

  it('should return 500 on error', async () => {
    (mockScoring.getDestinationsByCriteria as jest.Mock).mockRejectedValue(new Error('criteria failed'));

    const res = await request(app).get('/activities/paris');

    expect(res.status).toBe(500);
  });
});

// ─── GET /popular ─────────────────────────────────────────────────────────────

describe('GET /popular', () => {
  let mockCacheInstance: any;

  beforeEach(() => {
    const MockCache = PopularityCacheService as jest.MockedClass<typeof PopularityCacheService>;
    mockCacheInstance = {
      getTopDestinations: jest.fn(),
      getTopBySegment: jest.fn(),
      getTopByCategory: jest.fn(),
    };
    MockCache.mockImplementation(() => mockCacheInstance);
  });

  it('should return global popular destinations from cache when cache hits', async () => {
    const cached = [{ id: 'd1' }];
    mockCacheInstance.getTopDestinations.mockResolvedValue(cached);

    const res = await request(app).get('/popular');

    expect(res.status).toBe(200);
    expect(res.body.popular).toEqual(cached);
  });

  it('should fall back to DB when global cache misses', async () => {
    mockCacheInstance.getTopDestinations.mockResolvedValue(null);
    const { PopularityService } = require('@ai/recommendations/popularity.service');
    PopularityService.mockImplementation(() => ({
      getTopDestinations: jest.fn().mockResolvedValue([{ id: 'db-d1' }]),
    }));

    const res = await request(app).get('/popular');

    expect(res.status).toBe(200);
  });

  it('should return segment-filtered results with cache hit', async () => {
    const segmentRecs = [{ id: 'seg-d1' }];
    mockCacheInstance.getTopBySegment.mockResolvedValue(segmentRecs);

    const res = await request(app).get('/popular').query({ segment: 'BUDGET_BACKPACKER' });

    expect(res.status).toBe(200);
    expect(res.body.popular).toEqual(segmentRecs);
    expect(res.body.metadata.segment).toBe('BUDGET_BACKPACKER');
  });

  it('should return segment-filtered results from DB when cache misses', async () => {
    mockCacheInstance.getTopBySegment.mockResolvedValue(null);
    const { PopularityService } = require('@ai/recommendations/popularity.service');
    PopularityService.mockImplementation(() => ({
      getTopBySegment: jest.fn().mockResolvedValue([{ id: 'seg-db' }]),
    }));

    const res = await request(app).get('/popular').query({ segment: 'LUXURY_TRAVELER' });

    expect(res.status).toBe(200);
  });

  it('should return category-filtered results with cache hit', async () => {
    const catRecs = [{ id: 'cat-d1' }];
    mockCacheInstance.getTopByCategory.mockResolvedValue(catRecs);

    const res = await request(app).get('/popular').query({ category: 'BEACH' });

    expect(res.status).toBe(200);
    expect(res.body.metadata.category).toBe('BEACH');
  });

  it('should fall back to DB for category when cache misses', async () => {
    mockCacheInstance.getTopByCategory.mockResolvedValue(null);
    const { PopularityService } = require('@ai/recommendations/popularity.service');
    PopularityService.mockImplementation(() => ({
      getTopByCategory: jest.fn().mockResolvedValue([{ id: 'cat-db' }]),
    }));

    const res = await request(app).get('/popular').query({ category: 'MOUNTAIN' });

    expect(res.status).toBe(200);
  });

  it('should return 500 on error', async () => {
    mockCacheInstance.getTopDestinations.mockRejectedValue(new Error('cache error'));

    const res = await request(app).get('/popular');

    expect(res.status).toBe(500);
  });
});
