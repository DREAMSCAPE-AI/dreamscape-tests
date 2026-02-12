/**
 * Unit Tests for Flight Scoring Service
 *
 * Tests the scoring algorithm that ranks flights based on:
 * - Similarity with user preferences
 * - Popularity (airline rating, on-time, route)
 * - Quality metrics (amenities, flexibility, comfort)
 * - Contextual factors (timing, duration, price fit)
 * - Segment-specific cabin class boosts
 * - Diversity (MMR algorithm)
 *
 * @ticket US-IA-004-bis.2
 */

import { FlightScoringService, TripContext } from '../../../../dreamscape-services/ai/src/flights/services/flight-scoring.service';
import {
  FlightFeatures,
  FlightVector,
  FlightClass,
  FlightType,
  AirlineAlliance,
} from '../../../../dreamscape-services/ai/src/flights/types/flight-vector.types';

describe('FlightScoringService', () => {
  let scorer: FlightScoringService;

  beforeEach(() => {
    scorer = new FlightScoringService();
  });

  describe('scoreFlights', () => {
    it('should score and rank flights', async () => {
      const userVector = [0.7, 0.8, 0.6, 0.3, 0.5, 0.9, 0.6, 0.8]; // Tropical, cultural, comfort-oriented, direct flights
      const userSegment = 'LUXURY_TRAVELER';

      const flights = [
        {
          features: createMockFlight({
            flightClass: FlightClass.BUSINESS,
            flightType: FlightType.DIRECT,
            popularity: { airlineRating: 4.8, onTimePerformance: 0.90, routePopularity: 0.9, reviewCount: 500 },
          }),
          vector: [0.8, 0.9, 0.8, 0.9, 0.5, 1.0, 0.7, 0.9] as FlightVector, // Premium, direct, cultural destination
        },
        {
          features: createMockFlight({
            flightClass: FlightClass.ECONOMY,
            flightType: FlightType.TWO_PLUS_STOPS,
            popularity: { airlineRating: 3.5, onTimePerformance: 0.75, routePopularity: 0.5, reviewCount: 100 },
          }),
          vector: [0.6, 0.5, 0.2, 0.3, 0.7, 0.5, 0.4, 0.5] as FlightVector, // Budget, multiple stops
        },
        {
          features: createMockFlight({
            flightClass: FlightClass.PREMIUM_ECONOMY,
            flightType: FlightType.ONE_STOP,
            popularity: { airlineRating: 4.2, onTimePerformance: 0.85, routePopularity: 0.7, reviewCount: 300 },
          }),
          vector: [0.7, 0.8, 0.5, 0.7, 0.6, 0.8, 0.6, 0.8] as FlightVector, // Mid-tier, one stop
        },
      ];

      const scored = await scorer.scoreFlights(userVector, userSegment, flights);

      expect(scored).toHaveLength(3);
      expect(scored[0].rank).toBe(1);
      expect(scored[1].rank).toBe(2);
      expect(scored[2].rank).toBe(3);

      // Business class direct flight should score highest for luxury traveler
      expect(scored[0].flight.flightClass).toBe(FlightClass.BUSINESS);
      expect(scored[0].flight.flightType).toBe(FlightType.DIRECT);

      // All should have valid scores
      scored.forEach(flight => {
        expect(flight.score).toBeGreaterThanOrEqual(0);
        expect(flight.score).toBeLessThanOrEqual(1);
        expect(flight.confidence).toBeGreaterThanOrEqual(0);
        expect(flight.confidence).toBeLessThanOrEqual(1);
        expect(flight.reasons).toBeInstanceOf(Array);
      });
    });

    it('should apply segment boosts correctly', async () => {
      const userVector = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
      const userSegment = 'LUXURY_TRAVELER';

      const flights = [
        {
          features: createMockFlight({ flightClass: FlightClass.FIRST_CLASS }),
          vector: [0.5, 0.5, 0.9, 0.5, 0.5, 0.5, 0.5, 0.8] as FlightVector,
        },
        {
          features: createMockFlight({ flightClass: FlightClass.ECONOMY }),
          vector: [0.5, 0.5, 0.2, 0.5, 0.5, 0.5, 0.5, 0.5] as FlightVector,
        },
      ];

      const scored = await scorer.scoreFlights(userVector, userSegment, flights);

      // First class should have segment boost > 1.0 for luxury travelers
      const firstClass = scored.find(s => s.flight.flightClass === FlightClass.FIRST_CLASS);
      const economy = scored.find(s => s.flight.flightClass === FlightClass.ECONOMY);

      expect(firstClass).toBeDefined();
      expect(economy).toBeDefined();
      expect(firstClass!.breakdown.segmentBoost).toBeGreaterThan(1.0);
      expect(economy!.breakdown.segmentBoost).toBeLessThan(1.0);
      expect(firstClass!.score).toBeGreaterThan(economy!.score);
    });

    it('should consider trip context in scoring', async () => {
      const userVector = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
      const userSegment = 'BUSINESS_TRAVELER';

      const tripContext: TripContext = {
        tripPurpose: 'BUSINESS',
        budgetPerPerson: 800,
        preferDirectFlights: true,
        preferredDepartureTime: 'MORNING',
        avoidRedEye: true,
      };

      const flights = [
        {
          features: createMockFlight({
            flightType: FlightType.DIRECT,
            schedule: { departureTime: '2025-06-15T08:00:00', arrivalTime: '2025-06-15T16:00:00', timeOfDay: 'MORNING', isRedEye: false, isOvernight: false },
            price: { amount: 750, currency: 'EUR' },
          }),
          vector: [0.5, 0.5, 0.6, 0.9, 0.5, 0.5, 0.5, 0.8] as FlightVector,
        },
        {
          features: createMockFlight({
            flightType: FlightType.TWO_PLUS_STOPS,
            schedule: { departureTime: '2025-06-15T23:00:00', arrivalTime: '2025-06-16T14:00:00', timeOfDay: 'NIGHT', isRedEye: true, isOvernight: true },
            price: { amount: 400, currency: 'EUR' },
          }),
          vector: [0.5, 0.5, 0.3, 0.4, 0.5, 0.5, 0.5, 0.5] as FlightVector,
        },
      ];

      const scored = await scorer.scoreFlights(userVector, userSegment, flights, tripContext);

      // First flight should score higher due to better context match
      expect(scored[0].breakdown.contextualScore).toBeGreaterThan(scored[1].breakdown.contextualScore);
      expect(scored[0].flight.flightType).toBe(FlightType.DIRECT);
    });

    it('should filter low quality flights', async () => {
      const userVector = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
      const userSegment = 'CULTURAL_ENTHUSIAST';

      const flights = [
        {
          features: createMockFlight({
            popularity: { airlineRating: 4.5, onTimePerformance: 0.88, routePopularity: 0.8, reviewCount: 400 },
          }),
          vector: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.8] as FlightVector,
        },
        {
          features: createMockFlight({
            popularity: { airlineRating: 2.0, onTimePerformance: 0.60, routePopularity: 0.3, reviewCount: 10 }, // Poor quality
            amenities: { wifi: false, power: false, entertainment: false, meals: 0 },
          }),
          vector: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.3] as FlightVector,
        },
      ];

      const scored = await scorer.scoreFlights(userVector, userSegment, flights);

      // Poor quality flight should be filtered out
      expect(scored.length).toBeLessThan(flights.length);
    });

    it('should apply MMR diversification', async () => {
      const userVector = [0.7, 0.8, 0.6, 0.3, 0.5, 0.9, 0.7, 0.8]; // Premium preference

      const flights = [
        {
          features: createMockFlight({
            flightId: 'flight-1',
            airline: { code: 'AF', name: 'Air France', rating: 4.5, alliance: AirlineAlliance.SKYTEAM, isLowCost: false },
            flightClass: FlightClass.BUSINESS,
          }),
          vector: [0.7, 0.8, 0.8, 0.9, 0.5, 1.0, 0.7, 0.9] as FlightVector,
        },
        {
          features: createMockFlight({
            flightId: 'flight-2',
            airline: { code: 'KL', name: 'KLM', rating: 4.4, alliance: AirlineAlliance.SKYTEAM, isLowCost: false },
            flightClass: FlightClass.BUSINESS,
          }),
          vector: [0.7, 0.85, 0.8, 0.85, 0.5, 0.95, 0.7, 0.85] as FlightVector, // Very similar to flight-1
        },
        {
          features: createMockFlight({
            flightId: 'flight-3',
            airline: { code: 'UA', name: 'United', rating: 3.8, alliance: AirlineAlliance.STAR_ALLIANCE, isLowCost: false },
            flightClass: FlightClass.PREMIUM_ECONOMY,
          }),
          vector: [0.6, 0.7, 0.5, 0.6, 0.6, 0.8, 0.6, 0.7] as FlightVector, // Different
        },
      ];

      const scored = await scorer.scoreFlights(userVector, 'LUXURY_TRAVELER', flights, undefined, 3);

      // Should include both alliances and cabin classes for diversity
      const alliances = scored.map(s => s.flight.airline.alliance);
      expect(new Set(alliances).size).toBeGreaterThan(1); // More than one alliance
    });

    it('should score amenities-rich flights higher in quality', async () => {
      const userVector = [0.5, 0.5, 0.7, 0.5, 0.5, 0.5, 0.5, 0.8];
      const userSegment = 'BUSINESS_TRAVELER';

      const flights = [
        {
          features: createMockFlight({
            amenities: {
              wifi: true,
              power: true,
              entertainment: true,
              meals: 2,
              baggage: { cabin: { allowed: true, quantity: 2 }, checked: { quantity: 2 } },
            },
          }),
          vector: [0.5, 0.5, 0.7, 0.5, 0.5, 0.5, 0.5, 0.8] as FlightVector,
        },
        {
          features: createMockFlight({
            amenities: {
              wifi: false,
              power: false,
              entertainment: false,
              meals: 0,
              baggage: { cabin: { allowed: true, quantity: 1 }, checked: { quantity: 1 } },
            },
          }),
          vector: [0.5, 0.5, 0.7, 0.5, 0.5, 0.5, 0.5, 0.8] as FlightVector,
        },
      ];

      const scored = await scorer.scoreFlights(userVector, userSegment, flights);

      expect(scored[0].breakdown.qualityScore).toBeGreaterThan(scored[1].breakdown.qualityScore);
    });

    it('should prioritize direct flights for business travelers', async () => {
      const userVector = [0.5, 0.6, 0.7, 0.2, 0.3, 0.9, 0.5, 0.8]; // Prefers direct flights
      const userSegment = 'BUSINESS_TRAVELER';

      const tripContext: TripContext = {
        tripPurpose: 'BUSINESS',
        preferDirectFlights: true,
      };

      const flights = [
        {
          features: createMockFlight({
            flightType: FlightType.DIRECT,
            numberOfStops: 0,
            duration: { total: 480, flight: 480, layover: 0 },
          }),
          vector: [0.5, 0.6, 0.7, 0.9, 0.3, 0.9, 0.5, 0.8] as FlightVector,
        },
        {
          features: createMockFlight({
            flightType: FlightType.ONE_STOP,
            numberOfStops: 1,
            duration: { total: 600, flight: 480, layover: 120 },
          }),
          vector: [0.5, 0.6, 0.6, 0.6, 0.3, 0.9, 0.5, 0.8] as FlightVector,
        },
      ];

      const scored = await scorer.scoreFlights(userVector, userSegment, flights, tripContext);

      expect(scored[0].flight.flightType).toBe(FlightType.DIRECT);
      expect(scored[0].breakdown.contextualScore).toBeGreaterThan(scored[1].breakdown.contextualScore);
    });
  });

  describe('reason generation', () => {
    it('should generate meaningful reasons', async () => {
      const userVector = [0.7, 0.8, 0.7, 0.3, 0.6, 0.9, 0.7, 0.8];

      const flights = [
        {
          features: createMockFlight({
            flightClass: FlightClass.BUSINESS,
            flightType: FlightType.DIRECT,
            airline: { code: 'SQ', name: 'Singapore Airlines', rating: 5.0, alliance: AirlineAlliance.STAR_ALLIANCE, isLowCost: false },
            popularity: { airlineRating: 5.0, onTimePerformance: 0.92, routePopularity: 0.9, reviewCount: 800 },
            amenities: { wifi: true, power: true, entertainment: true, meals: 2 },
            bookingInfo: { refundable: true, changeable: true },
          }),
          vector: [0.7, 0.8, 0.8, 0.9, 0.6, 0.9, 0.7, 0.95] as FlightVector,
        },
      ];

      const scored = await scorer.scoreFlights(
        userVector,
        'LUXURY_TRAVELER',
        flights,
        { tripPurpose: 'LEISURE', budgetPerPerson: 2000 }
      );

      expect(scored[0].reasons.length).toBeGreaterThan(0);
      expect(scored[0].reasons.some(r =>
        r.includes('airline') || r.includes('performance') || r.includes('Non-stop') || r.includes('amenities')
      )).toBe(true);
    });
  });

  describe('configuration', () => {
    it('should validate configuration', () => {
      const validConfig = {
        weights: {
          similarity: 0.45,
          popularity: 0.25,
          quality: 0.2,
          contextual: 0.1,
        },
        popularityWeights: { airlineRating: 0.4, routePopularity: 0.3, onTimePerformance: 0.2, reviewCount: 0.1 },
        qualityWeights: { onTimePerformance: 0.3, amenities: 0.25, baggage: 0.2, flexibility: 0.15, comfort: 0.1 },
        contextualWeights: { timingPreference: 0.4, durationFit: 0.3, priceFit: 0.3 },
        applySegmentBoost: true,
        diversityLambda: 0.6,
        applyDiversification: true,
        minSimilarityThreshold: 0.2,
        minQualityScore: 0.25,
      };

      const result = FlightScoringService.validateConfig(validConfig);
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
        popularityWeights: { airlineRating: 0.4, routePopularity: 0.3, onTimePerformance: 0.2, reviewCount: 0.1 },
        qualityWeights: { onTimePerformance: 0.3, amenities: 0.25, baggage: 0.2, flexibility: 0.15, comfort: 0.1 },
        contextualWeights: { timingPreference: 0.4, durationFit: 0.3, priceFit: 0.3 },
        applySegmentBoost: true,
        diversityLambda: 1.5, // Invalid: > 1.0
        applyDiversification: true,
        minSimilarityThreshold: 0.2,
        minQualityScore: 0.25,
      };

      const result = FlightScoringService.validateConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should allow custom configuration', () => {
      const customScorer = new FlightScoringService({
        weights: {
          similarity: 0.5,
          popularity: 0.3,
          quality: 0.15,
          contextual: 0.05,
        },
      });

      const config = customScorer.getConfig();
      expect(config.weights.similarity).toBe(0.5);
    });
  });
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function createMockFlight(overrides: Partial<FlightFeatures> = {}): FlightFeatures {
  return {
    flightId: overrides.flightId || 'test-flight-123',
    offerReference: overrides.offerReference || 'offer-ref-123',

    airline: overrides.airline || {
      code: 'AF',
      name: 'Air France',
      alliance: AirlineAlliance.SKYTEAM,
      rating: 4.3,
      isLowCost: false,
    },

    route: overrides.route || {
      origin: {
        airportCode: 'CDG',
        airportName: 'Charles de Gaulle',
        cityCode: 'PAR',
        cityName: 'Paris',
        countryCode: 'FR',
      },
      destination: {
        airportCode: 'JFK',
        airportName: 'John F Kennedy',
        cityCode: 'NYC',
        cityName: 'New York',
        countryCode: 'US',
      },
      distance: 5850,
    },

    flightClass: overrides.flightClass || FlightClass.ECONOMY,
    flightType: overrides.flightType || FlightType.DIRECT,
    numberOfStops: overrides.numberOfStops !== undefined ? overrides.numberOfStops : 0,

    segments: overrides.segments || [
      {
        departure: { airportCode: 'CDG', dateTime: '2025-06-15T10:00:00' },
        arrival: { airportCode: 'JFK', dateTime: '2025-06-15T12:30:00' },
        airline: 'AF',
        flightNumber: 'AF006',
        duration: 'PT8H30M',
      },
    ],

    duration: overrides.duration || {
      total: 510,
      flight: 510,
      layover: 0,
    },

    schedule: overrides.schedule || {
      departureTime: '2025-06-15T10:00:00',
      arrivalTime: '2025-06-15T12:30:00',
      isOvernight: false,
      isRedEye: false,
      timeOfDay: 'MORNING',
    },

    price: overrides.price || {
      amount: 450,
      currency: 'EUR',
      perPerson: true,
      taxesIncluded: true,
      fareType: 'PUBLISHED',
    },

    amenities: overrides.amenities || {
      wifi: false,
      power: false,
      entertainment: true,
      meals: 1,
      baggage: {
        cabin: { allowed: true, quantity: 1, weight: 10 },
        checked: { quantity: 1, weight: 23 },
      },
    },

    bookingInfo: overrides.bookingInfo || {
      seatsAvailable: 9,
      instantTicketing: false,
      refundable: false,
      changeable: true,
    },

    popularity: overrides.popularity || {
      routePopularity: 0.8,
      airlineRating: 4.3,
      onTimePerformance: 0.85,
      reviewCount: 0,
    },

    metadata: overrides.metadata || {},
  };
}
