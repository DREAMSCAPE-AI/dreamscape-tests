/**
 * Unit Tests: SegmentToVectorService
 *
 * Tests segment to vector conversion and blending logic
 */

import {
  SegmentToVectorService,
  FeatureVector,
} from '../../../dreamscape-services/ai/src/segments/segment-to-vector.service';
import { UserSegment } from '../../../dreamscape-services/ai/src/segments/types/segment.types';
import { SEGMENT_PROFILES } from '../../../dreamscape-services/ai/src/segments/types/segment-profile.types';
import { PERSONAS } from '../fixtures/user-personas';

describe('SegmentToVectorService', () => {
  let service: SegmentToVectorService;

  beforeEach(() => {
    service = new SegmentToVectorService();
  });

  describe('generateVectorFromSegment', () => {
    it('should generate correct vector for BUDGET_BACKPACKER', () => {
      const vector = service.generateVectorFromSegment(UserSegment.BUDGET_BACKPACKER);

      expect(vector).toHaveLength(8);
      expect(vector).toEqual(SEGMENT_PROFILES[UserSegment.BUDGET_BACKPACKER].typicalVector);
      vector.forEach((val) => {
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(1);
      });
    });

    it('should generate correct vector for FAMILY_EXPLORER', () => {
      const vector = service.generateVectorFromSegment(UserSegment.FAMILY_EXPLORER);

      expect(vector).toHaveLength(8);
      expect(vector).toEqual(SEGMENT_PROFILES[UserSegment.FAMILY_EXPLORER].typicalVector);
    });

    it('should generate vectors for all segments', () => {
      const allSegments = Object.values(UserSegment);

      allSegments.forEach((segment) => {
        const vector = service.generateVectorFromSegment(segment);

        expect(vector).toHaveLength(8);
        expect(service.validateVector(vector)).toBe(true);
      });
    });

    it('should throw error for invalid segment', () => {
      expect(() => {
        service.generateVectorFromSegment('INVALID_SEGMENT' as UserSegment);
      }).toThrow();
    });
  });

  describe('blendVectors', () => {
    const segmentVector: FeatureVector = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
    const preferenceVector: FeatureVector = [0.8, 0.2, 0.9, 0.1, 0.7, 0.3, 0.6, 0.4];

    it('should blend vectors with high confidence (favor preferences)', () => {
      const confidence = 0.9;
      const blended = service.blendVectors(segmentVector, preferenceVector, confidence);

      expect(blended).toHaveLength(8);

      // With high confidence, blended should be closer to preferenceVector
      for (let i = 0; i < 8; i++) {
        const distToPreference = Math.abs(blended[i] - preferenceVector[i]);
        const distToSegment = Math.abs(blended[i] - segmentVector[i]);
        expect(distToPreference).toBeLessThan(distToSegment);
      }
    });

    it('should blend vectors with low confidence (favor segment)', () => {
      const confidence = 0.2;
      const blended = service.blendVectors(segmentVector, preferenceVector, confidence);

      expect(blended).toHaveLength(8);

      // With low confidence, blended should be closer to segmentVector
      for (let i = 0; i < 8; i++) {
        const distToPreference = Math.abs(blended[i] - preferenceVector[i]);
        const distToSegment = Math.abs(blended[i] - segmentVector[i]);
        expect(distToSegment).toBeLessThan(distToPreference);
      }
    });

    it('should blend vectors with medium confidence (balanced)', () => {
      const confidence = 0.5;
      const blended = service.blendVectors(segmentVector, preferenceVector, confidence);

      expect(blended).toHaveLength(8);

      // With medium confidence, should be roughly balanced
      for (let i = 0; i < 8; i++) {
        const distToPreference = Math.abs(blended[i] - preferenceVector[i]);
        const distToSegment = Math.abs(blended[i] - segmentVector[i]);
        // Should be relatively close to both
        expect(distToPreference).toBeLessThan(0.3);
        expect(distToSegment).toBeLessThan(0.3);
      }
    });

    it('should produce valid vector values after blending', () => {
      const confidence = 0.7;
      const blended = service.blendVectors(segmentVector, preferenceVector, confidence);

      expect(service.validateVector(blended)).toBe(true);
    });
  });

  describe('createEnrichedVector', () => {
    it('should create segment-only vector when no preference vector', () => {
      const enriched = service.createEnrichedVector(UserSegment.BUDGET_BACKPACKER, undefined, 0.8);

      expect(enriched.source).toBe('segment_only');
      expect(enriched.vector).toEqual(
        SEGMENT_PROFILES[UserSegment.BUDGET_BACKPACKER].typicalVector
      );
      expect(enriched.segmentVector).toBeDefined();
      expect(enriched.baseVector).toBeUndefined();
      expect(enriched.blendingWeight).toBe(0);
      expect(enriched.primarySegment).toBe(UserSegment.BUDGET_BACKPACKER);
    });

    it('should create blended vector when preference vector provided', () => {
      const preferenceVector: FeatureVector = [0.7, 0.3, 0.8, 0.9, 0.2, 0.4, 0.5, 0.6];
      const enriched = service.createEnrichedVector(
        UserSegment.ADVENTURE_SEEKER,
        preferenceVector,
        0.75
      );

      expect(enriched.source).toBe('blended');
      expect(enriched.baseVector).toEqual(preferenceVector);
      expect(enriched.segmentVector).toBeDefined();
      expect(enriched.blendingWeight).toBeGreaterThan(0);
      expect(enriched.confidence).toBe(0.75);
      expect(enriched.primarySegment).toBe(UserSegment.ADVENTURE_SEEKER);
    });

    it('should adjust blending weight based on confidence', () => {
      const preferenceVector: FeatureVector = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];

      const highConf = service.createEnrichedVector(
        UserSegment.LUXURY_TRAVELER,
        preferenceVector,
        0.9
      );
      const lowConf = service.createEnrichedVector(
        UserSegment.LUXURY_TRAVELER,
        preferenceVector,
        0.2
      );

      // High confidence should have higher preference weight
      expect(highConf.blendingWeight).toBeGreaterThan(lowConf.blendingWeight);
    });
  });

  describe('calculateSimilarity', () => {
    it('should return 1.0 for identical vectors', () => {
      const vectorA: FeatureVector = [0.5, 0.6, 0.7, 0.8, 0.4, 0.3, 0.2, 0.9];
      const vectorB: FeatureVector = [0.5, 0.6, 0.7, 0.8, 0.4, 0.3, 0.2, 0.9];

      const similarity = service.calculateSimilarity(vectorA, vectorB);

      expect(similarity).toBeCloseTo(1.0, 2);
    });

    it('should return lower similarity for different vectors', () => {
      const vectorA: FeatureVector = [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0];
      const vectorB: FeatureVector = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0];

      const similarity = service.calculateSimilarity(vectorA, vectorB);

      expect(similarity).toBeLessThan(0.5);
    });

    it('should be symmetric', () => {
      const vectorA: FeatureVector = [0.8, 0.3, 0.9, 0.2, 0.7, 0.4, 0.6, 0.5];
      const vectorB: FeatureVector = [0.6, 0.5, 0.7, 0.3, 0.5, 0.6, 0.4, 0.7];

      const simAB = service.calculateSimilarity(vectorA, vectorB);
      const simBA = service.calculateSimilarity(vectorB, vectorA);

      expect(simAB).toBeCloseTo(simBA, 5);
    });
  });

  describe('validateVector', () => {
    it('should validate correct vectors', () => {
      const validVector: FeatureVector = [0.0, 0.3, 0.5, 0.7, 1.0, 0.2, 0.8, 0.4];
      expect(service.validateVector(validVector)).toBe(true);
    });

    it('should reject vectors with values < 0', () => {
      const invalidVector: FeatureVector = [0.5, -0.1, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
      expect(service.validateVector(invalidVector)).toBe(false);
    });

    it('should reject vectors with values > 1', () => {
      const invalidVector: FeatureVector = [0.5, 1.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
      expect(service.validateVector(invalidVector)).toBe(false);
    });

    it('should reject vectors with NaN', () => {
      const invalidVector: FeatureVector = [0.5, NaN, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
      expect(service.validateVector(invalidVector)).toBe(false);
    });
  });

  describe('normalizeVector', () => {
    it('should normalize vectors with out-of-range values', () => {
      const invalidVector: FeatureVector = [-0.5, 1.5, 0.5, 2.0, -1.0, 0.3, 0.7, 1.2];
      const normalized = service.normalizeVector(invalidVector);

      expect(service.validateVector(normalized)).toBe(true);
      expect(normalized[0]).toBe(0.0); // -0.5 -> 0.0
      expect(normalized[1]).toBe(1.0); // 1.5 -> 1.0
      expect(normalized[3]).toBe(1.0); // 2.0 -> 1.0
      expect(normalized[4]).toBe(0.0); // -1.0 -> 0.0
    });

    it('should not change valid vectors', () => {
      const validVector: FeatureVector = [0.2, 0.4, 0.6, 0.8, 0.1, 0.9, 0.5, 0.7];
      const normalized = service.normalizeVector(validVector);

      expect(normalized).toEqual(validVector);
    });
  });

  describe('findMostSimilarSegment', () => {
    it('should identify correct segment for typical vectors', () => {
      const allSegments = Object.values(UserSegment);

      allSegments.forEach((segment) => {
        const typicalVector = SEGMENT_PROFILES[segment].typicalVector;
        const result = service.findMostSimilarSegment(typicalVector);

        expect(result.segment).toBe(segment);
        expect(result.similarity).toBeGreaterThan(0.9);
      });
    });

    it('should find closest match for slightly modified vector', () => {
      const baseVector = SEGMENT_PROFILES[UserSegment.FAMILY_EXPLORER].typicalVector;
      // Slightly modify vector
      const modifiedVector: FeatureVector = baseVector.map((v) => v * 0.95 + 0.025) as FeatureVector;

      const result = service.findMostSimilarSegment(modifiedVector);

      expect(result.segment).toBe(UserSegment.FAMILY_EXPLORER);
      expect(result.similarity).toBeGreaterThan(0.8);
    });
  });

  describe('adjustVectorForSegment', () => {
    it('should pull vector towards segment characteristics', () => {
      const originalVector: FeatureVector = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
      const targetSegment = UserSegment.LUXURY_TRAVELER;
      const segmentVector = SEGMENT_PROFILES[targetSegment].typicalVector;

      const adjusted = service.adjustVectorForSegment(originalVector, targetSegment, 0.5);

      // Adjusted should be between original and segment
      for (let i = 0; i < 8; i++) {
        if (segmentVector[i] > originalVector[i]) {
          expect(adjusted[i]).toBeGreaterThan(originalVector[i]);
          expect(adjusted[i]).toBeLessThanOrEqual(segmentVector[i]);
        } else if (segmentVector[i] < originalVector[i]) {
          expect(adjusted[i]).toBeLessThan(originalVector[i]);
          expect(adjusted[i]).toBeGreaterThanOrEqual(segmentVector[i]);
        }
      }
    });

    it('should respect adjustment strength', () => {
      const originalVector: FeatureVector = [0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2];
      const targetSegment = UserSegment.ADVENTURE_SEEKER;

      const weakAdjust = service.adjustVectorForSegment(originalVector, targetSegment, 0.1);
      const strongAdjust = service.adjustVectorForSegment(originalVector, targetSegment, 0.9);

      // Strong adjustment should be closer to segment vector
      const segmentVector = SEGMENT_PROFILES[targetSegment].typicalVector;
      const distWeak = service.calculateSimilarity(weakAdjust, segmentVector);
      const distStrong = service.calculateSimilarity(strongAdjust, segmentVector);

      expect(distStrong).toBeGreaterThan(distWeak);
    });
  });

  describe('calculateConfidence', () => {
    it('should return high confidence for complete profiles', () => {
      const confidence = service.calculateConfidence(100, true);
      expect(confidence).toBeGreaterThan(0.9);
    });

    it('should return low confidence for incomplete profiles', () => {
      const confidence = service.calculateConfidence(30, true);
      expect(confidence).toBeLessThan(0.6);
    });

    it('should cap confidence without critical fields', () => {
      const confidence = service.calculateConfidence(100, false);
      expect(confidence).toBeLessThanOrEqual(0.4);
    });

    it('should scale with completeness', () => {
      const conf50 = service.calculateConfidence(50, true);
      const conf80 = service.calculateConfidence(80, true);
      const conf100 = service.calculateConfidence(100, true);

      expect(conf50).toBeLessThan(conf80);
      expect(conf80).toBeLessThan(conf100);
    });
  });

  describe('getAllSegmentVectors', () => {
    it('should return vectors for all segments', () => {
      const allVectors = service.getAllSegmentVectors();
      const allSegments = Object.values(UserSegment);

      expect(allVectors.size).toBe(allSegments.length);

      allSegments.forEach((segment) => {
        expect(allVectors.has(segment)).toBe(true);
        const vector = allVectors.get(segment);
        expect(vector).toBeDefined();
        expect(vector).toHaveLength(8);
        expect(service.validateVector(vector!)).toBe(true);
      });
    });
  });

  describe('Integration with personas', () => {
    it('should generate appropriate vectors for each persona segment', () => {
      const allPersonas = Object.values(PERSONAS);

      allPersonas.forEach((persona) => {
        const segmentVector = service.generateVectorFromSegment(persona.expectedSegment);

        // Check if generated vector is close to expected vector
        const similarity = service.calculateSimilarity(
          segmentVector,
          persona.expectedVector
        );

        expect(similarity).toBeGreaterThan(0.85); // Should be quite similar
      });
    });
  });
});
