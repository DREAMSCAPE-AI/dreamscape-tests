/**
 * stripeService.test.ts — DR-538-US-TEST-022
 *
 * Unit tests for StripeService.
 * The Stripe SDK is fully mocked — no real API calls are made.
 * stripeService is a singleton; stripe instance and isInitialized are reset in beforeEach.
 */

// ─── Mock Stripe SDK ──────────────────────────────────────────────────────────

jest.mock('stripe', () => {
  const mockInstance = {
    paymentIntents: {
      create: jest.fn(),
      retrieve: jest.fn(),
      cancel: jest.fn(),
      update: jest.fn(),
    },
    refunds: {
      create: jest.fn(),
    },
    balance: {
      retrieve: jest.fn(),
    },
    webhooks: {
      constructEvent: jest.fn(),
    },
  };

  const MockStripe: any = jest.fn(() => mockInstance);
  MockStripe.__mockInstance = mockInstance;

  // Simulate Stripe.errors.StripeError for instanceof checks
  class StripeError extends Error {
    type: string;
    code: string;
    constructor(message: string, type = 'card_error', code = '') {
      super(message);
      this.name = 'StripeError';
      this.type = type;
      this.code = code;
    }
  }
  MockStripe.errors = { StripeError };

  return MockStripe;
});

// ─── Imports ──────────────────────────────────────────────────────────────────

import Stripe from 'stripe';
import stripeService from '../../../../dreamscape-services/payment/src/services/StripeService';

const mockStripe = (Stripe as any).__mockInstance as {
  paymentIntents: { create: jest.Mock; retrieve: jest.Mock; cancel: jest.Mock; update: jest.Mock };
  refunds: { create: jest.Mock };
  balance: { retrieve: jest.Mock };
  webhooks: { constructEvent: jest.Mock };
};
const StripeErrorClass = (Stripe as any).errors.StripeError;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resetService() {
  (stripeService as any).stripe = null;
  (stripeService as any).isInitialized = false;
}

function injectStripe() {
  (stripeService as any).stripe = mockStripe;
  (stripeService as any).isInitialized = true;
}

const validRequest = {
  amount: 50000,
  currency: 'EUR',
  bookingId: 'booking-001',
  bookingReference: 'REF-001',
  userId: 'user-001',
  metadata: { source: 'test' },
};

const mockPaymentIntent = {
  id: 'pi_mock_123',
  client_secret: 'pi_mock_123_secret_abc',
  amount: 50000,
  currency: 'eur',
  status: 'requires_payment_method',
  latest_charge: 'ch_mock_456',
};

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_mock_key_12345';
  process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_mock_key_12345';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_mock_secret';
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  resetService();
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ─── initialize() ─────────────────────────────────────────────────────────────

describe('initialize()', () => {
  it('initializes in TEST mode with sk_test_ key', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_mock_key_12345';

    stripeService.initialize();

    expect(Stripe).toHaveBeenCalledWith('sk_test_mock_key_12345', expect.any(Object));
    expect((stripeService as any).isInitialized).toBe(true);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('TEST'));
  });

  it('initializes in LIVE mode with sk_live_ key', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_live_mock_key_12345';

    stripeService.initialize();

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('LIVE'));
    expect((stripeService as any).isInitialized).toBe(true);
  });

  it('logs and returns early when already initialized', () => {
    stripeService.initialize();
    (Stripe as unknown as jest.Mock).mockClear();

    stripeService.initialize(); // second call

    expect(Stripe).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith('[StripeService] Already initialized');
  });

  it('throws when STRIPE_SECRET_KEY is missing', () => {
    delete process.env.STRIPE_SECRET_KEY;

    expect(() => stripeService.initialize()).toThrow('STRIPE_SECRET_KEY is not configured');
  });

  it('throws when STRIPE_SECRET_KEY has invalid format', () => {
    process.env.STRIPE_SECRET_KEY = 'pk_test_wrong_key';

    expect(() => stripeService.initialize()).toThrow('Invalid STRIPE_SECRET_KEY format');
  });
});

// ─── createPaymentIntent() ────────────────────────────────────────────────────

