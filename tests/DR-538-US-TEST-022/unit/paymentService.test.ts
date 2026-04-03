/**
 * paymentService.test.ts — DR-538-US-TEST-022
 *
 * Unit tests for PaymentService.
 * All external dependencies (StripeService, DatabaseService, KafkaService) are mocked.
 */

// ─── Module mocks (hoisted before imports) ────────────────────────────────────

jest.mock(
  '../../../../dreamscape-services/payment/src/services/StripeService',
  () => ({
    __esModule: true,
    default: {
      createPaymentIntent: jest.fn(),
      getPaymentIntent: jest.fn(),
      createRefund: jest.fn(),
      cancelPaymentIntent: jest.fn(),
      updatePaymentIntentMetadata: jest.fn(),
      getPublishableKey: jest.fn(),
    },
  })
);

jest.mock(
  '../../../../dreamscape-services/payment/src/services/DatabaseService',
  () => ({
    __esModule: true,
    default: {
      createTransaction: jest.fn(),
      updateTransaction: jest.fn(),
    },
  })
);

jest.mock(
  '../../../../dreamscape-services/payment/src/services/KafkaService',
  () => ({
    __esModule: true,
    default: {
      publishPaymentCompleted: jest.fn().mockResolvedValue(undefined),
      publishPaymentFailed: jest.fn().mockResolvedValue(undefined),
      publishPaymentRefunded: jest.fn().mockResolvedValue(undefined),
    },
  })
);

// ─── Imports ──────────────────────────────────────────────────────────────────

import paymentService from '../../../../dreamscape-services/payment/src/services/PaymentService';
import stripeService from '../../../../dreamscape-services/payment/src/services/StripeService';
import databaseService from '../../../../dreamscape-services/payment/src/services/DatabaseService';
import kafkaService from '../../../../dreamscape-services/payment/src/services/KafkaService';

const mockStripe = stripeService as jest.Mocked<typeof stripeService>;
const mockDb = databaseService as jest.Mocked<typeof databaseService>;
const mockKafka = kafkaService as jest.Mocked<typeof kafkaService>;

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const createIntentRequest = {
  amount: 50000,
  currency: 'EUR',
  bookingId: 'booking-001',
  bookingReference: 'REF-001',
  userId: 'user-001',
  metadata: {},
};

const stripeIntentResponse = {
  paymentIntentId: 'pi_mock_123',
  clientSecret: 'pi_mock_123_secret',
  amount: 50000,
  currency: 'eur',
  status: 'requires_payment_method',
};

const mockPaymentIntent = {
  id: 'pi_mock_123',
  amount: 50000,
  currency: 'eur',
  payment_method: 'pm_mock_card',
  last_payment_error: null as any,
  metadata: {
    bookingId: 'booking-001',
    bookingReference: 'REF-001',
    userId: 'user-001',
  },
};

const mockRefundResponse = {
  refundId: 're_mock_789',
  paymentIntentId: 'pi_mock_123',
  amount: 50000,
  currency: 'eur',
  status: 'succeeded',
};

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  mockDb.createTransaction.mockResolvedValue(undefined);
  mockDb.updateTransaction.mockResolvedValue(undefined);
  mockKafka.publishPaymentCompleted.mockResolvedValue(undefined);
  mockKafka.publishPaymentFailed.mockResolvedValue(undefined);
  mockKafka.publishPaymentRefunded.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ─── createPaymentIntent() ────────────────────────────────────────────────────

