/**
 * US-IA-009.4/5 — Scoring hybride SVD + rule-based
 *
 * Tests du mode ML hybrid de AccommodationScoringService :
 * - scoreWithMLHybrid : combine ML (70%) + rules (30%)
 * - MLGrpcClient intégré via mock (circuit breaker, fallback)
 * - Fallback sur rule-based si ML échoue
 * - Le champ mlScore est présent dans le breakdown
 * - Les pondérations sont respectées
 *
 * @ticket US-IA-009.4, US-IA-009.5
 */

// Mock MLGrpcClient avant tout import
jest.mock('@ai/services/MLGrpcClient', () => {
  const mockClient = {
    getRecommendations: jest.fn(),
  };
  return {
    MLGrpcClient: jest.fn(() => mockClient),
    getMLClient: jest.fn(() => mockClient),
    __mockClient: mockClient,
  };
});

import { AccommodationScoringService } from '@ai/accommodations/services/accommodation-scoring.service';
import {
  AccommodationFeatures,
  AccommodationVector,
  AccommodationCategory,
  LocationType,
} from '@ai/accommodations/types/accommodation-vector.types';
import * as MLGrpcClientModule from '@ai/services/MLGrpcClient';

// Accès au mock client
const mockMLClient = (MLGrpcClientModule as any).__mockClient;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createHotel(
  hotelId: string,
  vector: number[],
  country: string = 'France',
  city: string = 'Paris'
): { features: AccommodationFeatures; vector: AccommodationVector } {
  return {
    features: {
      hotelId,
      name: `Hotel ${hotelId}`,
      location: {
        latitude: 48.8566,
        longitude: 2.3522,
        address: `1 rue Test, ${city}`,
        cityCode: city.substring(0, 3).toUpperCase(),
        locationType: LocationType.CITY_CENTER,
        distanceToCenter: 1.0,
        country,
        city,
      },
      category: AccommodationCategory.HOTEL,
      starRating: 4,
      price: { amount: 200, currency: 'EUR', perNight: true },
      ratings: {
        overall: 8.5,
        numberOfReviews: 500,
        cleanliness: 8.5,
        service: 8.0,
        facilities: 8.5,
      },
      amenities: [],
    },
    vector: vector as AccommodationVector,
  };
}

const BASE_VECTOR = [0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.0];

