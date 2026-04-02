/**
 * US-TEST-014 — Tests unitaires KafkaService (VoyageKafkaService singleton)
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// ── Mock @dreamscape/kafka ─────────────────────────────────────────────────────
const mockClientConnect     = jest.fn();
const mockClientDisconnect  = jest.fn();
const mockClientPublish     = jest.fn();
const mockClientSubscribe   = jest.fn();
const mockClientHealthCheck = jest.fn();

const mockKafkaClientInstance = {
  connect:     mockClientConnect,
  disconnect:  mockClientDisconnect,
  publish:     mockClientPublish,
  subscribe:   mockClientSubscribe,
  healthCheck: mockClientHealthCheck,
};

const mockGetKafkaClient = jest.fn(() => mockKafkaClientInstance);
const mockCreateEvent    = jest.fn((type: string, source: string, payload: any) => ({
  type, source, payload,
  metadata: { eventId: 'evt-mock', timestamp: new Date().toISOString(), version: '1' },
}));

jest.mock('@dreamscape/kafka', () => ({
  __esModule:     true,
  getKafkaClient: mockGetKafkaClient,
  createEvent:    mockCreateEvent,
  KAFKA_TOPICS: {
    VOYAGE_SEARCH_PERFORMED:  'voyage.search.performed',
    VOYAGE_BOOKING_CREATED:   'voyage.booking.created',
    VOYAGE_BOOKING_CONFIRMED: 'voyage.booking.confirmed',
    VOYAGE_BOOKING_CANCELLED: 'voyage.booking.cancelled',
    VOYAGE_BOOKING_UPDATED:   'voyage.booking.updated',
    VOYAGE_FLIGHT_SELECTED:   'voyage.flight.selected',
    VOYAGE_HOTEL_SELECTED:    'voyage.hotel.selected',
    PAYMENT_COMPLETED:        'payment.completed',
    PAYMENT_FAILED:           'payment.failed',
    USER_CREATED:             'user.created',
  },
  CONSUMER_GROUPS: {
    VOYAGE_SERVICE: 'voyage-service-group',
  },
  KafkaClient: jest.fn(),
}));

// ── Import after mocks — import the singleton default export ───────────────────
import voyageKafkaService from '@/services/KafkaService';

// ── Fixtures ────────────────────────────────────────────────────────────────────
const bookingCreatedPayload = {
  bookingId:   'BOOK-001',
  userId:      'user-001',
  bookingType: 'FLIGHT' as any,
  status:      'pending' as any,
  totalAmount: 450,
  currency:    'EUR',
  items:       [],
  travelers:   [],
  createdAt:   new Date().toISOString(),
};

const bookingConfirmedPayload = {
  bookingId:          'BOOK-001',
  userId:             'user-001',
  confirmationNumber: 'BOOK-001',
  paymentId:          'pi_001',
  confirmedAt:        new Date().toISOString(),
};

const bookingCancelledPayload = {
  bookingId:   'BOOK-001',
  userId:      'user-001',
  reason:      'payment_failed',
  cancelledAt: new Date().toISOString(),
};

// ── Tests ───────────────────────────────────────────────────────────────────────
describe('KafkaService (voyageKafkaService singleton) — US-TEST-014', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    // Reset initialized state by calling shutdown before each test
    try { await voyageKafkaService.shutdown(); } catch {}
    mockClientConnect.mockResolvedValue(undefined as never);
    mockClientDisconnect.mockResolvedValue(undefined as never);
    mockClientPublish.mockResolvedValue(undefined as never);
    mockClientSubscribe.mockResolvedValue(undefined as never);
    mockClientHealthCheck.mockResolvedValue({ healthy: true, details: {} } as never);
  });

  // ── initialize ──────────────────────────────────────────────────────────
  describe('initialize', () => {
    it('should connect the Kafka client', async () => {
      await voyageKafkaService.initialize();

      expect(mockGetKafkaClient).toHaveBeenCalledWith('voyage-service');
      expect(mockClientConnect).toHaveBeenCalled();
    });

    it('should not connect a second time when already initialized', async () => {
      await voyageKafkaService.initialize();
      await voyageKafkaService.initialize();

      expect(mockClientConnect).toHaveBeenCalledTimes(1);
    });

    it('should throw when Kafka connection fails', async () => {
      mockClientConnect.mockRejectedValue(new Error('Broker unreachable') as never);

      await expect(voyageKafkaService.initialize()).rejects.toThrow('Broker unreachable');
    });
  });

  // ── shutdown ─────────────────────────────────────────────────────────────
  describe('shutdown', () => {
    it('should disconnect the client after initialization', async () => {
      await voyageKafkaService.initialize();
      await voyageKafkaService.shutdown();

      expect(mockClientDisconnect).toHaveBeenCalled();
    });

    it('should do nothing when not initialized', async () => {
      // No initialize() call
      await voyageKafkaService.shutdown();
      expect(mockClientDisconnect).not.toHaveBeenCalled();
    });
  });

  // ── publishBookingCreated ────────────────────────────────────────────────
  describe('publishBookingCreated', () => {
    it('should publish to VOYAGE_BOOKING_CREATED topic', async () => {
      await voyageKafkaService.initialize();
      await voyageKafkaService.publishBookingCreated(bookingCreatedPayload);

      expect(mockCreateEvent).toHaveBeenCalledWith(
        'voyage.booking.created',
        'voyage-service',
        bookingCreatedPayload,
        expect.any(Object)
      );
      expect(mockClientPublish).toHaveBeenCalledWith(
        'voyage.booking.created',
        expect.any(Object),
        bookingCreatedPayload.bookingId
      );
    });

    it('should skip publish (warn only) when client not initialized', async () => {
      await expect(
        voyageKafkaService.publishBookingCreated(bookingCreatedPayload)
      ).resolves.toBeUndefined();

      expect(mockClientPublish).not.toHaveBeenCalled();
    });

    it('should pass correlationId to createEvent', async () => {
      await voyageKafkaService.initialize();
      await voyageKafkaService.publishBookingCreated(bookingCreatedPayload, 'corr-xyz');

      expect(mockCreateEvent).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(Object),
        { correlationId: 'corr-xyz' }
      );
    });
  });

  // ── publishBookingConfirmed ──────────────────────────────────────────────
  describe('publishBookingConfirmed', () => {
    it('should publish to VOYAGE_BOOKING_CONFIRMED topic', async () => {
      await voyageKafkaService.initialize();
      await voyageKafkaService.publishBookingConfirmed(bookingConfirmedPayload);

      expect(mockClientPublish).toHaveBeenCalledWith(
        'voyage.booking.confirmed',
        expect.any(Object),
        bookingConfirmedPayload.bookingId
      );
    });

    it('should skip when client is not initialized', async () => {
      await expect(
        voyageKafkaService.publishBookingConfirmed(bookingConfirmedPayload)
      ).resolves.toBeUndefined();
      expect(mockClientPublish).not.toHaveBeenCalled();
    });
  });

  // ── publishBookingCancelled ──────────────────────────────────────────────
  describe('publishBookingCancelled', () => {
    it('should publish to VOYAGE_BOOKING_CANCELLED topic', async () => {
      await voyageKafkaService.initialize();
      await voyageKafkaService.publishBookingCancelled(bookingCancelledPayload);

      expect(mockClientPublish).toHaveBeenCalledWith(
        'voyage.booking.cancelled',
        expect.any(Object),
        bookingCancelledPayload.bookingId
      );
    });

    it('should skip when client is not initialized', async () => {
      await expect(
        voyageKafkaService.publishBookingCancelled(bookingCancelledPayload)
      ).resolves.toBeUndefined();
      expect(mockClientPublish).not.toHaveBeenCalled();
    });
  });

  // ── subscribeToEvents ────────────────────────────────────────────────────
  describe('subscribeToEvents', () => {
    it('should subscribe with both payment handlers', async () => {
      await voyageKafkaService.initialize();

      const onPaymentCompleted = jest.fn();
      const onPaymentFailed    = jest.fn();

      await voyageKafkaService.subscribeToEvents({ onPaymentCompleted, onPaymentFailed });

      expect(mockClientSubscribe).toHaveBeenCalledWith(
        'voyage-service-group',
        expect.arrayContaining([
          expect.objectContaining({ topic: 'payment.completed', handler: onPaymentCompleted }),
          expect.objectContaining({ topic: 'payment.failed',    handler: onPaymentFailed }),
        ])
      );
    });

    it('should not call subscribe when client is not initialized', async () => {
      await voyageKafkaService.subscribeToEvents({ onPaymentCompleted: jest.fn() });
      expect(mockClientSubscribe).not.toHaveBeenCalled();
    });

    it('should not call subscribe when no handlers are provided', async () => {
      await voyageKafkaService.initialize();
      await voyageKafkaService.subscribeToEvents({});
      expect(mockClientSubscribe).not.toHaveBeenCalled();
    });
  });

  // ── healthCheck ──────────────────────────────────────────────────────────
  describe('healthCheck', () => {
    it('should return healthy:true when client is connected', async () => {
      await voyageKafkaService.initialize();
      const result = await voyageKafkaService.healthCheck();

      expect(mockClientHealthCheck).toHaveBeenCalled();
      expect(result.healthy).toBe(true);
    });

    it('should return healthy:false with error when not initialized', async () => {
      const result = await voyageKafkaService.healthCheck();

      expect(result.healthy).toBe(false);
      expect(result.details).toHaveProperty('error');
    });
  });
});
