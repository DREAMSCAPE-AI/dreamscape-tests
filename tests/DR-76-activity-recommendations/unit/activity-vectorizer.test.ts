/**
 * Unit Tests for Activity Vectorizer Service
 *
 * Tests the vectorization logic that transforms activity features
 * into 8D vectors compatible with user preference vectors.
 *
 * @ticket DR-76 / US-IA-004.1
 */

import { ActivityVectorizerService } from '../../../../dreamscape-services/ai/src/activities/services/activity-vectorizer.service';
import {
  ActivityFeatures,
  ActivityCategory,
  ActivityIntensity,
} from '../../../../dreamscape-services/ai/src/activities/types/activity-vector.types';

describe('ActivityVectorizerService', () => {
  let vectorizer: ActivityVectorizerService;

  beforeEach(() => {
    vectorizer = new ActivityVectorizerService();
  });

  describe('vectorize', () => {
    it('should create an 8-dimensional vector', () => {
      const activity: ActivityFeatures = createMockActivity({
        category: ActivityCategory.MUSEUM,
        intensity: ActivityIntensity.LOW,
      });

      const vector = vectorizer.vectorize(activity);

      expect(vector).toHaveLength(8);
      vector.forEach(dimension => {
        expect(dimension).toBeGreaterThanOrEqual(0);
        expect(dimension).toBeLessThanOrEqual(1);
      });
    });

    it('should score outdoor activities high on climate dimension', () => {
      const outdoorActivity: ActivityFeatures = createMockActivity({
        category: ActivityCategory.HIKING,
        availability: { weatherDependent: true, seasonal: true },
      });

      const indoorActivity: ActivityFeatures = createMockActivity({
        category: ActivityCategory.MUSEUM,
        availability: { weatherDependent: false, seasonal: false },
      });

      const outdoorVector = vectorizer.vectorize(outdoorActivity);
      const indoorVector = vectorizer.vectorize(indoorActivity);

      // Climate dimension (index 0)
      expect(outdoorVector[0]).toBeGreaterThan(indoorVector[0]);
    });

    it('should correctly distinguish cultural vs nature activities', () => {
      const culturalActivity: ActivityFeatures = createMockActivity({
        category: ActivityCategory.MUSEUM,
      });

      const natureActivity: ActivityFeatures = createMockActivity({
        category: ActivityCategory.HIKING,
      });

      const culturalVector = vectorizer.vectorize(culturalActivity);
      const natureVector = vectorizer.vectorize(natureActivity);

      // Culture/Nature dimension (index 1): 0 = nature, 1 = culture
      expect(culturalVector[1]).toBeGreaterThan(0.8);
      expect(natureVector[1]).toBeLessThan(0.2);
    });

    it('should map activity intensity to activity level dimension', () => {
      const lowIntensity: ActivityFeatures = createMockActivity({
        intensity: ActivityIntensity.LOW,
      });

      const highIntensity: ActivityFeatures = createMockActivity({
        intensity: ActivityIntensity.VERY_HIGH,
      });

      const lowVector = vectorizer.vectorize(lowIntensity);
      const highVector = vectorizer.vectorize(highIntensity);

      // Activity level dimension (index 3)
      expect(highVector[3]).toBeGreaterThan(lowVector[3]);
    });

    it('should score food-related activities high on gastronomy dimension', () => {
      const foodTour: ActivityFeatures = createMockActivity({
        category: ActivityCategory.FOOD_TOUR,
        features: { mealIncluded: true },
      });

      const museum: ActivityFeatures = createMockActivity({
        category: ActivityCategory.MUSEUM,
        features: { mealIncluded: false },
      });

      const foodVector = vectorizer.vectorize(foodTour);
      const museumVector = vectorizer.vectorize(museum);

      // Gastronomy dimension (index 6)
      expect(foodVector[6]).toBeGreaterThan(museumVector[6]);
      expect(foodVector[6]).toBeGreaterThan(0.5);
    });

    it('should score highly rated activities higher on popularity dimension', () => {
      const highlyRated: ActivityFeatures = createMockActivity({
        rating: 4.8,
        reviewCount: 500,
        bookingInfo: { instantConfirmation: true },
      });

      const lowRated: ActivityFeatures = createMockActivity({
        rating: 2.5,
        reviewCount: 10,
        bookingInfo: { instantConfirmation: false },
      });

      const highVector = vectorizer.vectorize(highlyRated);
      const lowVector = vectorizer.vectorize(lowRated);

      // Popularity dimension (index 7)
      expect(highVector[7]).toBeGreaterThan(lowVector[7]);
    });

    it('should correctly handle budget dimension based on price', () => {
      const freeActivity: ActivityFeatures = createMockActivity({
        price: { amount: 0, currency: 'EUR', perPerson: true },
      });

      const expensiveActivity: ActivityFeatures = createMockActivity({
        price: { amount: 200, currency: 'EUR', perPerson: true },
      });

      const freeVector = vectorizer.vectorize(freeActivity);
      const expensiveVector = vectorizer.vectorize(expensiveActivity);

      // Budget dimension (index 2): 0 = free/budget, 1 = luxury
      expect(freeVector[2]).toBe(0);
      expect(expensiveVector[2]).toBeGreaterThan(freeVector[2]);
    });

    it('should handle family-friendly activities in group size dimension', () => {
      const familyActivity: ActivityFeatures = createMockActivity({
        groupSize: { min: 2, max: 20, typical: 6 },
        features: { childFriendly: true },
      });

      const soloActivity: ActivityFeatures = createMockActivity({
        groupSize: { min: 1, max: 2, typical: 1 },
        features: { childFriendly: false },
      });

      const familyVector = vectorizer.vectorize(familyActivity);
      const soloVector = vectorizer.vectorize(soloActivity);

      // Group size dimension (index 4): 0 = solo/couple, 1 = large groups
      expect(familyVector[4]).toBeGreaterThan(soloVector[4]);
    });
  });

  describe('batchVectorize', () => {
    it('should vectorize multiple activities efficiently', () => {
      const activities: ActivityFeatures[] = [
        createMockActivity({ category: ActivityCategory.MUSEUM }),
        createMockActivity({ category: ActivityCategory.HIKING }),
        createMockActivity({ category: ActivityCategory.FOOD_TOUR }),
      ];

      const result = vectorizer.batchVectorize(activities);

      expect(result.vectors.size).toBe(3);
      expect(result.itemsProcessed).toBe(3);
      expect(result.processingTime).toBeGreaterThan(0);
      expect(result.errors).toBeUndefined();
    });

    it('should dynamically calculate market average price', () => {
      const activities: ActivityFeatures[] = [
        createMockActivity({ price: { amount: 30, currency: 'EUR', perPerson: true } }),
        createMockActivity({ price: { amount: 50, currency: 'EUR', perPerson: true } }),
        createMockActivity({ price: { amount: 70, currency: 'EUR', perPerson: true } }),
      ];

      const result = vectorizer.batchVectorize(activities);

      // Market average should be 50 EUR
      // Budget dimension should reflect this
      const vectors = Array.from(result.vectors.values());
      expect(vectors).toHaveLength(3);

      // Activity priced at market average (50) should have mid-range budget score
      const midVector = vectors[1];
      expect(midVector[2]).toBeGreaterThan(0.3);
      expect(midVector[2]).toBeLessThan(0.7);
    });

    it('should handle errors gracefully', () => {
      const activities: ActivityFeatures[] = [
        createMockActivity({ activityId: 'valid-1' }),
        // @ts-ignore - intentionally malformed for testing
        { activityId: 'invalid', category: null },
        createMockActivity({ activityId: 'valid-2' }),
      ];

      const result = vectorizer.batchVectorize(activities);

      expect(result.itemsProcessed).toBeGreaterThanOrEqual(2);
      // May or may not have errors depending on error handling
    });
  });

  describe('configuration', () => {
    it('should allow custom configuration', () => {
      const customConfig = {
        climate: {
          outdoorWeight: 0.8,
          weatherDependentWeight: 0.15,
          seasonalWeight: 0.05,
        },
      };

      const customVectorizer = new ActivityVectorizerService(customConfig);
      const config = customVectorizer.getConfig();

      expect(config.climate.outdoorWeight).toBe(0.8);
    });

    it('should allow config updates', () => {
      vectorizer.updateConfig({
        budget: {
          marketAveragePrice: 100,
          currency: 'USD',
        },
      });

      const config = vectorizer.getConfig();
      expect(config.budget.marketAveragePrice).toBe(100);
      expect(config.budget.currency).toBe('USD');
    });
  });
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Create a mock activity with default values and optional overrides
 */
function createMockActivity(overrides: Partial<ActivityFeatures> = {}): ActivityFeatures {
  return {
    activityId: overrides.activityId || 'test-activity-123',
    name: overrides.name || 'Test Activity',
    description: overrides.description || 'A test activity',

    location: overrides.location || {
      name: 'Test Location',
      address: '123 Test St',
      coordinates: { latitude: 48.8566, longitude: 2.3522 },
      cityCode: 'PAR',
    },

    category: overrides.category || ActivityCategory.TOUR,
    subCategories: overrides.subCategories || [],

    intensity: overrides.intensity || ActivityIntensity.MODERATE,

    duration: overrides.duration || {
      value: 120,
      formatted: '2 hours',
      isFlexible: false,
    },

    groupSize: overrides.groupSize || {
      min: 1,
      max: 10,
      typical: 5,
    },

    price: overrides.price || {
      amount: 50,
      currency: 'EUR',
      perPerson: true,
      discountsAvailable: false,
    },

    rating: overrides.rating !== undefined ? overrides.rating : 4.0,
    reviewCount: overrides.reviewCount !== undefined ? overrides.reviewCount : 100,

    bookingInfo: overrides.bookingInfo || {
      instantConfirmation: false,
      freeCancellation: false,
    },

    images: overrides.images || [],

    availability: overrides.availability || {
      weatherDependent: false,
      seasonal: false,
    },

    features: overrides.features || {
      guidedTour: false,
      audioGuide: false,
      transportation: false,
      mealIncluded: false,
      equipmentProvided: false,
      accessible: false,
      childFriendly: false,
      petFriendly: false,
    },

    requirements: overrides.requirements || {},
    metadata: overrides.metadata || {},
  };
}
