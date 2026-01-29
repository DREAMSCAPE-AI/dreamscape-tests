/**
 * Test Personas for User Segmentation
 *
 * Defines realistic user profiles for each segment type
 * to be used in unit and integration tests.
 */

import { UserSegment } from '../../../dreamscape-services/ai/src/segments/types/segment.types';

export interface TestPersona {
  userId: string;
  name: string;
  description: string;
  expectedSegment: UserSegment;
  expectedSegmentScore: number; // Minimum expected score
  onboardingProfile: any; // AIUserPreferences format
  expectedVector: [number, number, number, number, number, number, number, number];
}

export const PERSONAS: Record<string, TestPersona> = {
  BUDGET_BACKPACKER: {
    userId: 'test-budget-001',
    name: 'Marco the Backpacker',
    description: '25-year-old solo traveler on a tight budget, loves adventure',
    expectedSegment: UserSegment.BUDGET_BACKPACKER,
    expectedSegmentScore: 0.7,
    onboarding Profile: {
      userId: 'test-budget-001',
      isOnboardingCompleted: true,
      preferences: {
        destinations: {
          regions: ['SOUTHEAST_ASIA', 'EASTERN_EUROPE'],
          climates: ['TROPICAL', 'TEMPERATE'],
        },
        budget: {
          globalRange: { min: 25, max: 45, currency: 'EUR' },
          flexibility: 'flexible',
        },
        travel: {
          types: ['ADVENTURE', 'CULTURAL'],
          purposes: ['LEISURE'],
          style: 'spontaneous',
          groupTypes: ['SOLO'],
          travelWithChildren: false,
          childrenAges: [],
        },
        timing: {
          preferredSeasons: ['ANY'],
          dateFlexibility: 'flexible',
        },
        accommodation: {
          types: ['HOSTEL', 'BUDGET_HOTEL', 'GUESTHOUSE'],
          comfortLevel: 'basic',
        },
        transport: {
          preferredAirlines: [],
          modes: ['PUBLIC_TRANSPORT', 'BUS', 'TRAIN'],
        },
        activities: {
          types: ['HIKING', 'CULTURAL_TOURS', 'STREET_FOOD'],
          interests: ['OUTDOOR', 'LOCAL_CULTURE', 'BACKPACKING'],
          activityLevel: 'high',
        },
        experience: {
          level: 'intermediate',
          riskTolerance: 'adventurous',
        },
        climate: {
          preferences: ['TROPICAL', 'WARM'],
        },
      },
      metadata: {
        completedSteps: ['destinations', 'budget', 'travel_types', 'activities'],
        dataQuality: {
          completeness: 85,
          confidence: 80,
        },
      },
    },
    expectedVector: [0.6, 0.4, 0.2, 0.8, 0.1, 0.4, 0.3, 0.4],
  },

  FAMILY_EXPLORER: {
    userId: 'test-family-001',
    name: 'The Dupont Family',
    description: 'Family of 4 (2 children aged 5 and 8), moderate budget, family-friendly destinations',
    expectedSegment: UserSegment.FAMILY_EXPLORER,
    expectedSegmentScore: 0.75,
    onboardingProfile: {
      userId: 'test-family-001',
      isOnboardingCompleted: true,
      preferences: {
        destinations: {
          regions: ['WESTERN_EUROPE', 'MEDITERRANEAN'],
          climates: ['TEMPERATE', 'WARM'],
        },
        budget: {
          globalRange: { min: 90, max: 140, currency: 'EUR' },
          flexibility: 'flexible',
        },
        travel: {
          types: ['FAMILY', 'LEISURE'],
          purposes: ['LEISURE', 'EDUCATION'],
          style: 'planned',
          groupTypes: ['FAMILY'],
          travelWithChildren: true,
          childrenAges: [5, 8],
        },
        timing: {
          preferredSeasons: ['SUMMER', 'SPRING'],
          dateFlexibility: 'semi_flexible',
        },
        accommodation: {
          types: ['FAMILY_HOTEL', 'APARTMENT', 'RESORT'],
          comfortLevel: 'standard',
        },
        transport: {
          preferredAirlines: [],
          modes: ['FLIGHT', 'RENTAL_CAR'],
        },
        activities: {
          types: ['THEME_PARKS', 'BEACHES', 'MUSEUMS', 'NATURE_PARKS'],
          interests: ['FAMILY_FRIENDLY', 'EDUCATIONAL', 'FUN'],
          activityLevel: 'moderate',
        },
        experience: {
          level: 'beginner',
          riskTolerance: 'conservative',
        },
        climate: {
          preferences: ['WARM', 'SUNNY'],
        },
      },
      metadata: {
        completedSteps: ['destinations', 'budget', 'travel_types', 'accommodation', 'activities'],
        dataQuality: {
          completeness: 95,
          confidence: 90,
        },
      },
    },
    expectedVector: [0.7, 0.4, 0.5, 0.5, 0.9, 0.5, 0.5, 0.7],
  },

  LUXURY_TRAVELER: {
    userId: 'test-luxury-001',
    name: 'Victoria the Luxury Traveler',
    description: 'Affluent traveler, premium budget, seeks exclusive experiences',
    expectedSegment: UserSegment.LUXURY_TRAVELER,
    expectedSegmentScore: 0.8,
    onboardingProfile: {
      userId: 'test-luxury-001',
      isOnboardingCompleted: true,
      preferences: {
        destinations: {
          regions: ['MIDDLE_EAST', 'MALDIVES', 'FRENCH_RIVIERA'],
          climates: ['TROPICAL', 'MEDITERRANEAN'],
        },
        budget: {
          globalRange: { min: 300, max: 800, currency: 'EUR' },
          flexibility: 'strict',
        },
        travel: {
          types: ['LUXURY', 'LEISURE'],
          purposes: ['LEISURE', 'RELAXATION'],
          style: 'planned',
          groupTypes: ['COUPLE'],
          travelWithChildren: false,
          childrenAges: [],
        },
        timing: {
          preferredSeasons: ['ANY'],
          dateFlexibility: 'fixed',
        },
        accommodation: {
          types: ['5_STAR_HOTEL', 'LUXURY_RESORT', 'PRIVATE_VILLA'],
          comfortLevel: 'luxury',
        },
        transport: {
          preferredAirlines: ['EMIRATES', 'SINGAPORE_AIRLINES'],
          cabinClass: 'FIRST',
          modes: ['FLIGHT', 'PRIVATE_TRANSFER'],
        },
        activities: {
          types: ['FINE_DINING', 'LUXURY_SPA', 'WINE_TASTING', 'SHOPPING'],
          interests: ['LUXURY', 'RELAXATION', 'GOURMET'],
          activityLevel: 'low',
        },
        experience: {
          level: 'expert',
          riskTolerance: 'conservative',
        },
        climate: {
          preferences: ['TROPICAL', 'WARM'],
        },
      },
      metadata: {
        completedSteps: [
          'destinations',
          'budget',
          'travel_types',
          'accommodation',
          'transport',
          'activities',
        ],
        dataQuality: {
          completeness: 98,
          confidence: 95,
        },
      },
    },
    expectedVector: [0.7, 0.7, 0.95, 0.4, 0.3, 0.8, 0.9, 0.6],
  },

  ADVENTURE_SEEKER: {
    userId: 'test-adventure-001',
    name: 'Alex the Adventurer',
    description: 'Active traveler, seeks thrills and outdoor challenges',
    expectedSegment: UserSegment.ADVENTURE_SEEKER,
    expectedSegmentScore: 0.75,
    onboardingProfile: {
      userId: 'test-adventure-001',
      isOnboardingCompleted: true,
      preferences: {
        destinations: {
          regions: ['SOUTH_AMERICA', 'NEW_ZEALAND', 'NEPAL'],
          climates: ['MOUNTAIN', 'TROPICAL'],
        },
        budget: {
          globalRange: { min: 70, max: 130, currency: 'EUR' },
          flexibility: 'very_flexible',
        },
        travel: {
          types: ['ADVENTURE', 'NATURE'],
          purposes: ['ADVENTURE', 'SPORTS'],
          style: 'spontaneous',
          groupTypes: ['SOLO', 'FRIENDS'],
          travelWithChildren: false,
          childrenAges: [],
        },
        timing: {
          preferredSeasons: ['ANY'],
          dateFlexibility: 'flexible',
        },
        accommodation: {
          types: ['MOUNTAIN_LODGE', 'CAMPING', 'ECO_LODGE'],
          comfortLevel: 'basic',
        },
        transport: {
          preferredAirlines: [],
          modes: ['FLIGHT', 'LOCAL_TRANSPORT', 'HIKING'],
        },
        activities: {
          types: [
            'HIKING',
            'TREKKING',
            'ROCK_CLIMBING',
            'SURFING',
            'DIVING',
            'SKIING',
          ],
          interests: ['OUTDOOR', 'EXTREME_SPORTS', 'NATURE'],
          activityLevel: 'very_high',
        },
        experience: {
          level: 'advanced',
          riskTolerance: 'adventurous',
        },
        climate: {
          preferences: ['MOUNTAIN', 'VARIED'],
        },
      },
      metadata: {
        completedSteps: ['destinations', 'budget', 'travel_types', 'activities'],
        dataQuality: {
          completeness: 88,
          confidence: 85,
        },
      },
    },
    expectedVector: [0.5, 0.2, 0.5, 0.95, 0.3, 0.2, 0.4, 0.3],
  },

  CULTURAL_ENTHUSIAST: {
    userId: 'test-cultural-001',
    name: 'Sophie the Culture Lover',
    description: 'Intellectual traveler, loves museums, history, and local cuisine',
    expectedSegment: UserSegment.CULTURAL_ENTHUSIAST,
    expectedSegmentScore: 0.78,
    onboardingProfile: {
      userId: 'test-cultural-001',
      isOnboardingCompleted: true,
      preferences: {
        destinations: {
          regions: ['EUROPE', 'MIDDLE_EAST', 'ASIA'],
          climates: ['TEMPERATE', 'VARIED'],
        },
        budget: {
          globalRange: { min: 80, max: 160, currency: 'EUR' },
          flexibility: 'flexible',
        },
        travel: {
          types: ['CULTURAL', 'GASTRONOMY'],
          purposes: ['CULTURE', 'EDUCATION'],
          style: 'planned',
          groupTypes: ['COUPLE', 'SOLO'],
          travelWithChildren: false,
          childrenAges: [],
        },
        timing: {
          preferredSeasons: ['SPRING', 'FALL'],
          dateFlexibility: 'semi_flexible',
        },
        accommodation: {
          types: ['BOUTIQUE_HOTEL', 'CITY_HOTEL', 'B&B'],
          comfortLevel: 'standard',
        },
        transport: {
          preferredAirlines: [],
          modes: ['FLIGHT', 'TRAIN', 'PUBLIC_TRANSPORT'],
        },
        activities: {
          types: [
            'MUSEUMS',
            'HISTORICAL_SITES',
            'CULINARY_TOURS',
            'LOCAL_MARKETS',
            'CULTURAL_PERFORMANCES',
          ],
          interests: ['HISTORY', 'ART', 'GASTRONOMY', 'ARCHITECTURE'],
          activityLevel: 'moderate',
        },
        experience: {
          level: 'intermediate',
          riskTolerance: 'moderate',
        },
        climate: {
          preferences: ['TEMPERATE', 'COMFORTABLE'],
        },
      },
      metadata: {
        completedSteps: [
          'destinations',
          'budget',
          'travel_types',
          'accommodation',
          'activities',
        ],
        dataQuality: {
          completeness: 92,
          confidence: 88,
        },
      },
    },
    expectedVector: [0.6, 0.9, 0.6, 0.5, 0.4, 0.7, 0.8, 0.6],
  },

  ROMANTIC_COUPLE: {
    userId: 'test-romantic-001',
    name: 'Emma & James',
    description: 'Couple seeking romantic getaway, premium comfort',
    expectedSegment: UserSegment.ROMANTIC_COUPLE,
    expectedSegmentScore: 0.72,
    onboardingProfile: {
      userId: 'test-romantic-001',
      isOnboardingCompleted: true,
      preferences: {
        destinations: {
          regions: ['MEDITERRANEAN', 'CARIBBEAN', 'TUSCANY'],
          climates: ['MEDITERRANEAN', 'TROPICAL'],
        },
        budget: {
          globalRange: { min: 120, max: 220, currency: 'EUR' },
          flexibility: 'flexible',
        },
        travel: {
          types: ['ROMANTIC', 'LEISURE'],
          purposes: ['LEISURE', 'CELEBRATION'],
          style: 'planned',
          groupTypes: ['COUPLE'],
          travelWithChildren: false,
          childrenAges: [],
        },
        timing: {
          preferredSeasons: ['SUMMER', 'SPRING'],
          dateFlexibility: 'fixed',
        },
        accommodation: {
          types: ['BOUTIQUE_HOTEL', 'ROMANTIC_RESORT', 'PRIVATE_VILLA'],
          comfortLevel: 'premium',
        },
        transport: {
          preferredAirlines: [],
          modes: ['FLIGHT', 'RENTAL_CAR'],
        },
        activities: {
          types: [
            'ROMANTIC_DINNERS',
            'SUNSET_VIEWS',
            'WINE_TASTING',
            'COUPLES_SPA',
            'SCENIC_WALKS',
          ],
          interests: ['ROMANCE', 'GASTRONOMY', 'RELAXATION'],
          activityLevel: 'low',
        },
        experience: {
          level: 'intermediate',
          riskTolerance: 'moderate',
        },
        climate: {
          preferences: ['WARM', 'SUNNY'],
        },
      },
      metadata: {
        completedSteps: [
          'destinations',
          'budget',
          'travel_types',
          'accommodation',
          'activities',
        ],
        dataQuality: {
          completeness: 90,
          confidence: 87,
        },
      },
    },
    expectedVector: [0.7, 0.6, 0.7, 0.4, 0.5, 0.6, 0.7, 0.6],
  },

  BUSINESS_LEISURE: {
    userId: 'test-business-001',
    name: 'David the Business Traveler',
    description: 'Frequent business traveler who adds leisure activities',
    expectedSegment: UserSegment.BUSINESS_LEISURE,
    expectedSegmentScore: 0.73,
    onboardingProfile: {
      userId: 'test-business-001',
      isOnboardingCompleted: true,
      preferences: {
        destinations: {
          regions: ['GLOBAL_BUSINESS_HUBS'],
          climates: ['URBAN'],
        },
        budget: {
          globalRange: { min: 150, max: 280, currency: 'EUR' },
          flexibility: 'strict',
        },
        travel: {
          types: ['BUSINESS', 'LEISURE'],
          purposes: ['BUSINESS', 'LEISURE'],
          style: 'planned',
          groupTypes: ['SOLO'],
          travelWithChildren: false,
          childrenAges: [],
        },
        timing: {
          preferredSeasons: ['ANY'],
          dateFlexibility: 'fixed',
        },
        accommodation: {
          types: ['BUSINESS_HOTEL', 'CITY_CENTER_HOTEL', '4_STAR_HOTEL'],
          comfortLevel: 'premium',
        },
        transport: {
          preferredAirlines: ['LUFTHANSA', 'BRITISH_AIRWAYS'],
          cabinClass: 'BUSINESS',
          modes: ['FLIGHT', 'TAXI', 'UBER'],
        },
        activities: {
          types: ['CITY_TOURS', 'FINE_DINING', 'CULTURAL_ATTRACTIONS', 'GYM'],
          interests: ['BUSINESS', 'CULTURE', 'GASTRONOMY'],
          activityLevel: 'moderate',
        },
        experience: {
          level: 'expert',
          riskTolerance: 'moderate',
        },
        climate: {
          preferences: ['COMFORTABLE'],
        },
      },
      metadata: {
        completedSteps: [
          'destinations',
          'budget',
          'travel_types',
          'accommodation',
          'transport',
        ],
        dataQuality: {
          completeness: 94,
          confidence: 91,
        },
      },
    },
    expectedVector: [0.6, 0.7, 0.75, 0.4, 0.1, 0.9, 0.6, 0.7],
  },

  SENIOR_COMFORT: {
    userId: 'test-senior-001',
    name: 'Robert & Margaret',
    description: 'Retired couple, comfortable budget, slow travel, cultural focus',
    expectedSegment: UserSegment.SENIOR_COMFORT,
    expectedSegmentScore: 0.76,
    onboardingProfile: {
      userId: 'test-senior-001',
      isOnboardingCompleted: true,
      preferences: {
        destinations: {
          regions: ['EUROPE', 'MEDITERRANEAN', 'JAPAN'],
          climates: ['TEMPERATE', 'COMFORTABLE'],
        },
        budget: {
          globalRange: { min: 100, max: 180, currency: 'EUR' },
          flexibility: 'flexible',
        },
        travel: {
          types: ['CULTURAL', 'CRUISE', 'LEISURE'],
          purposes: ['LEISURE', 'CULTURE'],
          style: 'planned',
          groupTypes: ['COUPLE'],
          travelWithChildren: false,
          childrenAges: [],
        },
        timing: {
          preferredSeasons: ['SPRING', 'FALL'],
          dateFlexibility: 'flexible',
        },
        accommodation: {
          types: ['COMFORTABLE_HOTEL', 'CRUISE', 'RESORT', 'B&B'],
          comfortLevel: 'premium',
        },
        transport: {
          preferredAirlines: [],
          modes: ['FLIGHT', 'CRUISE', 'TRAIN'],
        },
        activities: {
          types: [
            'MUSEUMS',
            'HISTORICAL_SITES',
            'SCENIC_DRIVES',
            'RIVER_CRUISES',
            'GARDENS',
          ],
          interests: ['HISTORY', 'CULTURE', 'SCENIC_BEAUTY', 'RELAXATION'],
          activityLevel: 'low',
        },
        experience: {
          level: 'expert',
          riskTolerance: 'conservative',
        },
        climate: {
          preferences: ['TEMPERATE', 'COMFORTABLE'],
          tolerances: {
            hot: false,
            cold: false,
            rain: false,
            humidity: false,
          },
        },
      },
      metadata: {
        completedSteps: [
          'destinations',
          'budget',
          'travel_types',
          'accommodation',
          'transport',
          'activities',
        ],
        dataQuality: {
          completeness: 96,
          confidence: 93,
        },
      },
    },
    expectedVector: [0.7, 0.8, 0.7, 0.2, 0.5, 0.6, 0.7, 0.7],
  },
};

/**
 * Get all personas
 */
export function getAllPersonas(): TestPersona[] {
  return Object.values(PERSONAS);
}

/**
 * Get persona by segment
 */
export function getPersonaBySegment(segment: UserSegment): TestPersona | undefined {
  return getAllPersonas().find((p) => p.expectedSegment === segment);
}

/**
 * Get persona by user ID
 */
export function getPersonaById(userId: string): TestPersona | undefined {
  return getAllPersonas().find((p) => p.userId === userId);
}
