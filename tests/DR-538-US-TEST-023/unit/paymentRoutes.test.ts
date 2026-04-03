/**
 * paymentRoutes.test.ts — DR-538-US-TEST-023
 *
 * Supertest route tests for payment.ts.
 * PaymentService and WebhookService are fully mocked.
 *
 * Two Express app instances:
 *   app        — express.raw() for webhook + express.json() for others (normal usage)
 *   appJsonOnly — express.json() only (tests the non-Buffer 400 path on /webhook)
 */

// ─── Module mocks ─────────────────────────────────────────────────────────────

jest.mock(
  '../../../../dreamscape-services/payment/src/services/PaymentService',
  () => ({
    __esModule: true,
    default: {
      createPaymentIntent: jest.fn(),
      getPublishableKey: jest.fn(),
      processRefund: jest.fn(),
      cancelPaymentIntent: jest.fn(),
      updatePaymentIntentMetadata: jest.fn(),
    },
  })
);

jest.mock(
  '../../../../dreamscape-services/payment/src/services/WebhookService',
  () => ({
    __esModule: true,
    default: { processWebhook: jest.fn() },
  })
);

// ─── Imports ──────────────────────────────────────────────────────────────────

import request from 'supertest';
import express from 'express';
import paymentRouter from '../../../../dreamscape-services/payment/src/routes/payment';
import paymentService from '../../../../dreamscape-services/payment/src/services/PaymentService';
import webhookService from '../../../../dreamscape-services/payment/src/services/WebhookService';

const mockPayment = paymentService as jest.Mocked<typeof paymentService>;
const mockWebhook = webhookService as jest.Mocked<typeof webhookService>;

// ─── Test apps ────────────────────────────────────────────────────────────────

// Normal app: webhook receives raw Buffer, other routes receive parsed JSON
const app = express();
app.use('/api/v1/payment/webhook', express.raw({ type: '*/*' }));
app.use(express.json());
app.use('/api/v1/payment', paymentRouter);

// App without raw middleware: webhook body is parsed JSON (not a Buffer → 400)
const appJsonOnly = express();
appJsonOnly.use(express.json());
appJsonOnly.use('/api/v1/payment', paymentRouter);

// App that forces req.params.paymentIntentId to empty string, covering the dead-code guard
// in the /cancel/:id handler (lines 229-232 of payment.ts)
const appEmptyParam = express();
appEmptyParam.use(express.json());
appEmptyParam.use('/api/v1/payment', (req: any, _res: express.Response, next: express.NextFunction) => {
  // Lock req.params so the Router cannot overwrite it during route matching
  Object.defineProperty(req, 'params', {
    get() { return { paymentIntentId: '' }; },
    set(_v: any) { /* block router assignment */ },
    configurable: true,
  });
  next();
}, paymentRouter);

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ─── POST /create-intent ──────────────────────────────────────────────────────

