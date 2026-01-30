/**
 * Unit Tests: SegmentEngineService
 *
 * Tests user segment assignment logic and scoring algorithm
 */

import { SegmentEngineService } from '../../../dreamscape-services/ai/src/segments/segment-engine.service';
import {
  UserSegment,
  SegmentAssignment,
} from '../../../dreamscape-services/ai/src/segments/types/segment.types';
import { PERSONAS, getAllPersonas, getPersonaBySegment } from '../fixtures/user-personas';

describe('SegmentEngineService', () => {
  let service: SegmentEngineService;

  beforeEach(() => {
    service = new SegmentEngineService();
  });

  describe('assignSegment', () => {
    it('should assign BUDGET_BACKPACKER for low budget solo traveler', async () => {
      const profile = PERSONAS.BUDGET_BACKPACKER.onboardingProfile;
      const result = await service.assignSegment(profile);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].segment).toBe(UserSegment.BUDGET_BACKPACKER);
      expect(result[0].score).toBeGreaterThanOrEqual(
        PERSONAS.BUDGET_BACKPACKER.expectedSegmentScore
      );
      expect(result[0].assignedAt).toBeInstanceOf(Date);
    });

    it('should assign FAMILY_EXPLORER for family with children', async () => {
      const profile = PERSONAS.FAMILY_EXPLORER.onboardingProfile;
      const result = await service.assignSegment(profile);

      expect(result[0].segment).toBe(UserSegment.FAMILY_EXPLORER);
      expect(result[0].score).toBeGreaterThanOrEqual(
        PERSONAS.FAMILY_EXPLORER.expectedSegmentScore
      );

      // Should include reason about children
      expect(result[0].reasons).toEqual(
        expect.arrayContaining([expect.stringContaining('child')])
      );
    });

    it('should assign LUXURY_TRAVELER for high budget luxury seeker', async () => {
      const profile = PERSONAS.LUXURY_TRAVELER.onboardingProfile;
      const result = await service.assignSegment(profile);

      expect(result[0].segment).toBe(UserSegment.LUXURY_TRAVELER);
      expect(result[0].score).toBeGreaterThanOrEqual(
        PERSONAS.LUXURY_TRAVELER.expectedSegmentScore
      );
    });

    it('should assign ADVENTURE_SEEKER for active outdoor traveler', async () => {
      const profile = PERSONAS.ADVENTURE_SEEKER.onboardingProfile;
      const result = await service.assignSegment(profile);

      expect(result[0].segment).toBe(UserSegment.ADVENTURE_SEEKER);
      expect(result[0].score).toBeGreaterThanOrEqual(
        PERSONAS.ADVENTURE_SEEKER.expectedSegmentScore
      );
    });

    it('should assign CULTURAL_ENTHUSIAST for culture-focused traveler', async () => {
      const profile = PERSONAS.CULTURAL_ENTHUSIAST.onboardingProfile;
      const result = await service.assignSegment(profile);

      expect(result[0].segment).toBe(UserSegment.CULTURAL_ENTHUSIAST);
      expect(result[0].score).toBeGreaterThanOrEqual(
        PERSONAS.CULTURAL_ENTHUSIAST.expectedSegmentScore
      );
    });

    it('should assign ROMANTIC_COUPLE for couples seeking romance', async () => {
      const profile = PERSONAS.ROMANTIC_COUPLE.onboardingProfile;
      const result = await service.assignSegment(profile);

      expect(result[0].segment).toBe(UserSegment.ROMANTIC_COUPLE);
      expect(result[0].score).toBeGreaterThanOrEqual(
        PERSONAS.ROMANTIC_COUPLE.expectedSegmentScore
      );
    });

    it('should assign BUSINESS_LEISURE for business travelers', async () => {
      const profile = PERSONAS.BUSINESS_LEISURE.onboardingProfile;
      const result = await service.assignSegment(profile);

      expect(result[0].segment).toBe(UserSegment.BUSINESS_LEISURE);
      expect(result[0].score).toBeGreaterThanOrEqual(
        PERSONAS.BUSINESS_LEISURE.expectedSegmentScore
      );
    });

    it('should assign SENIOR_COMFORT for older travelers', async () => {
      const profile = PERSONAS.SENIOR_COMFORT.onboardingProfile;
      const result = await service.assignSegment(profile);

      expect(result[0].segment).toBe(UserSegment.SENIOR_COMFORT);
      expect(result[0].score).toBeGreaterThanOrEqual(
        PERSONAS.SENIOR_COMFORT.expectedSegmentScore
      );
    });

    it('should handle multi-segment assignment', async () => {
      // Profile that could match multiple segments
      const hybridProfile = {
        ...PERSONAS.BUSINESS_LEISURE.onboardingProfile,
        preferences: {
          ...PERSONAS.BUSINESS_LEISURE.onboardingProfile.preferences,
          travel: {
            ...PERSONAS.BUSINESS_LEISURE.onboardingProfile.preferences.travel,
            types: ['BUSINESS', 'CULTURAL'],
          },
        },
      };

      const result = await service.assignSegment(hybridProfile);

      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.length).toBeLessThanOrEqual(3); // Default max
      expect(result[0].score).toBeGreaterThan(result[result.length - 1].score); // Descending order
    });

    it('should respect minScore threshold', async () => {
      const profile = PERSONAS.BUDGET_BACKPACKER.onboardingProfile;
      const result = await service.assignSegment(profile, { minScore: 0.5 });

      result.forEach((assignment) => {
        expect(assignment.score).toBeGreaterThanOrEqual(0.5);
      });
    });

    it('should respect maxSegments option', async () => {
      const profile = PERSONAS.CULTURAL_ENTHUSIAST.onboardingProfile;
      const result = await service.assignSegment(profile, { maxSegments: 1 });

      expect(result.length).toBeLessThanOrEqual(1);
    });

    it('should include reasons when requested', async () => {
      const profile = PERSONAS.FAMILY_EXPLORER.onboardingProfile;
      const result = await service.assignSegment(profile, { includeReasons: true });

      expect(result[0].reasons).toBeDefined();
      expect(result[0].reasons.length).toBeGreaterThan(0);
      expect(typeof result[0].reasons[0]).toBe('string');
    });

    it('should exclude reasons when not requested', async () => {
      const profile = PERSONAS.FAMILY_EXPLORER.onboardingProfile;
      const result = await service.assignSegment(profile, { includeReasons: false });

      expect(result[0].reasons).toEqual([]);
    });

    it('should handle incomplete profile gracefully', async () => {
      const incompleteProfile = {
        userId: 'test-incomplete',
        isOnboardingCompleted: false,
        preferences: {
          destinations: {},
          budget: {},
          travel: {
            types: [],
            purposes: [],
            groupTypes: [],
            travelWithChildren: false,
            childrenAges: [],
          },
          timing: {},
          accommodation: { types: [] },
          transport: { preferredAirlines: [], modes: [] },
          activities: { types: [], interests: [] },
          experience: {},
          climate: { preferences: [] },
        },
        metadata: {
          completedSteps: [],
          dataQuality: {
            completeness: 20,
            confidence: 15,
          },
        },
      };

      const result = await service.assignSegment(incompleteProfile);

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      // Should still assign some segment even with incomplete data
    });
  });

  describe('getSegmentProfile', () => {
    it('should return profile for valid segment', () => {
      const profile = service.getSegmentProfile(UserSegment.BUDGET_BACKPACKER);

      expect(profile).toBeDefined();
      expect(profile.segment).toBe(UserSegment.BUDGET_BACKPACKER);
      expect(profile.name).toBeDefined();
      expect(profile.description).toBeDefined();
      expect(profile.typicalVector).toHaveLength(8);
      expect(profile.budgetRange).toBeDefined();
    });

    it('should return all segment profiles', () => {
      const allSegments = Object.values(UserSegment);

      allSegments.forEach((segment) => {
        const profile = service.getSegmentProfile(segment);
        expect(profile).toBeDefined();
        expect(profile.segment).toBe(segment);
      });
    });
  });

  describe('Dimension calculations', () => {
    it('should calculate budget dimension correctly', () => {
      const lowBudgetProfile = PERSONAS.BUDGET_BACKPACKER.onboardingProfile;
      const highBudgetProfile = PERSONAS.LUXURY_TRAVELER.onboardingProfile;

      // Access private method via type casting (for testing)
      const service Any = service as any;

      const lowBudgetDim = serviceAny.calculateBudgetDimension(
        lowBudgetProfile.preferences.budget
      );
      const highBudgetDim = serviceAny.calculateBudgetDimension(
        highBudgetProfile.preferences.budget
      );

      expect(lowBudgetDim).toBeLessThan(0.5);
      expect(highBudgetDim).toBeGreaterThan(0.8);
      expect(lowBudgetDim).toBeLessThan(highBudgetDim);
    });

    it('should calculate group dimension correctly', () => {
      const soloProfile = PERSONAS.BUDGET_BACKPACKER.onboardingProfile;
      const familyProfile = PERSONAS.FAMILY_EXPLORER.onboardingProfile;

      const serviceAny = service as any;

      const soloDim = serviceAny.calculateGroupDimension(soloProfile.preferences.travel);
      const familyDim = serviceAny.calculateGroupDimension(familyProfile.preferences.travel);

      expect(soloDim).toBeLessThan(0.3);
      expect(familyDim).toBeGreaterThan(0.8);
    });

    it('should calculate activity dimension correctly', () => {
      const lowActivityProfile = PERSONAS.SENIOR_COMFORT.onboardingProfile;
      const highActivityProfile = PERSONAS.ADVENTURE_SEEKER.onboardingProfile;

      const serviceAny = service as any;

      const lowActivityDim = serviceAny.calculateActivityDimension(
        lowActivityProfile.preferences.activities
      );
      const highActivityDim = serviceAny.calculateActivityDimension(
        highActivityProfile.preferences.activities
      );

      expect(lowActivityDim).toBeLessThan(0.4);
      expect(highActivityDim).toBeGreaterThan(0.8);
    });
  });

  describe('Scoring algorithm', () => {
    it('should give higher scores to better matches', async () => {
      // Test that a clear family profile scores highest for FAMILY_EXPLORER
      const profile = PERSONAS.FAMILY_EXPLORER.onboardingProfile;
      const result = await service.assignSegment(profile);

      const familyExplorerScore =
        result.find((s) => s.segment === UserSegment.FAMILY_EXPLORER)?.score || 0;
      const otherScores = result
        .filter((s) => s.segment !== UserSegment.FAMILY_EXPLORER)
        .map((s) => s.score);

      // Family Explorer should score highest
      otherScores.forEach((score) => {
        expect(familyExplorerScore).toBeGreaterThanOrEqual(score);
      });
    });

    it('should produce consistent scores for same input', async () => {
      const profile = PERSONAS.BUDGET_BACKPACKER.onboardingProfile;

      const result1 = await service.assignSegment(profile);
      const result2 = await service.assignSegment(profile);

      expect(result1[0].segment).toBe(result2[0].segment);
      expect(result1[0].score).toBeCloseTo(result2[0].score, 5);
    });

    it('should handle all personas correctly', async () => {
      const allPersonas = getAllPersonas();

      for (const persona of allPersonas) {
        const result = await service.assignSegment(persona.onboardingProfile);

        expect(result[0].segment).toBe(persona.expectedSegment);
        expect(result[0].score).toBeGreaterThanOrEqual(persona.expectedSegmentScore);
      }
    });
  });

  describe('Reasons generation', () => {
    it('should generate relevant reasons for FAMILY_EXPLORER', async () => {
      const profile = PERSONAS.FAMILY_EXPLORER.onboardingProfile;
      const result = await service.assignSegment(profile, { includeReasons: true });

      const familySegment = result.find((s) => s.segment === UserSegment.FAMILY_EXPLORER);
      expect(familySegment).toBeDefined();

      const reasons = familySegment!.reasons;
      const reasonText = reasons.join(' ').toLowerCase();

      // Should mention children or family
      expect(reasonText).toMatch(/child|family/);
    });

    it('should generate relevant reasons for LUXURY_TRAVELER', async () => {
      const profile = PERSONAS.LUXURY_TRAVELER.onboardingProfile;
      const result = await service.assignSegment(profile, { includeReasons: true });

      const luxurySegment = result.find((s) => s.segment === UserSegment.LUXURY_TRAVELER);
      expect(luxurySegment).toBeDefined();

      const reasons = luxurySegment!.reasons;
      const reasonText = reasons.join(' ').toLowerCase();

      // Should mention luxury or premium
      expect(reasonText).toMatch(/luxury|premium/);
    });

    it('should limit reasons to reasonable number', async () => {
      const profile = PERSONAS.CULTURAL_ENTHUSIAST.onboardingProfile;
      const result = await service.assignSegment(profile, { includeReasons: true });

      result.forEach((assignment) => {
        expect(assignment.reasons.length).toBeLessThanOrEqual(4);
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle missing budget data', async () => {
      const profile = {
        ...PERSONAS.BUDGET_BACKPACKER.onboardingProfile,
        preferences: {
          ...PERSONAS.BUDGET_BACKPACKER.onboardingProfile.preferences,
          budget: {
            flexibility: 'flexible',
          },
        },
      };

      const result = await service.assignSegment(profile);
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle missing activity level', async () => {
      const profile = {
        ...PERSONAS.CULTURAL_ENTHUSIAST.onboardingProfile,
        preferences: {
          ...PERSONAS.CULTURAL_ENTHUSIAST.onboardingProfile.preferences,
          activities: {
            types: ['MUSEUMS'],
            interests: ['CULTURE'],
            activityLevel: null,
          },
        },
      };

      const result = await service.assignSegment(profile);
      expect(result).toBeDefined();
    });

    it('should handle empty group types', async () => {
      const profile = {
        ...PERSONAS.BUDGET_BACKPACKER.onboardingProfile,
        preferences: {
          ...PERSONAS.BUDGET_BACKPACKER.onboardingProfile.preferences,
          travel: {
            ...PERSONAS.BUDGET_BACKPACKER.onboardingProfile.preferences.travel,
            groupTypes: [],
          },
        },
      };

      const result = await service.assignSegment(profile);
      expect(result).toBeDefined();
    });
  });
});
