jest.mock('@dreamscape/db', () => ({ prisma: {} }));

import { SegmentEngineService } from '@ai/segments/segment-engine.service';
import { UserSegment } from '@ai/segments/types/segment.types';

const makeProfile = (overrides: any = {}) => ({
  userId: 'user-1',
  isOnboardingCompleted: true,
  preferences: {
    destinations: {
      regions: ['EUROPE'],
      countries: ['FR'],
      climates: ['TEMPERATE'],
    },
    budget: {
      globalRange: { min: 30, max: 50, currency: 'EUR' },
      flexibility: 'flexible',
    },
    travel: {
      types: ['ADVENTURE'],
      purposes: ['LEISURE'],
      style: 'spontaneous',
      groupTypes: ['SOLO'],
      travelWithChildren: false,
      childrenAges: [],
    },
    timing: {
      preferredSeasons: ['SUMMER'],
      dateFlexibility: 'flexible',
    },
    accommodation: {
      types: ['HOSTEL'],
      comfortLevel: 'basic',
    },
    transport: {
      preferredAirlines: [],
      cabinClass: 'ECONOMY',
      modes: ['PLANE'],
    },
    activities: {
      types: ['HIKING'],
      interests: ['OUTDOOR', 'HIKING'],
      activityLevel: 'very_high',
    },
    experience: {
      level: 'intermediate',
      riskTolerance: 'adventurous',
    },
    climate: {
      preferences: ['TEMPERATE'],
    },
  },
  metadata: {
    completedSteps: ['destinations', 'budget', 'travel'],
    dataQuality: {
      completeness: 100,
      confidence: 0.95,
    },
  },
  ...overrides,
});

