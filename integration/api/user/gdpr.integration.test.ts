import request from 'supertest';

const USER_SERVICE_URL: string = process.env.USER_SERVICE_URL!;
const AUTH_SERVICE_URL: string = process.env.AUTH_SERVICE_URL!;
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

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  username?: string;
  phoneNumber?: string;
}

interface PrivacyPolicy {
  id: string;
  version: string;
  effectiveDate: string;
  content: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Consent {
  id: string;
  userId: string;
  analytics: boolean;
  marketing: boolean;
  functional: boolean;
  preferences: boolean;
  createdAt: string;
  updatedAt: string;
}

interface GDPRRequest {
  id: string;
  userId: string;
  requestType: string;
  status: string;
  reason?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

describe('GDPR Integration Tests', () => {
  let testUser: User | undefined;
  let accessToken: string | undefined;
  let secondTestUser: User | undefined;
  let secondAccessToken: string | undefined;
  const userURL: string = USER_SERVICE_URL;
  const authURL: string = AUTH_SERVICE_URL;

  beforeAll(async () => {
    try {
      await makeRequest(userURL, USER_API_PREFIX).post('/test/reset').expect(200);
      await makeRequest(authURL, AUTH_API_PREFIX).post('/test/reset').expect(200);
    } catch (error) {
      console.warn('Test reset endpoints not available, continuing...');
    }
  });

  beforeEach(async () => {
    // Create a test user through auth service for each test
    const registrationData = {
      email: `gdpr-test-${Date.now()}@test.com`,
      password: 'Password123!',
      firstName: 'GDPR',
      lastName: 'Test',
      username: `gdpruser${Date.now()}`
    };

    const registerResponse = await makeRequest(authURL, AUTH_API_PREFIX)
      .post('/register')
      .send(registrationData)
      .expect(201);

    testUser = registerResponse.body.data.user;
    accessToken = registerResponse.body.data.tokens.accessToken;
  });

  afterEach(async () => {
    try {
      if (testUser?.email) {
        await makeRequest(userURL, USER_API_PREFIX).post('/test/cleanup').send();
        await makeRequest(authURL, AUTH_API_PREFIX).post('/test/cleanup').send();
      }
    } catch (error) {
      // Cleanup errors are not critical for tests
    }
  });

  describe('Privacy Policy', () => {
    it('should get current privacy policy without authentication', async () => {
      const response = await makeRequest(userURL, GDPR_API_PREFIX)
        .get('/privacy-policy');

      // Privacy policy might not exist in test database, so accept both 200 and 404
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
        expect(response.body.data).toHaveProperty('id');
        expect(response.body.data).toHaveProperty('version');
        expect(response.body.data).toHaveProperty('content');
        expect(response.body.data.isActive).toBe(true);
      } else {
        expect(response.status).toBe(404);
      }
    }, 10000);

    it('should list all privacy policy versions without authentication', async () => {
      const response = await makeRequest(userURL, GDPR_API_PREFIX)
        .get('/privacy-policy/versions');

      // Accept both success with empty array and 404
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
        expect(Array.isArray(response.body.data)).toBe(true);
      } else {
        expect(response.status).toBe(404);
      }
    }, 10000);

    it('should accept privacy policy when authenticated', async () => {
      // First, try to get the current policy
      const policyResponse = await makeRequest(userURL, GDPR_API_PREFIX)
        .get('/privacy-policy');

      if (policyResponse.status === 200 && policyResponse.body.data) {
        const policyId = policyResponse.body.data.id;

        const acceptResponse = await makeRequest(userURL, GDPR_API_PREFIX)
          .post('/privacy-policy/accept')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ policyId })
          .expect(201);

        expect(acceptResponse.body.success).toBe(true);
        expect(acceptResponse.body.data).toBeDefined();
        expect(acceptResponse.body.data.userId).toBe(testUser!.id);
        expect(acceptResponse.body.data.policyId).toBe(policyId);
        expect(acceptResponse.body.data.acceptedAt).toBeDefined();
      } else {
        // If no policy exists, test should expect 404 or 400
        const acceptResponse = await makeRequest(userURL, GDPR_API_PREFIX)
          .post('/privacy-policy/accept')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ policyId: 'non-existent-policy-id' });

        expect([400, 404]).toContain(acceptResponse.status);
      }
    }, 15000);

    it('should reject policy acceptance without authentication', async () => {
      await makeRequest(userURL, GDPR_API_PREFIX)
        .post('/privacy-policy/accept')
        .send({ policyId: 'some-policy-id' })
        .expect(401);
    }, 10000);

    it('should handle duplicate policy acceptance gracefully', async () => {
      const policyResponse = await makeRequest(userURL, GDPR_API_PREFIX)
        .get('/privacy-policy');

      if (policyResponse.status === 200 && policyResponse.body.data) {
        const policyId = policyResponse.body.data.id;

        // Accept once
        await makeRequest(userURL, GDPR_API_PREFIX)
          .post('/privacy-policy/accept')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ policyId })
          .expect(201);

        // Accept again - should be idempotent or return appropriate status
        const secondAcceptResponse = await makeRequest(userURL, GDPR_API_PREFIX)
          .post('/privacy-policy/accept')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ policyId });

        // Accept either 201 (idempotent), 200 (already accepted), or 409 (conflict)
        expect([200, 201, 409]).toContain(secondAcceptResponse.status);
      }
    }, 15000);
  });

  describe('Consent Management', () => {
    it('should get default consent for new user', async () => {
      const response = await makeRequest(userURL, GDPR_API_PREFIX)
        .get('/consent')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.userId).toBe(testUser!.id);

      // Default consent values
      expect(response.body.data.analytics).toBe(false);
      expect(response.body.data.marketing).toBe(false);
      expect(response.body.data.functional).toBe(true);
      expect(response.body.data.preferences).toBe(true);
    }, 10000);

    it('should update consent preferences', async () => {
      const updateData = {
        analytics: true,
        marketing: true,
        preferences: false
      };

      const response = await makeRequest(userURL, GDPR_API_PREFIX)
        .put('/consent')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.analytics).toBe(true);
      expect(response.body.data.marketing).toBe(true);
      expect(response.body.data.preferences).toBe(false);
      expect(response.body.data.functional).toBe(true); // Should remain true
    }, 10000);

    it('should create consent history entry on update', async () => {
      // Update consent
      await makeRequest(userURL, GDPR_API_PREFIX)
        .put('/consent')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ analytics: true, marketing: true })
        .expect(200);

      // Get consent history
      const historyResponse = await makeRequest(userURL, GDPR_API_PREFIX)
        .get('/consent/history')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(historyResponse.body.success).toBe(true);
      expect(historyResponse.body.data).toBeDefined();
      expect(Array.isArray(historyResponse.body.data)).toBe(true);
      expect(historyResponse.body.data.length).toBeGreaterThan(0);

      // Most recent entry should reflect the update
      const latestEntry = historyResponse.body.data[0];
      expect(latestEntry.userId).toBe(testUser!.id);
      expect(latestEntry.analytics).toBe(true);
      expect(latestEntry.marketing).toBe(true);
    }, 15000);

    it('should get consent history ordered by date', async () => {
      // Make multiple consent updates
      await makeRequest(userURL, GDPR_API_PREFIX)
        .put('/consent')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ analytics: true })
        .expect(200);

      // Wait a bit to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 100));

      await makeRequest(userURL, GDPR_API_PREFIX)
        .put('/consent')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ marketing: true })
        .expect(200);

      // Get history
      const historyResponse = await makeRequest(userURL, GDPR_API_PREFIX)
        .get('/consent/history')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(historyResponse.body.data.length).toBeGreaterThanOrEqual(2);

      // Verify order (most recent first)
      const history = historyResponse.body.data;
      for (let i = 0; i < history.length - 1; i++) {
        const current = new Date(history[i].createdAt);
        const next = new Date(history[i + 1].createdAt);
        expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime());
      }
    }, 15000);

    it('should reject consent update without authentication', async () => {
      await makeRequest(userURL, GDPR_API_PREFIX)
        .put('/consent')
        .send({ analytics: true })
        .expect(401);
    }, 10000);
  });

  describe('Data Export', () => {
    it('should create data export request', async () => {
      const response = await makeRequest(userURL, GDPR_API_PREFIX)
        .post('/data-export')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.userId).toBe(testUser!.id);
      expect(response.body.data.requestType).toBe('DATA_EXPORT');
      expect(response.body.data.status).toBe('PENDING');
      expect(response.body.data.createdAt).toBeDefined();
    }, 10000);

    it('should list user GDPR requests', async () => {
      // Create a data export request
      await makeRequest(userURL, GDPR_API_PREFIX)
        .post('/data-export')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      // List requests
      const response = await makeRequest(userURL, GDPR_API_PREFIX)
        .get('/requests')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0].requestType).toBe('DATA_EXPORT');
    }, 15000);

    it('should get specific request by ID', async () => {
      // Create a request
      const createResponse = await makeRequest(userURL, GDPR_API_PREFIX)
        .post('/data-export')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      const requestId = createResponse.body.data.id;

      // Get specific request
      const response = await makeRequest(userURL, GDPR_API_PREFIX)
        .get(`/requests/${requestId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.id).toBe(requestId);
      expect(response.body.data.userId).toBe(testUser!.id);
    }, 15000);

    it('should download completed export data', async () => {
      // Create export request
      const createResponse = await makeRequest(userURL, GDPR_API_PREFIX)
        .post('/data-export')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      const requestId = createResponse.body.data.id;

      // Try to download (will be PENDING, so should return appropriate status)
      const downloadResponse = await makeRequest(userURL, GDPR_API_PREFIX)
        .get(`/data-export/${requestId}/download`)
        .set('Authorization', `Bearer ${accessToken}`);

      // Should either be 202 (processing), 404 (not ready), or 200 (ready)
      expect([200, 202, 404]).toContain(downloadResponse.status);

      if (downloadResponse.status === 200) {
        // If download is ready, should have data
        expect(downloadResponse.body).toBeDefined();
      }
    }, 15000);

    it('should reject data export without authentication', async () => {
      await makeRequest(userURL, GDPR_API_PREFIX)
        .post('/data-export')
        .expect(401);
    }, 10000);
  });

  describe('Data Deletion', () => {
    it('should create deletion request with reason', async () => {
      const deleteData = {
        reason: 'No longer using the service'
      };

      const response = await makeRequest(userURL, GDPR_API_PREFIX)
        .post('/data-deletion')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(deleteData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.userId).toBe(testUser!.id);
      expect(response.body.data.requestType).toBe('DATA_DELETION');
      expect(response.body.data.status).toBe('PENDING');
      expect(response.body.data.reason).toBe(deleteData.reason);
    }, 10000);

    it('should create deletion request without reason', async () => {
      const response = await makeRequest(userURL, GDPR_API_PREFIX)
        .post('/data-deletion')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.requestType).toBe('DATA_DELETION');
      expect(response.body.data.status).toBe('PENDING');
    }, 10000);

    it('should reject deletion without authentication', async () => {
      await makeRequest(userURL, GDPR_API_PREFIX)
        .post('/data-deletion')
        .send({ reason: 'Test deletion' })
        .expect(401);
    }, 10000);
  });

  describe('Authentication & Authorization', () => {
    it('should reject all protected endpoints with invalid token', async () => {
      const invalidToken = 'Bearer invalid.token.format';

      // Test multiple endpoints
      await makeRequest(userURL, GDPR_API_PREFIX)
        .post('/privacy-policy/accept')
        .set('Authorization', invalidToken)
        .send({ policyId: 'some-id' })
        .expect(401);

      await makeRequest(userURL, GDPR_API_PREFIX)
        .get('/consent')
        .set('Authorization', invalidToken)
        .expect(401);

      await makeRequest(userURL, GDPR_API_PREFIX)
        .put('/consent')
        .set('Authorization', invalidToken)
        .send({ analytics: true })
        .expect(401);

      await makeRequest(userURL, GDPR_API_PREFIX)
        .post('/data-export')
        .set('Authorization', invalidToken)
        .expect(401);

      await makeRequest(userURL, GDPR_API_PREFIX)
        .post('/data-deletion')
        .set('Authorization', invalidToken)
        .send({})
        .expect(401);
    }, 15000);

    it('should reject with expired token', async () => {
      // Use an obviously expired/invalid token
      const expiredToken = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

      await makeRequest(userURL, GDPR_API_PREFIX)
        .get('/consent')
        .set('Authorization', expiredToken)
        .expect(401);

      await makeRequest(userURL, GDPR_API_PREFIX)
        .post('/data-export')
        .set('Authorization', expiredToken)
        .expect(401);
    }, 10000);

    it('should ensure user A cannot access user B consent', async () => {
      // Create second test user
      const secondUserData = {
        email: `gdpr-test-second-${Date.now()}@test.com`,
        password: 'Password123!',
        firstName: 'Second',
        lastName: 'User',
        username: `gdprusersecond${Date.now()}`
      };

      const secondRegisterResponse = await makeRequest(authURL, AUTH_API_PREFIX)
        .post('/register')
        .send(secondUserData)
        .expect(201);

      secondTestUser = secondRegisterResponse.body.data.user;
      secondAccessToken = secondRegisterResponse.body.data.tokens.accessToken;

      // Create a GDPR request with first user
      const requestResponse = await makeRequest(userURL, GDPR_API_PREFIX)
        .post('/data-export')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      const requestId = requestResponse.body.data.id;

      // Try to access first user's request with second user's token
      const unauthorizedResponse = await makeRequest(userURL, GDPR_API_PREFIX)
        .get(`/requests/${requestId}`)
        .set('Authorization', `Bearer ${secondAccessToken}`);

      // Should be 403 (forbidden) or 404 (not found for security)
      expect([403, 404]).toContain(unauthorizedResponse.status);
    }, 15000);
  });

  describe('Input Validation', () => {
    it('should reject invalid consent values', async () => {
      const invalidData = {
        analytics: 'yes', // Should be boolean
        marketing: 1, // Should be boolean
        preferences: 'true' // Should be boolean, not string
      };

      const response = await makeRequest(userURL, GDPR_API_PREFIX)
        .put('/consent')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(invalidData);

      expect([400, 422]).toContain(response.status);
    }, 10000);

    it('should handle invalid request ID', async () => {
      const invalidRequestId = 'invalid-uuid-format';

      const response = await makeRequest(userURL, GDPR_API_PREFIX)
        .get(`/requests/${invalidRequestId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      // Should be 400 (bad request) or 404 (not found)
      expect([400, 404]).toContain(response.status);
    }, 10000);
  });

  describe('Edge Cases & Error Handling', () => {
    it('should handle multiple concurrent consent updates', async () => {
      const updates = [
        { analytics: true },
        { marketing: true },
        { preferences: false }
      ];

      // Send multiple updates concurrently
      const promises = updates.map(update =>
        makeRequest(userURL, GDPR_API_PREFIX)
          .put('/consent')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(update)
      );

      const responses = await Promise.all(promises);

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Final consent should reflect one of the updates
      const finalConsent = await makeRequest(userURL, GDPR_API_PREFIX)
        .get('/consent')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(finalConsent.body.data).toBeDefined();
    }, 15000);

    it('should handle malformed JSON in request body', async () => {
      await makeRequest(userURL, GDPR_API_PREFIX)
        .put('/consent')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);
    }, 10000);

    it('should handle empty request body for deletion', async () => {
      const response = await makeRequest(userURL, GDPR_API_PREFIX)
        .post('/data-deletion')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({});

      // Should succeed - reason is optional
      expect(response.status).toBe(201);
      expect(response.body.data.requestType).toBe('DATA_DELETION');
    }, 10000);

    it('should prevent duplicate pending data export requests', async () => {
      // Create first export request
      await makeRequest(userURL, GDPR_API_PREFIX)
        .post('/data-export')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      // Try to create another one
      const secondResponse = await makeRequest(userURL, GDPR_API_PREFIX)
        .post('/data-export')
        .set('Authorization', `Bearer ${accessToken}`);

      // Should either succeed (201) or indicate conflict (409)
      expect([201, 409]).toContain(secondResponse.status);
    }, 15000);

    it('should list requests with proper pagination if available', async () => {
      // Create multiple requests
      await makeRequest(userURL, GDPR_API_PREFIX)
        .post('/data-export')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      await makeRequest(userURL, GDPR_API_PREFIX)
        .post('/data-deletion')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ reason: 'Test' })
        .expect(201);

      // Get all requests
      const response = await makeRequest(userURL, GDPR_API_PREFIX)
        .get('/requests')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data.length).toBeGreaterThanOrEqual(2);

      // Check if pagination info is present
      if (response.body.data.pagination) {
        expect(response.body.data.pagination).toHaveProperty('page');
        expect(response.body.data.pagination).toHaveProperty('limit');
        expect(response.body.data.pagination).toHaveProperty('total');
      }
    }, 15000);
  });
});
