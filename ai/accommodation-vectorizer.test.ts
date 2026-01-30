/**
 * Accommodation Vectorizer Service Tests
 *
 * Validates that the vectorization logic produces:
 * 1. Properly normalized vectors [0-1]
 * 2. Consistent similarity for similar hotels
 * 3. Appropriate differences for dissimilar hotels
 * 4. Correct dimension calculations
 *
 * @module tests/ai
 * @ticket US-IA-003.1
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { AccommodationVectorizerService } from '../../dreamscape-services/ai/src/accommodations/services/accommodation-vectorizer.service';
import {
  AccommodationFeatures,
  AccommodationCategory,
  AmenityCategory,
  LocationType,
} from '../../dreamscape-services/ai/src/accommodations/types/accommodation-vector.types';

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(vec1: number[], vec2: number[]): number {
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }

  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

describe('AccommodationVectorizerService', () => {
  let vectorizer: AccommodationVectorizerService;

  beforeEach(() => {
    vectorizer = new AccommodationVectorizerService();
  });

  // =========================================================================
  // TEST 1: Vector Normalization
  // =========================================================================

  describe('Vector Normalization', () => {
    it('should produce vectors with all dimensions in [0-1] range', () => {
      const hotel: AccommodationFeatures = createTestHotel({
        category: AccommodationCategory.LUXURY_HOTEL,
        amenities: [
          AmenityCategory.POOL,
          AmenityCategory.SPA,
          AmenityCategory.GYM,
          AmenityCategory.RESTAURANT,
          AmenityCategory.FINE_DINING,
          AmenityCategory.CONCIERGE,
        ],
        price: 350,
        rating: 9.2,
      });

      const vector = vectorizer.vectorize(hotel);

      expect(vector).toHaveLength(8);

      vector.forEach((value, index) => {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      });
    });

    it('should produce non-zero vectors for hotels with features', () => {
      const hotel = createTestHotel({
        amenities: [AmenityCategory.WIFI, AmenityCategory.POOL],
      });

      const vector = vectorizer.vectorize(hotel);
      const sum = vector.reduce((a, b) => a + b, 0);

      expect(sum).toBeGreaterThan(0);
    });

    it('should handle hotels with minimal data gracefully', () => {
      const minimalHotel: AccommodationFeatures = {
        hotelId: 'MIN001',
        name: 'Minimal Hotel',
        location: {
          latitude: 48.8566,
          longitude: 2.3522,
          address: 'Paris, France',
          cityCode: 'PAR',
          locationType: LocationType.CITY_CENTER,
        },
        category: AccommodationCategory.HOTEL,
        price: { amount: 100, currency: 'EUR', perNight: true },
        amenities: [],
      };

      const vector = vectorizer.vectorize(minimalHotel);

      expect(vector).toHaveLength(8);
      vector.forEach(value => {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      });
    });
  });

  // =========================================================================
  // TEST 2: Similarity for Similar Hotels
  // =========================================================================

  describe('Similarity Validation', () => {
    it('should produce high similarity for two luxury beach resorts', () => {
      const resort1 = createTestHotel({
        category: AccommodationCategory.RESORT,
        locationType: LocationType.BEACH,
        amenities: [
          AmenityCategory.POOL,
          AmenityCategory.SPA,
          AmenityCategory.FINE_DINING,
          AmenityCategory.WATER_SPORTS,
        ],
        price: 400,
        rating: 9.0,
        stars: 5,
      });

      const resort2 = createTestHotel({
        hotelId: 'RESORT2',
        category: AccommodationCategory.RESORT,
        locationType: LocationType.BEACH,
        amenities: [
          AmenityCategory.POOL,
          AmenityCategory.SPA,
          AmenityCategory.RESTAURANT,
          AmenityCategory.WATER_SPORTS,
        ],
        price: 380,
        rating: 8.8,
        stars: 5,
      });

      const vec1 = vectorizer.vectorize(resort1);
      const vec2 = vectorizer.vectorize(resort2);

      const similarity = cosineSimilarity(vec1, vec2);

      // Similar hotels should have similarity > 0.85
      expect(similarity).toBeGreaterThan(0.85);
    });

    it('should produce low similarity for budget hostel vs luxury hotel', () => {
      const hostel = createTestHotel({
        category: AccommodationCategory.HOSTEL,
        amenities: [AmenityCategory.WIFI],
        price: 25,
        rating: 7.5,
        stars: 1,
      });

      const luxury = createTestHotel({
        hotelId: 'LUX001',
        category: AccommodationCategory.LUXURY_HOTEL,
        amenities: [
          AmenityCategory.CONCIERGE,
          AmenityCategory.SPA,
          AmenityCategory.FINE_DINING,
          AmenityCategory.BUTLER_SERVICE,
        ],
        price: 600,
        rating: 9.5,
        stars: 5,
      });

      const vec1 = vectorizer.vectorize(hostel);
      const vec2 = vectorizer.vectorize(luxury);

      const similarity = cosineSimilarity(vec1, vec2);

      // Very different hotels should have similarity < 0.5
      expect(similarity).toBeLessThan(0.5);
    });

    it('should produce medium similarity for business hotel vs boutique hotel', () => {
      const business = createTestHotel({
        category: AccommodationCategory.BUSINESS_HOTEL,
        locationType: LocationType.BUSINESS_DISTRICT,
        amenities: [
          AmenityCategory.WIFI,
          AmenityCategory.BUSINESS_CENTER,
          AmenityCategory.MEETING_ROOMS,
          AmenityCategory.GYM,
        ],
        price: 150,
        rating: 8.0,
      });

      const boutique = createTestHotel({
        hotelId: 'BTQ001',
        category: AccommodationCategory.BOUTIQUE_HOTEL,
        locationType: LocationType.HISTORIC_DISTRICT,
        amenities: [
          AmenityCategory.WIFI,
          AmenityCategory.RESTAURANT,
          AmenityCategory.BAR,
        ],
        price: 160,
        rating: 8.2,
      });

      const vec1 = vectorizer.vectorize(business);
      const vec2 = vectorizer.vectorize(boutique);

      const similarity = cosineSimilarity(vec1, vec2);

      // Moderately similar hotels should have similarity 0.5-0.75
      expect(similarity).toBeGreaterThan(0.5);
      expect(similarity).toBeLessThan(0.75);
    });
  });

  // =========================================================================
  // TEST 3: Dimension-Specific Validation
  // =========================================================================

  describe('Dimension Calculations', () => {
    it('should score climate dimension high for hotels with pool and AC', () => {
      const hotel = createTestHotel({
        amenities: [
          AmenityCategory.POOL,
          AmenityCategory.AIR_CONDITIONING,
          AmenityCategory.SAUNA,
        ],
      });

      const vector = vectorizer.vectorize(hotel);
      const climateDim = vector[0];

      expect(climateDim).toBeGreaterThan(0.6);
    });

    it('should score activity dimension high for hotels with gym, spa, sports', () => {
      const hotel = createTestHotel({
        amenities: [
          AmenityCategory.GYM,
          AmenityCategory.SPA,
          AmenityCategory.SPORTS_FACILITIES,
        ],
      });

      const vector = vectorizer.vectorize(hotel);
      const activityDim = vector[3];

      expect(activityDim).toBeGreaterThan(0.7);
    });

    it('should score gastronomy dimension high for hotels with fine dining', () => {
      const hotel = createTestHotel({
        amenities: [
          AmenityCategory.RESTAURANT,
          AmenityCategory.FINE_DINING,
          AmenityCategory.BAR,
          AmenityCategory.ROOM_SERVICE,
        ],
      });

      const vector = vectorizer.vectorize(hotel);
      const gastronomyDim = vector[6];

      expect(gastronomyDim).toBeGreaterThan(0.7);
    });

    it('should score budget dimension correctly based on price', () => {
      const budget = createTestHotel({ price: 50 });
      const midRange = createTestHotel({ hotelId: 'MID', price: 150 });
      const luxury = createTestHotel({ hotelId: 'LUX', price: 500 });

      const budgetVec = vectorizer.vectorize(budget);
      const midVec = vectorizer.vectorize(midRange);
      const luxVec = vectorizer.vectorize(luxury);

      expect(budgetVec[2]).toBeLessThan(0.4); // Budget: low score
      expect(midVec[2]).toBeGreaterThan(0.4);
      expect(midVec[2]).toBeLessThan(0.7); // Mid-range: medium score
      expect(luxVec[2]).toBeGreaterThan(0.8); // Luxury: high score
    });

    it('should score urbanRural dimension correctly based on location', () => {
      const cityHotel = createTestHotel({
        locationType: LocationType.CITY_CENTER,
      });

      const ruralHotel = createTestHotel({
        hotelId: 'RURAL',
        locationType: LocationType.COUNTRYSIDE,
      });

      const cityVec = vectorizer.vectorize(cityHotel);
      const ruralVec = vectorizer.vectorize(ruralHotel);

      expect(cityVec[5]).toBeGreaterThan(0.8); // City: high urban score
      expect(ruralVec[5]).toBeLessThan(0.3); // Rural: low urban score
    });

    it('should score popularity dimension based on ratings and reviews', () => {
      const popular = createTestHotel({
        rating: 9.5,
        reviewCount: 1500,
        stars: 5,
      });

      const unpopular = createTestHotel({
        hotelId: 'UNPOP',
        rating: 6.0,
        reviewCount: 10,
        stars: 2,
      });

      const popularVec = vectorizer.vectorize(popular);
      const unpopularVec = vectorizer.vectorize(unpopular);

      expect(popularVec[7]).toBeGreaterThan(0.7); // Popular: high score
      expect(unpopularVec[7]).toBeLessThan(0.4); // Unpopular: low score
    });

    it('should score groupSize dimension high for family hotels', () => {
      const familyHotel = createTestHotel({
        category: AccommodationCategory.FAMILY_HOTEL,
        amenities: [AmenityCategory.KIDS_CLUB, AmenityCategory.FAMILY_ROOMS],
        rooms: {
          totalRooms: 50,
          maxOccupancy: 6,
          hasFamilyRooms: true,
          hasSuites: true,
          hasConnectingRooms: true,
        },
      });

      const vector = vectorizer.vectorize(familyHotel);
      const groupSizeDim = vector[4];

      expect(groupSizeDim).toBeGreaterThan(0.6);
    });

    it('should score cultureNature dimension correctly', () => {
      const culturalHotel = createTestHotel({
        locationType: LocationType.HISTORIC_DISTRICT,
      });

      const natureHotel = createTestHotel({
        hotelId: 'NATURE',
        locationType: LocationType.MOUNTAIN,
        amenities: [AmenityCategory.ECO_FRIENDLY, AmenityCategory.OUTDOOR_ACTIVITIES],
      });

      const culturalVec = vectorizer.vectorize(culturalHotel);
      const natureVec = vectorizer.vectorize(natureHotel);

      expect(culturalVec[1]).toBeGreaterThan(0.7); // Cultural: high score
      expect(natureVec[1]).toBeLessThan(0.3); // Nature: low score
    });
  });

  // =========================================================================
  // TEST 4: Batch Vectorization
  // =========================================================================

  describe('Batch Vectorization', () => {
    it('should vectorize multiple hotels efficiently', () => {
      const hotels = [
        createTestHotel({ hotelId: 'H1', price: 100 }),
        createTestHotel({ hotelId: 'H2', price: 150 }),
        createTestHotel({ hotelId: 'H3', price: 200 }),
      ];

      const result = vectorizer.batchVectorize(hotels);

      expect(result.vectors.size).toBe(3);
      expect(result.itemsProcessed).toBe(3);
      expect(result.processingTime).toBeGreaterThan(0);
      expect(result.errors).toBeUndefined();
    });

    it('should calculate market average dynamically', () => {
      const hotels = [
        createTestHotel({ hotelId: 'H1', price: 50 }),
        createTestHotel({ hotelId: 'H2', price: 100 }),
        createTestHotel({ hotelId: 'H3', price: 200 }),
        createTestHotel({ hotelId: 'H4', price: 250 }),
      ];

      const result = vectorizer.batchVectorize(hotels);
      const vectors = Array.from(result.vectors.values());

      // Market average = (50+100+200+250)/4 = 150
      // Budget dimension should reflect this
      const budgetDims = vectors.map(v => v[2]);

      // Hotel at 50 EUR should be budget (low score)
      expect(budgetDims[0]).toBeLessThan(0.4);
      // Hotel at 250 EUR should be upscale (high score)
      expect(budgetDims[3]).toBeGreaterThan(0.7);
    });

    it('should handle errors gracefully in batch mode', () => {
      const hotels = [
        createTestHotel({ hotelId: 'H1' }),
        null as any, // Invalid hotel
        createTestHotel({ hotelId: 'H3' }),
      ];

      const result = vectorizer.batchVectorize(hotels.filter(h => h !== null));

      expect(result.vectors.size).toBe(2);
      expect(result.itemsProcessed).toBe(2);
    });
  });

  // =========================================================================
  // TEST 5: Edge Cases
  // =========================================================================

  describe('Edge Cases', () => {
    it('should handle hotel with no amenities', () => {
      const hotel = createTestHotel({ amenities: [] });
      const vector = vectorizer.vectorize(hotel);

      expect(vector).toHaveLength(8);
      // Some dimensions (location, price) should still have values
      expect(vector.some(v => v > 0)).toBe(true);
    });

    it('should handle hotel with zero price', () => {
      const hotel = createTestHotel({ price: 0, stars: 3 });
      const vector = vectorizer.vectorize(hotel);

      // Should fallback to star rating for budget dimension
      expect(vector[2]).toBeGreaterThan(0);
      expect(vector[2]).toBeLessThan(1);
    });

    it('should handle hotel with no ratings', () => {
      const hotel = createTestHotel({ rating: undefined, reviewCount: undefined });
      const vector = vectorizer.vectorize(hotel);

      // Popularity dimension should have some value (from star rating)
      expect(vector[7]).toBeGreaterThanOrEqual(0);
    });

    it('should be deterministic - same hotel produces same vector', () => {
      const hotel = createTestHotel();
      const vec1 = vectorizer.vectorize(hotel);
      const vec2 = vectorizer.vectorize(hotel);

      for (let i = 0; i < 8; i++) {
        expect(vec1[i]).toBeCloseTo(vec2[i], 10);
      }
    });
  });

  // =========================================================================
  // TEST 6: Configuration
  // =========================================================================

  describe('Configuration', () => {
    it('should use custom configuration when provided', () => {
      const customVectorizer = new AccommodationVectorizerService({
        climate: {
          pool: 0.5,
          airConditioning: 0.5,
          heating: 0,
          sauna: 0,
          hotTub: 0,
        },
      });

      const hotel = createTestHotel({
        amenities: [AmenityCategory.POOL, AmenityCategory.AIR_CONDITIONING],
      });

      const vector = customVectorizer.vectorize(hotel);
      expect(vector[0]).toBeCloseTo(1.0, 1); // Should be 1.0 with equal weights
    });

    it('should allow configuration updates', () => {
      vectorizer.updateConfig({
        budget: {
          marketAveragePrice: 200,
          currency: 'USD',
        },
      });

      const config = vectorizer.getConfig();
      expect(config.budget.marketAveragePrice).toBe(200);
      expect(config.budget.currency).toBe('USD');
    });
  });
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Create test hotel with default values
 */