describe('US-TEST-018 — SegmentEngineService', () => {
  let service: SegmentEngineService;

  beforeEach(() => {
    service = new SegmentEngineService();
  });

  describe('assignSegment', () => {
    it('should assign the best matching segment with reasons by default', async () => {
      const result = await service.assignSegment(makeProfile());

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].segment).toBe(UserSegment.BUDGET_BACKPACKER);
      expect(result[0].score).toBeGreaterThan(0);
      expect(result[0].assignedAt).toBeInstanceOf(Date);
      expect(result[0].reasons.length).toBeGreaterThan(0);
    });

    it('should respect maxSegments, minScore, and includeReasons=false', async () => {
      const result = await service.assignSegment(makeProfile(), {
        maxSegments: 1,
        minScore: 0.5,
        includeReasons: false,
      });

      expect(result).toHaveLength(1);
      expect(result[0].score).toBeGreaterThanOrEqual(0.5);
      expect(result[0].reasons).toEqual([]);
    });

    it('should allow custom weights to favor business travel', async () => {
      const businessProfile = makeProfile({
        preferences: {
          ...makeProfile().preferences,
          travel: {
            ...makeProfile().preferences.travel,
            types: ['BUSINESS'],
            purposes: ['BUSINESS'],
            groupTypes: ['SOLO'],
          },
          accommodation: {
            ...makeProfile().preferences.accommodation,
            comfortLevel: 'premium',
            types: ['HOTEL'],
          },
        },
      });

      const result = await service.assignSegment(businessProfile, {
        maxSegments: 1,
        weights: { businessMix: 1, budget: 0, group: 0, activity: 0, comfort: 0, age: 0, style: 0 },
      });

      expect(result[0].segment).toBe(UserSegment.BUSINESS_LEISURE);
    });
  });

  describe('public methods', () => {
    it('should throw for updateSegmentFromBehavior until implemented', async () => {
      await expect(service.updateSegmentFromBehavior('user-1', [])).rejects.toThrow(
        'Behavior-based segment update not yet implemented'
      );
    });

    it('should return the configured segment profile', () => {
      const profile = service.getSegmentProfile(UserSegment.LUXURY_TRAVELER);

      expect(profile.segment).toBe(UserSegment.LUXURY_TRAVELER);
      expect(profile.typicalVector).toHaveLength(8);
    });
  });

  describe('dimension helpers', () => {
    it('should calculate budget dimension with default, clamp low, and clamp high values', () => {
      expect((service as any).calculateBudgetDimension({ globalRange: undefined })).toBe(0.5);
      expect((service as any).calculateBudgetDimension({ globalRange: { min: 1, max: 5 } })).toBe(0);
      expect((service as any).calculateBudgetDimension({ globalRange: { min: 2000, max: 3000 } })).toBe(1);
    });

    it('should calculate group dimension for family, solo, couple, family group, friends group, and default', () => {
      expect((service as any).calculateGroupDimension({ groupTypes: [], travelWithChildren: true, childrenAges: [] })).toBe(0.9);
      expect((service as any).calculateGroupDimension({ groupTypes: ['SOLO'], travelWithChildren: false, childrenAges: [] })).toBe(0.1);
      expect((service as any).calculateGroupDimension({ groupTypes: ['COUPLE'], travelWithChildren: false, childrenAges: [] })).toBe(0.5);
      expect((service as any).calculateGroupDimension({ groupTypes: ['FAMILY'], travelWithChildren: false, childrenAges: [] })).toBe(0.85);
      expect((service as any).calculateGroupDimension({ groupTypes: ['FRIENDS'], travelWithChildren: false, childrenAges: [] })).toBe(0.7);
      expect((service as any).calculateGroupDimension({ groupTypes: [], travelWithChildren: false, childrenAges: [] })).toBe(0.3);
    });

    it('should calculate activity and comfort dimensions including fallback defaults', () => {
      expect((service as any).calculateActivityDimension({ activityLevel: 'low' })).toBe(0.2);
      expect((service as any).calculateActivityDimension({ activityLevel: 'high' })).toBe(0.8);
      expect((service as any).calculateActivityDimension({ activityLevel: null })).toBe(0.5);
      expect((service as any).calculateActivityDimension({ activityLevel: 'unknown' })).toBe(0.5);
      expect((service as any).calculateComfortDimension({ comfortLevel: 'basic' })).toBe(0.2);
      expect((service as any).calculateComfortDimension({ comfortLevel: 'luxury' })).toBe(0.95);
      expect((service as any).calculateComfortDimension({ comfortLevel: null })).toBe(0.5);
      expect((service as any).calculateComfortDimension({ comfortLevel: 'unknown' })).toBe(0.5);
    });

    it('should calculate age dimension from younger and older travel signals', () => {
      const younger = (service as any).calculateAgeDimension(makeProfile().preferences);
      const older = (service as any).calculateAgeDimension({
        ...makeProfile().preferences,
        budget: { globalRange: { min: 150, max: 200, currency: 'EUR' }, flexibility: 'strict' },
        travel: { ...makeProfile().preferences.travel, types: ['CRUISE'] },
        activities: { ...makeProfile().preferences.activities, activityLevel: 'low' },
        accommodation: { types: ['CRUISE'], comfortLevel: 'luxury' },
        experience: { level: 'expert', riskTolerance: 'conservative' },
      });

      expect(younger).toBeLessThan(0.4);
      expect(older).toBeGreaterThan(0.8);
    });

    it('should calculate style and business mix dimensions across branches', () => {
      const cultural = (service as any).calculateStyleDimension({
        ...makeProfile().preferences,
        travel: { ...makeProfile().preferences.travel, types: ['CULTURAL'] },
        activities: { ...makeProfile().preferences.activities, interests: ['MUSEUMS', 'GASTRONOMY', 'SHOPPING', 'ARCHITECTURE'] },
      });
      const nature = (service as any).calculateStyleDimension({
        ...makeProfile().preferences,
        travel: { ...makeProfile().preferences.travel, types: ['ADVENTURE', 'NATURE'] },
        activities: { ...makeProfile().preferences.activities, interests: ['HIKING', 'OUTDOOR', 'WILDLIFE'] },
      });

      expect(cultural).toBe(1);
      expect(nature).toBeLessThan(0.2);

      expect((service as any).calculateBusinessMixDimension({ types: ['BUSINESS'], purposes: [] })).toBe(0.7);
      expect((service as any).calculateBusinessMixDimension({ types: [], purposes: ['BUSINESS'] })).toBe(0.6);
      expect((service as any).calculateBusinessMixDimension({ types: ['BLEISURE'], purposes: [] })).toBe(0.5);
      expect((service as any).calculateBusinessMixDimension({ types: [], purposes: [] })).toBe(0);
    });
  });

  describe('reason generation', () => {
    it('should generate segment-specific reasons and cap them at four entries', () => {
      const familyProfile = makeProfile({
        preferences: {
          ...makeProfile().preferences,
          budget: {
            globalRange: { min: 90, max: 110, currency: 'EUR' },
            flexibility: 'flexible',
          },
          travel: {
            ...makeProfile().preferences.travel,
            groupTypes: ['COUPLE'],
            travelWithChildren: true,
            childrenAges: [5, 8],
            types: ['CULTURAL'],
          },
          accommodation: {
            types: ['HOTEL'],
            comfortLevel: 'standard',
          },
          activities: {
            ...makeProfile().preferences.activities,
            activityLevel: 'moderate',
            interests: ['MUSEUMS'],
          },
        },
      });
      const dimensions = (service as any).calculateDimensions(familyProfile);

      const familyReasons = (service as any).generateReasons(
        UserSegment.FAMILY_EXPLORER,
        {
          budget: 0,
          group: 0.9,
          activity: 0,
          comfort: 0,
          age: 0,
          style: 0,
          businessMix: 0,
        },
        familyProfile
      );
      const luxuryReasons = (service as any).generateReasons(
        UserSegment.LUXURY_TRAVELER,
        {
          budget: 0,
          group: 0,
          activity: 0,
          comfort: 0.95,
          age: 0,
          style: 0,
          businessMix: 0,
        },
        {
          ...familyProfile,
          preferences: {
            ...familyProfile.preferences,
            accommodation: { types: ['RESORT'], comfortLevel: 'luxury' },
          },
        }
      );
      const adventureReasons = (service as any).generateReasons(
        UserSegment.ADVENTURE_SEEKER,
        {
          ...dimensions,
          style: 0.2,
        },
        makeProfile()
      );
      const culturalReasons = (service as any).generateReasons(
        UserSegment.CULTURAL_ENTHUSIAST,
        {
          budget: 0,
          group: 0,
          activity: 0,
          comfort: 0,
          age: 0,
          style: 0.9,
          businessMix: 0,
        },
        familyProfile
      );
      const romanticReasons = (service as any).generateReasons(
        UserSegment.ROMANTIC_COUPLE,
        {
          ...dimensions,
          group: 0.5,
          comfort: 0.7,
        },
        {
          ...familyProfile,
          preferences: {
            ...familyProfile.preferences,
            travel: {
              ...familyProfile.preferences.travel,
              travelWithChildren: false,
              childrenAges: [],
              groupTypes: ['COUPLE'],
            },
            accommodation: {
              types: ['BOUTIQUE_HOTEL'],
              comfortLevel: 'premium',
            },
          },
        }
      );

      expect(familyReasons.some((reason: string) => reason.includes('traveling with 2 child'))).toBe(true);
      expect(familyReasons.length).toBeLessThanOrEqual(4);
      expect(luxuryReasons).toContain('luxury accommodation preference');
      expect(adventureReasons).toContain('high risk tolerance for adventure');
      expect(culturalReasons).toContain('cultural/urban focus');
      expect(romanticReasons).toContain('romantic couple travel style');
    });

    it('should generate the luxury budget label when budget strongly matches a premium segment', () => {
      const luxuryReasons = (service as any).generateReasons(
        UserSegment.LUXURY_TRAVELER,
        {
          budget: 0.95,
          group: 0,
          activity: 0,
          comfort: 0,
          age: 0,
          style: 0,
          businessMix: 0,
        },
        makeProfile()
      );
      const premiumReasons = (service as any).generateReasons(
        UserSegment.CULTURAL_ENTHUSIAST,
        {
          budget: 0.7,
          group: 0,
          activity: 0,
          comfort: 0,
          age: 0,
          style: 0,
          businessMix: 0,
        },
        makeProfile()
      );

      expect(luxuryReasons).toContain('luxury budget aligns with segment');
      expect(premiumReasons).toContain('premium budget aligns with segment');
    });
  });
});
