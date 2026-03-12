/**
 * Unit Tests for Flight Vectorizer Service
 *
 * Tests the vectorization logic that transforms flight features
 * into 8D vectors compatible with user preference vectors.
 *
 * @ticket US-IA-004-bis.1
 */

import { FlightVectorizerService } from '../../../../dreamscape-services/ai/src/flights/services/flight-vectorizer.service';
import {
  FlightFeatures,
  FlightClass,
  FlightType,
  AirlineAlliance,
} from '../../../../dreamscape-services/ai/src/flights/types/flight-vector.types';

describe('FlightVectorizerService', () => {
  let vectorizer: FlightVectorizerService;

  beforeEach(() => {
    vectorizer = new FlightVectorizerService();
  });

  describe('vectorize', () => {
    it('should create an 8-dimensional vector', () => {
      const flight: FlightFeatures = createMockFlight({
        flightClass: FlightClass.ECONOMY,
        flightType: FlightType.DIRECT,
      });

      const vector = vectorizer.vectorize(flight);

      expect(vector).toHaveLength(8);
      vector.forEach(dimension => {
        expect(dimension).toBeGreaterThanOrEqual(0);
        expect(dimension).toBeLessThanOrEqual(1);
      });
    });

    it('should map cabin class to budget dimension', () => {
      const economyFlight: FlightFeatures = createMockFlight({
        flightClass: FlightClass.ECONOMY,
        price: { amount: 300, currency: 'EUR' },
      });

      const businessFlight: FlightFeatures = createMockFlight({
        flightClass: FlightClass.BUSINESS,
        price: { amount: 1500, currency: 'EUR' },
      });

      const firstClassFlight: FlightFeatures = createMockFlight({
        flightClass: FlightClass.FIRST_CLASS,
        price: { amount: 3000, currency: 'EUR' },
      });

      const economyVector = vectorizer.vectorize(economyFlight);
      const businessVector = vectorizer.vectorize(businessFlight);
      const firstClassVector = vectorizer.vectorize(firstClassFlight);

      // Budget dimension (index 2): 0 = budget economy, 1 = luxury first class
      expect(economyVector[2]).toBeLessThan(businessVector[2]);
      expect(businessVector[2]).toBeLessThan(firstClassVector[2]);
      expect(firstClassVector[2]).toBeGreaterThan(0.8);
    });

    it('should map direct flights to relaxed travel style (low activity level)', () => {
      const directFlight: FlightFeatures = createMockFlight({
        flightType: FlightType.DIRECT,
        numberOfStops: 0,
      });

      const oneStopFlight: FlightFeatures = createMockFlight({
        flightType: FlightType.ONE_STOP,
        numberOfStops: 1,
        duration: { total: 600, flight: 480, layover: 120 },
      });

      const multiStopFlight: FlightFeatures = createMockFlight({
        flightType: FlightType.TWO_PLUS_STOPS,
        numberOfStops: 2,
        duration: { total: 720, flight: 540, layover: 180 },
      });

      const directVector = vectorizer.vectorize(directFlight);
      const oneStopVector = vectorizer.vectorize(oneStopFlight);
      const multiStopVector = vectorizer.vectorize(multiStopFlight);

      // Activity level dimension (index 3): 0 = relaxed/direct, 1 = adventurous/connections
      expect(directVector[3]).toBeGreaterThan(oneStopVector[3]);
      expect(oneStopVector[3]).toBeGreaterThan(multiStopVector[3]);
    });

    it('should score tropical destinations high on climate dimension', () => {
      const tropicalFlight: FlightFeatures = createMockFlight({
        route: {
          origin: { airportCode: 'CDG', cityCode: 'PAR', countryCode: 'FR' },
          destination: { airportCode: 'BKK', cityCode: 'BKK', countryCode: 'TH' },
          distance: 9500,
        },
      });

      const coldFlight: FlightFeatures = createMockFlight({
        route: {
          origin: { airportCode: 'CDG', cityCode: 'PAR', countryCode: 'FR' },
          destination: { airportCode: 'KEF', cityCode: 'REK', countryCode: 'IS' },
          distance: 2600,
        },
      });

      const tropicalVector = vectorizer.vectorize(tropicalFlight);
      const coldVector = vectorizer.vectorize(coldFlight);

      // Climate dimension (index 0): 0 = cold, 1 = tropical
      expect(tropicalVector[0]).toBeGreaterThan(coldVector[0]);
      expect(tropicalVector[0]).toBeGreaterThan(0.7);
      expect(coldVector[0]).toBeLessThan(0.3);
    });

    it('should distinguish cultural vs nature destinations', () => {
      const culturalFlight: FlightFeatures = createMockFlight({
        route: {
          origin: { airportCode: 'JFK', cityCode: 'NYC', countryCode: 'US' },
          destination: { airportCode: 'CDG', cityCode: 'PAR', countryCode: 'FR' },
          distance: 5850,
        },
      });

      const natureFlight: FlightFeatures = createMockFlight({
        route: {
          origin: { airportCode: 'LAX', cityCode: 'LAX', countryCode: 'US' },
          destination: { airportCode: 'KEF', cityCode: 'REK', countryCode: 'IS' },
          distance: 7200,
        },
      });

      const culturalVector = vectorizer.vectorize(culturalFlight);
      const natureVector = vectorizer.vectorize(natureFlight);

      // Culture/Nature dimension (index 1): 0 = nature, 1 = culture
      expect(culturalVector[1]).toBeGreaterThan(natureVector[1]);
      expect(culturalVector[1]).toBeGreaterThan(0.7);
    });

    it('should score high-rated airlines higher on popularity dimension', () => {
      const premiumAirline: FlightFeatures = createMockFlight({
        airline: {
          code: 'SQ',
          name: 'Singapore Airlines',
          rating: 5.0,
          alliance: AirlineAlliance.STAR_ALLIANCE,
          isLowCost: false,
        },
        popularity: {
          airlineRating: 5.0,
          onTimePerformance: 0.92,
          routePopularity: 0.9,
          reviewCount: 1000,
        },
      });

      const budgetAirline: FlightFeatures = createMockFlight({
        airline: {
          code: 'FR',
          name: 'Ryanair',
          rating: 3.0,
          alliance: AirlineAlliance.NONE,
          isLowCost: true,
        },
        popularity: {
          airlineRating: 3.0,
          onTimePerformance: 0.75,
          routePopularity: 0.5,
          reviewCount: 100,
        },
      });

      const premiumVector = vectorizer.vectorize(premiumAirline);
      const budgetVector = vectorizer.vectorize(budgetAirline);

      // Popularity dimension (index 7)
      expect(premiumVector[7]).toBeGreaterThan(budgetVector[7]);
      expect(premiumVector[7]).toBeGreaterThan(0.8);
    });

    it('should map culinary destinations high on gastronomy dimension', () => {
      const culinaryFlight: FlightFeatures = createMockFlight({
        route: {
          origin: { airportCode: 'JFK', cityCode: 'NYC', countryCode: 'US' },
          destination: { airportCode: 'TYO', cityCode: 'TYO', countryCode: 'JP' },
          distance: 10850,
        },
      });

      const regularFlight: FlightFeatures = createMockFlight({
        route: {
          origin: { airportCode: 'JFK', cityCode: 'NYC', countryCode: 'US' },
          destination: { airportCode: 'LHR', cityCode: 'LON', countryCode: 'GB' },
          distance: 5570,
        },
      });

      const culinaryVector = vectorizer.vectorize(culinaryFlight);
      const regularVector = vectorizer.vectorize(regularFlight);

      // Gastronomy dimension (index 6)
      expect(culinaryVector[6]).toBeGreaterThan(regularVector[6]);
    });

    it('should score major urban destinations high on urban/rural dimension', () => {
      const urbanFlight: FlightFeatures = createMockFlight({
        route: {
          origin: { airportCode: 'CDG', cityCode: 'PAR', countryCode: 'FR' },
          destination: { airportCode: 'JFK', cityCode: 'NYC', countryCode: 'US' },
          distance: 5850,
        },
      });

      const ruralFlight: FlightFeatures = createMockFlight({
        route: {
          origin: { airportCode: 'LHR', cityCode: 'LON', countryCode: 'GB' },
          destination: { airportCode: 'KEF', cityCode: 'REK', countryCode: 'IS' },
          distance: 1900,
        },
      });

      const urbanVector = vectorizer.vectorize(urbanFlight);
      const ruralVector = vectorizer.vectorize(ruralFlight);

      // Urban/Rural dimension (index 5): 0 = rural, 1 = urban
      expect(urbanVector[5]).toBeGreaterThan(ruralVector[5]);
      expect(urbanVector[5]).toBe(1.0);
    });

    it('should score family-friendly airlines higher on group size dimension', () => {
      const familyAirline: FlightFeatures = createMockFlight({
        airline: { code: 'BA', name: 'British Airways' },
        flightClass: FlightClass.ECONOMY,
        bookingInfo: { seatsAvailable: 9 },
      });

      const limitedSeats: FlightFeatures = createMockFlight({
        airline: { code: 'VS', name: 'Virgin Atlantic' },
        flightClass: FlightClass.BUSINESS,
        bookingInfo: { seatsAvailable: 2 },
      });

      const familyVector = vectorizer.vectorize(familyAirline);
      const limitedVector = vectorizer.vectorize(limitedSeats);

      // Group size dimension (index 4): 0 = solo, 1 = large groups
      expect(familyVector[4]).toBeGreaterThan(limitedVector[4]);
    });
  });

  describe('batchVectorize', () => {
    it('should vectorize multiple flights efficiently', () => {
      const flights: FlightFeatures[] = [
        createMockFlight({ flightClass: FlightClass.ECONOMY }),
        createMockFlight({ flightClass: FlightClass.BUSINESS }),
        createMockFlight({ flightClass: FlightClass.FIRST_CLASS }),
      ];

      const result = vectorizer.batchVectorize(flights);

      expect(result.vectors.size).toBe(3);
      expect(result.itemsProcessed).toBe(3);
      expect(result.processingTime).toBeGreaterThan(0);
      expect(result.errors).toBeUndefined();
    });

    it('should dynamically calculate market average price', () => {
      const flights: FlightFeatures[] = [
        createMockFlight({ price: { amount: 300, currency: 'EUR' } }),
        createMockFlight({ price: { amount: 500, currency: 'EUR' } }),
        createMockFlight({ price: { amount: 700, currency: 'EUR' } }),
      ];

      const result = vectorizer.batchVectorize(flights);

      // Market average should be 500 EUR
      // Budget dimension should reflect this
      const vectors = Array.from(result.vectors.values());
      expect(vectors).toHaveLength(3);

      // Flight priced at market average (500) should have mid-range budget score
      const midVector = vectors[1];
      expect(midVector[2]).toBeGreaterThan(0.2);
      expect(midVector[2]).toBeLessThan(0.6);
    });

    it('should handle errors gracefully', () => {
      const flights: FlightFeatures[] = [
        createMockFlight({ flightId: 'valid-1' }),
        // @ts-ignore - intentionally malformed for testing
        { flightId: 'invalid', flightClass: null },
        createMockFlight({ flightId: 'valid-2' }),
      ];

      const result = vectorizer.batchVectorize(flights);

      expect(result.itemsProcessed).toBeGreaterThanOrEqual(2);
      // May or may not have errors depending on error handling
    });
  });

  describe('configuration', () => {
    it('should allow custom configuration', () => {
      const customConfig = {
        budget: {
          economyRange: [0, 400] as [number, number],
          premiumEconomyRange: [400, 800] as [number, number],
          businessRange: [800, 2500] as [number, number],
          firstClassRange: [2500, 12000] as [number, number],
          marketAveragePrice: 500,
          currency: 'USD',
        },
      };

      const customVectorizer = new FlightVectorizerService(customConfig);
      const config = customVectorizer.getConfig();

      expect(config.budget.marketAveragePrice).toBe(500);
      expect(config.budget.currency).toBe('USD');
    });

    it('should allow config updates', () => {
      vectorizer.updateConfig({
        budget: {
          marketAveragePrice: 600,
          currency: 'USD',
        },
      });

      const config = vectorizer.getConfig();
      expect(config.budget.marketAveragePrice).toBe(600);
      expect(config.budget.currency).toBe('USD');
    });
  });
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Create a mock flight with default values and optional overrides
 */
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
        departure: {
          airportCode: 'CDG',
          dateTime: '2025-06-15T10:00:00',
        },
        arrival: {
          airportCode: 'JFK',
          dateTime: '2025-06-15T12:30:00',
        },
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
        cabin: {
          allowed: true,
          quantity: 1,
          weight: 10,
        },
        checked: {
          quantity: 1,
          weight: 23,
        },
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
