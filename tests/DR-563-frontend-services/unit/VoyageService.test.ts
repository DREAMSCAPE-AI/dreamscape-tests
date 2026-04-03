/**
 * DR-563 — US-TEST-026
 * Tests unitaires : VoyageService (services/voyage/VoyageService)
 *
 * Importe le vrai service — import.meta.env transformé par vite-meta-transform.
 *
 * @jest-environment node
 * @ticket DR-563
 */

const mockGet = jest.fn();
const mockPost = jest.fn();

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    create: jest.fn(() => ({
      get: mockGet,
      post: mockPost,
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    })),
  },
}));

process.env.VITE_VOYAGE_SERVICE_URL = 'http://localhost:3003';

import voyageService from '@/services/voyage/VoyageService';

describe('VoyageService', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── Flights ──────────────────────────────────────────────────────────────
  describe('searchFlights', () => {
    it('calls GET /flights/search with params and returns data', async () => {
      const mockFlights = { data: [{ id: 'f1', price: { total: '299' } }] };
      mockGet.mockResolvedValue({ data: mockFlights });
      const params = { originLocationCode: 'CDG', destinationLocationCode: 'JFK', departureDate: '2026-06-01', adults: 1 };
      const result = await voyageService.searchFlights(params as any);
      expect(mockGet).toHaveBeenCalledWith('/flights/search', { params });
      expect(result).toEqual(mockFlights);
    });

    it('propagates errors from the API', async () => {
      mockGet.mockRejectedValue(new Error('Amadeus API error'));
      await expect(voyageService.searchFlights({} as any)).rejects.toThrow('Amadeus API error');
    });
  });

  describe('getFlightStatus', () => {
    it('calls GET /flights/status with params', async () => {
      mockGet.mockResolvedValue({ data: { status: 'SCHEDULED' } });
      const params = { carrierCode: 'AF', flightNumber: '1234', scheduledDepartureDate: '2026-06-01' };
      const result = await voyageService.getFlightStatus(params);
      expect(mockGet).toHaveBeenCalledWith('/flights/status', { params });
      expect(result.status).toBe('SCHEDULED');
    });
  });

  describe('getFlightPriceAnalysis', () => {
    it('calls GET /flights/price-analysis', async () => {
      mockGet.mockResolvedValue({ data: { priceMetrics: [] } });
      const params = { originIataCode: 'CDG', destinationIataCode: 'JFK', departureDate: '2026-06-01' };
      await voyageService.getFlightPriceAnalysis(params);
      expect(mockGet).toHaveBeenCalledWith('/flights/price-analysis', { params });
    });
  });

  // ── Hotels ───────────────────────────────────────────────────────────────
  describe('searchHotels', () => {
    it('calls GET /hotels/search with params', async () => {
      const mockHotels = { data: [{ hotelId: 'H1', name: 'Grand Hotel' }] };
      mockGet.mockResolvedValue({ data: mockHotels });
      const params = { cityCode: 'PAR', checkInDate: '2026-06-01', checkOutDate: '2026-06-05', adults: 2 };
      const result = await voyageService.searchHotels(params as any);
      expect(mockGet).toHaveBeenCalledWith('/hotels/search', { params });
      expect(result).toEqual(mockHotels);
    });
  });

  describe('getHotelDetails', () => {
    it('calls GET /hotels/details/:offerId', async () => {
      mockGet.mockResolvedValue({ data: { hotel: { name: 'Grand Hotel' } } });
      await voyageService.getHotelDetails('offer-123');
      expect(mockGet).toHaveBeenCalledWith('/hotels/details/offer-123');
    });
  });

  // ── Activities ───────────────────────────────────────────────────────────
  describe('searchActivities', () => {
    it('calls GET /activities/search with params', async () => {
      mockGet.mockResolvedValue({ data: { data: [] } });
      const params = { latitude: 48.85, longitude: 2.35 };
      await voyageService.searchActivities(params as any);
      expect(mockGet).toHaveBeenCalledWith('/activities/search', { params });
    });
  });

  describe('getActivityDetails', () => {
    it('calls GET /activities/details/:activityId', async () => {
      mockGet.mockResolvedValue({ data: { activity: { id: 'act-1' } } });
      await voyageService.getActivityDetails('act-1');
      expect(mockGet).toHaveBeenCalledWith('/activities/details/act-1');
    });
  });

  // ── Bookings ─────────────────────────────────────────────────────────────
  describe('getUserBookings', () => {
    it('calls GET /bookings with optional params', async () => {
      const mockBookings = { data: [], pagination: { total: 0 } };
      mockGet.mockResolvedValue({ data: mockBookings });
      const result = await voyageService.getUserBookings({ page: 1, limit: 10 });
      expect(mockGet).toHaveBeenCalledWith('/bookings', { params: { page: 1, limit: 10 } });
      expect(result).toEqual(mockBookings);
    });

    it('calls GET /bookings with no params when called without arguments', async () => {
      mockGet.mockResolvedValue({ data: { data: [] } });
      await voyageService.getUserBookings();
      expect(mockGet).toHaveBeenCalledWith('/bookings', { params: undefined });
    });
  });

  describe('getBookingDetails', () => {
    it('calls GET /bookings/:reference with optional userId', async () => {
      mockGet.mockResolvedValue({ data: { booking: { reference: 'BOOK-001' } } });
      await voyageService.getBookingDetails('BOOK-001', 'user-1');
      expect(mockGet).toHaveBeenCalledWith('/bookings/BOOK-001', { params: { userId: 'user-1' } });
    });
  });

  describe('cancelBooking', () => {
    it('calls POST /bookings/:reference/cancel with reason and userId', async () => {
      mockPost.mockResolvedValue({ data: { success: true } });
      await voyageService.cancelBooking('BOOK-001', 'Change of plans', 'user-1');
      expect(mockPost).toHaveBeenCalledWith('/bookings/BOOK-001/cancel', {
        reason: 'Change of plans',
        userId: 'user-1',
      });
    });

    it('calls cancel with undefined reason when none provided', async () => {
      mockPost.mockResolvedValue({ data: { success: true } });
      await voyageService.cancelBooking('BOOK-001');
      expect(mockPost).toHaveBeenCalledWith('/bookings/BOOK-001/cancel', {
        reason: undefined,
        userId: undefined,
      });
    });
  });

  describe('getBookingStats', () => {
    it('calls GET /bookings/stats with userId', async () => {
      mockGet.mockResolvedValue({ data: { total: 5 } });
      await voyageService.getBookingStats('user-1');
      expect(mockGet).toHaveBeenCalledWith('/bookings/stats', { params: { userId: 'user-1' } });
    });
  });
});