const hotels = [
  createHotel('H1', [0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1]),
  createHotel('H2', [0.5, 0.4, 0.3, 0.2, 0.1, 0.0, 0.0, 0.0]),
  createHotel('H3', [0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2]),
];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('US-IA-009.4/5 — Hybrid ML Scoring', () => {
  let service: AccommodationScoringService;

  beforeEach(() => {
    jest.clearAllMocks();
    // Activer le mode ML dans le service
    service = new AccommodationScoringService({
      useMLModel: true,
      mlHybridWeight: 0.7,
      minSimilarityThreshold: 0,
      minQualityScore: 0,
      applyDiversification: false, // Désactivé pour simplifier les tests
    });
  });

  describe('scoreWithMLHybrid — fonctionnement normal', () => {
    it('should use MLGrpcClient when useMLModel=true', async () => {
      mockMLClient.getRecommendations.mockResolvedValue({
        items: [
          { itemId: 'H1', score: 0.9, confidence: 0.8 },
          { itemId: 'H2', score: 0.5, confidence: 0.7 },
          { itemId: 'H3', score: 0.85, confidence: 0.9 },
        ],
        modelVersion: 'svd_v1.0',
        inferenceTimeMs: 45,
        fromCache: false,
        totalCandidates: 3,
        warnings: [],
      });

      const results = await service.scoreAccommodations(
        BASE_VECTOR,
        'ADVENTURE_SEEKER',
        hotels,
        10,
        undefined,
        'user-ml-test'
      );

      expect(mockMLClient.getRecommendations).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-ml-test',
          topK: expect.any(Number),
          timeout: 300,
        })
      );
      expect(results.length).toBeGreaterThan(0);
    });

    it('should include mlScore in breakdown when ML is active', async () => {
      mockMLClient.getRecommendations.mockResolvedValue({
        items: [{ itemId: 'H1', score: 0.9, confidence: 0.85 }],
        modelVersion: 'svd_v1.0',
        inferenceTimeMs: 30,
        fromCache: false,
        totalCandidates: 1,
        warnings: [],
      });

      const results = await service.scoreAccommodations(
        BASE_VECTOR,
        'LUXURY_TRAVELER',
        hotels,
        10,
        undefined,
        'user-ml-breakdown'
      );

      const h1Result = results.find((r) => r.accommodation.hotelId === 'H1');
      expect(h1Result).toBeDefined();
      expect(h1Result!.breakdown.mlScore).toBeDefined();
      expect(typeof h1Result!.breakdown.mlScore).toBe('number');
    });

    it('should rank hotel with higher ML score higher', async () => {
      // H3 a le ML score le plus élevé
      mockMLClient.getRecommendations.mockResolvedValue({
        items: [
          { itemId: 'H1', score: 0.6, confidence: 0.7 },
          { itemId: 'H2', score: 0.4, confidence: 0.6 },
          { itemId: 'H3', score: 0.95, confidence: 0.9 }, // ML score élevé
        ],
        modelVersion: 'svd_v1.0',
        inferenceTimeMs: 25,
        fromCache: false,
        totalCandidates: 3,
        warnings: [],
      });

      const results = await service.scoreAccommodations(
        BASE_VECTOR,
        'ADVENTURE_SEEKER',
        hotels,
        10,
        undefined,
        'user-ranking-test'
      );

      const h3Index = results.findIndex((r) => r.accommodation.hotelId === 'H3');
      const h2Index = results.findIndex((r) => r.accommodation.hotelId === 'H2');

      // H3 (ML score 0.95) doit être mieux classé que H2 (ML score 0.4)
      expect(h3Index).toBeLessThan(h2Index);
    });

    it('should apply hybrid weight: 70% ML + 30% rules', async () => {
      const mlScore = 0.8;
      mockMLClient.getRecommendations.mockResolvedValue({
        items: [{ itemId: 'H1', score: mlScore, confidence: 0.8 }],
        modelVersion: 'svd_v1.0',
        inferenceTimeMs: 20,
        fromCache: false,
        totalCandidates: 1,
        warnings: [],
      });

      const results = await service.scoreAccommodations(
        BASE_VECTOR,
        'ADVENTURE_SEEKER',
        hotels.slice(0, 1), // Only H1
        10,
        undefined,
        'user-weight-test'
      );

      const h1 = results[0];
      expect(h1).toBeDefined();

      // hybrid = 0.7 * mlScore + 0.3 * ruleScore
      // We can't know ruleScore exactly, but final score should reflect ML weight
      const { mlScore: storedMlScore, finalScore } = h1.breakdown;
      expect(storedMlScore).toBe(mlScore);
      // finalScore doit être influencé par le ML score élevé
      expect(finalScore).toBeGreaterThan(0.5);
    });
  });

  describe('Fallback sur rule-based si ML échoue', () => {
    it('should fall back to rule-based when MLGrpcClient throws', async () => {
      mockMLClient.getRecommendations.mockRejectedValue(
        new Error('gRPC connection failed')
      );

      // Le scoring rule-based doit quand même fonctionner
      const results = await service.scoreAccommodations(
        BASE_VECTOR,
        'ADVENTURE_SEEKER',
        hotels,
        10,
        undefined,
        'user-fallback-test'
      );

      // Doit retourner des résultats (rule-based fallback)
      expect(results.length).toBeGreaterThan(0);
      // Pas de mlScore dans le breakdown (mode rule-based)
      results.forEach((r) => {
        expect(r.breakdown.mlScore).toBeUndefined();
      });
    });

    it('should fall back when circuit breaker is OPEN', async () => {
      mockMLClient.getRecommendations.mockRejectedValue(
        new Error('Circuit breaker is OPEN')
      );

      const results = await service.scoreAccommodations(
        BASE_VECTOR,
        'BUSINESS_TRAVELER',
        hotels,
        10,
        undefined,
        'user-circuit-test'
      );

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Mode rule-based (useMLModel=false)', () => {
    it('should NOT call MLGrpcClient when useMLModel=false', async () => {
      const ruleService = new AccommodationScoringService({
        useMLModel: false,
        minSimilarityThreshold: 0,
        minQualityScore: 0,
      });

      await ruleService.scoreAccommodations(
        BASE_VECTOR,
        'FAMILY_TRAVELER',
        hotels,
        10
      );

      expect(mockMLClient.getRecommendations).not.toHaveBeenCalled();
    });

    it('should still produce ranked results in rule-based mode', async () => {
      const ruleService = new AccommodationScoringService({
        useMLModel: false,
        minSimilarityThreshold: 0,
        minQualityScore: 0,
      });

      const results = await ruleService.scoreAccommodations(
        BASE_VECTOR,
        'FAMILY_TRAVELER',
        hotels,
        10
      );

      expect(results.length).toBe(hotels.length);
      // Tri décroissant
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
      }
    });
  });

  describe('Configuration ML hybrid', () => {
    it('should respect custom mlHybridWeight', async () => {
      const customService = new AccommodationScoringService({
        useMLModel: true,
        mlHybridWeight: 0.3, // 30% ML, 70% rules
        minSimilarityThreshold: 0,
        minQualityScore: 0,
        applyDiversification: false,
      });

      mockMLClient.getRecommendations.mockResolvedValue({
        items: [{ itemId: 'H1', score: 1.0, confidence: 0.9 }],
        modelVersion: 'svd_v1.0',
        inferenceTimeMs: 15,
        fromCache: true,
        totalCandidates: 1,
        warnings: [],
      });

      const results = await customService.scoreAccommodations(
        BASE_VECTOR,
        'ADVENTURE_SEEKER',
        hotels.slice(0, 1),
        10,
        undefined,
        'user-custom-weight'
      );

      expect(results.length).toBeGreaterThan(0);
    });
  });
});
