/**
 * kafkaService.test.ts — DR-538-US-TEST-024
 *
 * Unit tests for PaymentKafkaService.
 * @dreamscape/kafka is fully mocked (no real broker required).
 * paymentKafkaService is a singleton; state is reset in beforeEach.
 */

// ─── Module mocks ─────────────────────────────────────────────────────────────

jest.mock('@dreamscape/kafka', () => ({
  getKafkaClient: jest.fn(),
  createEvent: jest.fn(),
  KAFKA_TOPICS: {
    PAYMENT_INITIATED: 'dreamscape.payment.initiated',
    PAYMENT_COMPLETED: 'dreamscape.payment.completed',
    PAYMENT_FAILED: 'dreamscape.payment.failed',
    PAYMENT_REFUNDED: 'dreamscape.payment.refunded',
    VOYAGE_BOOKING_CREATED: 'dreamscape.voyage.booking.created',
    VOYAGE_BOOKING_CANCELLED: 'dreamscape.voyage.booking.cancelled',
  },
  CONSUMER_GROUPS: {
    PAYMENT_SERVICE: 'dreamscape-payment-service-group',
  },
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import { getKafkaClient, createEvent, KAFKA_TOPICS, CONSUMER_GROUPS } from '@dreamscape/kafka';
import paymentKafkaService from '../../../../dreamscape-services/payment/src/services/KafkaService';

const mockGetKafkaClient = getKafkaClient as jest.MockedFunction<typeof getKafkaClient>;
const mockCreateEvent = createEvent as jest.MockedFunction<typeof createEvent>;

// ─── Shared mock objects ───────────────────────────────────────────────────────

const mockClient = {
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  publish: jest.fn().mockResolvedValue(undefined),
  subscribe: jest.fn().mockResolvedValue(undefined),
  healthCheck: jest.fn().mockResolvedValue({ healthy: true, details: { connected: true } }),
};

const mockEvent = {
  eventId: 'mock-event-id',
  eventType: 'mock.event',
  timestamp: '2024-01-01T00:00:00.000Z',
  version: '1.0.0',
  source: 'payment-service',
  payload: {},
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resetService() {
  (paymentKafkaService as any).client = null;
  (paymentKafkaService as any).isInitialized = false;
}

function injectClient() {
  (paymentKafkaService as any).client = mockClient;
  (paymentKafkaService as any).isInitialized = true;
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  mockGetKafkaClient.mockReturnValue(mockClient as any);
  mockCreateEvent.mockReturnValue(mockEvent as any);
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  resetService();
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ─── initialize() ─────────────────────────────────────────────────────────────

describe('initialize()', () => {
  it('calls getKafkaClient and connects on first call', async () => {
    await paymentKafkaService.initialize();

    expect(mockGetKafkaClient).toHaveBeenCalledWith('payment-service');
    expect(mockClient.connect).toHaveBeenCalledTimes(1);
    expect((paymentKafkaService as any).isInitialized).toBe(true);
  });

  it('skips re-initialization when already initialized', async () => {
    await paymentKafkaService.initialize();
    await paymentKafkaService.initialize();

    expect(mockClient.connect).toHaveBeenCalledTimes(1);
    expect(console.log).toHaveBeenCalledWith('[PaymentKafkaService] Already initialized');
  });

  it('rethrows and stays uninitialized when connect() throws', async () => {
    mockClient.connect.mockRejectedValueOnce(new Error('Broker unreachable'));

    await expect(paymentKafkaService.initialize()).rejects.toThrow('Broker unreachable');
    expect(console.error).toHaveBeenCalled();
    expect((paymentKafkaService as any).isInitialized).toBe(false);
  });
});

// ─── shutdown() ───────────────────────────────────────────────────────────────

describe('shutdown()', () => {
  it('disconnects client and clears isInitialized when client is set', async () => {
    injectClient();

    await paymentKafkaService.shutdown();

    expect(mockClient.disconnect).toHaveBeenCalledTimes(1);
    expect((paymentKafkaService as any).isInitialized).toBe(false);
  });

  it('does nothing when client is null', async () => {
    await paymentKafkaService.shutdown();

    expect(mockClient.disconnect).not.toHaveBeenCalled();
  });
});

// ─── publishPaymentInitiated() ────────────────────────────────────────────────

describe('publishPaymentInitiated()', () => {
  const payload = {
    paymentId: 'pay-001',
    bookingId: 'b-001',
    userId: 'u-001',
    amount: 50000,
    currency: 'EUR',
    paymentMethod: 'credit_card' as const,
    initiatedAt: '2024-01-01T00:00:00.000Z',
  };

  it('warns and skips when client is not initialized', async () => {
    await paymentKafkaService.publishPaymentInitiated(payload);

    expect(console.warn).toHaveBeenCalledWith(
      '[PaymentKafkaService] Client not initialized, skipping publish'
    );
    expect(mockClient.publish).not.toHaveBeenCalled();
  });

  it('creates event and publishes to PAYMENT_INITIATED topic', async () => {
    injectClient();

    await paymentKafkaService.publishPaymentInitiated(payload);

    expect(mockCreateEvent).toHaveBeenCalledWith(
      'payment.initiated',
      'payment-service',
      payload,
      { correlationId: undefined }
    );
    expect(mockClient.publish).toHaveBeenCalledWith(
      KAFKA_TOPICS.PAYMENT_INITIATED,
      mockEvent,
      payload.paymentId
    );
  });

  it('forwards correlationId to createEvent when provided', async () => {
    injectClient();

    await paymentKafkaService.publishPaymentInitiated(payload, 'corr-xyz');

    expect(mockCreateEvent).toHaveBeenCalledWith(
      'payment.initiated',
      'payment-service',
      payload,
      { correlationId: 'corr-xyz' }
    );
  });
});

// ─── publishPaymentCompleted() ────────────────────────────────────────────────

describe('publishPaymentCompleted()', () => {
  const payload = {
    paymentId: 'pay-001',
    bookingId: 'b-001',
    userId: 'u-001',
    amount: 50000,
    currency: 'EUR',
    transactionId: 'txn-001',
    completedAt: '2024-01-01T00:00:00.000Z',
  };

  it('warns and skips when client is not initialized', async () => {
    await paymentKafkaService.publishPaymentCompleted(payload);

    expect(console.warn).toHaveBeenCalled();
    expect(mockClient.publish).not.toHaveBeenCalled();
  });

  it('creates event and publishes to PAYMENT_COMPLETED topic', async () => {
    injectClient();

    await paymentKafkaService.publishPaymentCompleted(payload);

    expect(mockCreateEvent).toHaveBeenCalledWith(
      'payment.completed',
      'payment-service',
      payload,
      { correlationId: undefined }
    );
    expect(mockClient.publish).toHaveBeenCalledWith(
      KAFKA_TOPICS.PAYMENT_COMPLETED,
      mockEvent,
      payload.paymentId
    );
  });
});

// ─── publishPaymentFailed() ───────────────────────────────────────────────────

describe('publishPaymentFailed()', () => {
  const payload = {
    paymentId: 'pay-001',
    bookingId: 'b-001',
    userId: 'u-001',
    amount: 50000,
    currency: 'EUR',
    errorCode: 'card_declined',
    errorMessage: 'Your card was declined.',
    failedAt: '2024-01-01T00:00:00.000Z',
  };

  it('warns and skips when client is not initialized', async () => {
    await paymentKafkaService.publishPaymentFailed(payload);

    expect(console.warn).toHaveBeenCalled();
    expect(mockClient.publish).not.toHaveBeenCalled();
  });

  it('creates event and publishes to PAYMENT_FAILED topic', async () => {
    injectClient();

    await paymentKafkaService.publishPaymentFailed(payload);

    expect(mockCreateEvent).toHaveBeenCalledWith(
      'payment.failed',
      'payment-service',
      payload,
      { correlationId: undefined }
    );
    expect(mockClient.publish).toHaveBeenCalledWith(
      KAFKA_TOPICS.PAYMENT_FAILED,
      mockEvent,
      payload.paymentId
    );
  });
});

// ─── publishPaymentRefunded() ─────────────────────────────────────────────────

describe('publishPaymentRefunded()', () => {
  const payload = {
    paymentId: 'pay-001',
    bookingId: 'b-001',
    userId: 'u-001',
    refundAmount: 50000,
    currency: 'EUR',
    refundId: 're_mock',
    reason: 'requested_by_customer',
    refundedAt: '2024-01-01T00:00:00.000Z',
  };

  it('warns and skips when client is not initialized', async () => {
    await paymentKafkaService.publishPaymentRefunded(payload);

    expect(console.warn).toHaveBeenCalled();
    expect(mockClient.publish).not.toHaveBeenCalled();
  });

  it('creates event and publishes to PAYMENT_REFUNDED topic', async () => {
    injectClient();

    await paymentKafkaService.publishPaymentRefunded(payload);

    expect(mockCreateEvent).toHaveBeenCalledWith(
      'payment.refunded',
      'payment-service',
      payload,
      { correlationId: undefined }
    );
    expect(mockClient.publish).toHaveBeenCalledWith(
      KAFKA_TOPICS.PAYMENT_REFUNDED,
      mockEvent,
      payload.paymentId
    );
  });
});

// ─── subscribeToBookingEvents() ───────────────────────────────────────────────

describe('subscribeToBookingEvents()', () => {
  it('warns and returns when client is not initialized', async () => {
    await paymentKafkaService.subscribeToBookingEvents({ onBookingCreated: jest.fn() });

    expect(console.warn).toHaveBeenCalledWith(
      '[PaymentKafkaService] Client not initialized, cannot subscribe'
    );
    expect(mockClient.subscribe).not.toHaveBeenCalled();
  });

  it('does not call subscribe when no handlers are provided', async () => {
    injectClient();

    await paymentKafkaService.subscribeToBookingEvents({});

    expect(mockClient.subscribe).not.toHaveBeenCalled();
  });

  it('subscribes to VOYAGE_BOOKING_CREATED when onBookingCreated is provided', async () => {
    injectClient();
    const handler = jest.fn();

    await paymentKafkaService.subscribeToBookingEvents({ onBookingCreated: handler });

    expect(mockClient.subscribe).toHaveBeenCalledWith(
      CONSUMER_GROUPS.PAYMENT_SERVICE,
      [{ topic: KAFKA_TOPICS.VOYAGE_BOOKING_CREATED, handler }]
    );
  });

  it('subscribes to VOYAGE_BOOKING_CANCELLED when onBookingCancelled is provided', async () => {
    injectClient();
    const handler = jest.fn();

    await paymentKafkaService.subscribeToBookingEvents({ onBookingCancelled: handler });

    expect(mockClient.subscribe).toHaveBeenCalledWith(
      CONSUMER_GROUPS.PAYMENT_SERVICE,
      [{ topic: KAFKA_TOPICS.VOYAGE_BOOKING_CANCELLED, handler }]
    );
  });

  it('subscribes to both topics when both handlers are provided', async () => {
    injectClient();
    const onCreated = jest.fn();
    const onCancelled = jest.fn();

    await paymentKafkaService.subscribeToBookingEvents({
      onBookingCreated: onCreated,
      onBookingCancelled: onCancelled,
    });

    expect(mockClient.subscribe).toHaveBeenCalledWith(
      CONSUMER_GROUPS.PAYMENT_SERVICE,
      [
        { topic: KAFKA_TOPICS.VOYAGE_BOOKING_CREATED, handler: onCreated },
        { topic: KAFKA_TOPICS.VOYAGE_BOOKING_CANCELLED, handler: onCancelled },
      ]
    );
  });
});

// ─── healthCheck() ────────────────────────────────────────────────────────────

describe('healthCheck()', () => {
  it('returns unhealthy status when client is not initialized', async () => {
    const result = await paymentKafkaService.healthCheck();

    expect(result).toEqual({
      healthy: false,
      details: { error: 'Client not initialized' },
    });
  });

  it('delegates to client.healthCheck() when initialized', async () => {
    injectClient();
    mockClient.healthCheck.mockResolvedValueOnce({
      healthy: true,
      details: { connected: true, broker: 'localhost:9092' },
    });

    const result = await paymentKafkaService.healthCheck();

    expect(mockClient.healthCheck).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ healthy: true, details: { connected: true, broker: 'localhost:9092' } });
  });
});
