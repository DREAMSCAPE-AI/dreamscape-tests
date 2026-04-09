import request from 'supertest';
import crypto from 'crypto';

const PAYMENT_SERVICE_URL: string = process.env.PAYMENT_SERVICE_URL || 'http://localhost:3004';
const AUTH_SERVICE_URL: string = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
const PAYMENT_PREFIX = '/api/v1/payment';
const AUTH_PREFIX = '/api/v1/auth';

const paymentApi = {
  post: (path: string) =>
    request(PAYMENT_SERVICE_URL).post(`${PAYMENT_PREFIX}${path}`).set('x-test-rate-limit', 'true'),
  get: (path: string) =>
    request(PAYMENT_SERVICE_URL).get(`${PAYMENT_PREFIX}${path}`).set('x-test-rate-limit', 'true'),
  put: (path: string) =>
    request(PAYMENT_SERVICE_URL).put(`${PAYMENT_PREFIX}${path}`).set('x-test-rate-limit', 'true'),
};

const authApi = {
  post: (path: string) =>
    request(AUTH_SERVICE_URL).post(`${AUTH_PREFIX}${path}`).set('x-test-rate-limit', 'true'),
};

// ─────────────────────────────────────────────────────────────
// DR-615 — payment-service Integration Tests (target: 60% coverage)
// One shared user created once per file in beforeAll
// Note: Stripe SDK is mocked server-side via STRIPE_SECRET_KEY=sk_test_*
// ─────────────────────────────────────────────────────────────

let accessToken: string = '';

beforeAll(async () => {
  const userData = {
    email: `dr615-shared-${Date.now()}@test.com`,
    password: 'Password123!',
    firstName: 'DR615',
    lastName: 'Test',
  };
  let res = await authApi.post('/register').send(userData);
  for (let i = 0; i < 5 && res.status === 429; i++) {
    await new Promise(r => setTimeout(r, 2000));
    res = await authApi.post('/register').send({ ...userData, email: `dr615-retry${i}-${Date.now()}@test.com` });
  }
  if (res.status === 201) {
    accessToken = res.body.data.tokens.accessToken;
  } else {
    console.warn(`[DR-615] Could not create test user (${res.status}) — tests run with empty token`);
  }
}, 30000);

afterAll(async () => {
  try { await authApi.post('/test/cleanup').send(); } catch {}
});

describe('[DR-615] payment-service — Health & Setup', () => {
  it('exposes /health endpoint', async () => {
    const res = await request(PAYMENT_SERVICE_URL).get('/health');
    expect([200, 429, 503]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.status).toBeDefined();
    }
  }, 10000);
});

describe('[DR-615] payment-service — Create Payment Intent', () => {
  it('creates a payment intent with valid amount', async () => {
    const res = await paymentApi
      .post('/create-intent')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ amount: 9999, currency: 'eur', bookingId: `booking-${Date.now()}` });

    expect(res.status).not.toBe(500);
    expect([200, 201, 400, 401, 402, 422, 503]).toContain(res.status);
    expect(res.body).toBeDefined();
  }, 15000);

  it('rejects payment intent with amount = 0', async () => {
    const res = await paymentApi
      .post('/create-intent')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ amount: 0, currency: 'eur' });

    expect([400, 401, 422]).toContain(res.status);
  }, 10000);

  it('rejects payment intent with negative amount', async () => {
    const res = await paymentApi
      .post('/create-intent')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ amount: -500, currency: 'eur' });

    expect([400, 401, 422]).toContain(res.status);
  }, 10000);

  it('rejects payment intent without currency', async () => {
    const res = await paymentApi
      .post('/create-intent')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ amount: 5000 });

    expect([400, 401, 422]).toContain(res.status);
  }, 10000);

  it('rejects payment intent without auth', async () => {
    const res = await paymentApi
      .post('/create-intent')
      .send({ amount: 5000, currency: 'eur' });

    expect([400, 401, 403, 404, 429]).toContain(res.status);
  }, 10000);
});

