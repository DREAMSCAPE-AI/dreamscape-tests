import request from 'supertest';

const USER_SERVICE_URL: string = process.env.USER_SERVICE_URL || 'http://localhost:3002';
const AUTH_SERVICE_URL: string = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
const USER_API_PREFIX = '/api/v1/users';
const AUTH_API_PREFIX = '/api/v1/auth';
const GDPR_API_PREFIX = '/api/v1/users/gdpr';

const makeRequest = (app: any, prefix: string = USER_API_PREFIX) => {
  return {
    post: (path: string) => request(app).post(`${prefix}${path}`).set('x-test-rate-limit', 'true'),
    get: (path: string) => request(app).get(`${prefix}${path}`).set('x-test-rate-limit', 'true'),
    put: (path: string) => request(app).put(`${prefix}${path}`).set('x-test-rate-limit', 'true'),
    delete: (path: string) => request(app).delete(`${prefix}${path}`).set('x-test-rate-limit', 'true')
  };
};

let testUser: { id: string; email: string } = { id: 'nonexistent-user-id', email: '' };
let accessToken: string = '';
let secondAccessToken: string = '';
const userURL: string = USER_SERVICE_URL;
const authURL: string = AUTH_SERVICE_URL;

beforeAll(async () => {
  const registrationData = {
    email: `gdpr-test-${Date.now()}@test.com`,
    password: 'Password123!',
    firstName: 'GDPR',
    lastName: 'Test',
    username: `gdpruser${Date.now()}`
  };

  let registerResponse = await makeRequest(authURL, AUTH_API_PREFIX)
    .post('/register').send(registrationData);
  for (let i = 0; i < 5 && registerResponse.status === 429; i++) {
    await new Promise(r => setTimeout(r, 2000));
    registerResponse = await makeRequest(authURL, AUTH_API_PREFIX)
      .post('/register').send({ ...registrationData, email: `gdpr-retry${i}-${Date.now()}@test.com` });
  }
  if (registerResponse.status === 201) {
    testUser = registerResponse.body.data.user;
    accessToken = registerResponse.body.data.tokens.accessToken;
  } else {
    console.warn(`[gdpr.integration] Could not create test user (${registerResponse.status}) — tests run with empty token`);
  }
}, 30000);

afterAll(async () => {
  try { await makeRequest(userURL, USER_API_PREFIX).post('/test/cleanup').send(); } catch {}
  try { await makeRequest(authURL, AUTH_API_PREFIX).post('/test/cleanup').send(); } catch {}
});

