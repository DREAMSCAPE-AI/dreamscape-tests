/**
 * Unit Tests for Activity Scoring Service
 *
 * Tests the scoring algorithm that ranks activities based on:
 * - Similarity with user preferences
 * - Popularity and quality metrics
 * - Contextual factors (trip duration, budget, companions)
 * - Segment-specific boosts
 * - Diversity (MMR algorithm)
 *
 * @ticket DR-76 / US-IA-004.2
 */

import { ActivityScoringService, TripContext } from '../../../../dreamscape-services/ai/src/activities/services/activity-scoring.service';
import {
  ActivityFeatures,
  ActivityVector,
  ActivityCategory,
  ActivityIntensity,
} from '../../../../dreamscape-services/ai/src/activities/types/activity-vector.types';

describe('ActivityScoringService', () => {
  let scorer: ActivityScoringService;

  beforeEach(() => {
    scorer = new ActivityScoringService();
  });

  describe('scoreActivities', () => {
    it('should score and rank activities', async () => {
      const userVector = [0.5, 0.8, 0.4, 0.6, 0.5, 0.9, 0.3, 0.7]; // Cultural, urban, moderate activity
      const userSegment = 'CULTURAL_ENTHUSIAST';

      const activities = [
        {
          features: createMockActivity({ category: ActivityCategory.MUSEUM, rating: 4.5 }),
          vector: [0.3, 0.9, 0.4, 0.2, 0.5, 1.0, 0.3, 0.8] as ActivityVector, // High culture, urban
        },
        {
          features: createMockActivity({ category: ActivityCategory.HIKING, rating: 4.2 }),
          vector: [0.8, 0.1, 0.2, 0.8, 0.4, 0.0, 0.1, 0.7] as ActivityVector, // Nature, rural, high activity
        },
        {
          features: createMockActivity({ category: ActivityCategory.FOOD_TOUR, rating: 4.7 }),
          vector: [0.2, 0.7, 0.5, 0.3, 0.6, 0.8, 0.9, 0.9] as ActivityVector, // Culture, gastronomy
        },
      ];

      const scored = await scorer.scoreActivities(userVector, userSegment, activities);

      expect(scored).toHaveLength(3);
      expect(scored[0].rank).toBe(1);
      expect(scored[1].rank).toBe(2);
      expect(scored[2].rank).toBe(3);

      // Museum should score highest for cultural enthusiast with urban preference
      expect(scored[0].activity.category).toBe(ActivityCategory.MUSEUM);

      // All should have valid scores
      scored.forEach(activity => {
        expect(activity.score).toBeGreaterThanOrEqual(0);
        expect(activity.score).toBeLessThanOrEqual(1);
        expect(activity.confidence).toBeGreaterThanOrEqual(0);
        expect(activity.confidence).toBeLessThanOrEqual(1);
        expect(activity.reasons).toBeInstanceOf(Array);
      });
    });

    it('should apply segment boosts correctly', async () => {
      const userVector = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
      const userSegment = 'ADVENTURE_SEEKER';

      const activities = [
        {
          features: createMockActivity({ category: ActivityCategory.EXTREME_SPORTS }),
          vector: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5] as ActivityVector,
        },
        {
          features: createMockActivity({ category: ActivityCategory.MUSEUM }),
          vector: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5] as ActivityVector,
        },
      ];

      const scored = await scorer.scoreActivities(userVector, userSegment, activities);

      // Extreme sports should have segment boost > 1.0 for adventure seekers
      const extremeSports = scored.find(s => s.activity.category === ActivityCategory.EXTREME_SPORTS);
      const museum = scored.find(s => s.activity.category === ActivityCategory.MUSEUM);

      expect(extremeSports).toBeDefined();
      expect(museum).toBeDefined();
      expect(extremeSports!.breakdown.segmentBoost).toBeGreaterThan(1.0);
      expect(museum!.breakdown.segmentBoost).toBeLessThan(1.0);
      expect(extremeSports!.score).toBeGreaterThan(museum!.score);
    });

    it('should consider trip context in scoring', async () => {
      const userVector = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
      const userSegment = 'FAMILY_EXPLORER';

      const tripContext: TripContext = {
        stayDuration: 3,
        travelCompanions: 'family',
        budgetPerActivity: 50,
        timeAvailable: 120, // 2 hours
      };

      const activities = [
        {
          features: createMockActivity({
            duration: { value: 120, formatted: '2 hours', isFlexible: false },
            price: { amount: 45, currency: 'EUR', perPerson: true },
            features: { childFriendly: true },
          }),
          vector: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5] as ActivityVector,
        },
        {
          features: createMockActivity({
            duration: { value: 480, formatted: 'Full day', isFlexible: false },
            price: { amount: 150, currency: 'EUR', perPerson: true },
            features: { childFriendly: false },
          }),
          vector: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5] as ActivityVector,
        },
      ];

      const scored = await scorer.scoreActivities(userVector, userSegment, activities, tripContext);

      // First activity should score higher due to better context match
      expect(scored[0].breakdown.contextualScore).toBeGreaterThan(scored[1].breakdown.contextualScore);
    });

    it('should filter low quality activities', async () => {
      const userVector = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
      const userSegment = 'CULTURAL_ENTHUSIAST';

      const activities = [
        {
          features: createMockActivity({ rating: 4.5, reviewCount: 200 }),
          vector: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5] as ActivityVector,
        },
        {
          features: createMockActivity({ rating: 1.5, reviewCount: 5 }), // Poor quality
          vector: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5] as ActivityVector,
        },
      ];

      const scored = await scorer.scoreActivities(userVector, userSegment, activities);

      // Poor quality activity should be filtered out
      expect(scored.length).toBeLessThan(activities.length);
    });

    it('should apply MMR diversification', async () => {
      const userVector = [0.5, 0.9, 0.5, 0.3, 0.5, 0.9, 0.5, 0.7]; // Cultural preference

      const activities = [
        {
          features: createMockActivity({ activityId: 'museum-1', category: ActivityCategory.MUSEUM }),
          vector: [0.3, 0.9, 0.4, 0.2, 0.5, 1.0, 0.3, 0.8] as ActivityVector,
        },
        {
          features: createMockActivity({ activityId: 'museum-2', category: ActivityCategory.ART_GALLERY }),
          vector: [0.3, 0.85, 0.5, 0.2, 0.5, 0.95, 0.4, 0.8] as ActivityVector, // Very similar to museum-1
        },
        {
          features: createMockActivity({ activityId: 'hike-1', category: ActivityCategory.HIKING }),
          vector: [0.8, 0.1, 0.2, 0.8, 0.4, 0.0, 0.1, 0.7] as ActivityVector, // Different
        },
      ];

      const scored = await scorer.scoreActivities(userVector, 'CULTURAL_ENTHUSIAST', activities, undefined, 3);

      // Should include both museums and hiking for diversity
      const categories = scored.map(s => s.activity.category);
      expect(new Set(categories).size).toBeGreaterThan(1); // More than one category
    });
  });

  describe('reason generation', () => {
    it('should generate meaningful reasons', async () => {
      const userVector = [0.5, 0.9, 0.4, 0.3, 0.7, 0.9, 0.3, 0.7]; // Cultural, urban, family

      const activities = [
        {
          features: createMockActivity({
            category: ActivityCategory.MUSEUM,
            rating: 4.8,
            features: { childFriendly: true, guidedTour: true },
            bookingInfo: { instantConfirmation: true, freeCancellation: true },
          }),
          vector: [0.3, 0.9, 0.4, 0.2, 0.7, 1.0, 0.3, 0.9] as ActivityVector,
        },
      ];

      const scored = await scorer.scoreActivities(
        userVector,
        'FAMILY_EXPLORER',
        activities,
        { travelCompanions: 'family' }
      );

      expect(scored[0].reasons.length).toBeGreaterThan(0);
      expect(scored[0].reasons.some(r => r.includes('match') || r.includes('rated'))).toBe(true);
    });
  });

  describe('configuration', () => {
    it('should validate configuration', () => {
      const validConfig = {
        weights: {
          similarity: 0.5,
          popularity: 0.25,
          quality: 0.15,
          contextual: 0.1,
        },
        popularityWeights: { rating: 0.5, reviewCount: 0.3, isPopular: 0.2 },
        qualityWeights: { rating: 0.4, instantConfirmation: 0.3, freeCancellation: 0.2, features: 0.1 },
        contextualWeights: { durationMatch: 0.4, budgetFit: 0.3, companionSuitability: 0.3 },
        applySegmentBoost: true,
        diversityLambda: 0.7,
        applyDiversification: true,
        minSimilarityThreshold: 0.25,
        minQualityScore: 0.3,
      };

      const result = ActivityScoringService.validateConfig(validConfig);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid configuration', () => {
      const invalidConfig = {
        weights: {
          similarity: 0.6,
          popularity: 0.4,
          quality: 0.3,
          contextual: 0.2,
        }, // Sum > 1.0
        popularityWeights: { rating: 0.5, reviewCount: 0.3, isPopular: 0.2 },
        qualityWeights: { rating: 0.4, instantConfirmation: 0.3, freeCancellation: 0.2, features: 0.1 },
        contextualWeights: { durationMatch: 0.4, budgetFit: 0.3, companionSuitability: 0.3 },
        applySegmentBoost: true,
        diversityLambda: 1.5, // Invalid: > 1.0
        applyDiversification: true,
        minSimilarityThreshold: 0.25,
        minQualityScore: 0.3,
      };

      const result = ActivityScoringService.validateConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should allow custom configuration', () => {
      const customScorer = new ActivityScoringService({
        weights: {
          similarity: 0.6,
          popularity: 0.2,
          quality: 0.1,
          contextual: 0.1,
        },
      });

      const config = customScorer.getConfig();
      expect(config.weights.similarity).toBe(0.6);
    });
  });
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

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
