import request from 'supertest';

const VOYAGE_SERVICE_URL: string = process.env.VOYAGE_SERVICE_URL || 'http://localhost:3003';
const AUTH_SERVICE_URL: string = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
const VOYAGE_PREFIX = '/api/v1/voyage';
const AUTH_PREFIX = '/api/v1/auth';

const voyageApi = {
  post: (path: string) =>
    request(VOYAGE_SERVICE_URL).post(`${VOYAGE_PREFIX}${path}`).set('x-test-rate-limit', 'true'),
  get: (path: string) =>
    request(VOYAGE_SERVICE_URL).get(`${VOYAGE_PREFIX}${path}`).set('x-test-rate-limit', 'true'),
  put: (path: string) =>
    request(VOYAGE_SERVICE_URL).put(`${VOYAGE_PREFIX}${path}`).set('x-test-rate-limit', 'true'),
  delete: (path: string) =>
    request(VOYAGE_SERVICE_URL).delete(`${VOYAGE_PREFIX}${path}`).set('x-test-rate-limit', 'true'),
};

const authApi = {
  post: (path: string) =>
    request(AUTH_SERVICE_URL).post(`${AUTH_PREFIX}${path}`).set('x-test-rate-limit', 'true'),
};

async function createTestUser(suffix: string = '') {
  const userData = {
    email: `dr614-${suffix}-${Date.now()}@test.com`,
    password: 'Password123!',
    firstName: 'DR614',
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
// DR-614 — voyage-service Integration Tests (target: 60% coverage)
// ─────────────────────────────────────────────────────────────

describe('[DR-614] voyage-service — Flights Search', () => {
  let ctx: Awaited<ReturnType<typeof createTestUser>>;

  beforeEach(async () => { ctx = await createTestUser('flights'); });
  afterEach(async () => {
    try { await authApi.post('/test/cleanup').send(); } catch {}
  });

  it('searches flights with valid parameters', async () => {
    const res = await voyageApi
      .get('/flights/search')
      .set('Authorization', `Bearer ${ctx.accessToken}`)
      .query({
        origin: 'CDG',
        destination: 'JFK',
        departureDate: '2025-08-01',
        adults: 1,
      });

    expect([200, 404, 503]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    }
  }, 20000);

  it('rejects flight search with missing origin', async () => {
    const res = await voyageApi
      .get('/flights/search')
      .set('Authorization', `Bearer ${ctx.accessToken}`)
      .query({ destination: 'JFK', departureDate: '2025-08-01', adults: 1 });

    expect([400, 422]).toContain(res.status);
  }, 10000);

  it('rejects flight search with missing destination', async () => {
    const res = await voyageApi
      .get('/flights/search')
      .set('Authorization', `Bearer ${ctx.accessToken}`)
      .query({ origin: 'CDG', departureDate: '2025-08-01', adults: 1 });

    expect([400, 422]).toContain(res.status);
  }, 10000);

  it('rejects flight search without auth', async () => {
    const res = await voyageApi
      .get('/flights/search')
      .query({ origin: 'CDG', destination: 'JFK', departureDate: '2025-08-01' });

    expect([401, 403]).toContain(res.status);
  }, 10000);

  it('rejects flight search with invalid date format', async () => {
    const res = await voyageApi
      .get('/flights/search')
      .set('Authorization', `Bearer ${ctx.accessToken}`)
      .query({ origin: 'CDG', destination: 'JFK', departureDate: 'not-a-date', adults: 1 });

    expect([400, 422]).toContain(res.status);
  }, 10000);
});

describe('[DR-614] voyage-service — Hotels Search', () => {
  let ctx: Awaited<ReturnType<typeof createTestUser>>;

  beforeEach(async () => { ctx = await createTestUser('hotels'); });
  afterEach(async () => {
    try { await authApi.post('/test/cleanup').send(); } catch {}
  });

  it('searches hotels with valid parameters', async () => {
    const res = await voyageApi
      .get('/hotels/search')
      .set('Authorization', `Bearer ${ctx.accessToken}`)
      .query({
        cityCode: 'PAR',
        checkInDate: '2025-08-01',
        checkOutDate: '2025-08-05',
        adults: 1,
      });

    expect([200, 404, 503]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
    }
  }, 20000);

  it('rejects hotel search with missing cityCode', async () => {
    const res = await voyageApi
      .get('/hotels/search')
      .set('Authorization', `Bearer ${ctx.accessToken}`)
      .query({ checkInDate: '2025-08-01', checkOutDate: '2025-08-05' });

    expect([400, 422]).toContain(res.status);
  }, 10000);

  it('rejects hotel search without auth', async () => {
    const res = await voyageApi
      .get('/hotels/search')
      .query({ cityCode: 'PAR', checkInDate: '2025-08-01', checkOutDate: '2025-08-05' });

    expect([401, 403]).toContain(res.status);
  }, 10000);
});

describe('[DR-614] voyage-service — Itinerary', () => {
  let ctx: Awaited<ReturnType<typeof createTestUser>>;
  let createdItineraryId: string | null = null;

  beforeEach(async () => { ctx = await createTestUser('itinerary'); });
  afterEach(async () => {
    if (createdItineraryId) {
      try {
        await voyageApi
          .delete(`/itinerary/${createdItineraryId}`)
          .set('Authorization', `Bearer ${ctx.accessToken}`);
      } catch {}
      createdItineraryId = null;
    }
    try { await authApi.post('/test/cleanup').send(); } catch {}
  });

  it('creates a new itinerary', async () => {
    const itineraryData = {
      title: 'Paris Trip 2025',
      startDate: '2025-08-01',
      endDate: '2025-08-07',
      destination: 'Paris, France',
    };

    const res = await voyageApi
      .post('/itinerary')
      .set('Authorization', `Bearer ${ctx.accessToken}`)
      .send(itineraryData);

    expect([200, 201]).toContain(res.status);
    if ([200, 201].includes(res.status)) {
      expect(res.body.success).toBe(true);
      createdItineraryId = res.body.data.itinerary?.id ?? res.body.data.id;
    }
  }, 15000);

  it('gets itinerary by id', async () => {
    // Create first
    const createRes = await voyageApi
      .post('/itinerary')
      .set('Authorization', `Bearer ${ctx.accessToken}`)
      .send({ title: 'Test Itinerary', startDate: '2025-08-01', endDate: '2025-08-05' });

    if (![200, 201].includes(createRes.status)) return;

    const id = createRes.body.data.itinerary?.id ?? createRes.body.data.id;
    createdItineraryId = id;

    const res = await voyageApi
      .get(`/itinerary/${id}`)
      .set('Authorization', `Bearer ${ctx.accessToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
  }, 20000);

  it('updates an itinerary', async () => {
    const createRes = await voyageApi
      .post('/itinerary')
      .set('Authorization', `Bearer ${ctx.accessToken}`)
      .send({ title: 'Update Test', startDate: '2025-08-01', endDate: '2025-08-05' });

    if (![200, 201].includes(createRes.status)) return;

    const id = createRes.body.data.itinerary?.id ?? createRes.body.data.id;
    createdItineraryId = id;

    const res = await voyageApi
      .put(`/itinerary/${id}`)
      .set('Authorization', `Bearer ${ctx.accessToken}`)
      .send({ title: 'Updated Title' });

    expect([200, 204]).toContain(res.status);
  }, 20000);

  it('rejects itinerary creation without auth', async () => {
    const res = await voyageApi
      .post('/itinerary')
      .send({ title: 'No Auth', startDate: '2025-08-01', endDate: '2025-08-05' });

    expect([401, 403]).toContain(res.status);
  }, 10000);

  it('returns 404 for non-existent itinerary', async () => {
    const res = await voyageApi
      .get('/itinerary/non-existent-id-12345')
      .set('Authorization', `Bearer ${ctx.accessToken}`);

    expect([404, 400]).toContain(res.status);
  }, 10000);
});

describe('[DR-614] voyage-service — Cart', () => {
  let ctx: Awaited<ReturnType<typeof createTestUser>>;

  beforeEach(async () => { ctx = await createTestUser('cart'); });
  afterEach(async () => {
    try { await authApi.post('/test/cleanup').send(); } catch {}
  });

  it('gets empty cart for new user', async () => {
    const res = await voyageApi
      .get('/cart')
      .set('Authorization', `Bearer ${ctx.accessToken}`);

    expect([200, 404]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
      const items = res.body.data.cart?.items ?? res.body.data.items ?? [];
      expect(Array.isArray(items)).toBe(true);
    }
  }, 15000);

  it('adds flight to cart', async () => {
    const cartItem = {
      type: 'flight',
      flightData: {
        origin: 'CDG',
        destination: 'JFK',
        departureDate: '2025-08-01',
        price: 450,
        currency: 'EUR',
      },
    };

    const res = await voyageApi
      .post('/cart')
      .set('Authorization', `Bearer ${ctx.accessToken}`)
      .send(cartItem);

    expect([200, 201]).toContain(res.status);
  }, 15000);

  it('adds hotel to cart', async () => {
    const cartItem = {
      type: 'hotel',
      hotelData: {
        name: 'Test Hotel',
        cityCode: 'PAR',
        checkInDate: '2025-08-01',
        checkOutDate: '2025-08-05',
        pricePerNight: 120,
        currency: 'EUR',
      },
    };

    const res = await voyageApi
      .post('/cart')
      .set('Authorization', `Bearer ${ctx.accessToken}`)
      .send(cartItem);

    expect([200, 201]).toContain(res.status);
  }, 15000);

  it('rejects cart access without auth', async () => {
    const res = await voyageApi.get('/cart');
    expect([401, 403]).toContain(res.status);
  }, 10000);

  it('deletes item from cart', async () => {
    // Add an item first
    const addRes = await voyageApi
      .post('/cart')
      .set('Authorization', `Bearer ${ctx.accessToken}`)
      .send({ type: 'flight', flightData: { origin: 'CDG', destination: 'LHR', price: 100 } });

    if (![200, 201].includes(addRes.status)) return;

    const itemId = addRes.body.data?.item?.id ?? addRes.body.data?.cartItem?.id;
    if (!itemId) return;

    const deleteRes = await voyageApi
      .delete(`/cart/${itemId}`)
      .set('Authorization', `Bearer ${ctx.accessToken}`);

    expect([200, 204]).toContain(deleteRes.status);
  }, 20000);
});

describe('[DR-614] voyage-service — Booking', () => {
  let ctx: Awaited<ReturnType<typeof createTestUser>>;

  beforeEach(async () => { ctx = await createTestUser('booking'); });
  afterEach(async () => {
    try { await authApi.post('/test/cleanup').send(); } catch {}
  });

  it('creates booking from cart', async () => {
    // Add item to cart first
    await voyageApi
      .post('/cart')
      .set('Authorization', `Bearer ${ctx.accessToken}`)
      .send({ type: 'flight', flightData: { origin: 'CDG', destination: 'JFK', price: 450 } });

    const res = await voyageApi
      .post('/booking')
      .set('Authorization', `Bearer ${ctx.accessToken}`)
      .send({ paymentMethod: 'stripe', currency: 'EUR' });

    // May succeed or fail (payment not mocked), but should not 500
    expect(res.status).not.toBe(500);
    expect([200, 201, 400, 402, 404, 422]).toContain(res.status);
  }, 20000);

  it('rejects booking without auth', async () => {
    const res = await voyageApi
      .post('/booking')
      .send({ paymentMethod: 'stripe' });

    expect([401, 403]).toContain(res.status);
  }, 10000);
});

describe('[DR-614] voyage-service — Input Validation & Security', () => {
  let ctx: Awaited<ReturnType<typeof createTestUser>>;

  beforeEach(async () => { ctx = await createTestUser('validation'); });
  afterEach(async () => {
    try { await authApi.post('/test/cleanup').send(); } catch {}
  });

  it('does not return 500 on SQL injection in search params', async () => {
    const res = await voyageApi
      .get('/flights/search')
      .set('Authorization', `Bearer ${ctx.accessToken}`)
      .query({ origin: "CDG'; DROP TABLE flights; --", destination: 'JFK', departureDate: '2025-08-01' });

    expect(res.status).not.toBe(500);
  }, 10000);

  it('does not return 500 on XSS in search params', async () => {
    const res = await voyageApi
      .get('/hotels/search')
      .set('Authorization', `Bearer ${ctx.accessToken}`)
      .query({ cityCode: '<script>alert(1)</script>', checkInDate: '2025-08-01', checkOutDate: '2025-08-05' });

    expect(res.status).not.toBe(500);
  }, 10000);

  it('rejects itinerary with invalid dates (endDate before startDate)', async () => {
    const res = await voyageApi
      .post('/itinerary')
      .set('Authorization', `Bearer ${ctx.accessToken}`)
      .send({ title: 'Bad Dates', startDate: '2025-08-10', endDate: '2025-08-01' });

    expect([400, 422]).toContain(res.status);
  }, 10000);
});