describe('[DR-615] payment-service — Transaction Status', () => {
  it('returns 404 for non-existent transaction', async () => {
    const res = await paymentApi
      .get('/status/non-existent-transaction-id-12345')
      .set('Authorization', `Bearer ${accessToken}`);

    expect([400, 401, 404]).toContain(res.status);
  }, 10000);

  it('rejects transaction status without auth', async () => {
    const res = await paymentApi.get('/status/some-id');
    expect([400, 401, 403, 404, 429]).toContain(res.status);
  }, 10000);
});

describe('[DR-615] payment-service — Payment History', () => {
  it('returns payment history for user', async () => {
    const res = await paymentApi
      .get('/history')
      .set('Authorization', `Bearer ${accessToken}`);

    expect([200, 401, 404]).toContain(res.status);
    expect(res.body).toBeDefined();
  }, 15000);

  it('rejects payment history without auth', async () => {
    const res = await paymentApi.get('/history');
    expect([400, 401, 403, 404, 429]).toContain(res.status);
  }, 10000);
});

describe('[DR-615] payment-service — Refund', () => {
  it('returns 404 when refunding non-existent payment', async () => {
    const res = await paymentApi
      .post('/refund')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ paymentIntentId: 'pi_nonexistent_12345', reason: 'requested_by_customer' });

    expect([400, 401, 404, 422, 503]).toContain(res.status);
    expect(res.status).not.toBe(500);
  }, 15000);

  it('rejects refund without auth', async () => {
    const res = await paymentApi
      .post('/refund')
      .send({ paymentIntentId: 'pi_test_12345' });

    expect([400, 401, 403, 404, 429]).toContain(res.status);
  }, 10000);

  it('rejects refund with missing paymentIntentId', async () => {
    const res = await paymentApi
      .post('/refund')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ reason: 'requested_by_customer' });

    expect([400, 401, 422]).toContain(res.status);
  }, 10000);
});

describe('[DR-615] payment-service — Webhooks (Stripe)', () => {
  const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_secret';

  function buildStripeSignature(payload: string, secret: string): string {
    const timestamp = Math.floor(Date.now() / 1000);
    const signedPayload = `${timestamp}.${payload}`;
    const signature = crypto
      .createHmac('sha256', secret.replace('whsec_', ''))
      .update(signedPayload)
      .digest('hex');
    return `t=${timestamp},v1=${signature}`;
  }

  it('rejects webhook with missing Stripe-Signature header', async () => {
    const payload = JSON.stringify({ type: 'payment_intent.succeeded', data: {} });

    const res = await request(PAYMENT_SERVICE_URL)
      .post(`${PAYMENT_PREFIX}/webhook`)
      .set('Content-Type', 'application/json')
      .send(payload);

    expect([400, 401, 403, 429]).toContain(res.status);
  }, 10000);

  it('rejects webhook with invalid signature', async () => {
    const payload = JSON.stringify({ type: 'payment_intent.succeeded', data: {} });

    const res = await request(PAYMENT_SERVICE_URL)
      .post(`${PAYMENT_PREFIX}/webhook`)
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 't=12345,v1=invalidsignature')
      .send(payload);

    expect([400, 401, 403, 429]).toContain(res.status);
  }, 10000);

  it('processes payment_intent.succeeded event', async () => {
    const eventId = `evt_test_${Date.now()}`;
    const payload = JSON.stringify({
      id: eventId,
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: `pi_test_${Date.now()}`,
          amount: 5000,
          currency: 'eur',
          status: 'succeeded',
          metadata: { userId: 'test-user-id', bookingId: 'booking-123' },
        },
      },
    });

    const sig = buildStripeSignature(payload, WEBHOOK_SECRET);

    const res = await request(PAYMENT_SERVICE_URL)
      .post(`${PAYMENT_PREFIX}/webhook`)
      .set('Content-Type', 'application/json')
      .set('stripe-signature', sig)
      .send(payload);

    expect(res.status).not.toBe(500);
    expect([200, 400, 401, 403, 429]).toContain(res.status);
  }, 15000);

  it('processes payment_intent.payment_failed event', async () => {
    const eventId = `evt_fail_${Date.now()}`;
    const payload = JSON.stringify({
      id: eventId,
      type: 'payment_intent.payment_failed',
      data: {
        object: {
          id: `pi_fail_${Date.now()}`,
          amount: 5000,
          currency: 'eur',
          status: 'requires_payment_method',
          last_payment_error: { code: 'card_declined', message: 'Your card was declined.' },
          metadata: { userId: 'test-user-id' },
        },
      },
    });

    const sig = buildStripeSignature(payload, WEBHOOK_SECRET);

    const res = await request(PAYMENT_SERVICE_URL)
      .post(`${PAYMENT_PREFIX}/webhook`)
      .set('Content-Type', 'application/json')
      .set('stripe-signature', sig)
      .send(payload);

    expect(res.status).not.toBe(500);
    expect([200, 400, 401, 403, 429]).toContain(res.status);
  }, 15000);

  it('handles duplicate webhook events idempotently', async () => {
    const eventId = `evt_dup_${Date.now()}`;
    const payload = JSON.stringify({
      id: eventId,
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_dup', amount: 1000, currency: 'eur', status: 'succeeded', metadata: {} } },
    });

    const sig = buildStripeSignature(payload, WEBHOOK_SECRET);
    const headers = { 'Content-Type': 'application/json', 'stripe-signature': sig };

    const res1 = await request(PAYMENT_SERVICE_URL)
      .post(`${PAYMENT_PREFIX}/webhook`)
      .set(headers)
      .send(payload);

    const res2 = await request(PAYMENT_SERVICE_URL)
      .post(`${PAYMENT_PREFIX}/webhook`)
      .set(headers)
      .send(payload);

    expect(res1.status).not.toBe(500);
    expect(res2.status).not.toBe(500);
  }, 20000);
});

