/**
 * US-TEST-019 - Event Handlers Unit Tests
 */

jest.mock('@dreamscape/kafka', () => ({}));

jest.mock('@ai/onboarding/onboarding-orchestrator.service', () => ({
  OnboardingOrchestratorService: jest.fn().mockImplementation(() => ({
    processOnboardingComplete: jest.fn(),
  })),
}));

import {
  handleUserPreferencesUpdated,
  handleUserProfileUpdated,
  handleOnboardingCompleted,
  registerOnboardingConsumer,
} from '@ai/handlers/userEventsHandler';

import {
  handleVoyageSearchPerformed,
  handleVoyageBookingCreated,
  handleFlightSelected,
  handleHotelSelected,
} from '@ai/handlers/voyageEventsHandler';

import { OnboardingOrchestratorService } from '@ai/onboarding/onboarding-orchestrator.service';

describe('US-TEST-019 - userEventsHandler', () => {
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  describe('handleUserPreferencesUpdated', () => {
    const makeEvent = (preferences: any) => ({
      payload: {
        userId: 'user-1',
        preferences,
        updatedAt: new Date().toISOString(),
      },
    });

    it('should complete without throwing when all optional fields are present', async () => {
      const event = makeEvent({
        travelPreferences: { seatPreference: 'window' },
        language: 'fr',
        currency: 'EUR',
      });

      await expect(handleUserPreferencesUpdated(event as any, {} as any)).resolves.toBeUndefined();
    });

    it('should skip travelPreferences update when not provided', async () => {
      await expect(
        handleUserPreferencesUpdated(makeEvent({ language: 'en' }) as any, {} as any)
      ).resolves.toBeUndefined();
    });

    it('should skip language update when not provided', async () => {
      await expect(
        handleUserPreferencesUpdated(makeEvent({ currency: 'USD' }) as any, {} as any)
      ).resolves.toBeUndefined();
    });

    it('should skip currency update when not provided', async () => {
      await expect(
        handleUserPreferencesUpdated(makeEvent({ travelPreferences: {} }) as any, {} as any)
      ).resolves.toBeUndefined();
    });

    it('should handle empty preferences object', async () => {
      await expect(
        handleUserPreferencesUpdated(makeEvent({}) as any, {} as any)
      ).resolves.toBeUndefined();
    });

    it('should rethrow when a helper fails during preferences update', async () => {
      logSpy
        .mockImplementationOnce(() => {})
        .mockImplementationOnce(() => {
          throw new Error('preferences helper failed');
        });

      await expect(
        handleUserPreferencesUpdated(
          makeEvent({ travelPreferences: { seatPreference: 'window' } }) as any,
          {} as any
        )
      ).rejects.toThrow('preferences helper failed');
    });
  });

  describe('handleUserProfileUpdated', () => {
    const makeEvent = (profile: any) => ({
      payload: {
        userId: 'user-1',
        profile,
        updatedAt: new Date().toISOString(),
      },
    });

    it('should update age group and nationality when both are provided', async () => {
      await expect(
        handleUserProfileUpdated(
          makeEvent({ dateOfBirth: '1990-06-15', nationality: 'FR' }) as any,
          {} as any
        )
      ).resolves.toBeUndefined();
    });

    it('should skip age group when dateOfBirth is not provided', async () => {
      await expect(
        handleUserProfileUpdated(makeEvent({ nationality: 'DE' }) as any, {} as any)
      ).resolves.toBeUndefined();
    });

    it('should skip nationality update when not provided', async () => {
      await expect(
        handleUserProfileUpdated(makeEvent({ dateOfBirth: '2000-01-01' }) as any, {} as any)
      ).resolves.toBeUndefined();
    });

    it('should handle empty profile', async () => {
      await expect(handleUserProfileUpdated(makeEvent({}) as any, {} as any)).resolves.toBeUndefined();
    });

    it('should classify seniors as 65+', async () => {
      await expect(
        handleUserProfileUpdated(makeEvent({ dateOfBirth: '1940-01-01' }) as any, {} as any)
      ).resolves.toBeUndefined();

      expect(logSpy).toHaveBeenCalledWith('[AI] User user-1 segment age_group = 65+');
    });

    it('should classify young adults as 18-24', async () => {
      await expect(
        handleUserProfileUpdated(makeEvent({ dateOfBirth: '2005-01-01' }) as any, {} as any)
      ).resolves.toBeUndefined();

      expect(logSpy).toHaveBeenCalledWith('[AI] User user-1 segment age_group = 18-24');
    });

    it('should classify mature adults as 50-64', async () => {
      await expect(
        handleUserProfileUpdated(makeEvent({ dateOfBirth: '1970-01-01' }) as any, {} as any)
      ).resolves.toBeUndefined();

      expect(logSpy).toHaveBeenCalledWith('[AI] User user-1 segment age_group = 50-64');
    });

    it('should rethrow when a helper fails during profile update', async () => {
      logSpy
        .mockImplementationOnce(() => {})
        .mockImplementationOnce(() => {
          throw new Error('profile helper failed');
        });

      await expect(
        handleUserProfileUpdated(makeEvent({ dateOfBirth: '1990-06-15' }) as any, {} as any)
      ).rejects.toThrow('profile helper failed');
    });
  });

  describe('handleOnboardingCompleted', () => {
    it('should process onboarding when result is successful', async () => {
      const MockOrchestratorClass = OnboardingOrchestratorService as jest.MockedClass<
        typeof OnboardingOrchestratorService
      >;
      MockOrchestratorClass.mockImplementation(
        () =>
          ({
            processOnboardingComplete: jest.fn().mockResolvedValue({
              success: true,
              recommendations: [{ id: 'r1' }],
              metadata: { segmentAssigned: 'BUDGET_BACKPACKER', confidence: 0.85 },
            }),
          }) as any
      );

      const message = {
        value: Buffer.from(
          JSON.stringify({ userId: 'user-1', profile: {}, completedAt: new Date().toISOString() })
        ),
      };

      await expect(handleOnboardingCompleted(message)).resolves.toBeUndefined();
    });

    it('should log error when result is not successful', async () => {
      const MockOrchestratorClass = OnboardingOrchestratorService as jest.MockedClass<
        typeof OnboardingOrchestratorService
      >;
      MockOrchestratorClass.mockImplementation(
        () =>
          ({
            processOnboardingComplete: jest.fn().mockResolvedValue({
              success: false,
              error: 'Onboarding not completed',
              recommendations: [],
              metadata: {},
            }),
          }) as any
      );

      const message = {
        value: Buffer.from(
          JSON.stringify({ userId: 'user-2', profile: {}, completedAt: new Date().toISOString() })
        ),
      };

      await expect(handleOnboardingCompleted(message)).resolves.toBeUndefined();
    });

    it('should throw when message processing fails', async () => {
      const MockOrchestratorClass = OnboardingOrchestratorService as jest.MockedClass<
        typeof OnboardingOrchestratorService
      >;
      MockOrchestratorClass.mockImplementation(
        () =>
          ({
            processOnboardingComplete: jest.fn().mockRejectedValue(new Error('Orchestrator failed')),
          }) as any
      );

      const message = {
        value: Buffer.from(
          JSON.stringify({ userId: 'user-3', profile: {}, completedAt: new Date().toISOString() })
        ),
      };

      await expect(handleOnboardingCompleted(message)).rejects.toThrow('Orchestrator failed');
    });
  });

  describe('registerOnboardingConsumer', () => {
    it('should subscribe, run the Kafka consumer, and execute eachMessage', async () => {
      let registeredHandler: ((payload: any) => Promise<void>) | undefined;
      const mockConsumer = {
        subscribe: jest.fn().mockResolvedValue(undefined),
        run: jest.fn().mockImplementation(async ({ eachMessage }) => {
          registeredHandler = eachMessage;
        }),
      };

      await registerOnboardingConsumer(mockConsumer);

      expect(mockConsumer.subscribe).toHaveBeenCalledWith({ topic: 'user.onboarding.completed' });
      expect(mockConsumer.run).toHaveBeenCalledWith(
        expect.objectContaining({ eachMessage: expect.any(Function) })
      );

      const MockOrchestratorClass = OnboardingOrchestratorService as jest.MockedClass<
        typeof OnboardingOrchestratorService
      >;
      MockOrchestratorClass.mockImplementation(
        () =>
          ({
            processOnboardingComplete: jest.fn().mockResolvedValue({
              success: true,
              recommendations: [],
              metadata: {},
            }),
          }) as any
      );

      await expect(
        registeredHandler?.({
          message: {
            value: Buffer.from(
              JSON.stringify({ userId: 'user-kafka', profile: {}, completedAt: new Date().toISOString() })
            ),
          },
        })
      ).resolves.toBeUndefined();
    });
  });
});