describe('createPaymentIntent()', () => {
  it('calls StripeService and DatabaseService then returns the intent', async () => {
    mockStripe.createPaymentIntent.mockResolvedValue(stripeIntentResponse);

    const result = await paymentService.createPaymentIntent(createIntentRequest);

    expect(mockStripe.createPaymentIntent).toHaveBeenCalledWith(createIntentRequest);
    expect(mockDb.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentIntentId: 'pi_mock_123',
        bookingId: 'booking-001',
        amount: 500, // cents ÷ 100
        currency: 'EUR',
      })
    );
    expect(result).toEqual(stripeIntentResponse);
  });

  it('rethrows when StripeService throws', async () => {
    mockStripe.createPaymentIntent.mockRejectedValue(new Error('Stripe Error: card_declined'));

    await expect(paymentService.createPaymentIntent(createIntentRequest))
      .rejects.toThrow('card_declined');
  });

  it('rethrows when DatabaseService throws', async () => {
    mockStripe.createPaymentIntent.mockResolvedValue(stripeIntentResponse);
    mockDb.createTransaction.mockRejectedValue(new Error('DB connection lost'));

    await expect(paymentService.createPaymentIntent(createIntentRequest))
      .rejects.toThrow('DB connection lost');
  });
});

// ─── handlePaymentSucceeded() ─────────────────────────────────────────────────

describe('handlePaymentSucceeded()', () => {
  it('updates DB to SUCCEEDED and publishes Kafka event', async () => {
    mockStripe.getPaymentIntent.mockResolvedValue(mockPaymentIntent as any);

    await paymentService.handlePaymentSucceeded('pi_mock_123');

    expect(mockDb.updateTransaction).toHaveBeenCalledWith(
      'pi_mock_123',
      expect.objectContaining({ status: 'SUCCEEDED' })
    );
    expect(mockKafka.publishPaymentCompleted).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentId: 'pi_mock_123',
        bookingId: 'booking-001',
        userId: 'user-001',
        amount: 500, // cents ÷ 100
      })
    );
  });

  it('does not throw when Kafka publish fails (best-effort)', async () => {
    mockStripe.getPaymentIntent.mockResolvedValue(mockPaymentIntent as any);
    mockKafka.publishPaymentCompleted.mockRejectedValue(new Error('Kafka down'));

    await expect(paymentService.handlePaymentSucceeded('pi_mock_123')).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });

  it('throws when payment intent metadata is incomplete', async () => {
    mockStripe.getPaymentIntent.mockResolvedValue({
      ...mockPaymentIntent,
      metadata: { bookingId: '', bookingReference: '', userId: '' },
    } as any);

    await expect(paymentService.handlePaymentSucceeded('pi_mock_123'))
      .rejects.toThrow('Missing metadata');
  });

  it('rethrows when StripeService.getPaymentIntent throws', async () => {
    mockStripe.getPaymentIntent.mockRejectedValue(new Error('Stripe API down'));

    await expect(paymentService.handlePaymentSucceeded('pi_mock_123'))
      .rejects.toThrow('Stripe API down');
  });
});

// ─── handlePaymentFailed() ────────────────────────────────────────────────────

describe('handlePaymentFailed()', () => {
  it('uses provided failureReason when given', async () => {
    mockStripe.getPaymentIntent.mockResolvedValue(mockPaymentIntent as any);

    await paymentService.handlePaymentFailed('pi_mock_123', 'card_declined');

    expect(mockDb.updateTransaction).toHaveBeenCalledWith(
      'pi_mock_123',
      expect.objectContaining({ status: 'FAILED', failureReason: 'card_declined' })
    );
  });

  it('falls back to last_payment_error.message when no param provided', async () => {
    mockStripe.getPaymentIntent.mockResolvedValue({
      ...mockPaymentIntent,
      last_payment_error: { message: 'Your card has insufficient funds.' },
    } as any);

    await paymentService.handlePaymentFailed('pi_mock_123');

    expect(mockDb.updateTransaction).toHaveBeenCalledWith(
      'pi_mock_123',
      expect.objectContaining({ failureReason: 'Your card has insufficient funds.' })
    );
  });

  it('falls back to "Payment failed" when no reason is available', async () => {
    mockStripe.getPaymentIntent.mockResolvedValue({
      ...mockPaymentIntent,
      last_payment_error: null,
    } as any);

    await paymentService.handlePaymentFailed('pi_mock_123');

    expect(mockDb.updateTransaction).toHaveBeenCalledWith(
      'pi_mock_123',
      expect.objectContaining({ failureReason: 'Payment failed' })
    );
  });

  it('throws when metadata is incomplete', async () => {
    mockStripe.getPaymentIntent.mockResolvedValue({
      ...mockPaymentIntent,
      metadata: { bookingId: '', bookingReference: '', userId: '' },
    } as any);

    await expect(paymentService.handlePaymentFailed('pi_mock_123'))
      .rejects.toThrow('Missing metadata');
  });

  it('does not throw when Kafka publishPaymentFailed fails (best-effort)', async () => {
    mockStripe.getPaymentIntent.mockResolvedValue(mockPaymentIntent as any);
    mockKafka.publishPaymentFailed.mockRejectedValue(new Error('Kafka down'));

    await expect(paymentService.handlePaymentFailed('pi_mock_123', 'card_declined'))
      .resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });

  it('rethrows when StripeService.getPaymentIntent throws', async () => {
    mockStripe.getPaymentIntent.mockRejectedValue(new Error('Stripe API down'));

    await expect(paymentService.handlePaymentFailed('pi_mock_123'))
      .rejects.toThrow('Stripe API down');
  });
});

