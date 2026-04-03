/**
 * webhookService.test.ts — DR-538-US-TEST-023
 *
 * Unit tests for WebhookService.
 * All dependencies (StripeService, PaymentService, DatabaseService) are fully mocked.
 */

// ─── Module mocks ─────────────────────────────────────────────────────────────

jest.mock(
  '../../../../dreamscape-services/payment/src/services/StripeService',
  () => ({ __esModule: true, default: { constructWebhookEvent: jest.fn() } })
);

jest.mock(
  '../../../../dreamscape-services/payment/src/services/PaymentService',
  () => ({
    __esModule: true,
    default: {
      handlePaymentSucceeded: jest.fn(),
      handlePaymentFailed: jest.fn(),
      handlePaymentCanceled: jest.fn(),
      handlePaymentRefunded: jest.fn(),
    },
  })
);

jest.mock(
  '../../../../dreamscape-services/payment/src/services/DatabaseService',
  () => ({
    __esModule: true,
    default: {
      isEventProcessed: jest.fn(),
      markEventAsProcessed: jest.fn(),
    },
  })
);

// ─── Imports ──────────────────────────────────────────────────────────────────

import webhookService from '../../../../dreamscape-services/payment/src/services/WebhookService';
import stripeService from '../../../../dreamscape-services/payment/src/services/StripeService';
import paymentService from '../../../../dreamscape-services/payment/src/services/PaymentService';
import databaseService from '../../../../dreamscape-services/payment/src/services/DatabaseService';

