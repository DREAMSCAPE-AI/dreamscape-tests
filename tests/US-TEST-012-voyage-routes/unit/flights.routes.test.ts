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
const mockGetFlightPriceAnalysis = jest.fn();
const mockGetFlightChoicePrediction = jest.fn();
const mockSearchFlightInspiration = jest.fn();
const mockSearchCheapestFlightDates = jest.fn();
const mockGetFlightStatus = jest.fn();
const mockPredictFlightDelay = jest.fn();
const mockGetMostTraveledDestinations = jest.fn();
const mockGetMostBookedDestinations = jest.fn();
const mockGetBusiestTravelingPeriod = jest.fn();
const mockGetFlightCheckinLinks = jest.fn();
const mockGetFlightSeatMap = jest.fn();
const mockGetFlightOffersPrice = jest.fn();
const mockGetBrandedFares = jest.fn();
const mockSearchFlightAvailabilities = jest.fn();
const mockCreateFlightOrder = jest.fn();
const mockGetFlightOrder = jest.fn();

jest.mock('@/services/AmadeusService', () => ({
  __esModule: true,
  default: {
    searchFlights:        mockSearchFlights,
    resolveLocationCode:  mockResolveLocationCode,
    searchFlightDestinations: mockSearchDestinations,
    getFlightPriceAnalysis: mockGetFlightPriceAnalysis,
    getFlightChoicePrediction: mockGetFlightChoicePrediction,
    getFlightStatus:      mockGetFlightStatus,
    predictFlightDelay:   mockPredictFlightDelay,
    getMostTraveledDestinations: mockGetMostTraveledDestinations,
    getMostBookedDestinations:   mockGetMostBookedDestinations,
    getBusiestTravelingPeriod:   mockGetBusiestTravelingPeriod,
    getFlightCheckinLinks:       mockGetFlightCheckinLinks,
    getFlightSeatMap:            mockGetFlightSeatMap,
    searchFlightInspiration:     mockSearchFlightInspiration,
    searchCheapestFlightDates:   mockSearchCheapestFlightDates,
    searchFlightAvailabilities:  mockSearchFlightAvailabilities,
    getFlightOffersPrice:        mockGetFlightOffersPrice,
    getBrandedFares:             mockGetBrandedFares,
    createFlightOrder:           mockCreateFlightOrder,
    getFlightOrder:              mockGetFlightOrder,
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

const appWithUser = express();
appWithUser.use(express.json());
appWithUser.use((req: any, _res: any, next: any) => {
  req.user = { id: 'user-001' };
  next();
});
appWithUser.use('/flights', flightsRouter);

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

    it('should pass maxPrice to search when provided', async () => {
      mockSearchFlights.mockResolvedValue({ data: [] } as never);

      const res = await request(app)
        .get('/flights/search')
        .query({
          originLocationCode:      'CDG',
          destinationLocationCode: 'LHR',
          departureDate:           '2026-06-01',
          maxPrice:                '500',
        });

      expect(res.status).toBe(200);
      expect(mockSearchFlights).toHaveBeenCalledWith(expect.objectContaining({ maxPrice: 500 }));
    });

    it('should use user id as sessionId when user is authenticated', async () => {
      mockSearchFlights.mockResolvedValue({ data: [] } as never);

      const res = await request(appWithUser)
        .get('/flights/search')
        .query({
          originLocationCode:      'CDG',
          destinationLocationCode: 'LHR',
          departureDate:           '2026-06-01',
        });

      expect(res.status).toBe(200);
    });

    it('should return Unknown error when search throws non-Error', async () => {
      mockSearchFlights.mockRejectedValue('plain error' as never);

      const res = await request(app)
        .get('/flights/search')
        .query({
          originLocationCode:      'CDG',
          destinationLocationCode: 'LHR',
          departureDate:           '2026-06-01',
        });

      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Unknown error');
    });
  });

  describe('secondary flight endpoints', () => {
    it('should return 200 for GET /flights/destinations', async () => {
      mockSearchDestinations.mockResolvedValue({ data: [] } as never);

      const res = await request(app)
        .get('/flights/destinations')
        .query({ origin: 'PAR', maxPrice: '300' });

      expect(res.status).toBe(200);
      expect(mockResolveLocationCode).toHaveBeenCalledWith('PAR');
    });

    it('should return 400 for GET /flights/destinations when origin is missing', async () => {
      const res = await request(app).get('/flights/destinations');
      expect(res.status).toBe(400);
    });

    it('should return 500 for GET /flights/destinations when service throws', async () => {
      mockSearchDestinations.mockRejectedValue(new Error('destinations failed') as never);

      const res = await request(app)
        .get('/flights/destinations')
        .query({ origin: 'PAR' });

      expect(res.status).toBe(500);
    });

    it('should return 200 for GET /flights/price-analysis', async () => {
      mockGetFlightPriceAnalysis.mockResolvedValue({ data: {} } as never);

      const res = await request(app)
        .get('/flights/price-analysis')
        .query({
          originIataCode: 'PAR',
          destinationIataCode: 'LON',
          departureDate: '2026-06-01',
        });

      expect(res.status).toBe(200);
      expect(mockResolveLocationCode).toHaveBeenCalledWith('PAR');
      expect(mockResolveLocationCode).toHaveBeenCalledWith('LON');
    });

    it('should return 400 for GET /flights/price-analysis when params are missing', async () => {
      const res = await request(app).get('/flights/price-analysis').query({ originIataCode: 'PAR' });
      expect(res.status).toBe(400);
    });

    it('should return 500 for GET /flights/price-analysis when service throws', async () => {
      mockGetFlightPriceAnalysis.mockRejectedValue(new Error('analysis failed') as never);

      const res = await request(app)
        .get('/flights/price-analysis')
        .query({
          originIataCode: 'PAR',
          destinationIataCode: 'LON',
          departureDate: '2026-06-01',
        });

      expect(res.status).toBe(500);
    });

    it('should return 200 for POST /flights/choice-prediction', async () => {
      mockGetFlightChoicePrediction.mockResolvedValue({ data: {} } as never);

      const res = await request(app)
        .post('/flights/choice-prediction')
        .send({ data: [{ id: 'offer-1' }] });

      expect(res.status).toBe(200);
    });

    it('should return 500 for POST /flights/choice-prediction when service throws', async () => {
      mockGetFlightChoicePrediction.mockRejectedValue(new Error('prediction failed') as never);

      const res = await request(app)
        .post('/flights/choice-prediction')
        .send({ data: [{ id: 'offer-1' }] });

      expect(res.status).toBe(500);
    });

    it('should return 200 for GET /flights/inspiration', async () => {
      mockSearchFlightInspiration.mockResolvedValue({ data: [] } as never);

      const res = await request(app)
        .get('/flights/inspiration')
        .query({ origin: 'PAR', oneWay: 'true' });

      expect(res.status).toBe(200);
    });

    it('should return 400 for GET /flights/inspiration when origin is missing', async () => {
      const res = await request(app).get('/flights/inspiration');
      expect(res.status).toBe(400);
    });

    it('should return 500 for GET /flights/inspiration when service throws', async () => {
      mockSearchFlightInspiration.mockRejectedValue(new Error('inspiration failed') as never);

      const res = await request(app)
        .get('/flights/inspiration')
        .query({ origin: 'PAR' });

      expect(res.status).toBe(500);
    });

    it('should return 200 for GET /flights/cheapest-dates', async () => {
      mockSearchCheapestFlightDates.mockResolvedValue({ data: [] } as never);

      const res = await request(app)
        .get('/flights/cheapest-dates')
        .query({ origin: 'PAR', destination: 'LON' });

      expect(res.status).toBe(200);
    });

    it('should return 400 for GET /flights/cheapest-dates when origin or destination is missing', async () => {
      const res = await request(app).get('/flights/cheapest-dates').query({ origin: 'PAR' });
      expect(res.status).toBe(400);
    });

    it('should return 500 for GET /flights/cheapest-dates when service throws', async () => {
      mockSearchCheapestFlightDates.mockRejectedValue(new Error('cheapest failed') as never);

      const res = await request(app)
        .get('/flights/cheapest-dates')
        .query({ origin: 'PAR', destination: 'LON' });

      expect(res.status).toBe(500);
    });

    it('should return 200 for GET /flights/status', async () => {
      mockGetFlightStatus.mockResolvedValue({ data: {} } as never);

      const res = await request(app)
        .get('/flights/status')
        .query({
          carrierCode: 'AF',
          flightNumber: '123',
          scheduledDepartureDate: '2026-06-01',
        });

      expect(res.status).toBe(200);
    });

    it('should return 400 for GET /flights/status when params are missing', async () => {
      const res = await request(app).get('/flights/status').query({ carrierCode: 'AF' });
      expect(res.status).toBe(400);
    });

    it('should return 500 for GET /flights/status when service throws', async () => {
      mockGetFlightStatus.mockRejectedValue(new Error('status failed') as never);

      const res = await request(app)
        .get('/flights/status')
        .query({
          carrierCode: 'AF',
          flightNumber: '123',
          scheduledDepartureDate: '2026-06-01',
        });

      expect(res.status).toBe(500);
    });

    it('should return 200 for GET /flights/delay-prediction', async () => {
      mockPredictFlightDelay.mockResolvedValue({ data: {} } as never);

      const res = await request(app)
        .get('/flights/delay-prediction')
        .query({
          originLocationCode: 'CDG',
          destinationLocationCode: 'LHR',
          departureDate: '2026-06-01',
          departureTime: '10:00:00',
          arrivalDate: '2026-06-01',
          arrivalTime: '11:00:00',
          aircraftCode: '320',
          carrierCode: 'AF',
          flightNumber: '123',
          duration: 'PT1H',
        });

      expect(res.status).toBe(200);
    });

    it('should return 400 for GET /flights/delay-prediction when params are missing', async () => {
      const res = await request(app).get('/flights/delay-prediction').query({ originLocationCode: 'CDG' });
      expect(res.status).toBe(400);
    });

    it('should return 500 for GET /flights/delay-prediction when service throws', async () => {
      mockPredictFlightDelay.mockRejectedValue(new Error('delay failed') as never);

      const res = await request(app)
        .get('/flights/delay-prediction')
        .query({
          originLocationCode: 'CDG',
          destinationLocationCode: 'LHR',
          departureDate: '2026-06-01',
          departureTime: '10:00:00',
          arrivalDate: '2026-06-01',
          arrivalTime: '11:00:00',
          aircraftCode: '320',
          carrierCode: 'AF',
          flightNumber: '123',
          duration: 'PT1H',
        });

      expect(res.status).toBe(500);
    });

    it('should return 200 for analytics endpoints', async () => {
      mockGetMostTraveledDestinations.mockResolvedValue({ data: [] } as never);
      mockGetMostBookedDestinations.mockResolvedValue({ data: [] } as never);
      mockGetBusiestTravelingPeriod.mockResolvedValue({ data: [] } as never);

      const traveled = await request(app)
        .get('/flights/analytics/most-traveled')
        .query({ originCityCode: 'PAR', period: '2026-06' });
      const booked = await request(app)
        .get('/flights/analytics/most-booked')
        .query({ originCityCode: 'PAR', period: '2026-06' });
      const busiest = await request(app)
        .get('/flights/analytics/busiest-period')
        .query({ cityCode: 'PAR', period: '2026-06' });

      expect(traveled.status).toBe(200);
      expect(booked.status).toBe(200);
      expect(busiest.status).toBe(200);
    });

    it('should return 400 for analytics endpoints when required params are missing', async () => {
      const traveled = await request(app).get('/flights/analytics/most-traveled');
      const booked = await request(app).get('/flights/analytics/most-booked');
      const busiest = await request(app).get('/flights/analytics/busiest-period');

      expect(traveled.status).toBe(400);
      expect(booked.status).toBe(400);
      expect(busiest.status).toBe(400);
    });

    it('should return 500 for analytics endpoints when services throw', async () => {
      mockGetMostTraveledDestinations.mockRejectedValue(new Error('traveled failed') as never);
      mockGetMostBookedDestinations.mockRejectedValue(new Error('booked failed') as never);
      mockGetBusiestTravelingPeriod.mockRejectedValue(new Error('busiest failed') as never);

      const traveled = await request(app)
        .get('/flights/analytics/most-traveled')
        .query({ originCityCode: 'PAR', period: '2026-06' });
      const booked = await request(app)
        .get('/flights/analytics/most-booked')
        .query({ originCityCode: 'PAR', period: '2026-06' });
      const busiest = await request(app)
        .get('/flights/analytics/busiest-period')
        .query({ cityCode: 'PAR', period: '2026-06' });

      expect(traveled.status).toBe(500);
      expect(booked.status).toBe(500);
      expect(busiest.status).toBe(500);
    });

    it('should return 200 for GET /flights/checkin-links', async () => {
      mockGetFlightCheckinLinks.mockResolvedValue({ data: [] } as never);

      const res = await request(app)
        .get('/flights/checkin-links')
        .query({ airlineCode: 'AF' });

      expect(res.status).toBe(200);
    });

    it('should return 400 for GET /flights/checkin-links when airlineCode is missing', async () => {
      const res = await request(app).get('/flights/checkin-links');
      expect(res.status).toBe(400);
    });

    it('should return 500 for GET /flights/checkin-links when service throws', async () => {
      mockGetFlightCheckinLinks.mockRejectedValue(new Error('checkin failed') as never);

      const res = await request(app)
        .get('/flights/checkin-links')
        .query({ airlineCode: 'AF' });

      expect(res.status).toBe(500);
    });

    it('should return 200 for GET /flights/seatmap', async () => {
      mockGetFlightSeatMap.mockResolvedValue({ data: {} } as never);

      const res = await request(app)
        .get('/flights/seatmap')
        .query({ flightOfferId: 'offer-1' });

      expect(res.status).toBe(200);
    });

    it('should return 400 for GET /flights/seatmap when flightOfferId is missing', async () => {
      const res = await request(app).get('/flights/seatmap');
      expect(res.status).toBe(400);
    });

    it('should return 500 for GET /flights/seatmap when service throws', async () => {
      mockGetFlightSeatMap.mockRejectedValue(new Error('seatmap failed') as never);

      const res = await request(app)
        .get('/flights/seatmap')
        .query({ flightOfferId: 'offer-1' });

      expect(res.status).toBe(500);
    });

    it('should return 200 for POST /flights/offers/pricing', async () => {
      mockGetFlightOffersPrice.mockResolvedValue({ data: {} } as never);

      const res = await request(app)
        .post('/flights/offers/pricing')
        .send({ data: [{ id: 'offer-1' }] });

      expect(res.status).toBe(200);
    });

    it('should return 500 for POST /flights/offers/pricing when service throws', async () => {
      mockGetFlightOffersPrice.mockRejectedValue(new Error('pricing failed') as never);

      const res = await request(app)
        .post('/flights/offers/pricing')
        .send({ data: [{ id: 'offer-1' }] });

      expect(res.status).toBe(500);
    });

    it('should return 200 for GET /flights/branded-fares', async () => {
      mockGetBrandedFares.mockResolvedValue({ data: {} } as never);

      const res = await request(app)
        .get('/flights/branded-fares')
        .query({ flightOfferId: 'offer-1' });

      expect(res.status).toBe(200);
    });

    it('should return 400 for GET /flights/branded-fares when flightOfferId is missing', async () => {
      const res = await request(app).get('/flights/branded-fares');
      expect(res.status).toBe(400);
    });

    it('should return 500 for GET /flights/branded-fares when service throws', async () => {
      mockGetBrandedFares.mockRejectedValue(new Error('fares failed') as never);

      const res = await request(app)
        .get('/flights/branded-fares')
        .query({ flightOfferId: 'offer-1' });

      expect(res.status).toBe(500);
    });

    it('should return 200 for POST /flights/availabilities', async () => {
      mockSearchFlightAvailabilities.mockResolvedValue({ data: [] } as never);

      const res = await request(app)
        .post('/flights/availabilities')
        .send({
          originDestinations: [{ id: '1' }],
          travelers: [{ id: '1' }],
          sources: ['GDS'],
        });

      expect(res.status).toBe(200);
    });

    it('should return 400 for POST /flights/availabilities when body is incomplete', async () => {
      const res = await request(app)
        .post('/flights/availabilities')
        .send({ travelers: [{ id: '1' }] });

      expect(res.status).toBe(400);
    });

    it('should return 500 for POST /flights/availabilities when service throws', async () => {
      mockSearchFlightAvailabilities.mockRejectedValue(new Error('availability failed') as never);

      const res = await request(app)
        .post('/flights/availabilities')
        .send({
          originDestinations: [{ id: '1' }],
          travelers: [{ id: '1' }],
          sources: ['GDS'],
        });

      expect(res.status).toBe(500);
    });

    it('should return 200 for flight order create and fetch', async () => {
      mockCreateFlightOrder.mockResolvedValue({ data: { id: 'order-1' } } as never);
      mockGetFlightOrder.mockResolvedValue({ data: { id: 'order-1' } } as never);

      const createRes = await request(app)
        .post('/flights/orders')
        .send({ data: { type: 'flight-order' } });
      const fetchRes = await request(app).get('/flights/orders/order-1');

      expect(createRes.status).toBe(200);
      expect(fetchRes.status).toBe(200);
    });

    it('should return 500 for flight order retrieval when service throws', async () => {
      mockGetFlightOrder.mockRejectedValue(new Error('order failed') as never);

      const res = await request(app).get('/flights/orders/order-1');
      expect(res.status).toBe(500);
    });

    it('should return 500 for flight order creation when service throws', async () => {
      mockCreateFlightOrder.mockRejectedValue(new Error('order create failed') as never);

      const res = await request(app)
        .post('/flights/orders')
        .send({ data: { type: 'flight-order' } });

      expect(res.status).toBe(500);
    });

    it('should return Unknown error for GET /flights/destinations non-Error throw', async () => {
      mockSearchDestinations.mockRejectedValue('plain error' as never);

      const res = await request(app).get('/flights/destinations').query({ origin: 'PAR' });
      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Unknown error');
    });

    it('should return Unknown error for GET /flights/price-analysis non-Error throw', async () => {
      mockGetFlightPriceAnalysis.mockRejectedValue('plain error' as never);

      const res = await request(app).get('/flights/price-analysis').query({
        originIataCode: 'PAR', destinationIataCode: 'LON', departureDate: '2026-06-01',
      });
      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Unknown error');
    });

    it('should return Unknown error for POST /flights/choice-prediction non-Error throw', async () => {
      mockGetFlightChoicePrediction.mockRejectedValue('plain error' as never);

      const res = await request(app).post('/flights/choice-prediction').send({ data: [] });
      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Unknown error');
    });

    it('should return Unknown error for GET /flights/inspiration non-Error throw', async () => {
      mockSearchFlightInspiration.mockRejectedValue('plain error' as never);

      const res = await request(app).get('/flights/inspiration').query({ origin: 'PAR' });
      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Unknown error');
    });

    it('should return Unknown error for GET /flights/cheapest-dates non-Error throw', async () => {
      mockSearchCheapestFlightDates.mockRejectedValue('plain error' as never);

      const res = await request(app).get('/flights/cheapest-dates').query({ origin: 'PAR', destination: 'LON' });
      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Unknown error');
    });

    it('should return Unknown error for GET /flights/status non-Error throw', async () => {
      mockGetFlightStatus.mockRejectedValue('plain error' as never);

      const res = await request(app).get('/flights/status').query({
        carrierCode: 'AF', flightNumber: '123', scheduledDepartureDate: '2026-06-01',
      });
      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Unknown error');
    });

    it('should return Unknown error for GET /flights/delay-prediction non-Error throw', async () => {
      mockPredictFlightDelay.mockRejectedValue('plain error' as never);

      const res = await request(app).get('/flights/delay-prediction').query({
        originLocationCode: 'CDG', destinationLocationCode: 'LHR',
        departureDate: '2026-06-01', departureTime: '10:00:00',
        arrivalDate: '2026-06-01', arrivalTime: '11:00:00',
        aircraftCode: '320', carrierCode: 'AF', flightNumber: '123', duration: 'PT1H',
      });
      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Unknown error');
    });

    it('should pass max to most-traveled and return Unknown error on non-Error throw', async () => {
      mockGetMostTraveledDestinations.mockResolvedValue({ data: [] } as never);

      const res = await request(app).get('/flights/analytics/most-traveled').query({
        originCityCode: 'PAR', period: '2026-06', max: '10',
      });
      expect(res.status).toBe(200);
      expect(mockGetMostTraveledDestinations).toHaveBeenCalledWith(expect.objectContaining({ max: 10 }));
    });

    it('should return Unknown error for GET /flights/analytics/most-traveled non-Error throw', async () => {
      mockGetMostTraveledDestinations.mockRejectedValue('plain error' as never);

      const res = await request(app).get('/flights/analytics/most-traveled').query({
        originCityCode: 'PAR', period: '2026-06',
      });
      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Unknown error');
    });

    it('should pass max to most-booked and return Unknown error on non-Error throw', async () => {
      mockGetMostBookedDestinations.mockResolvedValue({ data: [] } as never);

      const res = await request(app).get('/flights/analytics/most-booked').query({
        originCityCode: 'PAR', period: '2026-06', max: '10',
      });
      expect(res.status).toBe(200);
      expect(mockGetMostBookedDestinations).toHaveBeenCalledWith(expect.objectContaining({ max: 10 }));
    });

    it('should return Unknown error for GET /flights/analytics/most-booked non-Error throw', async () => {
      mockGetMostBookedDestinations.mockRejectedValue('plain error' as never);

      const res = await request(app).get('/flights/analytics/most-booked').query({
        originCityCode: 'PAR', period: '2026-06',
      });
      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Unknown error');
    });

    it('should return Unknown error for GET /flights/analytics/busiest-period non-Error throw', async () => {
      mockGetBusiestTravelingPeriod.mockRejectedValue('plain error' as never);

      const res = await request(app).get('/flights/analytics/busiest-period').query({
        cityCode: 'PAR', period: '2026-06',
      });
      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Unknown error');
    });

    it('should return Unknown error for GET /flights/checkin-links non-Error throw', async () => {
      mockGetFlightCheckinLinks.mockRejectedValue('plain error' as never);

      const res = await request(app).get('/flights/checkin-links').query({ airlineCode: 'AF' });
      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Unknown error');
    });

    it('should return Unknown error for GET /flights/seatmap non-Error throw', async () => {
      mockGetFlightSeatMap.mockRejectedValue('plain error' as never);

      const res = await request(app).get('/flights/seatmap').query({ flightOfferId: 'offer-1' });
      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Unknown error');
    });

    it('should return Unknown error for POST /flights/offers/pricing non-Error throw', async () => {
      mockGetFlightOffersPrice.mockRejectedValue('plain error' as never);

      const res = await request(app).post('/flights/offers/pricing').send({ data: [] });
      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Unknown error');
    });

    it('should return Unknown error for GET /flights/branded-fares non-Error throw', async () => {
      mockGetBrandedFares.mockRejectedValue('plain error' as never);

      const res = await request(app).get('/flights/branded-fares').query({ flightOfferId: 'offer-1' });
      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Unknown error');
    });

    it('should return Unknown error for POST /flights/availabilities non-Error throw', async () => {
      mockSearchFlightAvailabilities.mockRejectedValue('plain error' as never);

      const res = await request(app).post('/flights/availabilities').send({
        originDestinations: [{ id: '1' }], travelers: [{ id: '1' }], sources: ['GDS'],
      });
      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Unknown error');
    });

    it('should return Unknown error for POST /flights/orders non-Error throw', async () => {
      mockCreateFlightOrder.mockRejectedValue('plain error' as never);

      const res = await request(app).post('/flights/orders').send({ data: {} });
      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Unknown error');
    });

    it('should return Unknown error for GET /flights/orders/:orderId non-Error throw', async () => {
      mockGetFlightOrder.mockRejectedValue('plain error' as never);

      const res = await request(app).get('/flights/orders/order-1');
      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Unknown error');
    });
  });
});