describe('createPaymentIntent()', () => {
  it('creates a payment intent and returns formatted response', async () => {
    injectStripe();
    mockStripe.paymentIntents.create.mockResolvedValue(mockPaymentIntent);

    const result = await stripeService.createPaymentIntent(validRequest);

    expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: validRequest.amount,
        currency: 'eur', // lowercased
        metadata: expect.objectContaining({
          bookingId: validRequest.bookingId,
          bookingReference: validRequest.bookingReference,
          userId: validRequest.userId,
        }),
      })
    );
    expect(result).toEqual({
      paymentIntentId: 'pi_mock_123',
      clientSecret: 'pi_mock_123_secret_abc',
      amount: 50000,
      currency: 'eur',
      status: 'requires_payment_method',
    });
  });

  it('throws when Stripe is not initialized', async () => {
    await expect(stripeService.createPaymentIntent(validRequest))
      .rejects.toThrow('not initialized');
  });

  it('converts StripeError to Error with stripe prefix', async () => {
    injectStripe();
    mockStripe.paymentIntents.create.mockRejectedValue(
      new StripeErrorClass('Your card was declined.', 'card_error', 'card_declined')
    );

    await expect(stripeService.createPaymentIntent(validRequest))
      .rejects.toThrow('Stripe Error: Your card was declined.');
  });

  it('rethrows plain Error as-is', async () => {
    injectStripe();
    mockStripe.paymentIntents.create.mockRejectedValue(new Error('Network timeout'));

    await expect(stripeService.createPaymentIntent(validRequest))
      .rejects.toThrow('Network timeout');
  });

  it('wraps unknown thrown values in Error', async () => {
    injectStripe();
    mockStripe.paymentIntents.create.mockRejectedValue('string error');

    await expect(stripeService.createPaymentIntent(validRequest))
      .rejects.toThrow('Unknown Stripe error occurred');
  });
});

// ─── getPaymentIntent() ───────────────────────────────────────────────────────

describe('getPaymentIntent()', () => {
  it('retrieves a payment intent by ID', async () => {
    injectStripe();
    mockStripe.paymentIntents.retrieve.mockResolvedValue(mockPaymentIntent);

    const result = await stripeService.getPaymentIntent('pi_mock_123');

    expect(mockStripe.paymentIntents.retrieve).toHaveBeenCalledWith('pi_mock_123');
    expect(result).toEqual(mockPaymentIntent);
  });

  it('converts StripeError on retrieve failure', async () => {
    injectStripe();
    mockStripe.paymentIntents.retrieve.mockRejectedValue(
      new StripeErrorClass('No such payment intent', 'invalid_request_error')
    );

    await expect(stripeService.getPaymentIntent('pi_bad'))
      .rejects.toThrow('Stripe Error: No such payment intent');
  });
});

// ─── cancelPaymentIntent() ────────────────────────────────────────────────────

describe('cancelPaymentIntent()', () => {
  it('cancels a payment intent and returns the result', async () => {
    injectStripe();
    const canceled = { ...mockPaymentIntent, status: 'canceled' };
    mockStripe.paymentIntents.cancel.mockResolvedValue(canceled);

    const result = await stripeService.cancelPaymentIntent('pi_mock_123');

    expect(mockStripe.paymentIntents.cancel).toHaveBeenCalledWith('pi_mock_123');
    expect(result.status).toBe('canceled');
  });

  it('converts StripeError on cancel failure', async () => {
    injectStripe();
    mockStripe.paymentIntents.cancel.mockRejectedValue(
      new StripeErrorClass('PaymentIntent cannot be canceled', 'invalid_request_error')
    );

    await expect(stripeService.cancelPaymentIntent('pi_mock_123'))
      .rejects.toThrow('Stripe Error: PaymentIntent cannot be canceled');
  });
});

// ─── createRefund() ───────────────────────────────────────────────────────────

describe('createRefund()', () => {
  const refundRequest = {
    paymentIntentId: 'pi_mock_123',
    bookingId: 'booking-001',
    userId: 'user-001',
  };

  const mockRefund = {
    id: 're_mock_789',
    amount: 50000,
    currency: 'eur',
    status: 'succeeded',
    reason: null,
  };

  it('creates a full refund and returns formatted response', async () => {
    injectStripe();
    mockStripe.paymentIntents.retrieve.mockResolvedValue(mockPaymentIntent);
    mockStripe.refunds.create.mockResolvedValue(mockRefund);

    const result = await stripeService.createRefund(refundRequest);

    expect(mockStripe.refunds.create).toHaveBeenCalledWith(
      expect.objectContaining({ payment_intent: 'pi_mock_123' })
    );
    expect(result).toMatchObject({
      refundId: 're_mock_789',
      paymentIntentId: 'pi_mock_123',
      amount: 50000,
      currency: 'eur',
      status: 'succeeded',
    });
  });

  it('includes amount in refund params when partial refund', async () => {
    injectStripe();
    mockStripe.paymentIntents.retrieve.mockResolvedValue(mockPaymentIntent);
    mockStripe.refunds.create.mockResolvedValue({ ...mockRefund, amount: 10000 });

    await stripeService.createRefund({ ...refundRequest, amount: 10000 });

    expect(mockStripe.refunds.create).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 10000 })
    );
  });

  it('includes reason in refund params when provided', async () => {
    injectStripe();
    mockStripe.paymentIntents.retrieve.mockResolvedValue(mockPaymentIntent);
    mockStripe.refunds.create.mockResolvedValue(mockRefund);

    await stripeService.createRefund({ ...refundRequest, reason: 'requested_by_customer' });

    expect(mockStripe.refunds.create).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'requested_by_customer' })
    );
  });

  it('throws when payment intent has no charge', async () => {
    injectStripe();
    mockStripe.paymentIntents.retrieve.mockResolvedValue({
      ...mockPaymentIntent,
      latest_charge: null,
    });

    await expect(stripeService.createRefund(refundRequest))
      .rejects.toThrow('No charge found for this payment intent');
  });

  it('converts StripeError on refund failure', async () => {
    injectStripe();
    mockStripe.paymentIntents.retrieve.mockResolvedValue(mockPaymentIntent);
    mockStripe.refunds.create.mockRejectedValue(
      new StripeErrorClass('Charge already fully refunded', 'invalid_request_error')
    );

    await expect(stripeService.createRefund(refundRequest))
      .rejects.toThrow('Stripe Error: Charge already fully refunded');
  });
});