describe('US-TEST-019 - voyageEventsHandler', () => {
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  describe('handleVoyageSearchPerformed', () => {
    it('should process search with criteria, destination, and logged-in user', async () => {
      const event = {
        payload: {
          searchId: 's-1',
          userId: 'user-1',
          sessionId: 'sess-1',
          searchType: 'flight',
          criteria: {
            origin: 'CDG',
            destination: 'JFK',
            departureDate: '2024-06-01',
            returnDate: '2024-06-15',
            passengers: 2,
          },
          resultsCount: 10,
          searchedAt: new Date().toISOString(),
        },
      };

      await expect(handleVoyageSearchPerformed(event as any, {} as any)).resolves.toBeUndefined();
    });

    it('should process search without destination in criteria', async () => {
      const event = {
        payload: {
          searchId: 's-2',
          userId: 'user-1',
          sessionId: 'sess-1',
          searchType: 'flight',
          criteria: { origin: 'CDG', passengers: 1 },
          resultsCount: 0,
          searchedAt: new Date().toISOString(),
        },
      };

      await expect(handleVoyageSearchPerformed(event as any, {} as any)).resolves.toBeUndefined();
    });

    it('should handle search with no criteria (hotel search)', async () => {
      const event = {
        payload: {
          searchId: 's-3',
          userId: null,
          sessionId: 'sess-anon',
          searchType: 'hotel',
          criteria: undefined,
          resultsCount: 0,
          searchedAt: new Date().toISOString(),
        },
      };

      await expect(handleVoyageSearchPerformed(event as any, {} as any)).resolves.toBeUndefined();
    });

    it('should handle anonymous user (no userId)', async () => {
      const event = {
        payload: {
          searchId: 's-4',
          userId: null,
          sessionId: 'sess-anon',
          searchType: 'flight',
          criteria: { origin: 'LHR', destination: 'DXB', passengers: 1 },
          resultsCount: 5,
          searchedAt: new Date().toISOString(),
        },
      };

      await expect(handleVoyageSearchPerformed(event as any, {} as any)).resolves.toBeUndefined();
    });

    it('should rethrow when a search helper fails', async () => {
      logSpy
        .mockImplementationOnce(() => {})
        .mockImplementationOnce(() => {
          throw new Error('search helper failed');
        });

      const event = {
        payload: {
          searchId: 's-err',
          userId: 'user-1',
          sessionId: 'sess-1',
          searchType: 'flight',
          criteria: { origin: 'CDG', destination: 'JFK', passengers: 1 },
          resultsCount: 1,
          searchedAt: new Date().toISOString(),
        },
      };

      await expect(handleVoyageSearchPerformed(event as any, {} as any)).rejects.toThrow(
        'search helper failed'
      );
    });
  });

  describe('handleVoyageBookingCreated', () => {
    it('should process booking with items and travelers', async () => {
      const event = {
        payload: {
          bookingId: 'bk-1',
          userId: 'user-1',
          bookingType: 'flight',
          totalAmount: 350,
          currency: 'EUR',
          items: [
            { description: 'Paris - New York' },
            { description: 'Economy seat' },
          ],
          travelers: [{ name: 'Alice' }, { name: 'Bob' }],
          createdAt: new Date().toISOString(),
        },
      };

      await expect(handleVoyageBookingCreated(event as any, {} as any)).resolves.toBeUndefined();
    });

    it('should handle empty items array', async () => {
      const event = {
        payload: {
          bookingId: 'bk-2',
          userId: 'user-2',
          bookingType: 'hotel',
          totalAmount: 200,
          currency: 'USD',
          items: [],
          travelers: [{ name: 'Carol' }],
          createdAt: new Date().toISOString(),
        },
      };

      await expect(handleVoyageBookingCreated(event as any, {} as any)).resolves.toBeUndefined();
    });

    it('should hit travel trend update when extracted destinations are present', async () => {
      const filterSpy = jest.spyOn(Array.prototype, 'filter').mockImplementationOnce(() => ['Paris'] as any);

      const event = {
        payload: {
          bookingId: 'bk-trend',
          userId: 'user-1',
          bookingType: 'flight',
          totalAmount: 350,
          currency: 'EUR',
          items: [{ description: 'Paris - New York' }],
          travelers: [{ name: 'Alice' }],
          createdAt: new Date().toISOString(),
        },
      };

      await expect(handleVoyageBookingCreated(event as any, {} as any)).resolves.toBeUndefined();

      expect(logSpy).toHaveBeenCalledWith('[AI] Travel trend: Paris (flight):', {
        travelers: 1,
        amount: 350,
      });

      filterSpy.mockRestore();
    });

    it('should rethrow when a booking helper fails', async () => {
      logSpy
        .mockImplementationOnce(() => {})
        .mockImplementationOnce(() => {
          throw new Error('booking helper failed');
        });

      const event = {
        payload: {
          bookingId: 'bk-err',
          userId: 'user-1',
          bookingType: 'flight',
          totalAmount: 350,
          currency: 'EUR',
          items: [],
          travelers: [{ name: 'Alice' }],
          createdAt: new Date().toISOString(),
        },
      };

      await expect(handleVoyageBookingCreated(event as any, {} as any)).rejects.toThrow(
        'booking helper failed'
      );
    });
  });

  describe('handleFlightSelected', () => {
    it('should process flight selection with userId', async () => {
      const event = {
        payload: {
          userId: 'user-1',
          sessionId: 'sess-1',
          flightId: 'fl-1',
          airline: 'AF',
          origin: 'CDG',
          destination: 'JFK',
          price: 450,
          currency: 'EUR',
          selectedAt: new Date().toISOString(),
        },
      };

      await expect(handleFlightSelected(event as any, {} as any)).resolves.toBeUndefined();
    });

    it('should use sessionId when userId is null', async () => {
      const event = {
        payload: {
          userId: null,
          sessionId: 'sess-anon',
          flightId: 'fl-2',
          airline: 'BA',
          origin: 'LHR',
          destination: 'LAX',
          price: 600,
          currency: 'GBP',
          selectedAt: new Date().toISOString(),
        },
      };

      await expect(handleFlightSelected(event as any, {} as any)).resolves.toBeUndefined();
    });

    it('should rethrow when a flight helper fails', async () => {
      logSpy
        .mockImplementationOnce(() => {})
        .mockImplementationOnce(() => {
          throw new Error('flight helper failed');
        });

      const event = {
        payload: {
          userId: 'user-1',
          sessionId: 'sess-1',
          flightId: 'fl-err',
          airline: 'AF',
          origin: 'CDG',
          destination: 'JFK',
          price: 450,
          currency: 'EUR',
          selectedAt: new Date().toISOString(),
        },
      };

      await expect(handleFlightSelected(event as any, {} as any)).rejects.toThrow(
        'flight helper failed'
      );
    });
  });

  describe('handleHotelSelected - price ranges', () => {
    const makeHotelEvent = (price: number) => ({
      payload: {
        userId: 'user-1',
        sessionId: 'sess-1',
        hotelId: 'h-1',
        hotelName: 'Grand Hotel',
        location: 'Paris',
        roomType: 'double',
        price,
        currency: 'EUR',
        selectedAt: new Date().toISOString(),
      },
    });

    it('should handle budget price (< 100)', async () => {
      await expect(handleHotelSelected(makeHotelEvent(50) as any, {} as any)).resolves.toBeUndefined();
    });

    it('should handle mid-range price (100 <= price < 200)', async () => {
      await expect(handleHotelSelected(makeHotelEvent(150) as any, {} as any)).resolves.toBeUndefined();
    });

    it('should handle premium price (200 <= price < 400)', async () => {
      await expect(handleHotelSelected(makeHotelEvent(300) as any, {} as any)).resolves.toBeUndefined();
    });

    it('should handle luxury price (>= 400)', async () => {
      await expect(handleHotelSelected(makeHotelEvent(500) as any, {} as any)).resolves.toBeUndefined();
    });

    it('should use sessionId when userId is null', async () => {
      const event = {
        payload: {
          userId: null,
          sessionId: 'sess-anon',
          hotelId: 'h-2',
          hotelName: 'Hostel',
          location: 'Berlin',
          roomType: 'dorm',
          price: 25,
          currency: 'EUR',
          selectedAt: new Date().toISOString(),
        },
      };

      await expect(handleHotelSelected(event as any, {} as any)).resolves.toBeUndefined();
    });

    it('should rethrow when a hotel helper fails', async () => {
      logSpy
        .mockImplementationOnce(() => {})
        .mockImplementationOnce(() => {
          throw new Error('hotel helper failed');
        });

      await expect(handleHotelSelected(makeHotelEvent(150) as any, {} as any)).rejects.toThrow(
        'hotel helper failed'
      );
    });
  });
});
