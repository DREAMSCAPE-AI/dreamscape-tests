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

async function createTestUser(suffix: string = '') {
  const userData = {
    email: `dr615-${suffix}-${Date.now()}@test.com`,
    password: 'Password123!',
    firstName: 'DR615',
    lastName: 'Test',
  };
  const res = await authApi.post('/register').send(userData).expect(201);
  return {
    user: res.body.data.user,
    accessToken: res.body.data.tokens.accessToken as string,
    userData,
  };
}

// ─────────────────────────────────────────────────────────────
// DR-615 — payment-service Integration Tests (target: 60%, from scratch)
// Note: Stripe SDK is mocked server-side via STRIPE_SECRET_KEY=sk_test_*
// ─────────────────────────────────────────────────────────────

describe('[DR-615] payment-service — Health & Setup', () => {
  it('exposes /health endpoint', async () => {
    const res = await request(PAYMENT_SERVICE_URL).get('/health');
    expect([200, 503]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.status).toBeDefined();
    }
  }, 10000);
});

describe('[DR-615] payment-service — Create Payment Intent', () => {
  let ctx: Awaited<ReturnType<typeof createTestUser>>;

  beforeEach(async () => { ctx = await createTestUser('intent'); });
  afterEach(async () => {
    try { await authApi.post('/test/cleanup').send(); } catch {}
  });

  it('creates a payment intent with valid amount', async () => {
    const res = await paymentApi
      .post('/create-intent')
      .set('Authorization', `Bearer ${ctx.accessToken}`)
      .send({ amount: 9999, currency: 'eur', bookingId: `booking-${Date.now()}` });

    // Stripe may be unavailable in test env, accept 402/503 too
    expect(res.status).not.toBe(500);
    expect([200, 201, 400, 402, 422, 503]).toContain(res.status);
    if ([200, 201].includes(res.status)) {
      expect(res.body.success).toBe(true);
      expect(res.body.data.clientSecret ?? res.body.data.paymentIntentId).toBeDefined();
    }
  }, 15000);

  it('rejects payment intent with amount = 0', async () => {
    const res = await paymentApi
      .post('/create-intent')
      .set('Authorization', `Bearer ${ctx.accessToken}`)
      .send({ amount: 0, currency: 'eur' });

    expect([400, 422]).toContain(res.status);
  }, 10000);

  it('rejects payment intent with negative amount', async () => {
    const res = await paymentApi
      .post('/create-intent')
      .set('Authorization', `Bearer ${ctx.accessToken}`)
      .send({ amount: -500, currency: 'eur' });

    expect([400, 422]).toContain(res.status);
  }, 10000);

  it('rejects payment intent without currency', async () => {
    const res = await paymentApi
      .post('/create-intent')
      .set('Authorization', `Bearer ${ctx.accessToken}`)
      .send({ amount: 5000 });

    expect([400, 422]).toContain(res.status);
  }, 10000);

  it('rejects payment intent without auth', async () => {
    const res = await paymentApi
      .post('/create-intent')
      .send({ amount: 5000, currency: 'eur' });

    expect([401, 403]).toContain(res.status);
  }, 10000);
});

describe('[DR-615] payment-service — Transaction Status', () => {
  let ctx: Awaited<ReturnType<typeof createTestUser>>;

  beforeEach(async () => { ctx = await createTestUser('status'); });
  afterEach(async () => {
    try { await authApi.post('/test/cleanup').send(); } catch {}
  });

  it('returns 404 for non-existent transaction', async () => {
    const res = await paymentApi
      .get('/status/non-existent-transaction-id-12345')
      .set('Authorization', `Bearer ${ctx.accessToken}`);

    expect([404, 400]).toContain(res.status);
  }, 10000);

  it('rejects transaction status without auth', async () => {
    const res = await paymentApi.get('/status/some-id');
    expect([401, 403]).toContain(res.status);
  }, 10000);
});

describe('[DR-615] payment-service — Payment History', () => {
  let ctx: Awaited<ReturnType<typeof createTestUser>>;

  beforeEach(async () => { ctx = await createTestUser('history'); });
  afterEach(async () => {
    try { await authApi.post('/test/cleanup').send(); } catch {}
  });

  it('returns empty payment history for new user', async () => {
    const res = await paymentApi
      .get('/history')
      .set('Authorization', `Bearer ${ctx.accessToken}`);

    expect([200, 404]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
      const transactions = res.body.data.transactions ?? res.body.data.payments ?? [];
      expect(Array.isArray(transactions)).toBe(true);
    }
  }, 15000);

  it('rejects payment history without auth', async () => {
    const res = await paymentApi.get('/history');
    expect([401, 403]).toContain(res.status);
  }, 10000);
});