// ─── handlePaymentCanceled() ──────────────────────────────────────────────────

describe('handlePaymentCanceled()', () => {
  it('updates DB to CANCELED', async () => {
    mockStripe.getPaymentIntent.mockResolvedValue(mockPaymentIntent as any);

    await paymentService.handlePaymentCanceled('pi_mock_123');

    expect(mockDb.updateTransaction).toHaveBeenCalledWith(
      'pi_mock_123',
      expect.objectContaining({ status: 'CANCELED' })
    );
  });

  it('throws when metadata is incomplete', async () => {
    mockStripe.getPaymentIntent.mockResolvedValue({
      ...mockPaymentIntent,
      metadata: { bookingId: '', bookingReference: '', userId: '' },
    } as any);

    await expect(paymentService.handlePaymentCanceled('pi_mock_123'))
      .rejects.toThrow('Missing metadata');
  });

  it('rethrows when StripeService throws', async () => {
    mockStripe.getPaymentIntent.mockRejectedValue(new Error('Not found'));

    await expect(paymentService.handlePaymentCanceled('pi_mock_123'))
      .rejects.toThrow('Not found');
  });
});

// ─── handlePaymentRefunded() ──────────────────────────────────────────────────

describe('handlePaymentRefunded()', () => {
  it('updates DB to REFUNDED and publishes Kafka event', async () => {
    mockStripe.getPaymentIntent.mockResolvedValue(mockPaymentIntent as any);

    await paymentService.handlePaymentRefunded('pi_mock_123');

    expect(mockDb.updateTransaction).toHaveBeenCalledWith(
      'pi_mock_123',
      expect.objectContaining({ status: 'REFUNDED' })
    );
    expect(mockKafka.publishPaymentRefunded).toHaveBeenCalled();
  });

  it('does not throw when Kafka publish fails (best-effort)', async () => {
    mockStripe.getPaymentIntent.mockResolvedValue(mockPaymentIntent as any);
    mockKafka.publishPaymentRefunded.mockRejectedValue(new Error('Kafka down'));

    await expect(paymentService.handlePaymentRefunded('pi_mock_123')).resolves.toBeUndefined();
  });

  it('throws when metadata is incomplete', async () => {
    mockStripe.getPaymentIntent.mockResolvedValue({
      ...mockPaymentIntent,
      metadata: { bookingId: '', bookingReference: '', userId: '' },
    } as any);

    await expect(paymentService.handlePaymentRefunded('pi_mock_123'))
      .rejects.toThrow('Missing metadata');
  });

  it('rethrows when StripeService throws', async () => {
    mockStripe.getPaymentIntent.mockRejectedValue(new Error('Stripe gone'));

    await expect(paymentService.handlePaymentRefunded('pi_mock_123'))
      .rejects.toThrow('Stripe gone');
  });
});

// ─── processRefund() ─────────────────────────────────────────────────────────