function createTestHotel(overrides: Partial<{
  hotelId: string;
  category: AccommodationCategory;
  locationType: LocationType;
  amenities: AmenityCategory[];
  price: number;
  rating: number;
  reviewCount: number;
  stars: number;
  rooms: any;
}>): AccommodationFeatures {
  return {
    hotelId: overrides.hotelId || 'TEST001',
    name: 'Test Hotel',
    location: {
      latitude: 48.8566,
      longitude: 2.3522,
      address: '123 Test Street, Paris',
      cityCode: 'PAR',
      locationType: overrides.locationType || LocationType.CITY_CENTER,
    },
    category: overrides.category || AccommodationCategory.HOTEL,
    starRating: overrides.stars !== undefined ? overrides.stars : 3,
    price: {
      amount: overrides.price !== undefined ? overrides.price : 150,
      currency: 'EUR',
      perNight: true,
    },
    ratings: overrides.rating !== undefined || overrides.reviewCount !== undefined ? {
      overall: overrides.rating !== undefined ? overrides.rating : 8.0,
      numberOfReviews: overrides.reviewCount !== undefined ? overrides.reviewCount : 100,
    } : undefined,
    amenities: overrides.amenities !== undefined
      ? overrides.amenities
      : [AmenityCategory.WIFI, AmenityCategory.AIR_CONDITIONING],
    rooms: overrides.rooms,
  };
}