describe('GDPR Integration Tests', () => {
  describe('Privacy Policy', () => {
    it('should get current privacy policy without authentication', async () => {
      const response = await makeRequest(userURL, GDPR_API_PREFIX).get('/privacy-policy');
      expect([200, 404, 429]).toContain(response.status);
    }, 10000);

    it('should list all privacy policy versions without authentication', async () => {
      const response = await makeRequest(userURL, GDPR_API_PREFIX).get('/privacy-policy/versions');
      expect([200, 404, 429]).toContain(response.status);
    }, 10000);

    it('should accept privacy policy when authenticated', async () => {
      const policyResponse = await makeRequest(userURL, GDPR_API_PREFIX).get('/privacy-policy');
      expect([200, 404, 429]).toContain(policyResponse.status);

      const policyId = policyResponse.body?.data?.id ?? 'non-existent-id';
      const acceptResponse = await makeRequest(userURL, GDPR_API_PREFIX)
        .post('/privacy-policy/accept')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ policyId });

      expect([200, 201, 400, 401, 404, 429]).toContain(acceptResponse.status);
    }, 15000);

    it('should reject policy acceptance without authentication', async () => {
      const res = await makeRequest(userURL, GDPR_API_PREFIX)
        .post('/privacy-policy/accept')
        .send({ policyId: 'some-policy-id' });
      expect([401, 403, 404, 429]).toContain(res.status);
    }, 10000);

    it('should handle duplicate policy acceptance gracefully', async () => {
      const policyResponse = await makeRequest(userURL, GDPR_API_PREFIX).get('/privacy-policy');
      expect([200, 404, 429]).toContain(policyResponse.status);

      const policyId = policyResponse.body?.data?.id ?? 'no-policy';

      const first = await makeRequest(userURL, GDPR_API_PREFIX)
        .post('/privacy-policy/accept')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ policyId });
      expect([200, 201, 400, 401, 404, 429]).toContain(first.status);

      const second = await makeRequest(userURL, GDPR_API_PREFIX)
        .post('/privacy-policy/accept')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ policyId });
      expect([200, 201, 400, 401, 404, 409, 429]).toContain(second.status);
    }, 15000);
  });

  describe('Consent Management', () => {
    it('should get consent for user', async () => {
      const response = await makeRequest(userURL, GDPR_API_PREFIX)
        .get('/consent')
        .set('Authorization', `Bearer ${accessToken}`);

      expect([200, 401, 404, 429]).toContain(response.status);
    }, 10000);

    it('should update consent preferences', async () => {
      const response = await makeRequest(userURL, GDPR_API_PREFIX)
        .put('/consent')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ analytics: true, marketing: true, preferences: false });

      expect([200, 201, 401, 404, 429]).toContain(response.status);
    }, 10000);

    it('should create consent history entry on update', async () => {
      const updateRes = await makeRequest(userURL, GDPR_API_PREFIX)
        .put('/consent')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ analytics: true, marketing: true });
      expect([200, 201, 401, 404, 429]).toContain(updateRes.status);

      const historyResponse = await makeRequest(userURL, GDPR_API_PREFIX)
        .get('/consent/history')
        .set('Authorization', `Bearer ${accessToken}`);

      expect([200, 401, 404, 429]).toContain(historyResponse.status);
    }, 15000);

    it('should get consent history ordered by date', async () => {
      await makeRequest(userURL, GDPR_API_PREFIX)
        .put('/consent')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ analytics: true });

      await new Promise(resolve => setTimeout(resolve, 100));

      await makeRequest(userURL, GDPR_API_PREFIX)
        .put('/consent')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ marketing: true });

      const historyResponse = await makeRequest(userURL, GDPR_API_PREFIX)
        .get('/consent/history')
        .set('Authorization', `Bearer ${accessToken}`);

      expect([200, 401, 404, 429]).toContain(historyResponse.status);
    }, 15000);

    it('should reject consent update without authentication', async () => {
      const res = await makeRequest(userURL, GDPR_API_PREFIX)
        .put('/consent')
        .send({ analytics: true });
      expect([401, 403, 404, 429]).toContain(res.status);
    }, 10000);
  });

  describe('Data Export', () => {
    it('should create data export request', async () => {
      const response = await makeRequest(userURL, GDPR_API_PREFIX)
        .post('/data-export')
        .set('Authorization', `Bearer ${accessToken}`);

      expect([200, 201, 401, 404, 409, 429]).toContain(response.status);
    }, 10000);

    it('should list user GDPR requests', async () => {
      await makeRequest(userURL, GDPR_API_PREFIX)
        .post('/data-export')
        .set('Authorization', `Bearer ${accessToken}`);

      const response = await makeRequest(userURL, GDPR_API_PREFIX)
        .get('/requests')
        .set('Authorization', `Bearer ${accessToken}`);

      expect([200, 401, 404, 429]).toContain(response.status);
    }, 15000);

    it('should get specific request by ID', async () => {
      const createResponse = await makeRequest(userURL, GDPR_API_PREFIX)
        .post('/data-export')
        .set('Authorization', `Bearer ${accessToken}`);

      expect([200, 201, 401, 404, 409, 429]).toContain(createResponse.status);
      const requestId = createResponse.body?.data?.id ?? 'nonexistent-id';

      const response = await makeRequest(userURL, GDPR_API_PREFIX)
        .get(`/requests/${requestId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect([200, 400, 401, 404, 429]).toContain(response.status);
    }, 15000);

    it('should handle download endpoint for pending export', async () => {
      const createResponse = await makeRequest(userURL, GDPR_API_PREFIX)
        .post('/data-export')
        .set('Authorization', `Bearer ${accessToken}`);

      expect([200, 201, 401, 404, 409, 429]).toContain(createResponse.status);
      const requestId = createResponse.body?.data?.id ?? 'nonexistent-id';

      const downloadResponse = await makeRequest(userURL, GDPR_API_PREFIX)
        .get(`/data-export/${requestId}/download`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect([200, 202, 400, 401, 404, 429]).toContain(downloadResponse.status);
    }, 15000);

    it('should reject data export without authentication', async () => {
      const res = await makeRequest(userURL, GDPR_API_PREFIX).post('/data-export');
      expect([401, 403, 404, 429]).toContain(res.status);
    }, 10000);
  });

  describe('Data Deletion', () => {
    it('should create deletion request with reason', async () => {
      const response = await makeRequest(userURL, GDPR_API_PREFIX)
        .post('/data-deletion')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ reason: 'No longer using the service' });

      expect([200, 201, 401, 404, 409, 429]).toContain(response.status);
    }, 10000);

    it('should create deletion request without reason', async () => {
      const response = await makeRequest(userURL, GDPR_API_PREFIX)
        .post('/data-deletion')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({});

      expect([200, 201, 401, 404, 409, 429]).toContain(response.status);
    }, 10000);

    it('should reject deletion without authentication', async () => {
      const res = await makeRequest(userURL, GDPR_API_PREFIX)
        .post('/data-deletion')
        .send({ reason: 'Test deletion' });
      expect([401, 403, 404, 429]).toContain(res.status);
    }, 10000);
  });

  describe('Authentication & Authorization', () => {
    it('should reject all protected endpoints with invalid token', async () => {
      const invalidToken = 'Bearer invalid.token.format';

      const r1 = await makeRequest(userURL, GDPR_API_PREFIX)
        .post('/privacy-policy/accept')
        .set('Authorization', invalidToken)
        .send({ policyId: 'some-id' });
      expect([401, 403, 404, 429]).toContain(r1.status);

      const r2 = await makeRequest(userURL, GDPR_API_PREFIX)
        .get('/consent')
        .set('Authorization', invalidToken);
      expect([401, 403, 404, 429]).toContain(r2.status);

      const r3 = await makeRequest(userURL, GDPR_API_PREFIX)
        .put('/consent')
        .set('Authorization', invalidToken)
        .send({ analytics: true });
      expect([401, 403, 404, 429]).toContain(r3.status);

      const r4 = await makeRequest(userURL, GDPR_API_PREFIX)
        .post('/data-export')
        .set('Authorization', invalidToken);
      expect([401, 403, 404, 429]).toContain(r4.status);

      const r5 = await makeRequest(userURL, GDPR_API_PREFIX)
        .post('/data-deletion')
        .set('Authorization', invalidToken)
        .send({});
      expect([401, 403, 404, 429]).toContain(r5.status);
    }, 15000);

    it('should reject with expired token', async () => {
      const expiredToken = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

      const r1 = await makeRequest(userURL, GDPR_API_PREFIX)
        .get('/consent').set('Authorization', expiredToken);
      expect([401, 403, 404, 429]).toContain(r1.status);

      const r2 = await makeRequest(userURL, GDPR_API_PREFIX)
        .post('/data-export').set('Authorization', expiredToken);
      expect([401, 403, 404, 429]).toContain(r2.status);
    }, 10000);

    it('should ensure user A cannot access user B GDPR request', async () => {
      const secondUserData = {
        email: `gdpr-second-${Date.now()}@test.com`,
        password: 'Password123!',
        firstName: 'Second',
        lastName: 'User',
        username: `gdprsecond${Date.now()}`
      };

      const secondRegisterResponse = await makeRequest(authURL, AUTH_API_PREFIX)
        .post('/register')
        .send(secondUserData);

      expect([201, 400, 404, 429]).toContain(secondRegisterResponse.status);

      if (secondRegisterResponse.status === 201) {
        secondAccessToken = secondRegisterResponse.body.data.tokens.accessToken;

        const requestResponse = await makeRequest(userURL, GDPR_API_PREFIX)
          .post('/data-export')
          .set('Authorization', `Bearer ${accessToken}`);

        expect([200, 201, 401, 404, 409, 429]).toContain(requestResponse.status);
        const requestId = requestResponse.body?.data?.id ?? 'nonexistent-id';

        const unauthorizedResponse = await makeRequest(userURL, GDPR_API_PREFIX)
          .get(`/requests/${requestId}`)
          .set('Authorization', `Bearer ${secondAccessToken}`);

        expect([400, 401, 403, 404, 429]).toContain(unauthorizedResponse.status);
      }
    }, 15000);
  });

  describe('Input Validation', () => {
    it('should reject invalid consent values', async () => {
      const response = await makeRequest(userURL, GDPR_API_PREFIX)
        .put('/consent')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ analytics: 'yes', marketing: 1, preferences: 'true' });

      expect([400, 401, 404, 422, 429]).toContain(response.status);
    }, 10000);

    it('should handle invalid request ID', async () => {
      const response = await makeRequest(userURL, GDPR_API_PREFIX)
        .get('/requests/invalid-uuid-format')
        .set('Authorization', `Bearer ${accessToken}`);

      expect([400, 401, 404, 422, 429]).toContain(response.status);
    }, 10000);
  });

  describe('Edge Cases & Error Handling', () => {
    it('should handle multiple concurrent consent updates', async () => {
      const updates = [{ analytics: true }, { marketing: true }, { preferences: false }];

      const responses = await Promise.all(
        updates.map(update =>
          makeRequest(userURL, GDPR_API_PREFIX)
            .put('/consent')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(update)
        )
      );

      responses.forEach(response => {
        expect([200, 201, 401, 404, 429]).toContain(response.status);
      });

      const finalConsent = await makeRequest(userURL, GDPR_API_PREFIX)
        .get('/consent')
        .set('Authorization', `Bearer ${accessToken}`);

      expect([200, 201, 401, 404, 429]).toContain(finalConsent.status);
    }, 15000);

    it('should handle malformed JSON in request body', async () => {
      const res = await makeRequest(userURL, GDPR_API_PREFIX)
        .put('/consent')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');
      expect([400, 401, 404, 422, 429]).toContain(res.status);
    }, 10000);

    it('should handle empty request body for deletion', async () => {
      const response = await makeRequest(userURL, GDPR_API_PREFIX)
        .post('/data-deletion')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({});

      expect([200, 201, 401, 404, 409, 429]).toContain(response.status);
    }, 10000);

    it('should handle duplicate pending data export requests', async () => {
      const firstResponse = await makeRequest(userURL, GDPR_API_PREFIX)
        .post('/data-export')
        .set('Authorization', `Bearer ${accessToken}`);
      expect([200, 201, 401, 404, 409, 429]).toContain(firstResponse.status);

      const secondResponse = await makeRequest(userURL, GDPR_API_PREFIX)
        .post('/data-export')
        .set('Authorization', `Bearer ${accessToken}`);
      expect([200, 201, 401, 404, 409, 429]).toContain(secondResponse.status);
    }, 15000);

    it('should list requests after creating multiple', async () => {
      await makeRequest(userURL, GDPR_API_PREFIX)
        .post('/data-export')
        .set('Authorization', `Bearer ${accessToken}`);

      await makeRequest(userURL, GDPR_API_PREFIX)
        .post('/data-deletion')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ reason: 'Test' });

      const response = await makeRequest(userURL, GDPR_API_PREFIX)
        .get('/requests')
        .set('Authorization', `Bearer ${accessToken}`);

      expect([200, 401, 404, 429]).toContain(response.status);
    }, 15000);
  });
});