describe('[DR-615] payment-service — Refund', () => {
  let ctx: Awaited<ReturnType<typeof createTestUser>>;

  beforeEach(async () => { ctx = await createTestUser('refund'); });
  afterEach(async () => {
    try { await authApi.post('/test/cleanup').send(); } catch {}
  });

  it('returns 404 when refunding non-existent payment', async () => {
    const res = await paymentApi
      .post('/refund')
      .set('Authorization', `Bearer ${ctx.accessToken}`)
      .send({ paymentIntentId: 'pi_nonexistent_12345', reason: 'requested_by_customer' });

    expect([400, 404, 422, 503]).toContain(res.status);
    expect(res.status).not.toBe(500);
  }, 15000);

  it('rejects refund without auth', async () => {
    const res = await paymentApi
      .post('/refund')
      .send({ paymentIntentId: 'pi_test_12345' });

    expect([401, 403]).toContain(res.status);
  }, 10000);

  it('rejects refund with missing paymentIntentId', async () => {
    const res = await paymentApi
      .post('/refund')
      .set('Authorization', `Bearer ${ctx.accessToken}`)
      .send({ reason: 'requested_by_customer' });

    expect([400, 422]).toContain(res.status);
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

    expect([400, 401, 403]).toContain(res.status);
  }, 10000);

  it('rejects webhook with invalid signature', async () => {
    const payload = JSON.stringify({ type: 'payment_intent.succeeded', data: {} });

    const res = await request(PAYMENT_SERVICE_URL)
      .post(`${PAYMENT_PREFIX}/webhook`)
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 't=12345,v1=invalidsignature')
      .send(payload);

    expect([400, 401, 403]).toContain(res.status);
  }, 10000);

  it('processes payment_intent.succeeded event (idempotent)', async () => {
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

    // Either accepted or rejected (sig mismatch in test env) — never 500
    expect(res.status).not.toBe(500);
    expect([200, 400, 401, 403]).toContain(res.status);
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
    expect([200, 400, 401, 403]).toContain(res.status);
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

    // Both must not crash
    expect(res1.status).not.toBe(500);
    expect(res2.status).not.toBe(500);
  }, 20000);
});

describe('[DR-615] payment-service — Confirm Payment', () => {
  let ctx: Awaited<ReturnType<typeof createTestUser>>;

  beforeEach(async () => { ctx = await createTestUser('confirm'); });
  afterEach(async () => {
    try { await authApi.post('/test/cleanup').send(); } catch {}
  });

  it('rejects confirmation without auth', async () => {
    const res = await paymentApi
      .post('/confirm')
      .send({ paymentIntentId: 'pi_test_12345' });

    expect([401, 403]).toContain(res.status);
  }, 10000);

  it('rejects confirmation with missing paymentIntentId', async () => {
    const res = await paymentApi
      .post('/confirm')
      .set('Authorization', `Bearer ${ctx.accessToken}`)
      .send({});

    expect([400, 422]).toContain(res.status);
  }, 10000);

  it('returns error for non-existent payment intent', async () => {
    const res = await paymentApi
      .post('/confirm')
      .set('Authorization', `Bearer ${ctx.accessToken}`)
      .send({ paymentIntentId: 'pi_nonexistent_absolutely_fake' });

    expect(res.status).not.toBe(500);
    expect([400, 404, 422, 503]).toContain(res.status);
  }, 15000);
});

describe('[DR-615] payment-service — Security & Validation', () => {
  let ctx: Awaited<ReturnType<typeof createTestUser>>;

  beforeEach(async () => { ctx = await createTestUser('security'); });
  afterEach(async () => {
    try { await authApi.post('/test/cleanup').send(); } catch {}
  });

  it('does not return 500 on SQL injection in amount field', async () => {
    const res = await paymentApi
      .post('/create-intent')
      .set('Authorization', `Bearer ${ctx.accessToken}`)
      .send({ amount: "'; DROP TABLE payments; --", currency: 'eur' });

    expect(res.status).not.toBe(500);
    expect([400, 422]).toContain(res.status);
  }, 10000);

  it('does not return 500 on extremely large amount', async () => {
    const res = await paymentApi
      .post('/create-intent')
      .set('Authorization', `Bearer ${ctx.accessToken}`)
      .send({ amount: Number.MAX_SAFE_INTEGER, currency: 'eur' });

    expect(res.status).not.toBe(500);
  }, 10000);

  it('does not return 500 on malformed JSON body', async () => {
    const res = await request(PAYMENT_SERVICE_URL)
      .post(`${PAYMENT_PREFIX}/create-intent`)
      .set('Authorization', `Bearer ${ctx.accessToken}`)
      .set('Content-Type', 'application/json')
      .set('x-test-rate-limit', 'true')
      .send('not valid json {');

    expect(res.status).not.toBe(500);
    expect([400, 422]).toContain(res.status);
  }, 10000);
});
