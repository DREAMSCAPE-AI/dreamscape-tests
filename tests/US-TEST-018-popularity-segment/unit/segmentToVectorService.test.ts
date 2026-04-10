jest.mock('@dreamscape/db', () => ({ prisma: {} }));

import { SegmentToVectorService, FeatureVector } from '@ai/segments/segment-to-vector.service';
import { UserSegment } from '@ai/segments/types/segment.types';
import { SEGMENT_PROFILES } from '@ai/segments/types/segment-profile.types';

const budgetVector = SEGMENT_PROFILES[UserSegment.BUDGET_BACKPACKER].typicalVector as FeatureVector;
const luxuryVector = SEGMENT_PROFILES[UserSegment.LUXURY_TRAVELER].typicalVector as FeatureVector;

describe('US-TEST-018 — SegmentToVectorService', () => {
  let service: SegmentToVectorService;

  beforeEach(() => {
    service = new SegmentToVectorService();
  });

  describe('generateVectorFromSegment', () => {
    it('should return the typical vector for a known segment', () => {
      expect(service.generateVectorFromSegment(UserSegment.BUDGET_BACKPACKER)).toEqual(budgetVector);
    });

    it('should throw for an unknown segment', () => {
      expect(() => service.generateVectorFromSegment('UNKNOWN' as UserSegment)).toThrow(
        'Unknown segment: UNKNOWN'
      );
    });
  });

  describe('blendVectors and enriched vectors', () => {
    it('should blend vectors using confidence-based weights across thresholds', () => {
      expect(service.blendVectors(budgetVector, luxuryVector, 0.95)[0]).toBeCloseTo(
        0.9 * luxuryVector[0] + 0.1 * budgetVector[0],
        5
      );
      expect(service.blendVectors(budgetVector, luxuryVector, 0.7)[0]).toBeCloseTo(
        0.8 * luxuryVector[0] + 0.2 * budgetVector[0],
        5
      );
      expect(service.blendVectors(budgetVector, luxuryVector, 0.5)[0]).toBeCloseTo(
        0.6 * luxuryVector[0] + 0.4 * budgetVector[0],
        5
      );
      expect(service.blendVectors(budgetVector, luxuryVector, 0.3)[0]).toBeCloseTo(
        0.4 * luxuryVector[0] + 0.6 * budgetVector[0],
        5
      );
      expect(service.blendVectors(budgetVector, luxuryVector, 0.1)[0]).toBeCloseTo(
        0.2 * luxuryVector[0] + 0.8 * budgetVector[0],
        5
      );
    });

    it('should create segment-only enriched vector when preference vector is absent', () => {
      const result = service.createEnrichedVector(UserSegment.BUDGET_BACKPACKER);

      expect(result).toEqual({
        vector: budgetVector,
        segmentVector: budgetVector,
        blendingWeight: 0,
        confidence: 0.5,
        primarySegment: UserSegment.BUDGET_BACKPACKER,
        source: 'segment_only',
      });
    });

    it('should create blended enriched vector when preference vector is provided', () => {
      const result = service.createEnrichedVector(
        UserSegment.BUDGET_BACKPACKER,
        luxuryVector,
        0.7
      );

      expect(result.baseVector).toEqual(luxuryVector);
      expect(result.segmentVector).toEqual(budgetVector);
      expect(result.blendingWeight).toBe(0.8);
      expect(result.source).toBe('blended');
      expect(result.vector).toEqual(service.blendVectors(budgetVector, luxuryVector, 0.7));
    });
  });

  describe('vector utilities', () => {
    it('should adjust vector toward the segment and respect custom strength', () => {
      const result = service.adjustVectorForSegment([0, 0, 0, 0, 0, 0, 0, 0], UserSegment.LUXURY_TRAVELER, 0.5);
      const defaultStrengthResult = service.adjustVectorForSegment([0, 0, 0, 0, 0, 0, 0, 0], UserSegment.LUXURY_TRAVELER);

      expect(result[2]).toBeCloseTo(luxuryVector[2] * 0.5, 5);
      expect(result[3]).toBeCloseTo(luxuryVector[3] * 0.5, 5);
      expect(defaultStrengthResult[2]).toBeCloseTo(luxuryVector[2] * 0.3, 5);
    });

    it('should compute similarity for identical, opposite-like, and zero vectors', () => {
      expect(service.calculateSimilarity(budgetVector, budgetVector)).toBe(1);
      expect(service.calculateSimilarity([1, 0, 0, 0, 0, 0, 0, 0], [0, 1, 0, 0, 0, 0, 0, 0])).toBe(0.5);
      expect(service.calculateSimilarity([0, 0, 0, 0, 0, 0, 0, 0], budgetVector)).toBe(0);
    });

    it('should validate and normalize vectors', () => {
      expect(service.validateVector(budgetVector)).toBe(true);
      expect(service.validateVector([1.2, 0, 0, 0, 0, 0, 0, 0] as FeatureVector)).toBe(false);
      expect(service.validateVector([NaN, 0, 0, 0, 0, 0, 0, 0] as FeatureVector)).toBe(false);

      expect(service.normalizeVector([-1, 0.5, 2, 1, 0.2, 0.8, -0.3, 1.5] as FeatureVector)).toEqual([
        0, 0.5, 1, 1, 0.2, 0.8, 0, 1,
      ]);
    });

    it('should expose all segment vectors and find the most similar segment', () => {
      const allVectors = service.getAllSegmentVectors();
      const best = service.findMostSimilarSegment(luxuryVector);

      expect(allVectors.size).toBe(Object.values(UserSegment).length);
      expect(best.segment).toBe(UserSegment.LUXURY_TRAVELER);
      expect(best.similarity).toBe(1);
    });

    it('should calculate confidence with and without critical fields', () => {
      expect(service.calculateConfidence(80, false)).toBe(0.4);
      expect(service.calculateConfidence(20, false)).toBe(0.2);
      expect(service.calculateConfidence(100, true)).toBe(0.95);
      expect(service.calculateConfidence(10, true)).toBe(0.2);
    });
  });
});
