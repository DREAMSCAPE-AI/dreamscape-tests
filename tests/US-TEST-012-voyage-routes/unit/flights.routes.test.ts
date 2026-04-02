/**
 * US-TEST-012 — Tests unitaires routes/flights.ts
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';

// ── Mocks ─────────────────────────────────────────────────────────────────────
const mockSearchFlights       = jest.fn();
const mockResolveLocationCode = jest.fn();
const mockSearchDestinations  = jest.fn();

jest.mock('@/services/AmadeusService', () => ({
  __esModule: true,
  default: {
    searchFlights:        mockSearchFlights,
    resolveLocationCode:  mockResolveLocationCode,
    searchFlightDestinations: mockSearchDestinations,
    searchFlightPriceMetrics: jest.fn(),
    predictFlightChoice:  jest.fn(),
    getFlightStatus:      jest.fn(),
    predictFlightDelay:   jest.fn(),
    getMostTraveledDestinations: jest.fn(),
    getMostBookedDestinations:   jest.fn(),
    getBusiestTravelingPeriod:   jest.fn(),
    getFlightCheckInLinks:       jest.fn(),
    getSeatMap:                  jest.fn(),
    searchCheapestFlightDates:   jest.fn(),
    searchFlightAvailabilities:  jest.fn(),
    getFlightOrder:              jest.fn(),
    deleteFlightOrder:           jest.fn(),
  },
}));

jest.mock('@/mappers/FlightOfferMapper', () => ({
  __esModule: true,
  FlightOfferMapper: {
    mapToDTOs:          jest.fn((d: any) => d || []),
    mapToSimplifiedList: jest.fn((d: any) => d || []),
  },
}));

jest.mock('@/services/KafkaService', () => ({
  __esModule: true,
  default: { publishSearchPerformed: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock('@/config/environment', () => ({
  config: { amadeus: { baseUrl: 'https://test.api.amadeus.com', apiKey: 'k', apiSecret: 's' } },
}));

jest.mock('@/services/CacheService', () => ({
  __esModule: true,
  default: { cacheWrapper: jest.fn((_t: any, _p: any, fn: any) => fn()) },
}));

// ── App setup ─────────────────────────────────────────────────────────────────
import flightsRouter from '@/routes/flights';

const app = express();
app.use(express.json());
app.use('/flights', flightsRouter);

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('Flights Routes — US-TEST-012', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolveLocationCode.mockImplementation(async (code: any) => code);
  });

  describe('GET /flights/search', () => {
    it('should return 200 with valid params', async () => {
      mockSearchFlights.mockResolvedValue({ data: [] } as never);

      const res = await request(app)
        .get('/flights/search')
        .query({
          originLocationCode:      'CDG',
          destinationLocationCode: 'LHR',
          departureDate:           '2026-06-01',
          adults:                  '1',
        });

      expect(res.status).toBe(200);
    });

    it('should return 400 when required params are missing', async () => {
      const res = await request(app)
        .get('/flights/search')
        .query({ originLocationCode: 'CDG' }); // missing destination + date

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should return 400 when all required params are absent', async () => {
      const res = await request(app).get('/flights/search');
      expect(res.status).toBe(400);
    });

    it('should return 500 when AmadeusService throws', async () => {
      mockSearchFlights.mockRejectedValue(new Error('API down') as never);

      const res = await request(app)
        .get('/flights/search')
        .query({
          originLocationCode:      'CDG',
          destinationLocationCode: 'LHR',
          departureDate:           '2026-06-01',
        });

      expect(res.status).toBe(500);
    });
  });
});
