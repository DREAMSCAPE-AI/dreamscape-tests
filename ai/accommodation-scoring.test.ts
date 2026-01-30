/**
 * Accommodation Scoring Service Tests
 *
 * Validates:
 * 1. Cosine similarity calculations
 * 2. Popularity scoring logic
 * 3. Quality scoring logic
 * 4. Segment boost application
 * 5. MMR diversification
 * 6. Reason generation
 * 7. Configuration management
 *
 * @module tests/ai
 * @ticket US-IA-003.2
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  AccommodationScoringService,
  DEFAULT_SCORING_CONFIG,
} from '../../dreamscape-services/ai/src/accommodations/services/accommodation-scoring.service';
import {
  AccommodationFeatures,
  AccommodationVector,
  AccommodationCategory,
  AmenityCategory,
  LocationType,
} from '../../dreamscape-services/ai/src/accommodations/types/accommodation-vector.types';

describe('AccommodationScoringService', () => {
  let scoringService: AccommodationScoringService;

  beforeEach(() => {
    scoringService = new AccommodationScoringService();
  });

  // ==========================================================================
  // TEST 1: Cosine Similarity
  // ==========================================================================

  describe('Cosine Similarity', () => {
    it('should calculate perfect similarity for identical vectors', async () => {
      const userVector = [0.5, 0.8, 0.6, 0.7, 0.4, 0.9, 0.7, 0.8];
      const hotelVector: AccommodationVector = [0.5, 0.8, 0.6, 0.7, 0.4, 0.9, 0.7, 0.8];

      const hotel = createTestHotelWithVector(hotelVector);
      const results = await scoringService.scoreAccommodations(
        userVector,
        'CULTURAL_ENTHUSIAST',
        [hotel],
        10
      );

      // Similarity should be 1.0 (perfect match)
      expect(results[0].breakdown.similarityScore).toBeCloseTo(1.0, 2);
    });

    it('should calculate zero similarity for orthogonal vectors', async () => {
      // Orthogonal vectors: [1,0,0,0,0,0,0,0] and [0,1,0,0,0,0,0,0]
      const userVector = [1, 0, 0, 0, 0, 0, 0, 0];
      const hotelVector: AccommodationVector = [0, 1, 0, 0, 0, 0, 0, 0];

      const hotel = createTestHotelWithVector(hotelVector);
      const results = await scoringService.scoreAccommodations(
        userVector,
        'CULTURAL_ENTHUSIAST',
        [hotel],
        10
      );

      expect(results[0].breakdown.similarityScore).toBeCloseTo(0, 1);
    });

    it('should calculate high similarity for similar vectors', async () => {
      const userVector = [0.8, 0.9, 0.7, 0.6, 0.3, 0.95, 0.8, 0.75];
      const hotelVector: AccommodationVector = [0.75, 0.85, 0.65, 0.65, 0.35, 0.9, 0.75, 0.7];

      const hotel = createTestHotelWithVector(hotelVector);
      const results = await scoringService.scoreAccommodations(
        userVector,
        'CULTURAL_ENTHUSIAST',
        [hotel],
        10
      );

      // Very similar vectors should have similarity > 0.95
      expect(results[0].breakdown.similarityScore).toBeGreaterThan(0.95);
    });

    it('should handle zero vectors gracefully', async () => {
      const userVector = [0, 0, 0, 0, 0, 0, 0, 0];
      const hotelVector: AccommodationVector = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];

      const hotel = createTestHotelWithVector(hotelVector);
      const results = await scoringService.scoreAccommodations(
        userVector,
        'CULTURAL_ENTHUSIAST',
        [hotel],
        10
      );

      // Should return 0 similarity without crashing
      expect(results[0].breakdown.similarityScore).toBe(0);
    });
  });

  // ==========================================================================
  // TEST 2: Popularity Scoring
  // ==========================================================================

  describe('Popularity Scoring', () => {
    it('should score highly rated and reviewed hotels higher', async () => {
      const popularHotel = createTestHotelWithVector(
        [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
        {
          ratings: {
            overall: 9.5,
            numberOfReviews: 2000,
          },
        }
      );

      const unpopularHotel = createTestHotelWithVector(
        [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
        {
          hotelId: 'UNPOP',
          ratings: {
            overall: 6.0,
            numberOfReviews: 10,
          },
        }
      );

      const userVector = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
      const results = await scoringService.scoreAccommodations(
        userVector,
        'CULTURAL_ENTHUSIAST',
        [popularHotel, unpopularHotel],
        10
      );

      expect(results[0].breakdown.popularityScore).toBeGreaterThan(
        results[1].breakdown.popularityScore
      );
    });

    it('should use logarithmic scaling for review counts', async () => {
      const hotel10 = createTestHotelWithVector(
        [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
        {
          hotelId: 'H10',
          ratings: { overall: 8.0, numberOfReviews: 10 },
        }
      );

      const hotel100 = createTestHotelWithVector(
        [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
        {
          hotelId: 'H100',
          ratings: { overall: 8.0, numberOfReviews: 100 },
        }
      );

      const hotel1000 = createTestHotelWithVector(
        [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
        {
          hotelId: 'H1000',
          ratings: { overall: 8.0, numberOfReviews: 1000 },
        }
      );

      const userVector = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
      const results = await scoringService.scoreAccommodations(
        userVector,
        'CULTURAL_ENTHUSIAST',
        [hotel10, hotel100, hotel1000],
        10
      );

      // Popularity should increase, but not linearly
      const pop10 = results.find(r => r.accommodation.hotelId === 'H10')!.breakdown.popularityScore;
      const pop100 = results.find(r => r.accommodation.hotelId === 'H100')!.breakdown.popularityScore;
      const pop1000 = results.find(r => r.accommodation.hotelId === 'H1000')!.breakdown.popularityScore;

      expect(pop100).toBeGreaterThan(pop10);
      expect(pop1000).toBeGreaterThan(pop100);

      // Difference 10→100 should be larger than 100→1000 (logarithmic)
      const diff1 = pop100 - pop10;
      const diff2 = pop1000 - pop100;
      expect(diff1).toBeGreaterThan(diff2);
    });
  });

  // ==========================================================================
  // TEST 3: Quality Scoring
  // ==========================================================================

  describe('Quality Scoring', () => {
    it('should score 5-star hotels higher than 2-star hotels', async () => {
      const fiveStar = createTestHotelWithVector(
        [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
        {
          starRating: 5,
          ratings: {
            overall: 9.0,
            numberOfReviews: 500,
            cleanliness: 9.2,
            service: 9.0,
            facilities: 8.8,
          },
        }
      );

      const twoStar = createTestHotelWithVector(
        [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
        {
          hotelId: 'TWO',
          starRating: 2,
          ratings: {
            overall: 6.5,
            numberOfReviews: 100,
            cleanliness: 6.5,
            service: 6.0,
            facilities: 6.8,
          },
        }
      );

      const userVector = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
      const results = await scoringService.scoreAccommodations(
        userVector,
        'CULTURAL_ENTHUSIAST',
        [fiveStar, twoStar],
        10
      );

      expect(results[0].breakdown.qualityScore).toBeGreaterThan(
        results[1].breakdown.qualityScore
      );
      expect(results[0].breakdown.qualityScore).toBeGreaterThan(0.7);
      expect(results[1].breakdown.qualityScore).toBeLessThan(0.5);
    });

    it('should handle missing detailed ratings gracefully', async () => {
      const hotel = createTestHotelWithVector(
        [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
        {
          starRating: 4,
          ratings: {
            overall: 8.0,
            numberOfReviews: 200,
            // No detailed ratings
          },
        }
      );

      const userVector = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
      const results = await scoringService.scoreAccommodations(
        userVector,
        'CULTURAL_ENTHUSIAST',
        [hotel],
        10
      );

      // Should fallback to star rating + overall rating
      expect(results[0].breakdown.qualityScore).toBeGreaterThan(0);
      expect(results[0].breakdown.qualityScore).toBeLessThan(1);
    });
  });

  // ==========================================================================
  // TEST 4: Segment Boost
  // ==========================================================================

  describe('Segment Boost', () => {
    it('should boost luxury hotels for LUXURY_TRAVELER segment', async () => {
      const luxuryHotel = createTestHotelWithVector(
        [0.5, 0.5, 0.8, 0.6, 0.3, 0.8, 0.7, 0.8],
        {
          category: AccommodationCategory.LUXURY_HOTEL,
          starRating: 5,
        }
      );

      const userVector = [0.5, 0.5, 0.7, 0.6, 0.3, 0.8, 0.7, 0.8];
      const results = await scoringService.scoreAccommodations(
        userVector,
        'LUXURY_TRAVELER',
        [luxuryHotel],
        10
      );

      // Segment boost should be 1.4x for LUXURY_TRAVELER → LUXURY_HOTEL
      expect(results[0].breakdown.segmentBoost).toBe(1.4);
    });

    it('should penalize hostels for LUXURY_TRAVELER segment', async () => {
      const hostel = createTestHotelWithVector(
        [0.5, 0.5, 0.2, 0.3, 0.5, 0.8, 0.4, 0.5],
        {
          category: AccommodationCategory.HOSTEL,
          starRating: 2,
        }
      );

      const userVector = [0.5, 0.5, 0.7, 0.6, 0.3, 0.8, 0.7, 0.8];
      const results = await scoringService.scoreAccommodations(
        userVector,
        'LUXURY_TRAVELER',
        [hostel],
        10
      );

      // Segment boost should be 0.3x for LUXURY_TRAVELER → HOSTEL
      expect(results[0].breakdown.segmentBoost).toBe(0.3);
    });

    it('should boost family hotels for FAMILY_EXPLORER segment', async () => {
      const familyHotel = createTestHotelWithVector(
        [0.5, 0.5, 0.5, 0.5, 0.8, 0.6, 0.5, 0.7],
        {
          category: AccommodationCategory.FAMILY_HOTEL,
          amenities: [AmenityCategory.KIDS_CLUB, AmenityCategory.FAMILY_ROOMS],
        }
      );

      const userVector = [0.5, 0.5, 0.5, 0.5, 0.8, 0.6, 0.5, 0.7];
      const results = await scoringService.scoreAccommodations(
        userVector,
        'FAMILY_EXPLORER',
        [familyHotel],
        10
      );

      expect(results[0].breakdown.segmentBoost).toBe(1.3);
    });

    it('should not apply boost when applySegmentBoost is false', async () => {
      const scoringWithoutBoost = new AccommodationScoringService({
        applySegmentBoost: false,
      });

      const luxuryHotel = createTestHotelWithVector(
        [0.5, 0.5, 0.8, 0.6, 0.3, 0.8, 0.7, 0.8],
        {
          category: AccommodationCategory.LUXURY_HOTEL,
        }
      );

      const userVector = [0.5, 0.5, 0.7, 0.6, 0.3, 0.8, 0.7, 0.8];
      const results = await scoringWithoutBoost.scoreAccommodations(
        userVector,
        'LUXURY_TRAVELER',
        [luxuryHotel],
        10
      );

      expect(results[0].breakdown.segmentBoost).toBe(1.0);
    });
  });

  // ==========================================================================
  // TEST 5: Score Combination
  // ==========================================================================

  describe('Score Combination', () => {
    it('should combine all components with correct weights', async () => {
      const hotel = createTestHotelWithVector(
        [0.8, 0.8, 0.8, 0.8, 0.5, 0.8, 0.8, 0.8],
        {
          starRating: 4,
          ratings: {
            overall: 8.5,
            numberOfReviews: 500,
            cleanliness: 8.5,
            service: 8.3,
            facilities: 8.7,
          },
          category: AccommodationCategory.BOUTIQUE_HOTEL,
        }
      );

      const userVector = [0.8, 0.8, 0.7, 0.7, 0.5, 0.9, 0.8, 0.7];
      const results = await scoringService.scoreAccommodations(
        userVector,
        'CULTURAL_ENTHUSIAST',
        [hotel],
        10
      );

      const breakdown = results[0].breakdown;

      // Manually calculate expected score
      const similarity = breakdown.similarityScore;
      const popularity = breakdown.popularityScore;
      const quality = breakdown.qualityScore;

      const expectedBase =
        0.5 * similarity +
        0.3 * popularity +
        0.2 * quality;

      const segmentBoost = 1.3; // CULTURAL_ENTHUSIAST → BOUTIQUE_HOTEL
      const expectedFinal = Math.min(1.0, expectedBase * segmentBoost);

      expect(breakdown.finalScore).toBeCloseTo(expectedFinal, 2);
    });

    it('should clamp final score to [0-1] range', async () => {
      const perfectHotel = createTestHotelWithVector(
        [0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9],
        {
          starRating: 5,
          ratings: {
            overall: 10,
            numberOfReviews: 10000,
            cleanliness: 10,
            service: 10,
            facilities: 10,
          },
          category: AccommodationCategory.LUXURY_HOTEL,
        }
      );

      const userVector = [0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9];
      const results = await scoringService.scoreAccommodations(
        userVector,
        'LUXURY_TRAVELER',
        [perfectHotel],
        10
      );

      // Even with 1.4x boost, should be clamped to 1.0
      expect(results[0].score).toBeLessThanOrEqual(1.0);
      expect(results[0].score).toBeGreaterThan(0.9);
    });
  });

  // ==========================================================================
  // TEST 6: MMR Diversification
  // ==========================================================================

  describe('MMR Diversification', () => {
    it('should diversify results when applyDiversification is true', async () => {
      // Create 10 similar luxury beach resorts
      const similarHotels = Array.from({ length: 10 }, (_, i) =>
        createTestHotelWithVector(
          [0.7, 0.2, 0.8, 0.6, 0.3, 0.3, 0.6, 0.8],
          {
            hotelId: `RESORT${i}`,
            category: AccommodationCategory.RESORT,
            starRating: 5,
            ratings: { overall: 9.0 - i * 0.1, numberOfReviews: 1000 },
          }
        )
      );

      // Add 2 different hotels (city boutique, mountain eco-lodge)
      const boutiqueHotel = createTestHotelWithVector(
        [0.3, 0.9, 0.7, 0.5, 0.3, 0.95, 0.8, 0.7],
        {
          hotelId: 'BOUTIQUE',
          category: AccommodationCategory.BOUTIQUE_HOTEL,
          starRating: 4,
          ratings: { overall: 8.5, numberOfReviews: 500 },
        }
      );

      const ecoLodge = createTestHotelWithVector(
        [0.5, 0.1, 0.4, 0.7, 0.5, 0.1, 0.4, 0.65],
        {
          hotelId: 'ECO',
          category: AccommodationCategory.ECO_LODGE,
          starRating: 3,
          ratings: { overall: 8.3, numberOfReviews: 200 },
        }
      );

      const allHotels = [...similarHotels, boutiqueHotel, ecoLodge];
      const userVector = [0.7, 0.2, 0.8, 0.6, 0.3, 0.3, 0.6, 0.8]; // Matches resorts

      const results = await scoringService.scoreAccommodations(
        userVector,
        'LUXURY_TRAVELER',
        allHotels,
        5
      );

      // With MMR, should include some non-resort hotels for diversity
      const categories = results.map(r => r.accommodation.category);
      const uniqueCategories = new Set(categories);

      expect(uniqueCategories.size).toBeGreaterThan(1); // At least 2 categories
    });

    it('should prioritize relevance when lambda is high', async () => {
      const highRelevanceScorer = new AccommodationScoringService({
        diversityLambda: 0.95, // 95% relevance, 5% diversity
      });

      const hotels = [
        createTestHotelWithVector([0.9, 0.9, 0.9, 0.9, 0.5, 0.9, 0.9, 0.9], {
          hotelId: 'H1',
          starRating: 5,
          ratings: { overall: 9.5, numberOfReviews: 2000 },
        }),
        createTestHotelWithVector([0.88, 0.88, 0.88, 0.88, 0.5, 0.88, 0.88, 0.88], {
          hotelId: 'H2',
          starRating: 5,
          ratings: { overall: 9.4, numberOfReviews: 1800 },
        }),
        createTestHotelWithVector([0.3, 0.3, 0.3, 0.3, 0.5, 0.3, 0.3, 0.3], {
          hotelId: 'H3',
          starRating: 2,
          ratings: { overall: 6.0, numberOfReviews: 50 },
        }),
      ];

      const userVector = [0.9, 0.9, 0.9, 0.9, 0.5, 0.9, 0.9, 0.9];
      const results = await highRelevanceScorer.scoreAccommodations(
        userVector,
        'LUXURY_TRAVELER',
        hotels,
        3
      );

      // Should select H1, H2 (high relevance) before H3 (low relevance)
      expect(results[0].accommodation.hotelId).toBe('H1');
      expect(results[1].accommodation.hotelId).toBe('H2');
    });
  });

  // ==========================================================================
  // TEST 7: Explainability (Reasons)
  // ==========================================================================

  describe('Explainability', () => {
    it('should generate appropriate reasons for high similarity', async () => {
      const hotel = createTestHotelWithVector(
        [0.9, 0.9, 0.8, 0.7, 0.5, 0.95, 0.85, 0.8],
        {
          starRating: 4,
          ratings: { overall: 8.8, numberOfReviews: 1000 },
          category: AccommodationCategory.BOUTIQUE_HOTEL,
        }
      );

      const userVector = [0.9, 0.9, 0.8, 0.7, 0.5, 0.95, 0.85, 0.8];
      const results = await scoringService.scoreAccommodations(
        userVector,
        'CULTURAL_ENTHUSIAST',
        [hotel],
        10
      );

      const reasons = results[0].reasons;
      expect(reasons).toContain('Matches your preferences');
    });

    it('should include segment-specific reasons', async () => {
      const hotel = createTestHotelWithVector(
        [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
        {
          category: AccommodationCategory.LUXURY_HOTEL,
        }
      );

      const userVector = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
      const results = await scoringService.scoreAccommodations(
        userVector,
        'LUXURY_TRAVELER',
        [hotel],
        10
      );

      const reasons = results[0].reasons;
      const hasSegmentReason = reasons.some(r => r.includes('luxury traveler'));
      expect(hasSegmentReason).toBe(true);
    });

    it('should include dimension-specific reasons', async () => {
      const hotel = createTestHotelWithVector(
        [0.3, 0.9, 0.5, 0.4, 0.3, 0.95, 0.85, 0.7], // High urban (dim 5) and gastronomy (dim 6)
        {
          starRating: 4,
          ratings: { overall: 8.5, numberOfReviews: 500 },
        }
      );

      const userVector = [0.3, 0.9, 0.5, 0.4, 0.3, 0.95, 0.85, 0.7]; // Matches hotel
      const results = await scoringService.scoreAccommodations(
        userVector,
        'CULTURAL_ENTHUSIAST',
        [hotel],
        10
      );

      const reasons = results[0].reasons;
      expect(reasons).toContain('Located in the heart of the city');
      expect(reasons).toContain('Great dining options');
    });

    it('should limit reasons to maximum 5', async () => {
      const perfectHotel = createTestHotelWithVector(
        [0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9],
        {
          starRating: 5,
          ratings: {
            overall: 10,
            numberOfReviews: 10000,
            cleanliness: 10,
            service: 10,
            facilities: 10,
          },
          category: AccommodationCategory.LUXURY_HOTEL,
        }
      );

      const userVector = [0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9];
      const results = await scoringService.scoreAccommodations(
        userVector,
        'LUXURY_TRAVELER',
        [perfectHotel],
        10
      );

      expect(results[0].reasons.length).toBeLessThanOrEqual(5);
    });
  });

  // ==========================================================================
  // TEST 8: Configuration
  // ==========================================================================

  describe('Configuration', () => {
    it('should use custom weights when provided', async () => {
      const customScorer = new AccommodationScoringService({
        weights: {
          similarity: 0.7, // Higher similarity weight
          popularity: 0.2,
          quality: 0.1,
        },
      });

      const config = customScorer.getConfig();
      expect(config.weights.similarity).toBe(0.7);
      expect(config.weights.popularity).toBe(0.2);
      expect(config.weights.quality).toBe(0.1);
    });

    it('should validate configuration correctly', () => {
      const validConfig = DEFAULT_SCORING_CONFIG;
      const result = AccommodationScoringService.validateConfig(validConfig);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid weight sums', () => {
      const invalidConfig = {
        ...DEFAULT_SCORING_CONFIG,
        weights: {
          similarity: 0.6,
          popularity: 0.6,
          quality: 0.6, // Sum = 1.8 > 1.0
        },
      };

      const result = AccommodationScoringService.validateConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should update configuration dynamically', () => {
      scoringService.updateConfig({
        diversityLambda: 0.5,
      });

      const config = scoringService.getConfig();
      expect(config.diversityLambda).toBe(0.5);
    });
  });

  // ==========================================================================
  // TEST 9: Filters
  // ==========================================================================

  describe('Filters', () => {
    it('should filter out hotels below similarity threshold', async () => {
      const hotels = [
        createTestHotelWithVector([0.9, 0.9, 0.9, 0.9, 0.5, 0.9, 0.9, 0.9], {
          hotelId: 'HIGH',
        }),
        createTestHotelWithVector([0.1, 0.1, 0.1, 0.1, 0.5, 0.1, 0.1, 0.1], {
          hotelId: 'LOW',
        }),
      ];

      const userVector = [0.9, 0.9, 0.9, 0.9, 0.5, 0.9, 0.9, 0.9];
      const results = await scoringService.scoreAccommodations(
        userVector,
        'LUXURY_TRAVELER',
        hotels,
        10
      );

      // Should only include HIGH hotel (LOW has similarity < 0.3)
      expect(results.length).toBe(1);
      expect(results[0].accommodation.hotelId).toBe('HIGH');
    });

    it('should filter out hotels below quality threshold', async () => {
      const hotels = [
        createTestHotelWithVector([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5], {
          hotelId: 'GOOD',
          starRating: 4,
          ratings: { overall: 8.0, numberOfReviews: 500 },
        }),
        createTestHotelWithVector([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5], {
          hotelId: 'BAD',
          starRating: 1,
          ratings: { overall: 4.0, numberOfReviews: 10 },
        }),
      ];

      const userVector = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
      const results = await scoringService.scoreAccommodations(
        userVector,
        'CULTURAL_ENTHUSIAST',
        hotels,
        10
      );

      // BAD hotel should be filtered out (quality < 0.4)
      const hotelIds = results.map(r => r.accommodation.hotelId);
      expect(hotelIds).toContain('GOOD');
      expect(hotelIds).not.toContain('BAD');
    });
  });
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Create test hotel with vector and optional overrides
 */
function createTestHotelWithVector(
  vector: AccommodationVector,
  overrides?: Partial<{
    hotelId: string;
    category: AccommodationCategory;
    starRating: number;
    ratings: any;
    amenities: AmenityCategory[];
  }>
): { features: AccommodationFeatures; vector: AccommodationVector } {
  const features: AccommodationFeatures = {
    hotelId: overrides?.hotelId || 'TEST001',
    name: 'Test Hotel',
    location: {
      latitude: 48.8566,
      longitude: 2.3522,
      address: '123 Test Street',
      cityCode: 'PAR',
      locationType: LocationType.CITY_CENTER,
    },
    category: overrides?.category || AccommodationCategory.HOTEL,
    starRating: overrides?.starRating !== undefined ? overrides.starRating : 3,
    price: {
      amount: 150,
      currency: 'EUR',
      perNight: true,
    },
    ratings: overrides?.ratings || {
      overall: 8.0,
      numberOfReviews: 100,
    },
    amenities: overrides?.amenities || [AmenityCategory.WIFI],
  };

  return { features, vector };
}