// ─── constructWebhookEvent() ──────────────────────────────────────────────────

describe('constructWebhookEvent()', () => {
  it('returns the constructed event when signature is valid', () => {
    injectStripe();
    const mockEvent = { id: 'evt_mock', type: 'payment_intent.succeeded' };
    mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);

    const result = stripeService.constructWebhookEvent('raw-body', 'stripe-signature');

    expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith(
      'raw-body', 'stripe-signature', 'whsec_mock_secret'
    );
    expect(result).toEqual(mockEvent);
  });

  it('throws when STRIPE_WEBHOOK_SECRET is missing', () => {
    injectStripe();
    delete process.env.STRIPE_WEBHOOK_SECRET;

    expect(() => stripeService.constructWebhookEvent('body', 'sig'))
      .toThrow('STRIPE_WEBHOOK_SECRET is not configured');
  });

  it('rethrows when signature verification fails', () => {
    injectStripe();
    mockStripe.webhooks.constructEvent.mockImplementation(() => {
      throw new Error('Webhook signature verification failed');
    });

    expect(() => stripeService.constructWebhookEvent('body', 'bad-sig'))
      .toThrow('Webhook signature verification failed');
  });
});

// ─── updatePaymentIntentMetadata() ───────────────────────────────────────────

describe('updatePaymentIntentMetadata()', () => {
  it('updates metadata and returns the updated payment intent', async () => {
    injectStripe();
    const updated = { ...mockPaymentIntent, metadata: { bookingId: 'b2' } };
    mockStripe.paymentIntents.update.mockResolvedValue(updated);

    const result = await stripeService.updatePaymentIntentMetadata('pi_mock_123', { bookingId: 'b2' });

    expect(mockStripe.paymentIntents.update).toHaveBeenCalledWith(
      'pi_mock_123', { metadata: { bookingId: 'b2' } }
    );
    expect(result).toEqual(updated);
  });

  it('converts StripeError on update failure', async () => {
    injectStripe();
    mockStripe.paymentIntents.update.mockRejectedValue(
      new StripeErrorClass('No such payment intent', 'invalid_request_error')
    );

    await expect(stripeService.updatePaymentIntentMetadata('pi_bad', {}))
      .rejects.toThrow('Stripe Error: No such payment intent');
  });
});

// ─── getPublishableKey() ──────────────────────────────────────────────────────

describe('getPublishableKey()', () => {
  it('returns the publishable key from env', () => {
    process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_mock_key_12345';
    expect(stripeService.getPublishableKey()).toBe('pk_test_mock_key_12345');
  });

  it('throws when STRIPE_PUBLISHABLE_KEY is missing', () => {
    delete process.env.STRIPE_PUBLISHABLE_KEY;
    expect(() => stripeService.getPublishableKey()).toThrow('STRIPE_PUBLISHABLE_KEY is not configured');
  });
});

// ─── healthCheck() ────────────────────────────────────────────────────────────

describe('healthCheck()', () => {
  it('returns unhealthy when not initialized', async () => {
    const result = await stripeService.healthCheck();

    expect(result).toEqual({ healthy: false, details: { error: 'Stripe not initialized' } });
  });

  it('returns healthy with balance details when Stripe is reachable', async () => {
    injectStripe();
    mockStripe.balance.retrieve.mockResolvedValue({
      available: [{ amount: 100000, currency: 'eur' }],
      pending: [],
      livemode: false,
    });

    const result = await stripeService.healthCheck();

    expect(result.healthy).toBe(true);
    expect(result.details).toHaveProperty('available');
  });

  it('returns unhealthy with error message when balance retrieve throws', async () => {
    injectStripe();
    mockStripe.balance.retrieve.mockRejectedValue(new Error('Connection refused'));

    const result = await stripeService.healthCheck();

    expect(result.healthy).toBe(false);
    expect(result.details.error).toBe('Connection refused');
  });

  it('returns "Unknown error" when a non-Error value is thrown', async () => {
    injectStripe();
    mockStripe.balance.retrieve.mockRejectedValue('plain string error');

    const result = await stripeService.healthCheck();

    expect(result.healthy).toBe(false);
    expect(result.details.error).toBe('Unknown error');
  });
});
