/**
 * US-TEST-011 — Tests unitaires AmadeusService
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// ── Mock @/config/environment ──────────────────────────────────────────────────
jest.mock('@/config/environment', () => ({
  config: {
    amadeus: {
      baseUrl:   'https://test.api.amadeus.com',
      apiKey:    'TEST_KEY',
      apiSecret: 'TEST_SECRET',
    },
  },
}));

// ── Mock CacheService ──────────────────────────────────────────────────────────
const mockCacheWrapper = jest.fn();

jest.mock('@/services/CacheService', () => ({
  __esModule: true,
  default: { cacheWrapper: mockCacheWrapper },
}));

// ── Mock axios ─────────────────────────────────────────────────────────────────
const mockAxiosPost    = jest.fn();
const mockAxiosGet     = jest.fn();
const mockAxiosRequest = jest.fn();
const mockAxiosDelete  = jest.fn();

const mockAxiosInstance = {
  get:      mockAxiosGet,
  post:     mockAxiosPost,
  request:  mockAxiosRequest,
  delete:   mockAxiosDelete,
  interceptors: {
    request:  { use: jest.fn() },
    response: { use: jest.fn() },
  },
};

const mockAxiosCreate = jest.fn().mockReturnValue(mockAxiosInstance);

function axiosMockFactory() {
  return {
    __esModule:   true,
    default: {
      post:         mockAxiosPost,
      create:       mockAxiosCreate,
      isAxiosError: (e: any) => Boolean(e?.isAxiosError),
    },
    post:         mockAxiosPost,
    create:       mockAxiosCreate,
    isAxiosError: (e: any) => Boolean(e?.isAxiosError),
  };
}

jest.mock('axios', axiosMockFactory);

// ── Import after mocks ─────────────────────────────────────────────────────────
import AmadeusService from '@/services/AmadeusService';

const requestInterceptor = mockAxiosInstance.interceptors.request.use.mock.calls[0]?.[0];
const requestErrorInterceptor = mockAxiosInstance.interceptors.request.use.mock.calls[0]?.[1];
const responseSuccessInterceptor = mockAxiosInstance.interceptors.response.use.mock.calls[0]?.[0];
const responseErrorInterceptor = mockAxiosInstance.interceptors.response.use.mock.calls[0]?.[1];

// ── Helpers ────────────────────────────────────────────────────────────────────
const makeTokenResponse = () => ({
  data: { access_token: 'test-token', token_type: 'Bearer', expires_in: 1799 },
});

const makeAxiosError = (status: number, errorCode?: number, message = 'Error') => {
  const err: any = new Error(message);
  err.isAxiosError = true;
  err.response = {
    status,
    data: errorCode
      ? { errors: [{ code: errorCode, title: message, detail: message }] }
      : { message },
  };
  err.config = { url: '/test' };
  return err;
};

const flightSearchParams = {
  originLocationCode:      'CDG',
  destinationLocationCode: 'LHR',
  departureDate:           '2026-06-01',
  adults:                  1,
};

// ── Tests ───────────────────────────────────────────────────────────────────────
describe('AmadeusService — US-TEST-011', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AmadeusService as any).accessToken = null;
    (AmadeusService as any).tokenExpiresAt = 0;
    (AmadeusService as any).rateLimitRetryCount = 0;
    (AmadeusService as any).circuitBreakerFailureCount = 0;
    (AmadeusService as any).circuitBreakerLastFailureTime = 0;
    (AmadeusService as any).isCircuitOpen = false;
    (AmadeusService as any).lastRequestTime = 0;
    // cacheWrapper calls through to fetcher by default
    mockCacheWrapper.mockImplementation((_type: any, _params: any, fetcher: any) => fetcher());
    // Auth succeeds by default
    mockAxiosPost.mockResolvedValue(makeTokenResponse() as never);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── Authentication ────────────────────────────────────────────────────────
  describe('Authentication', () => {
    it('should obtain an access token via client_credentials grant', async () => {
      await (AmadeusService as any).authenticate();

      expect(mockAxiosPost).toHaveBeenCalledWith(
        expect.stringContaining('/v1/security/oauth2/token'),
        expect.any(URLSearchParams),
        expect.objectContaining({
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        })
      );
    });

    it('should throw when credentials are invalid', async () => {
      const authError = makeAxiosError(401);
      mockAxiosPost.mockRejectedValue(authError as never);

      await expect(
        (AmadeusService as any).authenticate()
      ).rejects.toThrow('Failed to authenticate with Amadeus API');
    });

    it('ensureValidToken should call authenticate when token is missing', async () => {
      (AmadeusService as any).accessToken = null;
      (AmadeusService as any).tokenExpiresAt = 0;

      await (AmadeusService as any).ensureValidToken();

      expect(mockAxiosPost).toHaveBeenCalled();
    });

    it('ensureValidToken should call authenticate when token is expired', async () => {
      (AmadeusService as any).accessToken = 'old-token';
      (AmadeusService as any).tokenExpiresAt = Date.now() - 1000;

      await (AmadeusService as any).ensureValidToken();

      expect(mockAxiosPost).toHaveBeenCalled();
    });

    it('ensureValidToken should not call authenticate when token is still valid', async () => {
      (AmadeusService as any).accessToken = 'valid-token';
      (AmadeusService as any).tokenExpiresAt = Date.now() + 100000;

      await (AmadeusService as any).ensureValidToken();

      expect(mockAxiosPost).not.toHaveBeenCalled();
    });

    it('request interceptor should attach the bearer token', async () => {
      const interceptor = requestInterceptor;
      (AmadeusService as any).accessToken = 'attached-token';
      (AmadeusService as any).tokenExpiresAt = Date.now() + 100000;

      const config = await interceptor({ headers: {} });

      expect(config.headers.Authorization).toBe('Bearer attached-token');
    });

    it('request interceptor error handler should reject the original error', async () => {
      const interceptor = requestErrorInterceptor;
      const err = new Error('request interceptor failed');

      await expect(interceptor(err)).rejects.toBe(err);
    });
  });

  describe('Interceptors', () => {
    it('response success interceptor should reset retry state and close the circuit', () => {
      const interceptor = responseSuccessInterceptor;
      const response = { data: { ok: true } };

      (AmadeusService as any).rateLimitRetryCount = 2;
      (AmadeusService as any).circuitBreakerFailureCount = 4;
      (AmadeusService as any).isCircuitOpen = true;

      const result = interceptor(response);

      expect(result).toBe(response);
      expect((AmadeusService as any).rateLimitRetryCount).toBe(0);
      expect((AmadeusService as any).circuitBreakerFailureCount).toBe(0);
      expect((AmadeusService as any).isCircuitOpen).toBe(false);
    });

    it('response error interceptor should retry 429 responses with exponential backoff', async () => {
      jest.useFakeTimers();
      const interceptor = responseErrorInterceptor;
      const err: any = makeAxiosError(429, undefined, 'Too many requests');
      err.config = { url: '/retry-me' };
      mockAxiosRequest.mockResolvedValue({ data: { retried: true } } as never);

      const pending = interceptor(err);
      await jest.runAllTimersAsync();

      await expect(pending).resolves.toEqual({ data: { retried: true } });
      expect(mockAxiosRequest).toHaveBeenCalledWith(err.config);
      expect((AmadeusService as any).rateLimitRetryCount).toBe(1);

      jest.useRealTimers();
    });

    it('response error interceptor should open the circuit breaker after threshold is reached', async () => {
      const interceptor = responseErrorInterceptor;
      const err: any = makeAxiosError(429, undefined, 'Too many requests');

      (AmadeusService as any).rateLimitRetryCount = 3;
      (AmadeusService as any).circuitBreakerFailureCount = 4;

      await expect(interceptor(err)).rejects.toBe(err);
      expect((AmadeusService as any).isCircuitOpen).toBe(true);
    });

    it('response error interceptor should reject non-429 errors without retry', async () => {
      const interceptor = responseErrorInterceptor;
      const err: any = makeAxiosError(500, undefined, 'Internal');

      await expect(interceptor(err)).rejects.toBe(err);
      expect(mockAxiosRequest).not.toHaveBeenCalled();
    });

    it('response error interceptor should reject network errors (no response property)', async () => {
      const interceptor = responseErrorInterceptor;
      const networkErr: any = new Error('Network timeout');
      // No response property — simulates a network-level error

      await expect(interceptor(networkErr)).rejects.toBe(networkErr);
      expect(mockAxiosRequest).not.toHaveBeenCalled();
    });

    it('response error interceptor should log detailed Amadeus errors when present', async () => {
      const interceptor = responseErrorInterceptor;
      const err: any = makeAxiosError(400, 32171, 'Invalid location');

      await expect(interceptor(err)).rejects.toBe(err);
    });
  });

  // ── searchLocations ───────────────────────────────────────────────────────
  describe('searchLocations', () => {
    it('should return location results for a valid keyword', async () => {
      const locationData = { data: [{ iataCode: 'CDG', name: 'Charles de Gaulle' }] };
      mockCacheWrapper.mockResolvedValue(locationData as never);

      const result = await AmadeusService.searchLocations({ keyword: 'Paris' });
      expect(result).toEqual(locationData);
    });

    it('should throw when keyword is too short', async () => {
      await expect(
        AmadeusService.searchLocations({ keyword: 'P' })
      ).rejects.toThrow();
    });

    it('should use cacheWrapper for location searches', async () => {
      mockCacheWrapper.mockResolvedValue({ data: [] } as never);

      await AmadeusService.searchLocations({ keyword: 'London' });
      expect(mockCacheWrapper).toHaveBeenCalledWith(
        'locations',
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should include subType when valid', async () => {
      mockAxiosGet.mockResolvedValue({ data: { data: [] } } as never);
      await AmadeusService.searchLocations({ keyword: 'Paris', subType: 'AIRPORT' });
      expect(mockAxiosGet).toHaveBeenCalledWith(
        expect.stringContaining('/v1/reference-data/locations'),
        expect.objectContaining({ params: expect.objectContaining({ subType: 'AIRPORT' }) })
      );
    });

    it('should include countryCode when valid 2-letter code', async () => {
      mockAxiosGet.mockResolvedValue({ data: { data: [] } } as never);
      await AmadeusService.searchLocations({ keyword: 'Paris', countryCode: 'FR' });
      expect(mockAxiosGet).toHaveBeenCalledWith(
        expect.stringContaining('/v1/reference-data/locations'),
        expect.objectContaining({ params: expect.objectContaining({ countryCode: 'FR' }) })
      );
    });

    it('should NOT include invalid subType', async () => {
      mockAxiosGet.mockResolvedValue({ data: { data: [] } } as never);
      await AmadeusService.searchLocations({ keyword: 'Paris', subType: 'INVALID' });
      expect(mockAxiosGet).toHaveBeenCalledWith(
        expect.stringContaining('/v1/reference-data/locations'),
        expect.objectContaining({ params: expect.not.objectContaining({ subType: 'INVALID' }) })
      );
    });

    it('should NOT include invalid countryCode', async () => {
      mockAxiosGet.mockResolvedValue({ data: { data: [] } } as never);
      await AmadeusService.searchLocations({ keyword: 'Paris', countryCode: 'FRANCE' });
      expect(mockAxiosGet).toHaveBeenCalledWith(
        expect.stringContaining('/v1/reference-data/locations'),
        expect.objectContaining({ params: expect.not.objectContaining({ countryCode: 'FRANCE' }) })
      );
    });

    it('should handle CITY,COUNTRY format keyword', async () => {
      mockAxiosGet.mockResolvedValue({ data: { data: [] } } as never);
      await AmadeusService.searchLocations({ keyword: 'Paris, France' });
      expect(mockAxiosGet).toHaveBeenCalledWith(
        expect.stringContaining('/v1/reference-data/locations'),
        expect.objectContaining({ params: expect.objectContaining({ keyword: 'Paris' }) })
      );
    });

    it('should handle ALL CAPS keyword and convert to title case', async () => {
      mockAxiosGet.mockResolvedValue({ data: { data: [] } } as never);
      await AmadeusService.searchLocations({ keyword: 'LONDON' });
      expect(mockAxiosGet).toHaveBeenCalledWith(
        expect.stringContaining('/v1/reference-data/locations'),
        expect.objectContaining({ params: expect.objectContaining({ keyword: 'London' }) })
      );
    });

    it('should throw when keyword is empty', async () => {
      await expect(
        AmadeusService.searchLocations({ keyword: '' })
      ).rejects.toThrow();
    });
  });

  // ── searchFlights ─────────────────────────────────────────────────────────
  describe('searchFlights', () => {
    it('should return flight offers for valid search params', async () => {
      const flightData = { data: [{ id: 'offer-1', price: { total: '200.00' } }], meta: { count: 1 } };
      mockAxiosGet.mockResolvedValue({ data: flightData } as never);

      const result = await AmadeusService.searchFlights(flightSearchParams);

      expect(mockAxiosGet).toHaveBeenCalledWith(
        expect.stringContaining('/v2/shopping/flight-offers'),
        expect.objectContaining({
          params: expect.objectContaining({
            originLocationCode:      'CDG',
            destinationLocationCode: 'LHR',
          }),
        })
      );
      expect(result).toBeDefined();
    });

    it('should throw descriptive error for invalid date (code 4926)', async () => {
      const err = makeAxiosError(400, 4926, 'Invalid date');
      mockAxiosGet.mockRejectedValue(err as never);

      await expect(
        AmadeusService.searchFlights({ ...flightSearchParams, departureDate: '2020-01-01' })
      ).rejects.toThrow(/Invalid date/);
    });

    it('should throw for 500 server error', async () => {
      const err = makeAxiosError(500, undefined, 'Internal server error');
      mockAxiosGet.mockRejectedValue(err as never);

      await expect(AmadeusService.searchFlights(flightSearchParams)).rejects.toThrow(
        /Server error/
      );
    });

    it('should use cacheWrapper for flight searches', async () => {
      mockCacheWrapper.mockResolvedValue({ data: [] } as never);

      await AmadeusService.searchFlights(flightSearchParams);

      expect(mockCacheWrapper).toHaveBeenCalledWith(
        'flights',
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should propagate error code 477 (no flight offers found)', async () => {
      const err = makeAxiosError(400, 477, 'No offers found');
      mockAxiosGet.mockRejectedValue(err as never);

      await expect(AmadeusService.searchFlights(flightSearchParams)).rejects.toThrow(
        /No flight offers found/
      );
    });

    it('should propagate error code 38195 (quota exceeded)', async () => {
      const err = makeAxiosError(400, 38195, 'Quota exceeded');
      mockAxiosGet.mockRejectedValue(err as never);

      await expect(AmadeusService.searchFlights(flightSearchParams)).rejects.toThrow(
        /quota exceeded/i
      );
    });

    it('should propagate error code 38194 (rate limit)', async () => {
      const err = makeAxiosError(400, 38194, 'Rate limit');
      mockAxiosGet.mockRejectedValue(err as never);

      await expect(AmadeusService.searchFlights(flightSearchParams)).rejects.toThrow(
        /rate limit/i
      );
    });

    it('should propagate 400 error with detail message', async () => {
      const err = makeAxiosError(400, undefined, 'Bad param');
      mockAxiosGet.mockRejectedValue(err as never);

      await expect(AmadeusService.searchFlights(flightSearchParams)).rejects.toThrow(
        /Bad Request/
      );
    });

    it('should propagate 404 error', async () => {
      const err = makeAxiosError(404, undefined, 'Not found');
      mockAxiosGet.mockRejectedValue(err as never);

      await expect(AmadeusService.searchFlights(flightSearchParams)).rejects.toThrow(
        /not found/i
      );
    });

    it('should propagate request error without response', async () => {
      const err: any = new Error('Request failed');
      err.isAxiosError = true;
      // No response, no request - generic error
      mockAxiosGet.mockRejectedValue(err as never);

      await expect(AmadeusService.searchFlights(flightSearchParams)).rejects.toThrow(
        /Request error/
      );
    });
  });

  // ── searchFlightsWithMapping ──────────────────────────────────────────────
  describe('searchFlightsWithMapping', () => {
    it('should return flight data using cacheWrapper with flightOffers key', async () => {
      const flightData = { data: [{ id: 'offer-mapped' }] };
      mockAxiosGet.mockResolvedValue({ data: flightData } as never);

      const result = await AmadeusService.searchFlightsWithMapping(flightSearchParams);

      expect(mockCacheWrapper).toHaveBeenCalledWith(
        'flightOffers',
        expect.any(Object),
        expect.any(Function)
      );
      expect(result).toBeDefined();
    });

    it('should throw on error', async () => {
      const err = makeAxiosError(500, undefined, 'Server error');
      mockAxiosGet.mockRejectedValue(err as never);

      await expect(AmadeusService.searchFlightsWithMapping(flightSearchParams)).rejects.toThrow(
        /Server error/i
      );
    });
  });

  // ── searchFlightDestinations ──────────────────────────────────────────────
  describe('searchFlightDestinations', () => {
    it('should return flight destinations for a valid origin', async () => {
      const destinationData = { data: [{ type: 'flight-destination', origin: 'CDG', destination: 'AMS' }] };
      mockAxiosGet.mockResolvedValue({ data: destinationData } as never);

      const result = await AmadeusService.searchFlightDestinations({ origin: 'CDG', maxPrice: 200 });

      expect(mockAxiosGet).toHaveBeenCalledWith(
        expect.stringContaining('/v1/shopping/flight-destinations'),
        expect.objectContaining({ params: expect.objectContaining({ origin: 'CDG' }) })
      );
      expect(result).toBeDefined();
    });

    it('should throw on error', async () => {
      const err = makeAxiosError(500, undefined, 'Server error');
      mockAxiosGet.mockRejectedValue(err as never);

      await expect(AmadeusService.searchFlightDestinations({ origin: 'CDG' })).rejects.toThrow(
        /Server error/i
      );
    });
  });

  // ── searchHotels ──────────────────────────────────────────────────────────
  describe('searchHotels', () => {
    const hotelParams = {
      cityCode:     'PAR',
      checkInDate:  '2026-06-01',
      checkOutDate: '2026-06-05',
      adults:       2,
    };

    it('should perform 2-step search: hotel IDs then offers', async () => {
      const cityResponse   = { data: { data: [{ hotelId: 'H1' }, { hotelId: 'H2' }] } };
      const offersResponse = { data: { data: [{ hotel: { hotelId: 'H1' }, offers: [] }] } };

      mockAxiosGet
        .mockResolvedValueOnce(cityResponse as never)
        .mockResolvedValueOnce(offersResponse as never);

      await AmadeusService.searchHotels(hotelParams);

      expect(mockAxiosGet).toHaveBeenCalledTimes(2);
      expect((mockAxiosGet.mock.calls[0] as any[])[0]).toContain('hotels/by-city');
    });

    it('should throw when no hotels found for city code', async () => {
      mockAxiosGet.mockResolvedValue({ data: { data: [] } } as never);

      await expect(AmadeusService.searchHotels(hotelParams)).rejects.toThrow(
        /No hotels found/
      );
    });

    it('should throw when checkInDate and checkOutDate are missing', async () => {
      await expect(
        AmadeusService.searchHotels({ ...hotelParams, checkInDate: '', checkOutDate: '' })
      ).rejects.toThrow(/required/);
    });

    it('should throw when checkInDate is after checkOutDate', async () => {
      await expect(
        AmadeusService.searchHotels({
          ...hotelParams,
          checkInDate:  '2026-06-10',
          checkOutDate: '2026-06-05',
        })
      ).rejects.toThrow(/before/);
    });

    it('should use cacheWrapper for hotel searches', async () => {
      mockCacheWrapper.mockResolvedValue({ data: [] } as never);

      await AmadeusService.searchHotels(hotelParams);

      expect(mockCacheWrapper).toHaveBeenCalledWith(
        'hotels',
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should throw when date format is invalid', async () => {
      await expect(
        AmadeusService.searchHotels({ ...hotelParams, checkInDate: '01-06-2026', checkOutDate: '05-06-2026' })
      ).rejects.toThrow(/YYYY-MM-DD/);
    });

    it('should use hotelIds directly when provided (skip step 1)', async () => {
      const offersResponse = { data: { data: [{ hotel: { hotelId: 'H99' }, offers: [] }] } };
      mockAxiosGet.mockResolvedValue(offersResponse as never);

      const result = await AmadeusService.searchHotels({
        ...hotelParams,
        hotelIds: 'H99',
      });

      expect(mockAxiosGet).toHaveBeenCalledTimes(1);
      expect((mockAxiosGet.mock.calls[0] as any[])[0]).toContain('/v3/shopping/hotel-offers');
      expect(result).toBeDefined();
    });

    it('should throw when neither cityCode nor hotelIds is provided', async () => {
      const paramsWithoutCity: any = {
        checkInDate:  '2026-06-01',
        checkOutDate: '2026-06-05',
        adults:       2,
      };
      await expect(AmadeusService.searchHotels(paramsWithoutCity)).rejects.toThrow(
        /cityCode or hotelIds is required/
      );
    });

    it('should handle 429 error from hotel-offers endpoint', async () => {
      const cityResponse = { data: { data: [{ hotelId: 'H1' }, { hotelId: 'H2' }] } };
      const rateLimitErr = makeAxiosError(429, undefined, 'Too many requests');

      mockAxiosGet
        .mockResolvedValueOnce(cityResponse as never)
        .mockRejectedValueOnce(rateLimitErr as never);

      await expect(AmadeusService.searchHotels(hotelParams)).rejects.toThrow(
        /[Rr]ate limit|[Tt]oo many/
      );
    });

    it('should propagate non-429 error from hotel-offers step (covers inner catch line 411)', async () => {
      const cityResponse = { data: { data: [{ hotelId: 'H1' }] } };
      const serverError = makeAxiosError(500, undefined, 'Internal error');

      mockAxiosGet
        .mockResolvedValueOnce(cityResponse as never)
        .mockRejectedValueOnce(serverError as never);

      await expect(AmadeusService.searchHotels(hotelParams)).rejects.toThrow();
    });

    it('should use hotelIds fallback in error message when no cityCode', async () => {
      const serverError = makeAxiosError(500, undefined, 'Internal error');
      mockAxiosGet.mockRejectedValueOnce(serverError as never);

      const paramsWithHotelIds: any = {
        ...hotelParams,
        cityCode: undefined,
        hotelIds: 'H99',
      };
      await expect(AmadeusService.searchHotels(paramsWithHotelIds)).rejects.toThrow();
    });

    it('should return empty array when city response has no data property', async () => {
      mockAxiosGet.mockResolvedValueOnce({ data: {} } as never);

      await expect(AmadeusService.searchHotels(hotelParams)).rejects.toThrow(/No hotels found/);
    });

    it('should apply pagination defaults using page param', async () => {
      const cityResponse   = { data: { data: Array.from({ length: 20 }, (_, i) => ({ hotelId: `H${i}` })) } };
      const offersResponse = { data: { data: [] } };

      mockAxiosGet
        .mockResolvedValueOnce(cityResponse as never)
        .mockResolvedValueOnce(offersResponse as never);

      await AmadeusService.searchHotels({ ...hotelParams, page: { offset: 5, limit: 5 } });

      expect(mockAxiosGet).toHaveBeenCalledTimes(2);
    });
  });

  // ── getHotelDetails ───────────────────────────────────────────────────────
  describe('getHotelDetails', () => {
    it('should return hotel details for a valid offerId', async () => {
      const hotelDetail = { data: { type: 'hotel-offer', id: 'OFFER123' } };
      mockAxiosGet.mockResolvedValue({ data: hotelDetail } as never);

      const result = await AmadeusService.getHotelDetails('OFFER123');

      expect(mockAxiosGet).toHaveBeenCalledWith(
        expect.stringContaining('/v3/shopping/hotel-offers/OFFER123')
      );
      expect(result).toBeDefined();
    });

    it('should use cacheWrapper with hotelDetails key', async () => {
      mockCacheWrapper.mockResolvedValue({ data: {} } as never);

      await AmadeusService.getHotelDetails('OFFER_XYZ');

      expect(mockCacheWrapper).toHaveBeenCalledWith(
        'hotelDetails',
        { offerId: 'OFFER_XYZ' },
        expect.any(Function)
      );
    });

    it('should throw on error', async () => {
      const err = makeAxiosError(404, undefined, 'Not found');
      mockAxiosGet.mockRejectedValue(err as never);

      await expect(AmadeusService.getHotelDetails('INVALID')).rejects.toThrow(
        /not found/i
      );
    });
  });

  // ── autocompleteHotelName ─────────────────────────────────────────────────
  describe('autocompleteHotelName', () => {
    it('should return autocomplete results for a hotel keyword', async () => {
      const responseData = { data: [{ name: 'Hilton Paris' }] };
      mockAxiosGet.mockResolvedValue({ data: responseData } as never);

      const result = await AmadeusService.autocompleteHotelName({ keyword: 'Hilton' });

      expect(mockAxiosGet).toHaveBeenCalledWith(
        expect.stringContaining('/v1/reference-data/locations/hotel'),
        expect.objectContaining({ params: expect.objectContaining({ keyword: 'Hilton' }) })
      );
      expect(result).toBeDefined();
    });

    it('should throw on error', async () => {
      const err = makeAxiosError(500, undefined, 'Server error');
      mockAxiosGet.mockRejectedValue(err as never);

      await expect(AmadeusService.autocompleteHotelName({ keyword: 'Hilton' })).rejects.toThrow(
        /Server error/i
      );
    });
  });

  // ── createHotelBooking ────────────────────────────────────────────────────
  describe('createHotelBooking', () => {
    const bookingParams = {
      offerId: 'OFFER123',
      guests: [{
        id: 1,
        name: { title: 'MR', firstName: 'John', lastName: 'Doe' },
        contact: { phone: '+33123456789', email: 'john@example.com' },
      }],
      payments: [{
        method: 'creditCard',
        card: { vendorCode: 'VI', cardNumber: '4111111111111111', expiryDate: '2028-01' },
      }],
    };

    it('should create a hotel booking successfully', async () => {
      const bookingResponse = { data: { id: 'BOOKING123', type: 'hotel-order' } };
      mockAxiosPost.mockResolvedValue({ data: bookingResponse } as never);

      const result = await AmadeusService.createHotelBooking(bookingParams);

      expect(mockAxiosPost).toHaveBeenCalledWith(
        expect.stringContaining('/v1/booking/hotel-bookings'),
        expect.objectContaining({
          data: expect.objectContaining({
            offerId: 'OFFER123',
          }),
        })
      );
      expect(result).toBeDefined();
    });

    it('should auto-assign guest id when not provided', async () => {
      const paramsWithoutId = {
        ...bookingParams,
        guests: [{
          name: { title: 'MR', firstName: 'Jane', lastName: 'Doe' },
          contact: { phone: '+33123456789', email: 'jane@example.com' },
        }],
      };
      const bookingResponse = { data: { id: 'BOOKING456' } };
      mockAxiosPost.mockResolvedValue({ data: bookingResponse } as never);

      const result = await AmadeusService.createHotelBooking(paramsWithoutId);

      expect(mockAxiosPost).toHaveBeenCalledWith(
        expect.stringContaining('/v1/booking/hotel-bookings'),
        expect.objectContaining({
          data: expect.objectContaining({
            guests: expect.arrayContaining([
              expect.objectContaining({ id: 1 }),
            ]),
          }),
        })
      );
      expect(result).toBeDefined();
    });

    it('should throw on error', async () => {
      const err = makeAxiosError(400, undefined, 'Invalid booking params');
      mockAxiosPost.mockRejectedValue(err as never);

      await expect(AmadeusService.createHotelBooking(bookingParams)).rejects.toThrow(
        /Bad Request/
      );
    });

    it('should send card: undefined when payment has no card property', async () => {
      const bookingResponse = { data: { id: 'BOOKING789' } };
      mockAxiosPost.mockResolvedValue({ data: bookingResponse } as never);

      await AmadeusService.createHotelBooking({
        offerId: 'OFFER123',
        guests: [{ id: 1, name: { title: 'MR', firstName: 'John', lastName: 'Doe' }, contact: { phone: '+33123456789', email: 'john@example.com' } }],
        payments: [{ method: 'creditCard' }], // no card property
      });

      expect(mockAxiosPost).toHaveBeenCalledWith(
        expect.stringContaining('/v1/booking/hotel-bookings'),
        expect.objectContaining({
          data: expect.objectContaining({
            payments: [expect.objectContaining({ method: 'creditCard', card: undefined })],
          }),
        })
      );
    });
  });

  // ── searchActivities ──────────────────────────────────────────────────────
  describe('searchActivities', () => {
    const activityParams = { latitude: 48.8566, longitude: 2.3522, radius: 20 };

    it('should return activities for valid coordinates', async () => {
      const response = { data: { data: [{ id: 'act-1', name: 'Eiffel Tower' }] } };
      mockAxiosGet.mockResolvedValue(response as never);

      const result = await AmadeusService.searchActivities(activityParams);
      expect(result).toBeDefined();
      expect(mockAxiosGet).toHaveBeenCalledWith(
        expect.stringContaining('activities'),
        expect.objectContaining({
          params: expect.objectContaining({
            latitude:  48.8566,
            longitude: 2.3522,
          }),
        })
      );
    });

    it('should return result gracefully when no activities found', async () => {
      mockAxiosGet.mockResolvedValue({ data: { data: [] } } as never);

      const result = await AmadeusService.searchActivities(activityParams);
      expect(result).toBeDefined();
    });

    it('should use cacheWrapper for activity searches', async () => {
      mockCacheWrapper.mockResolvedValue({ data: [] } as never);

      await AmadeusService.searchActivities(activityParams);

      expect(mockCacheWrapper).toHaveBeenCalledWith(
        'activities',
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should rethrow errors from activity search', async () => {
      const err = makeAxiosError(500, undefined, 'Server error');
      mockAxiosGet.mockRejectedValue(err as never);

      await expect(AmadeusService.searchActivities(activityParams)).rejects.toBeDefined();
    });

    it('should rethrow cache wrapper errors unchanged', async () => {
      const searchError = new Error('activities unavailable');
      mockCacheWrapper.mockRejectedValue(searchError as never);

      await expect(AmadeusService.searchActivities(activityParams)).rejects.toBe(searchError);
    });
  });

  // ── getActivityDetails ────────────────────────────────────────────────────
  describe('getActivityDetails', () => {
    it('should return activity details for a valid activityId', async () => {
      const activityDetail = { data: { id: 'ACT123', name: 'City Tour' } };
      mockAxiosGet.mockResolvedValue({ data: activityDetail } as never);

      const result = await AmadeusService.getActivityDetails('ACT123');

      expect(mockAxiosGet).toHaveBeenCalledWith(
        expect.stringContaining('/v1/shopping/activities/ACT123')
      );
      expect(result).toBeDefined();
    });

    it('should throw on error', async () => {
      const err = makeAxiosError(404, undefined, 'Not found');
      mockAxiosGet.mockRejectedValue(err as never);

      await expect(AmadeusService.getActivityDetails('INVALID')).rejects.toThrow(
        /not found/i
      );
    });
  });

  // ── analyzeFlightPrices ───────────────────────────────────────────────────
  describe('analyzeFlightPrices', () => {
    const priceParams = {
      originIataCode:      'CDG',
      destinationIataCode: 'LHR',
      departureDate:       '2026-06-01',
    };

    it('should return flight price analysis', async () => {
      const priceData = { data: [{ type: 'itinerary-price-metric' }] };
      mockAxiosGet.mockResolvedValue({ data: priceData } as never);

      const result = await AmadeusService.analyzeFlightPrices(priceParams);

      expect(mockCacheWrapper).toHaveBeenCalledWith(
        'flightPrices',
        expect.any(Object),
        expect.any(Function)
      );
      expect(result).toBeDefined();
    });

    it('should throw on error', async () => {
      const err = makeAxiosError(500, undefined, 'Server error');
      mockAxiosGet.mockRejectedValue(err as never);

      await expect(AmadeusService.analyzeFlightPrices(priceParams)).rejects.toThrow(
        /Server error/i
      );
    });
  });

  // ── predictFlightChoice ───────────────────────────────────────────────────
  describe('predictFlightChoice', () => {
    it('should return flight choice prediction', async () => {
      const predictionData = { data: [{ id: 'offer-1', choiceProbability: '0.75' }] };
      mockAxiosPost.mockResolvedValue({ data: predictionData } as never);

      const result = await AmadeusService.predictFlightChoice({ flightOffers: [] });

      expect(mockAxiosPost).toHaveBeenCalledWith(
        expect.stringContaining('/v2/shopping/flight-offers/prediction'),
        expect.anything()
      );
      expect(result).toBeDefined();
    });

    it('should throw on error', async () => {
      const err = makeAxiosError(500, undefined, 'Server error');
      mockAxiosPost.mockRejectedValue(err as never);

      await expect(AmadeusService.predictFlightChoice({})).rejects.toThrow(
        /Server error/i
      );
    });
  });

  // ── searchFlightInspiration ───────────────────────────────────────────────
  describe('searchFlightInspiration', () => {
    it('should return flight inspiration results', async () => {
      const inspirationData = { data: [{ type: 'flight-destination', destination: 'AMS' }] };
      mockAxiosGet.mockResolvedValue({ data: inspirationData } as never);

      const result = await AmadeusService.searchFlightInspiration({ origin: 'CDG' });

      expect(mockAxiosGet).toHaveBeenCalledWith(
        expect.stringContaining('/v1/shopping/flight-destinations'),
        expect.objectContaining({ params: expect.objectContaining({ origin: 'CDG' }) })
      );
      expect(result).toBeDefined();
    });

    it('should throw on error', async () => {
      const err = makeAxiosError(500, undefined, 'Server error');
      mockAxiosGet.mockRejectedValue(err as never);

      await expect(AmadeusService.searchFlightInspiration({ origin: 'CDG' })).rejects.toThrow(
        /Server error/i
      );
    });
  });

  // ── searchCheapestFlightDates ─────────────────────────────────────────────
  describe('searchCheapestFlightDates', () => {
    it('should return cheapest flight dates', async () => {
      const datesData = { data: [{ type: 'flight-date', price: { total: '100.00' } }] };
      mockAxiosGet.mockResolvedValue({ data: datesData } as never);

      const result = await AmadeusService.searchCheapestFlightDates({ origin: 'CDG', destination: 'LHR' });

      expect(mockAxiosGet).toHaveBeenCalledWith(
        expect.stringContaining('/v1/shopping/flight-dates'),
        expect.objectContaining({ params: expect.objectContaining({ origin: 'CDG', destination: 'LHR' }) })
      );
      expect(result).toBeDefined();
    });

    it('should throw on error', async () => {
      const err = makeAxiosError(500, undefined, 'Server error');
      mockAxiosGet.mockRejectedValue(err as never);

      await expect(AmadeusService.searchCheapestFlightDates({ origin: 'CDG', destination: 'LHR' })).rejects.toThrow(
        /Server error/i
      );
    });
  });

  // ── searchFlightAvailabilities ────────────────────────────────────────────
  describe('searchFlightAvailabilities', () => {
    it('should return flight availabilities', async () => {
      const availData = { data: [{ type: 'flight-availability' }] };
      mockAxiosPost.mockResolvedValue({ data: availData } as never);

      const result = await AmadeusService.searchFlightAvailabilities({ originLocationCode: 'CDG' });

      expect(mockAxiosPost).toHaveBeenCalledWith(
        expect.stringContaining('/v1/shopping/availability/flight-availabilities'),
        expect.anything()
      );
      expect(result).toBeDefined();
    });

    it('should throw on error', async () => {
      const err = makeAxiosError(500, undefined, 'Server error');
      mockAxiosPost.mockRejectedValue(err as never);

      await expect(AmadeusService.searchFlightAvailabilities({})).rejects.toThrow(
        /Server error/i
      );
    });
  });

  // ── createFlightOrder ─────────────────────────────────────────────────────
  describe('createFlightOrder', () => {
    it('should create a flight order successfully', async () => {
      const orderData = { data: { id: 'ORDER123', type: 'flight-order' } };
      mockAxiosPost.mockResolvedValue({ data: orderData } as never);

      const result = await AmadeusService.createFlightOrder({ flightOffers: [], travelers: [] });

      expect(mockAxiosPost).toHaveBeenCalledWith(
        expect.stringContaining('/v1/booking/flight-orders'),
        expect.anything()
      );
      expect(result).toBeDefined();
    });

    it('should throw on error', async () => {
      const err = makeAxiosError(400, undefined, 'Bad request');
      mockAxiosPost.mockRejectedValue(err as never);

      await expect(AmadeusService.createFlightOrder({})).rejects.toThrow(
        /Bad Request/
      );
    });
  });

  // ── getFlightOrder ────────────────────────────────────────────────────────
  describe('getFlightOrder', () => {
    it('should retrieve a flight order by ID', async () => {
      const orderData = { data: { id: 'ORDER123', type: 'flight-order' } };
      mockAxiosGet.mockResolvedValue({ data: orderData } as never);

      const result = await AmadeusService.getFlightOrder('ORDER123');

      expect(mockAxiosGet).toHaveBeenCalledWith(
        expect.stringContaining('/v1/booking/flight-orders/ORDER123')
      );
      expect(result).toBeDefined();
    });

    it('should throw on error', async () => {
      const err = makeAxiosError(404, undefined, 'Not found');
      mockAxiosGet.mockRejectedValue(err as never);

      await expect(AmadeusService.getFlightOrder('INVALID')).rejects.toThrow(
        /not found/i
      );
    });
  });

  // ── deleteFlightOrder ─────────────────────────────────────────────────────
  describe('deleteFlightOrder', () => {
    it('should delete a flight order by ID', async () => {
      mockAxiosDelete.mockResolvedValue({ data: {} } as never);

      const result = await AmadeusService.deleteFlightOrder('ORDER123');

      expect(mockAxiosDelete).toHaveBeenCalledWith(
        expect.stringContaining('/v1/booking/flight-orders/ORDER123')
      );
      expect(result).toBeDefined();
    });

    it('should throw on error', async () => {
      const err = makeAxiosError(404, undefined, 'Not found');
      mockAxiosDelete.mockRejectedValue(err as never);

      await expect(AmadeusService.deleteFlightOrder('INVALID')).rejects.toThrow(
        /not found/i
      );
    });
  });

  // ── getFlightSeatMap ──────────────────────────────────────────────────────
  describe('getFlightSeatMap', () => {
    it('should return seat map for a flight offer', async () => {
      const seatMapData = { data: [{ type: 'seatmap' }] };
      mockAxiosGet.mockResolvedValue({ data: seatMapData } as never);

      const result = await AmadeusService.getFlightSeatMap({ flightOfferId: 'OFFER123' });

      expect(mockAxiosGet).toHaveBeenCalledWith(
        expect.stringContaining('/v1/shopping/seatmaps'),
        expect.objectContaining({ params: expect.objectContaining({ flightOfferId: 'OFFER123' }) })
      );
      expect(result).toBeDefined();
    });

    it('should throw on error', async () => {
      const err = makeAxiosError(500, undefined, 'Server error');
      mockAxiosGet.mockRejectedValue(err as never);

      await expect(AmadeusService.getFlightSeatMap({ flightOfferId: 'OFFER123' })).rejects.toThrow(
        /Server error/i
      );
    });
  });

  // ── getBrandedFares ───────────────────────────────────────────────────────
  describe('getBrandedFares', () => {
    it('should return branded fares', async () => {
      const faresData = { data: [{ type: 'flight-offers-upselling' }] };
      mockAxiosPost.mockResolvedValue({ data: faresData } as never);

      const result = await AmadeusService.getBrandedFares({ flightOffers: [] });

      expect(mockAxiosPost).toHaveBeenCalledWith(
        expect.stringContaining('/v1/shopping/flight-offers/upselling'),
        expect.anything()
      );
      expect(result).toBeDefined();
    });

    it('should throw on error', async () => {
      const err = makeAxiosError(500, undefined, 'Server error');
      mockAxiosPost.mockRejectedValue(err as never);

      await expect(AmadeusService.getBrandedFares({})).rejects.toThrow(
        /Server error/i
      );
    });
  });

  // ── getFlightStatus ───────────────────────────────────────────────────────
  describe('getFlightStatus', () => {
    const statusParams = {
      carrierCode: 'AF',
      flightNumber: '1234',
      scheduledDepartureDate: '2026-06-01',
    };

    it('should return flight status', async () => {
      const statusData = { data: [{ type: 'DatedFlight', flightDesignator: { carrierCode: 'AF' } }] };
      mockAxiosGet.mockResolvedValue({ data: statusData } as never);

      const result = await AmadeusService.getFlightStatus(statusParams);

      expect(mockAxiosGet).toHaveBeenCalledWith(
        expect.stringContaining('/v2/schedule/flights'),
        expect.objectContaining({ params: expect.objectContaining({ carrierCode: 'AF' }) })
      );
      expect(result).toBeDefined();
    });

    it('should throw on error', async () => {
      const err = makeAxiosError(500, undefined, 'Server error');
      mockAxiosGet.mockRejectedValue(err as never);

      await expect(AmadeusService.getFlightStatus(statusParams)).rejects.toThrow(
        /Server error/i
      );
    });
  });

  // ── predictFlightDelay ────────────────────────────────────────────────────
  describe('predictFlightDelay', () => {
    const delayParams = {
      originLocationCode: 'CDG',
      destinationLocationCode: 'LHR',
      departureDate: '2026-06-01',
      departureTime: '08:00:00',
      arrivalDate: '2026-06-01',
      arrivalTime: '09:00:00',
      aircraftCode: '320',
      carrierCode: 'AF',
      flightNumber: '1234',
      duration: 'PT1H',
    };

    it('should return flight delay prediction', async () => {
      const delayData = { data: [{ type: 'prediction', result: 'LESS_THAN_30_MINUTES' }] };
      mockAxiosGet.mockResolvedValue({ data: delayData } as never);

      const result = await AmadeusService.predictFlightDelay(delayParams);

      expect(mockAxiosGet).toHaveBeenCalledWith(
        expect.stringContaining('/v1/travel/predictions/flight-delay'),
        expect.any(Object)
      );
      expect(result).toBeDefined();
    });

    it('should throw on error', async () => {
      const err = makeAxiosError(500, undefined, 'Server error');
      mockAxiosGet.mockRejectedValue(err as never);

      await expect(AmadeusService.predictFlightDelay(delayParams)).rejects.toThrow(
        /Server error/i
      );
    });
  });

  // ── getAirportOnTimePerformance ───────────────────────────────────────────
  describe('getAirportOnTimePerformance', () => {
    it('should return airport on-time performance', async () => {
      const onTimeData = { data: [{ type: 'prediction', percentage: '85' }] };
      mockAxiosGet.mockResolvedValue({ data: onTimeData } as never);

      const result = await AmadeusService.getAirportOnTimePerformance({ airportCode: 'CDG', date: '2026-06-01' });

      expect(mockAxiosGet).toHaveBeenCalledWith(
        expect.stringContaining('/v1/airport/predictions/on-time'),
        expect.objectContaining({ params: expect.objectContaining({ airportCode: 'CDG' }) })
      );
      expect(result).toBeDefined();
    });

    it('should throw on error', async () => {
      const err = makeAxiosError(500, undefined, 'Server error');
      mockAxiosGet.mockRejectedValue(err as never);

      await expect(AmadeusService.getAirportOnTimePerformance({ airportCode: 'CDG', date: '2026-06-01' })).rejects.toThrow(
        /Server error/i
      );
    });
  });

  // ── getNearestRelevantAirports ────────────────────────────────────────────
  describe('getNearestRelevantAirports', () => {
    it('should return nearest airports for given coordinates', async () => {
      const airportsData = { data: [{ iataCode: 'CDG', name: 'Charles de Gaulle' }] };
      mockAxiosGet.mockResolvedValue({ data: airportsData } as never);

      const result = await AmadeusService.getNearestRelevantAirports({ latitude: 48.8566, longitude: 2.3522 });

      expect(mockAxiosGet).toHaveBeenCalledWith(
        expect.stringContaining('/v1/reference-data/airports'),
        expect.objectContaining({ params: expect.objectContaining({ latitude: 48.8566, longitude: 2.3522 }) })
      );
      expect(result).toBeDefined();
    });

    it('should include optional params when provided', async () => {
      mockAxiosGet.mockResolvedValue({ data: { data: [] } } as never);

      await AmadeusService.getNearestRelevantAirports({
        latitude: 48.8566,
        longitude: 2.3522,
        radius: 50,
        page: { limit: 5, offset: 0 },
        sort: 'relevance',
      });

      expect(mockAxiosGet).toHaveBeenCalledWith(
        expect.stringContaining('/v1/reference-data/airports'),
        expect.objectContaining({
          params: expect.objectContaining({ radius: 50, sort: 'relevance' }),
        })
      );
    });

    it('should include page offset when non-zero', async () => {
      mockAxiosGet.mockResolvedValue({ data: { data: [] } } as never);

      await AmadeusService.getNearestRelevantAirports({
        latitude: 48.8566,
        longitude: 2.3522,
        page: { limit: 5, offset: 5 },
      });

      expect(mockAxiosGet).toHaveBeenCalledWith(
        expect.stringContaining('/v1/reference-data/airports'),
        expect.objectContaining({
          params: expect.objectContaining({ 'page[offset]': 5, 'page[limit]': 5 }),
        })
      );
    });

    it('should throw on error', async () => {
      const err = makeAxiosError(500, undefined, 'Server error');
      mockAxiosGet.mockRejectedValue(err as never);

      await expect(AmadeusService.getNearestRelevantAirports({ latitude: 48.8566, longitude: 2.3522 })).rejects.toThrow(
        /Server error/i
      );
    });
  });

  // ── getAirportRoutes ──────────────────────────────────────────────────────
  describe('getAirportRoutes', () => {
    it('should return airport routes for a departure airport', async () => {
      const routesData = { data: [{ type: 'location', iataCode: 'LHR' }] };
      mockAxiosGet.mockResolvedValue({ data: routesData } as never);

      const result = await AmadeusService.getAirportRoutes({ departureAirportCode: 'CDG' });

      expect(mockAxiosGet).toHaveBeenCalledWith(
        expect.stringContaining('/v1/airport/direct-destinations'),
        expect.objectContaining({ params: expect.objectContaining({ departureAirportCode: 'CDG' }) })
      );
      expect(result).toBeDefined();
    });

    it('should throw on error', async () => {
      const err = makeAxiosError(500, undefined, 'Server error');
      mockAxiosGet.mockRejectedValue(err as never);

      await expect(AmadeusService.getAirportRoutes({ departureAirportCode: 'CDG' })).rejects.toThrow(
        /Server error/i
      );
    });
  });

  // ── getMostTraveledDestinations ───────────────────────────────────────────
  describe('getMostTraveledDestinations', () => {
    it('should return most traveled destinations', async () => {
      const travelerData = { data: [{ type: 'air-traffic', destination: 'LHR' }] };
      mockAxiosGet.mockResolvedValue({ data: travelerData } as never);

      const result = await AmadeusService.getMostTraveledDestinations({ originCityCode: 'PAR', period: '2026-06' });

      expect(mockAxiosGet).toHaveBeenCalledWith(
        expect.stringContaining('/v1/travel/analytics/air-traffic/traveled'),
        expect.objectContaining({ params: expect.objectContaining({ originCityCode: 'PAR' }) })
      );
      expect(result).toBeDefined();
    });

    it('should throw on error', async () => {
      const err = makeAxiosError(500, undefined, 'Server error');
      mockAxiosGet.mockRejectedValue(err as never);

      await expect(AmadeusService.getMostTraveledDestinations({ originCityCode: 'PAR', period: '2026-06' })).rejects.toThrow(
        /Server error/i
      );
    });
  });

  // ── getMostBookedDestinations ─────────────────────────────────────────────
  describe('getMostBookedDestinations', () => {
    it('should return most booked destinations', async () => {
      const bookedData = { data: [{ type: 'air-traffic', destination: 'LHR' }] };
      mockAxiosGet.mockResolvedValue({ data: bookedData } as never);

      const result = await AmadeusService.getMostBookedDestinations({ originCityCode: 'PAR', period: '2026-06' });

      expect(mockAxiosGet).toHaveBeenCalledWith(
        expect.stringContaining('/v1/travel/analytics/air-traffic/booked'),
        expect.objectContaining({ params: expect.objectContaining({ originCityCode: 'PAR' }) })
      );
      expect(result).toBeDefined();
    });

    it('should throw on error', async () => {
      const err = makeAxiosError(500, undefined, 'Server error');
      mockAxiosGet.mockRejectedValue(err as never);

      await expect(AmadeusService.getMostBookedDestinations({ originCityCode: 'PAR', period: '2026-06' })).rejects.toThrow(
        /Server error/i
      );
    });
  });

  // ── getBusiestTravelingPeriod ─────────────────────────────────────────────
  describe('getBusiestTravelingPeriod', () => {
    it('should return busiest traveling period', async () => {
      const busiestData = { data: [{ type: 'air-traffic', period: '2026-06' }] };
      mockAxiosGet.mockResolvedValue({ data: busiestData } as never);

      const result = await AmadeusService.getBusiestTravelingPeriod({ cityCode: 'PAR', period: '2026' });

      expect(mockAxiosGet).toHaveBeenCalledWith(
        expect.stringContaining('/v1/travel/analytics/air-traffic/busiest-period'),
        expect.objectContaining({ params: expect.objectContaining({ cityCode: 'PAR' }) })
      );
      expect(result).toBeDefined();
    });

    it('should throw on error', async () => {
      const err = makeAxiosError(500, undefined, 'Server error');
      mockAxiosGet.mockRejectedValue(err as never);

      await expect(AmadeusService.getBusiestTravelingPeriod({ cityCode: 'PAR', period: '2026' })).rejects.toThrow(
        /Server error/i
      );
    });
  });

  // ── getFlightCheckinLinks ─────────────────────────────────────────────────
  describe('getFlightCheckinLinks', () => {
    it('should return check-in links for a given airline', async () => {
      const checkinData = { data: [{ type: 'checkin-link', href: 'https://airline.com/checkin' }] };
      mockAxiosGet.mockResolvedValue({ data: checkinData } as never);

      const result = await AmadeusService.getFlightCheckinLinks({ airlineCode: 'AF' });

      expect(mockAxiosGet).toHaveBeenCalledWith(
        expect.stringContaining('/v2/reference-data/urls/checkin-links'),
        expect.objectContaining({ params: expect.objectContaining({ airlineCode: 'AF' }) })
      );
      expect(result).toBeDefined();
    });

    it('should throw on error', async () => {
      const err = makeAxiosError(500, undefined, 'Server error');
      mockAxiosGet.mockRejectedValue(err as never);

      await expect(AmadeusService.getFlightCheckinLinks({ airlineCode: 'AF' })).rejects.toThrow(
        /Server error/i
      );
    });
  });

  // ── lookupAirlineCode ─────────────────────────────────────────────────────
  describe('lookupAirlineCode', () => {
    it('should return airline information by IATA code', async () => {
      const airlineData = { data: [{ type: 'airline', iataCode: 'AF', name: 'Air France' }] };
      mockAxiosGet.mockResolvedValue({ data: airlineData } as never);

      const result = await AmadeusService.lookupAirlineCode({ IATACode: 'AF' });

      expect(mockCacheWrapper).toHaveBeenCalledWith(
        'airlines',
        expect.any(Object),
        expect.any(Function)
      );
      expect(result).toBeDefined();
    });

    it('should throw on error', async () => {
      const err = makeAxiosError(500, undefined, 'Server error');
      mockAxiosGet.mockRejectedValue(err as never);

      await expect(AmadeusService.lookupAirlineCode({ IATACode: 'AF' })).rejects.toThrow(
        /Server error/i
      );
    });
  });

  // ── getAirlineRoutes ──────────────────────────────────────────────────────
  describe('getAirlineRoutes', () => {
    it('should return airline routes for a given airline', async () => {
      const routesData = { data: [{ type: 'location', iataCode: 'LHR' }] };
      mockAxiosGet.mockResolvedValue({ data: routesData } as never);

      const result = await AmadeusService.getAirlineRoutes({ airlineCode: 'AF' });

      expect(mockAxiosGet).toHaveBeenCalledWith(
        expect.stringContaining('/v1/airline/destinations'),
        expect.objectContaining({ params: expect.objectContaining({ airlineCode: 'AF' }) })
      );
      expect(result).toBeDefined();
    });

    it('should throw on error', async () => {
      const err = makeAxiosError(500, undefined, 'Server error');
      mockAxiosGet.mockRejectedValue(err as never);

      await expect(AmadeusService.getAirlineRoutes({ airlineCode: 'AF' })).rejects.toThrow(
        /Server error/i
      );
    });
  });

  // ── searchTransfers ───────────────────────────────────────────────────────
  describe('searchTransfers', () => {
    const transferParams = {
      startLocationCode: 'CDG',
      endLocationCode: 'LHR',
      transferType: 'PRIVATE',
      startDateTime: '2026-06-01T10:00:00',
      passengers: 2,
    };

    it('should return transfer offers', async () => {
      const transferData = { data: [{ type: 'transfer-offer', id: 'TRANSFER123' }] };
      mockAxiosPost.mockResolvedValue({ data: transferData } as never);

      const result = await AmadeusService.searchTransfers(transferParams);

      expect(mockAxiosPost).toHaveBeenCalledWith(
        expect.stringContaining('/v1/shopping/transfer-offers'),
        expect.anything()
      );
      expect(result).toBeDefined();
    });

    it('should throw on error', async () => {
      const err = makeAxiosError(500, undefined, 'Server error');
      mockAxiosPost.mockRejectedValue(err as never);

      await expect(AmadeusService.searchTransfers(transferParams)).rejects.toThrow(
        /Server error/i
      );
    });
  });

  // ── createTransferBooking ─────────────────────────────────────────────────
  describe('createTransferBooking', () => {
    it('should create a transfer booking', async () => {
      const bookingData = { data: { id: 'TBOOKING123', type: 'transfer-order' } };
      mockAxiosPost.mockResolvedValue({ data: bookingData } as never);

      const result = await AmadeusService.createTransferBooking({ offerId: 'TRANSFER123' });

      expect(mockAxiosPost).toHaveBeenCalledWith(
        expect.stringContaining('/v1/ordering/transfer-orders'),
        expect.anything()
      );
      expect(result).toBeDefined();
    });

    it('should throw on error', async () => {
      const err = makeAxiosError(400, undefined, 'Bad request');
      mockAxiosPost.mockRejectedValue(err as never);

      await expect(AmadeusService.createTransferBooking({})).rejects.toThrow(
        /Bad Request/
      );
    });
  });

  // ── getTransferOrder ──────────────────────────────────────────────────────
  describe('getTransferOrder', () => {
    it('should retrieve a transfer order by ID', async () => {
      const orderData = { data: { id: 'TORDER123', type: 'transfer-order' } };
      mockAxiosGet.mockResolvedValue({ data: orderData } as never);

      const result = await AmadeusService.getTransferOrder('TORDER123');

      expect(mockAxiosGet).toHaveBeenCalledWith(
        expect.stringContaining('/v1/ordering/transfer-orders/TORDER123'),
        expect.any(Object)
      );
      expect(result).toBeDefined();
    });

    it('should throw on error', async () => {
      const err = makeAxiosError(404, undefined, 'Not found');
      mockAxiosGet.mockRejectedValue(err as never);

      await expect(AmadeusService.getTransferOrder('INVALID')).rejects.toThrow(
        /not found/i
      );
    });
  });

  // ── cancelTransferOrder ───────────────────────────────────────────────────
  describe('cancelTransferOrder', () => {
    it('should cancel a transfer order by ID', async () => {
      mockAxiosDelete.mockResolvedValue({ data: {} } as never);

      const result = await AmadeusService.cancelTransferOrder('TORDER123');

      expect(mockAxiosDelete).toHaveBeenCalledWith(
        expect.stringContaining('/v1/ordering/transfer-orders/TORDER123'),
        expect.any(Object)
      );
      expect(result).toBeDefined();
    });

    it('should throw on error', async () => {
      const err = makeAxiosError(404, undefined, 'Not found');
      mockAxiosDelete.mockRejectedValue(err as never);

      await expect(AmadeusService.cancelTransferOrder('INVALID')).rejects.toThrow(
        /not found/i
      );
    });
  });

  // ── getHotelRatings ───────────────────────────────────────────────────────
  describe('getHotelRatings', () => {
    it('should return hotel ratings/sentiments', async () => {
      const ratingsData = { data: [{ type: 'hotel-sentiment', hotelId: 'HLPAR001' }] };
      mockAxiosGet.mockResolvedValue({ data: ratingsData } as never);

      const result = await AmadeusService.getHotelRatings({ hotelIds: 'HLPAR001' });

      expect(mockAxiosGet).toHaveBeenCalledWith(
        expect.stringContaining('/v2/e-reputation/hotel-sentiments'),
        expect.objectContaining({ params: expect.objectContaining({ hotelIds: 'HLPAR001' }) })
      );
      expect(result).toBeDefined();
    });

    it('should throw on error', async () => {
      const err = makeAxiosError(500, undefined, 'Server error');
      mockAxiosGet.mockRejectedValue(err as never);

      await expect(AmadeusService.getHotelRatings({ hotelIds: 'HLPAR001' })).rejects.toThrow(
        /Server error/i
      );
    });
  });

  // ── searchHotelNames ──────────────────────────────────────────────────────
  describe('searchHotelNames', () => {
    it('should return hotel names for a keyword', async () => {
      const hotelNamesData = { data: [{ name: 'Marriott Paris' }] };
      mockAxiosGet.mockResolvedValue({ data: hotelNamesData } as never);

      const result = await AmadeusService.searchHotelNames({ keyword: 'Marriott' });

      expect(mockAxiosGet).toHaveBeenCalledWith(
        expect.stringContaining('/v1/reference-data/locations/hotel'),
        expect.objectContaining({ params: expect.objectContaining({ keyword: 'Marriott', subType: 'HOTEL' }) })
      );
      expect(result).toBeDefined();
    });

    it('should include optional page params', async () => {
      mockAxiosGet.mockResolvedValue({ data: { data: [] } } as never);

      await AmadeusService.searchHotelNames({
        keyword: 'Hilton',
        countryCode: 'FR',
        page: { limit: 5, offset: 10 },
      });

      expect(mockAxiosGet).toHaveBeenCalledWith(
        expect.stringContaining('/v1/reference-data/locations/hotel'),
        expect.objectContaining({
          params: expect.objectContaining({
            countryCode: 'FR',
            'page[limit]': 5,
            'page[offset]': 10,
          }),
        })
      );
    });

    it('should throw on error', async () => {
      const err = makeAxiosError(500, undefined, 'Server error');
      mockAxiosGet.mockRejectedValue(err as never);

      await expect(AmadeusService.searchHotelNames({ keyword: 'Hilton' })).rejects.toThrow(
        /Server error/i
      );
    });
  });

  // ── getHotelList ──────────────────────────────────────────────────────────
  describe('getHotelList', () => {
    it('should return hotels by cityCode', async () => {
      const hotelListData = { data: [{ hotelId: 'HLPAR001' }] };
      mockAxiosGet.mockResolvedValue({ data: hotelListData } as never);

      const result = await AmadeusService.getHotelList({ cityCode: 'PAR' });

      expect(mockAxiosGet).toHaveBeenCalledWith(
        expect.stringContaining('/v1/reference-data/locations/hotels/by-city'),
        expect.objectContaining({ params: expect.objectContaining({ cityCode: 'PAR' }) })
      );
      expect(result).toBeDefined();
    });

    it('should return hotels by latitude/longitude', async () => {
      const hotelListData = { data: [{ hotelId: 'HLPAR001' }] };
      mockAxiosGet.mockResolvedValue({ data: hotelListData } as never);

      const result = await AmadeusService.getHotelList({ latitude: 48.8566, longitude: 2.3522 });

      expect(mockAxiosGet).toHaveBeenCalledWith(
        expect.stringContaining('/v1/reference-data/locations/hotels/by-city'),
        expect.objectContaining({
          params: expect.objectContaining({ latitude: 48.8566, longitude: 2.3522 }),
        })
      );
      expect(result).toBeDefined();
    });

    it('should include optional amenities and ratings', async () => {
      mockAxiosGet.mockResolvedValue({ data: { data: [] } } as never);

      await AmadeusService.getHotelList({
        cityCode: 'PAR',
        radius: 5,
        radiusUnit: 'KM',
        amenities: ['POOL', 'SPA'],
        ratings: ['4', '5'],
        hotelSource: 'ALL',
      });

      expect(mockAxiosGet).toHaveBeenCalledWith(
        expect.stringContaining('/v1/reference-data/locations/hotels/by-city'),
        expect.objectContaining({
          params: expect.objectContaining({
            amenities: 'POOL,SPA',
            ratings: '4,5',
            hotelSource: 'ALL',
          }),
        })
      );
    });

    it('should throw on error', async () => {
      const err = makeAxiosError(500, undefined, 'Server error');
      mockAxiosGet.mockRejectedValue(err as never);

      await expect(AmadeusService.getHotelList({ cityCode: 'PAR' })).rejects.toThrow(
        /Server error/i
      );
    });
  });

  // ── resolveLocationCode ───────────────────────────────────────────────────
  describe('resolveLocationCode', () => {
    it('should return IATA code directly if input is already 3-letter IATA code', async () => {
      const result = await AmadeusService.resolveLocationCode('CDG');
      expect(result).toBe('CDG');
      expect(mockAxiosGet).not.toHaveBeenCalled();
    });

    it('should resolve city name to IATA code via airport search', async () => {
      const airportResponse = { data: [{ iataCode: 'CDG', name: 'Charles de Gaulle' }] };
      mockCacheWrapper.mockResolvedValue(airportResponse as never);

      const result = await AmadeusService.resolveLocationCode('Paris');
      expect(result).toBe('CDG');
    });

    it('should fall back to city search when airport search returns no data', async () => {
      // First call (airport search) returns empty, second call (city search) returns city
      mockCacheWrapper
        .mockResolvedValueOnce({ data: [] } as never)
        .mockResolvedValueOnce({ data: [{ iataCode: 'CDG' }] } as never);

      const result = await AmadeusService.resolveLocationCode('Paris');
      expect(result).toBe('CDG');
    });

    it('should use hardcoded mapping when both searches fail', async () => {
      mockCacheWrapper.mockRejectedValue(new Error('Search failed') as never);

      const result = await AmadeusService.resolveLocationCode('Bangkok');
      expect(result).toBe('BKK');
    });

    it('should use hardcoded mapping for known cities when search returns empty', async () => {
      mockCacheWrapper
        .mockResolvedValueOnce({ data: [] } as never)
        .mockResolvedValueOnce({ data: [] } as never);

      const result = await AmadeusService.resolveLocationCode('london');
      expect(result).toBe('LHR');
    });

    it('should return uppercased input when location cannot be resolved', async () => {
      mockCacheWrapper
        .mockResolvedValueOnce({ data: [] } as never)
        .mockResolvedValueOnce({ data: [] } as never);

      const result = await AmadeusService.resolveLocationCode('unknowncity');
      expect(result).toBe('UNKNOWNCITY');
    });

    it('should return uppercased input on exception', async () => {
      mockCacheWrapper.mockRejectedValue(new Error('crash') as never);

      const result = await AmadeusService.resolveLocationCode('errorplace');
      expect(result).toBe('ERRORPLACE');
    });

    it('should resolve cannes to NCE via hardcoded mapping', async () => {
      mockCacheWrapper
        .mockResolvedValueOnce({ data: [] } as never)
        .mockResolvedValueOnce({ data: [] } as never);

      const result = await AmadeusService.resolveLocationCode('cannes');
      expect(result).toBe('NCE');
    });
  });

  // ── getHotelImages ────────────────────────────────────────────────────────
  describe('getHotelImages', () => {
    it('should return hotel images for a given hotelId', async () => {
      const imagesData = { data: [{ url: 'https://hotel.com/image.jpg' }] };
      mockAxiosGet.mockResolvedValue({ data: imagesData } as never);

      const result = await AmadeusService.getHotelImages({ hotelId: 'HLPAR001' });

      expect(mockAxiosGet).toHaveBeenCalledWith(
        expect.stringContaining('/v1/shopping/hotel-offers/HLPAR001/images')
      );
      expect(result).toBeDefined();
    });

    it('should throw on error', async () => {
      const err = makeAxiosError(404, undefined, 'Not found');
      mockAxiosGet.mockRejectedValue(err as never);

      await expect(AmadeusService.getHotelImages({ hotelId: 'INVALID' })).rejects.toThrow(
        /not found/i
      );
    });
  });

  // ── searchAirports ────────────────────────────────────────────────────────
  describe('searchAirports', () => {
    it('should return airports matching a keyword', async () => {
      const airportData = { data: [{ iataCode: 'CDG', name: 'Charles de Gaulle', subType: 'AIRPORT' }] };
      mockAxiosGet.mockResolvedValue({ data: airportData } as never);

      const result = await AmadeusService.searchAirports({ keyword: 'Paris' });

      expect(mockCacheWrapper).toHaveBeenCalledWith(
        'airports',
        expect.objectContaining({ keyword: 'Paris', subType: 'AIRPORT' }),
        expect.any(Function)
      );
      expect(result).toBeDefined();
    });

    it('should throw on error', async () => {
      const err = makeAxiosError(500, undefined, 'Server error');
      mockAxiosGet.mockRejectedValue(err as never);

      await expect(AmadeusService.searchAirports({ keyword: 'Paris' })).rejects.toThrow(
        /Server error/i
      );
    });
  });

  // ── getFlightPriceAnalysis ────────────────────────────────────────────────
  describe('getFlightPriceAnalysis', () => {
    it('should delegate to analyzeFlightPrices', async () => {
      const priceData = { data: [{ type: 'itinerary-price-metric' }] };
      mockAxiosGet.mockResolvedValue({ data: priceData } as never);

      const result = await AmadeusService.getFlightPriceAnalysis({
        originIataCode: 'CDG',
        destinationIataCode: 'LHR',
        departureDate: '2026-06-01',
      });

      expect(mockCacheWrapper).toHaveBeenCalledWith(
        'flightPrices',
        expect.any(Object),
        expect.any(Function)
      );
      expect(result).toBeDefined();
    });
  });

  // ── getFlightChoicePrediction ─────────────────────────────────────────────
  describe('getFlightChoicePrediction', () => {
    it('should delegate to predictFlightChoice', async () => {
      const predictionData = { data: [{ choiceProbability: '0.8' }] };
      mockAxiosPost.mockResolvedValue({ data: predictionData } as never);

      const result = await AmadeusService.getFlightChoicePrediction({ flightOffers: [] });

      expect(mockAxiosPost).toHaveBeenCalledWith(
        expect.stringContaining('/v2/shopping/flight-offers/prediction'),
        expect.anything()
      );
      expect(result).toBeDefined();
    });
  });

  // ── getFlightOffersPrice ──────────────────────────────────────────────────
  describe('getFlightOffersPrice', () => {
    it('should return pricing for a single flight offer', async () => {
      const pricingData = { data: { flightOffers: [{ price: { total: '250.00' } }] } };
      mockAxiosPost.mockResolvedValue({ data: pricingData } as never);

      const result = await AmadeusService.getFlightOffersPrice({ id: 'offer-1' });

      expect(mockAxiosPost).toHaveBeenCalledWith(
        expect.stringContaining('/v1/shopping/flight-offers/pricing'),
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'flight-offers-pricing',
            flightOffers: [{ id: 'offer-1' }],
          }),
        })
      );
      expect(result).toBeDefined();
    });

    it('should return pricing for an array of flight offers', async () => {
      const pricingData = { data: { flightOffers: [] } };
      mockAxiosPost.mockResolvedValue({ data: pricingData } as never);

      const result = await AmadeusService.getFlightOffersPrice([{ id: 'offer-1' }, { id: 'offer-2' }]);

      expect(mockAxiosPost).toHaveBeenCalledWith(
        expect.stringContaining('/v1/shopping/flight-offers/pricing'),
        expect.objectContaining({
          data: expect.objectContaining({
            flightOffers: [{ id: 'offer-1' }, { id: 'offer-2' }],
          }),
        })
      );
      expect(result).toBeDefined();
    });

    it('should throw on error', async () => {
      const err = makeAxiosError(500, undefined, 'Server error');
      mockAxiosPost.mockRejectedValue(err as never);

      await expect(AmadeusService.getFlightOffersPrice({ id: 'offer-1' })).rejects.toThrow(
        /Server error/i
      );
    });
  });

  // ── getActivityById ───────────────────────────────────────────────────────
  describe('getActivityById', () => {
    it('should return activity details by ID', async () => {
      const activityData = { data: { id: 'ACT123', name: 'Museum Tour' } };
      mockAxiosGet.mockResolvedValue({ data: activityData } as never);

      const result = await AmadeusService.getActivityById('ACT123');

      expect(mockAxiosGet).toHaveBeenCalledWith(
        expect.stringContaining('/v1/shopping/activities/ACT123')
      );
      expect(result).toBeDefined();
    });

    it('should rethrow errors from getActivityById', async () => {
      const err = makeAxiosError(404, undefined, 'Not found');
      mockAxiosGet.mockRejectedValue(err as never);

      await expect(AmadeusService.getActivityById('INVALID')).rejects.toBeDefined();
    });
  });

  // ── Error handling ────────────────────────────────────────────────────────
  describe('Error handling', () => {
    it('should throw rate limit error on 429', async () => {
      const err = makeAxiosError(429, undefined, 'Too many requests');
      mockAxiosGet.mockRejectedValue(err as never);

      await expect(AmadeusService.searchLocations({ keyword: 'Paris' })).rejects.toThrow(
        /[Rr]ate limit|[Tt]oo many/
      );
    });

    it('should throw authentication error on 401', async () => {
      const err = makeAxiosError(401, undefined, 'Unauthorized');
      mockAxiosGet.mockRejectedValue(err as never);

      await expect(AmadeusService.searchLocations({ keyword: 'Paris' })).rejects.toThrow(
        /[Aa]uth/
      );
    });

    it('should throw network error when no response received', async () => {
      const err: any = new Error('Network error');
      err.request    = {};
      err.isAxiosError = true;
      mockAxiosGet.mockRejectedValue(err as never);

      await expect(AmadeusService.searchLocations({ keyword: 'Paris' })).rejects.toThrow(
        /[Nn]etwork|[Nn]o response/
      );
    });

    it('should map Amadeus error code 141 to descriptive message', async () => {
      const err = makeAxiosError(500, 141, 'Amadeus system error');
      mockAxiosGet.mockRejectedValue(err as never);

      await expect(AmadeusService.searchLocations({ keyword: 'Paris' })).rejects.toThrow(/141/);
    });

    it('should map Amadeus error code 32171 to invalid location message', async () => {
      const err = makeAxiosError(400, 32171, 'Invalid location code');
      mockAxiosGet.mockRejectedValue(err as never);

      await expect(AmadeusService.searchLocations({ keyword: 'ZZZ' })).rejects.toThrow(
        /[Ii]nvalid location/
      );
    });

    it('should return general API error for other status codes', async () => {
      const err = makeAxiosError(422, undefined, 'Unprocessable');
      mockAxiosGet.mockRejectedValue(err as never);

      await expect(AmadeusService.searchFlights(flightSearchParams)).rejects.toThrow(
        /API Error/
      );
    });

    it('should use amadeusError.detail when error code is unrecognized', async () => {
      const err: any = new Error('Custom error');
      err.isAxiosError = true;
      err.response = {
        status: 400,
        data: { errors: [{ code: 99999, detail: 'custom detail message', title: 'custom title' }] },
      };
      err.config = { url: '/test' };
      mockAxiosGet.mockRejectedValue(err as never);

      await expect(AmadeusService.searchFlights(flightSearchParams)).rejects.toThrow(/custom detail message/);
    });

    it('should handle 400 error with empty errors array', async () => {
      const err: any = new Error('Bad request');
      err.isAxiosError = true;
      err.response = { status: 400, data: { errors: [] } };
      err.config = { url: '/test' };
      mockAxiosGet.mockRejectedValue(err as never);

      await expect(AmadeusService.searchFlights(flightSearchParams)).rejects.toThrow(/Bad Request/);
    });

    it('should use data.error_description when amadeusError and detail are absent', async () => {
      const err: any = new Error('Auth error');
      err.isAxiosError = true;
      err.response = { status: 400, data: { error_description: 'token_expired' } };
      err.config = { url: '/test' };
      mockAxiosGet.mockRejectedValue(err as never);

      await expect(AmadeusService.searchFlights(flightSearchParams)).rejects.toThrow(/token_expired/);
    });
  });

  // ── Circuit Breaker ───────────────────────────────────────────────────────
  describe('Circuit Breaker', () => {
    it('should throw when circuit breaker is open', async () => {
      (AmadeusService as any).isCircuitOpen = true;
      (AmadeusService as any).circuitBreakerLastFailureTime = Date.now();

      expect(() => (AmadeusService as any).checkCircuitBreaker()).toThrow(/Circuit breaker is open/);
    });

    it('should reset circuit breaker after timeout has elapsed', () => {
      (AmadeusService as any).isCircuitOpen = true;
      (AmadeusService as any).circuitBreakerLastFailureTime = Date.now() - 70000; // 70 seconds ago

      // Should NOT throw - circuit breaker resets
      expect(() => (AmadeusService as any).checkCircuitBreaker()).not.toThrow();
      expect((AmadeusService as any).isCircuitOpen).toBe(false);
      expect((AmadeusService as any).circuitBreakerFailureCount).toBe(0);
    });

    it('should not throw when circuit breaker is closed', () => {
      (AmadeusService as any).isCircuitOpen = false;
      expect(() => (AmadeusService as any).checkCircuitBreaker()).not.toThrow();
    });
  });

  describe('Rate limiting', () => {
    it('enforceRateLimit should wait when requests are too close together', async () => {
      jest.useFakeTimers();
      (AmadeusService as any).lastRequestTime = Date.now();

      const pending = (AmadeusService as any).enforceRateLimit();
      await jest.runAllTimersAsync();
      await expect(pending).resolves.toBeUndefined();

      jest.useRealTimers();
    });

    it('enforceRateLimit should proceed immediately when enough time has elapsed', async () => {
      (AmadeusService as any).lastRequestTime = Date.now() - 3000;

      await expect((AmadeusService as any).enforceRateLimit()).resolves.toBeUndefined();
    });
  });

  // ── cleanLocationKeyword ──────────────────────────────────────────────────
  describe('cleanLocationKeyword (private)', () => {
    it('should return empty string for empty input', () => {
      const result = (AmadeusService as any).cleanLocationKeyword('');
      expect(result).toBe('');
    });

    it('should trim whitespace', () => {
      const result = (AmadeusService as any).cleanLocationKeyword('  Paris  ');
      expect(result).toBe('Paris');
    });

    it('should extract city from CITY, COUNTRY format', () => {
      const result = (AmadeusService as any).cleanLocationKeyword('Paris, France');
      expect(result).toBe('Paris');
    });

    it('should convert all-caps longer than 3 chars to title case', () => {
      const result = (AmadeusService as any).cleanLocationKeyword('LONDON');
      expect(result).toBe('London');
    });

    it('should NOT convert short all-caps codes', () => {
      const result = (AmadeusService as any).cleanLocationKeyword('CDG');
      expect(result).toBe('CDG');
    });
  });

  describe('Additional branches', () => {
    it('resolveLocationCode should hit the outer catch and still uppercase the input', async () => {
      const original = (AmadeusService as any).cleanLocationKeyword;
      (AmadeusService as any).cleanLocationKeyword = jest.fn(() => {
        throw new Error('clean failed');
      });

      await expect(AmadeusService.resolveLocationCode('berlin')).resolves.toBe('BERLIN');

      (AmadeusService as any).cleanLocationKeyword = original;
    });
  });
});
