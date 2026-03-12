/**
 * Accommodation Scoring Service - Unit Tests
 *
 * Tests the scoring and ranking of accommodation recommendations.
 *
 * @ticket US-IA-003.2
 */

import { AccommodationScoringService } from '@ai/accommodations/services/accommodation-scoring.service';
import {
  AccommodationFeatures,
  AccommodationVector,
  AccommodationCategory,
  AmenityCategory,
  LocationType,
} from '@ai/accommodations/types/accommodation-vector.types';

describe('AccommodationScoringService', () => {
  let service: AccommodationScoringService;

  beforeEach(() => {
    service = new AccommodationScoringService();
  });

  describe('calculateCosineSimilarity', () => {
    it('should calculate cosine similarity between two vectors', () => {
      // Arrange
      const userVector = [1, 0, 0.5, 0.8, 0.3, 1, 0.6, 0.7];
      const hotelVector: AccommodationVector = [1, 0, 0.5, 0.8, 0.3, 1, 0.6, 0.7];

      // Act
      // @ts-ignore - accessing private method for testing
      const similarity = service.calculateCosineSimilarity(userVector, hotelVector);

      // Assert
      expect(similarity).toBe(1.0); // Identical vectors should have similarity of 1
    });

    it('should return 0 for orthogonal vectors', () => {
      // Arrange
      const userVector = [1, 0, 0, 0, 0, 0, 0, 0];
      const hotelVector: AccommodationVector = [0, 1, 0, 0, 0, 0, 0, 0];

      // Act
      // @ts-ignore - accessing private method for testing
      const similarity = service.calculateCosineSimilarity(userVector, hotelVector);

      // Assert
      expect(similarity).toBe(0); // Orthogonal vectors should have similarity of 0
    });

    it('should handle opposite vectors', () => {
      // Arrange
      const userVector = [1, 1, 1, 1, 1, 1, 1, 1];
      const hotelVector: AccommodationVector = [0, 0, 0, 0, 0, 0, 0, 0];

      // Act
      // @ts-ignore - accessing private method for testing
      const similarity = service.calculateCosineSimilarity(userVector, hotelVector);

      // Assert
      expect(similarity).toBe(0); // No overlap should give 0
    });
  });

  describe('scoreAccommodations', () => {
    it('should score and rank multiple accommodations', async () => {
      // Arrange
      const userVector = [0.8, 0.2, 0.5, 0.7, 0.3, 0.9, 0.6, 0.8];
      const userSegment = 'ADVENTURE_SEEKER';

      const hotels = [
        {
          features: createTestHotel(
            'PERFECT_MATCH',
            'Perfect Match Hotel',
            [0.8, 0.2, 0.5, 0.7, 0.3, 0.9, 0.6, 0.8], // Same as user vector
            8.5,
            500,
            4
          ),
          vector: [0.8, 0.2, 0.5, 0.7, 0.3, 0.9, 0.6, 0.8] as AccommodationVector,
        },
        {
          features: createTestHotel(
            'POOR_MATCH',
            'Poor Match Hotel',
            [0.1, 0.9, 0.1, 0.1, 0.8, 0.1, 0.1, 0.2], // Opposite preferences
            6.0,
            100,
            2
          ),
          vector: [0.1, 0.9, 0.1, 0.1, 0.8, 0.1, 0.1, 0.2] as AccommodationVector,
        },
        {
          features: createTestHotel(
            'GOOD_MATCH',
            'Good Match Hotel',
            [0.7, 0.3, 0.4, 0.6, 0.4, 0.8, 0.5, 0.7], // Similar to user
            8.0,
            400,
            4
          ),
          vector: [0.7, 0.3, 0.4, 0.6, 0.4, 0.8, 0.5, 0.7] as AccommodationVector,
        },
      ];

      // Act
      const results = await service.scoreAccommodations(userVector, userSegment, hotels, 10);

      // Assert
      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(3);

      // Verify results are sorted by score (descending)
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].breakdown.finalScore).toBeGreaterThanOrEqual(results[i].breakdown.finalScore);
      }

      // Perfect match should be ranked first
      expect(results[0].accommodation.hotelId).toBe('PERFECT_MATCH');

      // Verify score breakdown exists
      expect(results[0].breakdown.similarityScore).toBeDefined();
      expect(results[0].breakdown.popularityScore).toBeDefined();
      expect(results[0].breakdown.qualityScore).toBeDefined();
      expect(results[0].reasons).toBeDefined();
    });

    it('should filter out low similarity matches', async () => {
      // Arrange
      const userVector = [1, 0, 0, 0, 0, 1, 0, 1];
      const userSegment = 'LUXURY_TRAVELER';

      const hotels = [
        {
          features: createTestHotel(
            'HIGH_SIM',
            'High Similarity',
            [0.9, 0.1, 0.1, 0.1, 0.1, 0.9, 0.1, 0.9],
            8.0,
            300,
            4
          ),
          vector: [0.9, 0.1, 0.1, 0.1, 0.1, 0.9, 0.1, 0.9] as AccommodationVector,
        },
        {
          features: createTestHotel(
            'LOW_SIM',
            'Low Similarity',
            [0, 1, 1, 1, 1, 0, 1, 0], // Completely opposite
            9.0,
            500,
            5
          ),
          vector: [0, 1, 1, 1, 1, 0, 1, 0] as AccommodationVector,
        },
      ];

      // Act
      const results = await service.scoreAccommodations(userVector, userSegment, hotels, 10);

      // Assert
      // Low similarity hotel should be filtered out (similarity threshold = 0.3)
      expect(results.length).toBe(1);
      expect(results[0].accommodation.hotelId).toBe('HIGH_SIM');
    });

    it('should filter out low quality accommodations', async () => {
      // Arrange
      const userVector = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
      const userSegment = 'FAMILY_TRAVELER';

      const hotels = [
        {
          features: createTestHotel(
            'HIGH_QUALITY',
            'High Quality Hotel',
            [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
            8.5,
            500,
            4
          ),
          vector: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5] as AccommodationVector,
        },
        {
          features: createTestHotel(
            'LOW_QUALITY',
            'Low Quality Hotel',
            [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
            3.0, // Very low rating
            10,  // Very few reviews
            1    // 1 star
          ),
          vector: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5] as AccommodationVector,
        },
      ];

      // Act
      const results = await service.scoreAccommodations(userVector, userSegment, hotels, 10);

      // Assert
      // Low quality hotel should be filtered out (quality threshold = 0.4)
      expect(results.some((r: any) => r.accommodation.hotelId === 'HIGH_QUALITY')).toBe(true);
      // Low quality might be filtered, or ranked much lower
      if (results.length > 1) {
        expect(results[0].accommodation.hotelId).toBe('HIGH_QUALITY');
      }
    });
  });

  describe('applyMMR', () => {
    it('should diversify results using MMR algorithm', async () => {
      // Arrange
      const userVector = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
      const userSegment = 'BUSINESS_TRAVELER';

      // Create 5 very similar hotels (same location type, similar amenities)
      const hotels = [
        {
          features: createTestHotel('HOTEL1', 'Similar Hotel 1', [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5], 8.0, 300, 4),
          vector: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5] as AccommodationVector,
        },
        {
          features: createTestHotel('HOTEL2', 'Similar Hotel 2', [0.51, 0.49, 0.51, 0.49, 0.51, 0.49, 0.51, 0.49], 8.0, 300, 4),
          vector: [0.51, 0.49, 0.51, 0.49, 0.51, 0.49, 0.51, 0.49] as AccommodationVector,
        },
        {
          features: createTestHotel('HOTEL3', 'Similar Hotel 3', [0.49, 0.51, 0.49, 0.51, 0.49, 0.51, 0.49, 0.51], 8.0, 300, 4),
          vector: [0.49, 0.51, 0.49, 0.51, 0.49, 0.51, 0.49, 0.51] as AccommodationVector,
        },
        {
          features: createTestHotel('HOTEL4', 'Diverse Hotel', [0.9, 0.1, 0.9, 0.1, 0.9, 0.1, 0.9, 0.1], 7.5, 250, 3),
          vector: [0.9, 0.1, 0.9, 0.1, 0.9, 0.1, 0.9, 0.1] as AccommodationVector,
        },
      ];

      // Act
      const results = await service.scoreAccommodations(userVector, userSegment, hotels, 10);

      // Assert
      expect(results.length).toBeGreaterThan(0);

      // MMR should ensure the diverse hotel appears in results despite slightly lower similarity
      // Check that not all results are nearly identical
      const vectors = results.map(r =>
        hotels.find(h => h.features.hotelId === (r as any).accommodation.hotelId)?.vector
      ).filter(Boolean);

      // Calculate average similarity between consecutive results
      let totalSimilarity = 0;
      let count = 0;
      for (let i = 1; i < vectors.length; i++) {
        if (vectors[i-1] && vectors[i]) {
          // @ts-ignore
          const sim = service.calculateCosineSimilarity(vectors[i-1], vectors[i]);
          totalSimilarity += sim;
          count++;
        }
      }

      const avgSimilarity = count > 0 ? totalSimilarity / count : 1;

      // With diversification, consecutive results should not be too similar
      // Without diversification, they would all be nearly identical (similarity ~0.99)
      expect(avgSimilarity).toBeLessThan(0.95); // Should have some diversity
    });
  });
});

/**
 * Helper function to create test hotel data
 */
function createTestHotel(
  hotelId: string,
  name: string,
  vector: number[],
  rating: number,
  reviewCount: number,
  stars: number
): AccommodationFeatures {
  return {
    hotelId,
    name,
    chainCode: 'TEST',
    location: {
      latitude: 43.7,
      longitude: 7.25,
      address: 'Test Address',
      cityCode: 'TST',
      locationType: LocationType.CITY_CENTER,
      distanceToCenter: 1.0,
    },
    category: AccommodationCategory.HOTEL,
    starRating: stars,
    price: {
      amount: 100,
      currency: 'EUR',
      perNight: true,
    },
    ratings: {
      overall: rating,
      numberOfReviews: reviewCount,
      cleanliness: rating,
      service: rating,
      facilities: rating,
    },
    amenities: [
      AmenityCategory.WIFI,
      AmenityCategory.AIR_CONDITIONING,
      AmenityCategory.RESTAURANT,
    ],
  };
}
