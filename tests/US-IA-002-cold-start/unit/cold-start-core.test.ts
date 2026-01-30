/**
 * Cold Start Management - Core Functionality Tests
 *
 * Tests the cold start recommendation system components:
 * - User segmentation
 * - Strategy selection
 * - Hybrid scoring
 *
 * @ticket US-IA-002
 */

import { ColdStartStrategy } from '@ai/recommendations/types/cold-start.types';
import { UserSegment } from '@ai/segments/types/segment.types';

describe('IA-002: Cold Start Management System', () => {
  describe('Core Components', () => {
    it('should have ColdStartService available', async () => {
      // Verify the service can be imported
      const { ColdStartService } = await import('@ai/recommendations/cold-start.service');
      expect(ColdStartService).toBeDefined();

      // Verify service can be instantiated
      const service = new ColdStartService();
      expect(service).toBeInstanceOf(ColdStartService);
    });

    it('should have SegmentEngineService available', async () => {
      // Verify the service can be imported
      const { SegmentEngineService } = await import('@ai/segments/segment-engine.service');
      expect(SegmentEngineService).toBeDefined();

      // Verify service can be instantiated
      const service = new SegmentEngineService();
      expect(service).toBeInstanceOf(SegmentEngineService);
    });
  });

  describe('Cold Start Strategies', () => {
    it('should define all required strategy types', () => {
      expect(ColdStartStrategy.POPULARITY_ONLY).toBeDefined();
      expect(ColdStartStrategy.HYBRID_SEGMENT).toBeDefined();
      expect(ColdStartStrategy.HYBRID_PREFERENCES).toBeDefined();
      expect(ColdStartStrategy.ADAPTIVE).toBeDefined();
    });

    it('should have POPULARITY_ONLY strategy', () => {
      expect(ColdStartStrategy.POPULARITY_ONLY).toBe('POPULARITY_ONLY');
    });

    it('should have HYBRID_SEGMENT strategy', () => {
      expect(ColdStartStrategy.HYBRID_SEGMENT).toBe('HYBRID_SEGMENT');
    });

    it('should have HYBRID_PREFERENCES strategy', () => {
      expect(ColdStartStrategy.HYBRID_PREFERENCES).toBe('HYBRID_PREFERENCES');
    });

    it('should have ADAPTIVE strategy', () => {
      expect(ColdStartStrategy.ADAPTIVE).toBe('ADAPTIVE');
    });
  });

  describe('User Segments', () => {
    it('should define all user segment types', () => {
      const expectedSegments = [
        'BUDGET_BACKPACKER',
        'FAMILY_EXPLORER',
        'LUXURY_TRAVELER',
        'ADVENTURE_SEEKER',
        'CULTURAL_ENTHUSIAST',
        'ROMANTIC_COUPLE',
        'BUSINESS_LEISURE',
        'SENIOR_COMFORT',
      ];

      expectedSegments.forEach(segment => {
        expect(UserSegment[segment as keyof typeof UserSegment]).toBeDefined();
      });
    });

    it('should have BUDGET_BACKPACKER segment', () => {
      expect(UserSegment.BUDGET_BACKPACKER).toBe('BUDGET_BACKPACKER');
    });

    it('should have FAMILY_EXPLORER segment', () => {
      expect(UserSegment.FAMILY_EXPLORER).toBe('FAMILY_EXPLORER');
    });

    it('should have LUXURY_TRAVELER segment', () => {
      expect(UserSegment.LUXURY_TRAVELER).toBe('LUXURY_TRAVELER');
    });

    it('should have ADVENTURE_SEEKER segment', () => {
      expect(UserSegment.ADVENTURE_SEEKER).toBe('ADVENTURE_SEEKER');
    });

    it('should have CULTURAL_ENTHUSIAST segment', () => {
      expect(UserSegment.CULTURAL_ENTHUSIAST).toBe('CULTURAL_ENTHUSIAST');
    });

    it('should have ROMANTIC_COUPLE segment', () => {
      expect(UserSegment.ROMANTIC_COUPLE).toBe('ROMANTIC_COUPLE');
    });

    it('should have BUSINESS_LEISURE segment', () => {
      expect(UserSegment.BUSINESS_LEISURE).toBe('BUSINESS_LEISURE');
    });

    it('should have SENIOR_COMFORT segment', () => {
      expect(UserSegment.SENIOR_COMFORT).toBe('SENIOR_COMFORT');
    });
  });

  describe('Popularity Service', () => {
    it('should have PopularityService available', async () => {
      const { PopularityService } = await import('@ai/recommendations/popularity.service');
      expect(PopularityService).toBeDefined();

      const service = new PopularityService();
      expect(service).toBeInstanceOf(PopularityService);
    });

    it('should have calculateTrendAnalysis method', async () => {
      const { PopularityService } = await import('@ai/recommendations/popularity.service');
      const service = new PopularityService();
      expect(typeof service.calculateTrendAnalysis).toBe('function');
    });

    it('should have getTopDestinations method', async () => {
      const { PopularityService } = await import('@ai/recommendations/popularity.service');
      const service = new PopularityService();
      expect(typeof service.getTopDestinations).toBe('function');
    });
  });

  describe('Segment to Vector Conversion', () => {
    it('should have generateVectorFromSegmentService available', async () => {
      const { SegmentToVectorService } = await import('@ai/segments/segment-to-vector.service');
      expect(SegmentToVectorService).toBeDefined();

      const service = new SegmentToVectorService();
      expect(service).toBeInstanceOf(SegmentToVectorService);
    });

    it('should convert segment to feature vector', async () => {
      const { SegmentToVectorService } = await import('@ai/segments/segment-to-vector.service');
      const service = new SegmentToVectorService();

      // Verify the method exists
      expect(typeof service.generateVectorFromSegment).toBe('function');

      // Test conversion for ADVENTURE_SEEKER
      const vector = service.generateVectorFromSegment(UserSegment.ADVENTURE_SEEKER);
      expect(Array.isArray(vector)).toBe(true);
      expect(vector.length).toBe(8); // 8D vector
      expect(vector.every((v: number) => v >= 0 && v <= 1)).toBe(true);
    });

    it('should generate different vectors for different segments', async () => {
      const { SegmentToVectorService } = await import('@ai/segments/segment-to-vector.service');
      const service = new SegmentToVectorService();

      const adventureVector = service.generateVectorFromSegment(UserSegment.ADVENTURE_SEEKER);
      const luxuryVector = service.generateVectorFromSegment(UserSegment.LUXURY_TRAVELER);
      const budgetVector = service.generateVectorFromSegment(UserSegment.BUDGET_BACKPACKER);

      // Vectors should be different for different segments
      expect(adventureVector).not.toEqual(luxuryVector);
      expect(adventureVector).not.toEqual(budgetVector);
      expect(luxuryVector).not.toEqual(budgetVector);
    });
  });

  describe('Onboarding to Vector Conversion', () => {
    it('should have transformToEnrichedVectorService available', async () => {
      const { OnboardingToVectorService } = await import('@ai/onboarding/onboarding-to-vector.service');
      expect(OnboardingToVectorService).toBeDefined();

      const service = new OnboardingToVectorService();
      expect(service).toBeInstanceOf(OnboardingToVectorService);
    });

    it('should have transformToEnrichedVector method', async () => {
      const { OnboardingToVectorService } = await import('@ai/onboarding/onboarding-to-vector.service');
      const service = new OnboardingToVectorService();
      expect(typeof service.transformToEnrichedVector).toBe('function');
    });
  });
});