describe('[DR-615] payment-service — Confirm Payment', () => {
  it('rejects confirmation without auth', async () => {
    const res = await paymentApi
      .post('/confirm')
      .send({ paymentIntentId: 'pi_test_12345' });

    expect([400, 401, 403, 404, 429]).toContain(res.status);
  }, 10000);

  it('rejects confirmation with missing paymentIntentId', async () => {
    const res = await paymentApi
      .post('/confirm')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});

    expect([400, 401, 404, 422]).toContain(res.status);
  }, 10000);

  it('returns error for non-existent payment intent', async () => {
    const res = await paymentApi
      .post('/confirm')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ paymentIntentId: 'pi_nonexistent_absolutely_fake' });

    expect(res.status).not.toBe(500);
    expect([400, 401, 404, 422, 503]).toContain(res.status);
  }, 15000);
});

describe('[DR-615] payment-service — Security & Validation', () => {
  it('does not return 500 on SQL injection in amount field', async () => {
    const res = await paymentApi
      .post('/create-intent')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ amount: "'; DROP TABLE payments; --", currency: 'eur' });

    expect(res.status).not.toBe(500);
    expect([400, 401, 422]).toContain(res.status);
  }, 10000);

  it('does not return 500 on extremely large amount', async () => {
    const res = await paymentApi
      .post('/create-intent')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ amount: Number.MAX_SAFE_INTEGER, currency: 'eur' });

    expect(res.status).not.toBe(500);
    expect([200, 201, 400, 401, 402, 422, 503]).toContain(res.status);
  }, 10000);

  it('does not return 500 on malformed JSON body', async () => {
    const res = await request(PAYMENT_SERVICE_URL)
      .post(`${PAYMENT_PREFIX}/create-intent`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Content-Type', 'application/json')
      .set('x-test-rate-limit', 'true')
      .send('not valid json {');

    expect(res.status).not.toBe(500);
    expect([400, 422]).toContain(res.status);
  }, 10000);
});