const mockStripe = stripeService as jest.Mocked<typeof stripeService>;
const mockPayment = paymentService as jest.Mocked<typeof paymentService>;
const mockDb = databaseService as jest.Mocked<typeof databaseService>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEvent(type: string, data: Record<string, any> = {}) {
  return {
    id: 'evt_mock_123',
    type,
    created: 1700000000,
    livemode: false,
    data: { object: data },
  } as any;
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockDb.isEventProcessed.mockResolvedValue(false);
  mockDb.markEventAsProcessed.mockResolvedValue(undefined);
  mockPayment.handlePaymentSucceeded.mockResolvedValue(undefined);
  mockPayment.handlePaymentFailed.mockResolvedValue(undefined);
  mockPayment.handlePaymentCanceled.mockResolvedValue(undefined);
  mockPayment.handlePaymentRefunded.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ─── processWebhook() — signature & idempotency ───────────────────────────────

describe('processWebhook() — signature & idempotency', () => {
  it('returns failure when signature verification throws', async () => {
    mockStripe.constructWebhookEvent.mockImplementation(() => {
      throw new Error('Invalid signature');
    });

    const result = await webhookService.processWebhook(Buffer.from('body'), 'bad-sig');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid signature');
  });

  it('returns "Unknown error" when a non-Error is thrown', async () => {
    mockStripe.constructWebhookEvent.mockImplementation(() => { throw 'oops'; });

    const result = await webhookService.processWebhook(Buffer.from('body'), 'sig');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Unknown error');
  });

  it('returns early success when event was already processed (idempotency)', async () => {
    mockStripe.constructWebhookEvent.mockReturnValue(
      makeEvent('payment_intent.succeeded', { id: 'pi_123' })
    );
    mockDb.isEventProcessed.mockResolvedValue(true);

    const result = await webhookService.processWebhook(Buffer.from('body'), 'sig');

    expect(result.success).toBe(true);
    expect(result.message).toContain('already processed');
    expect(mockPayment.handlePaymentSucceeded).not.toHaveBeenCalled();
    expect(mockDb.markEventAsProcessed).not.toHaveBeenCalled();
  });

  it('marks event as processed after successful handling', async () => {
    mockStripe.constructWebhookEvent.mockReturnValue(
      makeEvent('payment_intent.succeeded', { id: 'pi_123' })
    );

    await webhookService.processWebhook(Buffer.from('body'), 'sig');

    expect(mockDb.markEventAsProcessed).toHaveBeenCalledWith(
      'evt_mock_123',
      'payment_intent.succeeded',
      expect.objectContaining({ created: 1700000000, livemode: false })
    );
  });
});

// ─── processWebhook() — event routing ────────────────────────────────────────

describe('processWebhook() — event routing', () => {
  it('delegates payment_intent.succeeded to handlePaymentSucceeded', async () => {
    mockStripe.constructWebhookEvent.mockReturnValue(
      makeEvent('payment_intent.succeeded', { id: 'pi_123' })
    );

    const result = await webhookService.processWebhook(Buffer.from('body'), 'sig');

    expect(mockPayment.handlePaymentSucceeded).toHaveBeenCalledWith('pi_123');
    expect(result.success).toBe(true);
  });

  it('delegates payment_intent.payment_failed with last_payment_error message', async () => {
    mockStripe.constructWebhookEvent.mockReturnValue(
      makeEvent('payment_intent.payment_failed', {
        id: 'pi_123',
        last_payment_error: { message: 'Insufficient funds.' },
      })
    );

    await webhookService.processWebhook(Buffer.from('body'), 'sig');

    expect(mockPayment.handlePaymentFailed).toHaveBeenCalledWith('pi_123', 'Insufficient funds.');
  });

  it('delegates payment_intent.payment_failed with undefined reason when no error', async () => {
    mockStripe.constructWebhookEvent.mockReturnValue(
      makeEvent('payment_intent.payment_failed', { id: 'pi_123', last_payment_error: null })
    );

    await webhookService.processWebhook(Buffer.from('body'), 'sig');

    expect(mockPayment.handlePaymentFailed).toHaveBeenCalledWith('pi_123', undefined);
  });

  it('delegates payment_intent.canceled to handlePaymentCanceled', async () => {
    mockStripe.constructWebhookEvent.mockReturnValue(
      makeEvent('payment_intent.canceled', { id: 'pi_123' })
    );

    await webhookService.processWebhook(Buffer.from('body'), 'sig');

    expect(mockPayment.handlePaymentCanceled).toHaveBeenCalledWith('pi_123');
    expect(result => result).toBeDefined();
  });

  it('delegates charge.refunded when payment_intent is a string', async () => {
    mockStripe.constructWebhookEvent.mockReturnValue(
      makeEvent('charge.refunded', { id: 'ch_123', payment_intent: 'pi_from_string' })
    );

    await webhookService.processWebhook(Buffer.from('body'), 'sig');

    expect(mockPayment.handlePaymentRefunded).toHaveBeenCalledWith('pi_from_string');
  });

  it('delegates charge.refunded when payment_intent is an object', async () => {
    mockStripe.constructWebhookEvent.mockReturnValue(
      makeEvent('charge.refunded', { id: 'ch_123', payment_intent: { id: 'pi_from_object' } })
    );

    await webhookService.processWebhook(Buffer.from('body'), 'sig');

    expect(mockPayment.handlePaymentRefunded).toHaveBeenCalledWith('pi_from_object');
  });

  it('logs error and skips handlePaymentRefunded when charge has no payment_intent', async () => {
    mockStripe.constructWebhookEvent.mockReturnValue(
      makeEvent('charge.refunded', { id: 'ch_123', payment_intent: null })
    );

    const result = await webhookService.processWebhook(Buffer.from('body'), 'sig');

    expect(mockPayment.handlePaymentRefunded).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
    expect(result.success).toBe(true); // event still marked as processed
  });

  it('handles charge.dispute.created by logging and marking as processed', async () => {
    mockStripe.constructWebhookEvent.mockReturnValue(
      makeEvent('charge.dispute.created', { id: 'dp_123', charge: 'ch_123', reason: 'fraudulent' })
    );

    const result = await webhookService.processWebhook(Buffer.from('body'), 'sig');

    expect(console.warn).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(mockDb.markEventAsProcessed).toHaveBeenCalled();
  });

  it('handles unrecognized event types gracefully', async () => {
    mockStripe.constructWebhookEvent.mockReturnValue(
      makeEvent('customer.created', {})
    );

    const result = await webhookService.processWebhook(Buffer.from('body'), 'sig');

    expect(result.success).toBe(true);
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Unhandled event type: customer.created')
    );
    expect(mockDb.markEventAsProcessed).toHaveBeenCalled();
  });

  it('returns failure when a handler throws', async () => {
    mockStripe.constructWebhookEvent.mockReturnValue(
      makeEvent('payment_intent.succeeded', { id: 'pi_123' })
    );
    mockPayment.handlePaymentSucceeded.mockRejectedValue(new Error('DB error'));

    const result = await webhookService.processWebhook(Buffer.from('body'), 'sig');

    expect(result.success).toBe(false);
    expect(result.error).toBe('DB error');
  });
});