describe('processRefund()', () => {
  const refundRequest = {
    paymentIntentId: 'pi_mock_123',
    bookingId: 'booking-001',
    userId: 'user-001',
  };

  it('creates refund, updates DB, publishes Kafka event', async () => {
    mockStripe.createRefund.mockResolvedValue(mockRefundResponse);

    const result = await paymentService.processRefund(refundRequest);

    expect(mockStripe.createRefund).toHaveBeenCalledWith(refundRequest);
    expect(mockDb.updateTransaction).toHaveBeenCalledWith(
      'pi_mock_123',
      expect.objectContaining({ status: 'REFUNDED' })
    );
    expect(mockKafka.publishPaymentRefunded).toHaveBeenCalled();
    expect(result).toEqual(mockRefundResponse);
  });

  it('does not throw when Kafka publish fails (best-effort)', async () => {
    mockStripe.createRefund.mockResolvedValue(mockRefundResponse);
    mockKafka.publishPaymentRefunded.mockRejectedValue(new Error('Kafka down'));

    await expect(paymentService.processRefund(refundRequest)).resolves.toBeDefined();
  });

  it('rethrows when StripeService.createRefund throws', async () => {
    mockStripe.createRefund.mockRejectedValue(new Error('Stripe Error: already refunded'));

    await expect(paymentService.processRefund(refundRequest))
      .rejects.toThrow('already refunded');
  });
});

// ─── cancelPaymentIntent() ───────────────────────────────────────────────────

describe('cancelPaymentIntent()', () => {
  it('cancels via StripeService and updates DB to CANCELED', async () => {
    mockStripe.cancelPaymentIntent.mockResolvedValue({} as any);

    await paymentService.cancelPaymentIntent('pi_mock_123');

    expect(mockStripe.cancelPaymentIntent).toHaveBeenCalledWith('pi_mock_123');
    expect(mockDb.updateTransaction).toHaveBeenCalledWith(
      'pi_mock_123',
      expect.objectContaining({ status: 'CANCELED' })
    );
  });

  it('rethrows when StripeService throws', async () => {
    mockStripe.cancelPaymentIntent.mockRejectedValue(new Error('Cannot cancel'));

    await expect(paymentService.cancelPaymentIntent('pi_mock_123'))
      .rejects.toThrow('Cannot cancel');
  });
});

// ─── updatePaymentIntentMetadata() ───────────────────────────────────────────

describe('updatePaymentIntentMetadata()', () => {
  const meta = { bookingId: 'b2', bookingReference: 'REF-002', userId: 'u1' };

  it('updates metadata in Stripe and DB', async () => {
    mockStripe.updatePaymentIntentMetadata.mockResolvedValue({} as any);

    await paymentService.updatePaymentIntentMetadata('pi_mock_123', meta);

    expect(mockStripe.updatePaymentIntentMetadata).toHaveBeenCalledWith('pi_mock_123', meta);
    expect(mockDb.updateTransaction).toHaveBeenCalledWith(
      'pi_mock_123',
      expect.objectContaining({ bookingId: 'b2', bookingReference: 'REF-002' })
    );
  });

  it('does not throw when DB update fails (best-effort)', async () => {
    mockStripe.updatePaymentIntentMetadata.mockResolvedValue({} as any);
    mockDb.updateTransaction.mockRejectedValue(new Error('DB error'));

    await expect(paymentService.updatePaymentIntentMetadata('pi_mock_123', meta))
      .resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalled();
  });

  it('rethrows when StripeService throws', async () => {
    mockStripe.updatePaymentIntentMetadata.mockRejectedValue(new Error('Stripe gone'));

    await expect(paymentService.updatePaymentIntentMetadata('pi_mock_123', meta))
      .rejects.toThrow('Stripe gone');
  });
});

// ─── getPublishableKey() ─────────────────────────────────────────────────────

describe('getPublishableKey()', () => {
  it('delegates to StripeService.getPublishableKey()', () => {
    mockStripe.getPublishableKey.mockReturnValue('pk_test_mock');

    const result = paymentService.getPublishableKey();

    expect(mockStripe.getPublishableKey).toHaveBeenCalled();
    expect(result).toBe('pk_test_mock');
  });
});
