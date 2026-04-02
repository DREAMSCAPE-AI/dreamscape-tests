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

const mockAxiosInstance = {
  get:      mockAxiosGet,
  post:     mockAxiosPost,
  request:  mockAxiosRequest,
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
  });
});