describe('POST /api/v1/payment/create-intent', () => {
  const validBody = {
    amount: 50000,
    currency: 'EUR',
    bookingId: 'b-001',
    bookingReference: 'REF-001',
    userId: 'u-001',
  };

  it('returns 200 with paymentIntent data on success', async () => {
    const intent = { paymentIntentId: 'pi_mock', clientSecret: 'secret', amount: 50000, currency: 'eur', status: 'requires_payment_method' };
    mockPayment.createPaymentIntent.mockResolvedValue(intent);

    const res = await request(app).post('/api/v1/payment/create-intent').send(validBody);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.paymentIntentId).toBe('pi_mock');
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/v1/payment/create-intent')
      .send({ amount: 100, currency: 'EUR' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Missing required fields');
  });

  it('returns 400 when amount is 0 (falsy, triggers missing-fields check)', async () => {
    const res = await request(app)
      .post('/api/v1/payment/create-intent')
      .send({ ...validBody, amount: 0 });

    expect(res.status).toBe(400);
    // !0 === true, so the missing-fields guard fires before the amount <= 0 check
    expect(res.body.error).toBe('Missing required fields');
  });

  it('returns 400 when amount is negative', async () => {
    const res = await request(app)
      .post('/api/v1/payment/create-intent')
      .send({ ...validBody, amount: -100 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid amount');
  });

  it('returns 500 with error message when PaymentService throws Error', async () => {
    mockPayment.createPaymentIntent.mockRejectedValue(new Error('Stripe down'));

    const res = await request(app).post('/api/v1/payment/create-intent').send(validBody);

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Stripe down');
  });

  it('returns 500 with "Unknown error" when non-Error is thrown', async () => {
    mockPayment.createPaymentIntent.mockRejectedValue('string error');

    const res = await request(app).post('/api/v1/payment/create-intent').send(validBody);

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Unknown error');
  });
});

// ─── GET /config ──────────────────────────────────────────────────────────────

describe('GET /api/v1/payment/config', () => {
  it('returns 200 with publishable key', async () => {
    mockPayment.getPublishableKey.mockReturnValue('pk_test_mock');

    const res = await request(app).get('/api/v1/payment/config');

    expect(res.status).toBe(200);
    expect(res.body.data.publishableKey).toBe('pk_test_mock');
  });

  it('returns 500 with error message when service throws Error', async () => {
    mockPayment.getPublishableKey.mockImplementation(() => { throw new Error('No key configured'); });

    const res = await request(app).get('/api/v1/payment/config');

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('No key configured');
  });

  it('returns 500 with "Unknown error" when non-Error is thrown', async () => {
    mockPayment.getPublishableKey.mockImplementation(() => { throw 42; });

    const res = await request(app).get('/api/v1/payment/config');

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Unknown error');
  });
});

// ─── POST /webhook ────────────────────────────────────────────────────────────

describe('POST /api/v1/payment/webhook', () => {
  it('returns 400 when stripe-signature header is missing', async () => {
    const res = await request(app)
      .post('/api/v1/payment/webhook')
      .send(Buffer.from('payload'));

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Missing stripe-signature header');
  });

  it('returns 400 when body is not a raw Buffer (no express.raw middleware)', async () => {
    const res = await request(appJsonOnly)
      .post('/api/v1/payment/webhook')
      .set('stripe-signature', 'sig_test')
      .send({ some: 'json' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request body');
  });

  it('returns 200 when webhook is processed successfully', async () => {
    mockWebhook.processWebhook.mockResolvedValue({ success: true, message: 'OK' });

    const res = await request(app)
      .post('/api/v1/payment/webhook')
      .set('stripe-signature', 'sig_test')
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.from('raw-payload'));

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });

  it('returns 400 when webhook processing fails', async () => {
    mockWebhook.processWebhook.mockResolvedValue({ success: false, message: 'Invalid sig', error: 'sig mismatch' });

    const res = await request(app)
      .post('/api/v1/payment/webhook')
      .set('stripe-signature', 'bad_sig')
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.from('raw-payload'));

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid sig');
  });

  it('returns 400 when processWebhook throws', async () => {
    mockWebhook.processWebhook.mockRejectedValue(new Error('Unexpected'));

    const res = await request(app)
      .post('/api/v1/payment/webhook')
      .set('stripe-signature', 'sig_test')
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.from('raw-payload'));

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Unexpected');
  });

  it('returns 400 with "Unknown error" when non-Error is thrown', async () => {
    mockWebhook.processWebhook.mockRejectedValue('boom');

    const res = await request(app)
      .post('/api/v1/payment/webhook')
      .set('stripe-signature', 'sig_test')
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.from('raw-payload'));

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Unknown error');
  });
});

// ─── POST /refund ─────────────────────────────────────────────────────────────

describe('POST /api/v1/payment/refund', () => {
  const validBody = { paymentIntentId: 'pi_mock', bookingId: 'b-001', userId: 'u-001' };
  const refundResponse = { refundId: 're_mock', paymentIntentId: 'pi_mock', amount: 50000, currency: 'eur', status: 'succeeded' };

  it('returns 200 with refund data on success', async () => {
    mockPayment.processRefund.mockResolvedValue(refundResponse);

    const res = await request(app).post('/api/v1/payment/refund').send(validBody);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.refundId).toBe('re_mock');
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/v1/payment/refund')
      .send({ paymentIntentId: 'pi_mock' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Missing required fields');
  });

  it('returns 500 with error message when service throws Error', async () => {
    mockPayment.processRefund.mockRejectedValue(new Error('Stripe Error: already refunded'));

    const res = await request(app).post('/api/v1/payment/refund').send(validBody);

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Stripe Error: already refunded');
  });

  it('returns 500 with "Unknown error" when non-Error is thrown', async () => {
    mockPayment.processRefund.mockRejectedValue({ code: 'unknown' });

    const res = await request(app).post('/api/v1/payment/refund').send(validBody);

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Unknown error');
  });
});

// ─── PUT /update-metadata ─────────────────────────────────────────────────────

describe('PUT /api/v1/payment/update-metadata', () => {
  const validBody = {
    paymentIntentId: 'pi_mock',
    metadata: { bookingId: 'b-002', bookingReference: 'REF-002', userId: 'u-001' },
  };

  it('returns 200 on successful metadata update', async () => {
    mockPayment.updatePaymentIntentMetadata.mockResolvedValue(undefined);

    const res = await request(app).put('/api/v1/payment/update-metadata').send(validBody);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 400 when paymentIntentId is missing', async () => {
    const res = await request(app)
      .put('/api/v1/payment/update-metadata')
      .send({ metadata: { bookingId: 'b-002' } });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Missing required fields');
  });

  it('returns 400 when metadata is missing', async () => {
    const res = await request(app)
      .put('/api/v1/payment/update-metadata')
      .send({ paymentIntentId: 'pi_mock' });

    expect(res.status).toBe(400);
  });

  it('returns 500 with error message when service throws Error', async () => {
    mockPayment.updatePaymentIntentMetadata.mockRejectedValue(new Error('Not found'));

    const res = await request(app).put('/api/v1/payment/update-metadata').send(validBody);

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Not found');
  });

  it('returns 500 with "Unknown error" when non-Error is thrown', async () => {
    mockPayment.updatePaymentIntentMetadata.mockRejectedValue(null);

    const res = await request(app).put('/api/v1/payment/update-metadata').send(validBody);

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Unknown error');
  });
});

// ─── POST /cancel/:paymentIntentId ────────────────────────────────────────────

describe('POST /api/v1/payment/cancel/:paymentIntentId', () => {
  it('returns 200 on successful cancellation', async () => {
    mockPayment.cancelPaymentIntent.mockResolvedValue(undefined);

    const res = await request(app).post('/api/v1/payment/cancel/pi_mock_123');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockPayment.cancelPaymentIntent).toHaveBeenCalledWith('pi_mock_123');
  });

  it('returns 500 with error message when service throws Error', async () => {
    mockPayment.cancelPaymentIntent.mockRejectedValue(new Error('Cannot cancel'));

    const res = await request(app).post('/api/v1/payment/cancel/pi_mock_123');

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Cannot cancel');
  });

  it('returns 500 with "Unknown error" when non-Error is thrown', async () => {
    mockPayment.cancelPaymentIntent.mockRejectedValue('fail');

    const res = await request(app).post('/api/v1/payment/cancel/pi_mock_123');

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Unknown error');
  });

  it('returns 400 when paymentIntentId param is empty (dead-code guard coverage)', async () => {
    const res = await request(appEmptyParam).post('/api/v1/payment/cancel/any');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Missing payment intent ID');
  });
});
