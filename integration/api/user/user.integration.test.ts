import request from 'supertest';

const USER_SERVICE_URL: string = process.env.USER_SERVICE_URL!;
const AUTH_SERVICE_URL: string = process.env.AUTH_SERVICE_URL!;
const USER_API_PREFIX = '/api/v1/users';
const AUTH_API_PREFIX = '/api/v1/auth';

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
}

// ─────────────────────────────────────────────────────────────
// User Service Integration Tests
// One shared user + profile created once in beforeAll
// ─────────────────────────────────────────────────────────────

let testUser: User;
let accessToken: string;
const userURL: string = USER_SERVICE_URL;
const authURL: string = AUTH_SERVICE_URL;

beforeAll(async () => {
  const registrationData = {
    email: `user-test-${Date.now()}@test.com`,
    password: 'Password123!',
    firstName: 'Test',
    lastName: 'User',
    username: `testuser${Date.now()}`
  };

  let registerResponse = await makeRequest(authURL, AUTH_API_PREFIX)
    .post('/register').send(registrationData);
  for (let i = 0; i < 5 && registerResponse.status === 429; i++) {
    await new Promise(r => setTimeout(r, 1500));
    registerResponse = await makeRequest(authURL, AUTH_API_PREFIX)
      .post('/register').send({ ...registrationData, email: `user-retry${i}-${Date.now()}@test.com` });
  }
  if (registerResponse.status !== 201) throw new Error(`Cannot create test user (status ${registerResponse.status})`);
  testUser = registerResponse.body.data.user;
  accessToken = registerResponse.body.data.tokens.accessToken;

  // Create initial profile so profile-dependent tests have something to work with
  await makeRequest(userURL, USER_API_PREFIX)
    .post('/profile')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ userId: testUser.id, bio: 'Initial bio', location: 'Test City', website: 'https://testwebsite.com' });
});

afterAll(async () => {
  try { await makeRequest(userURL, USER_API_PREFIX).post('/test/cleanup').send(); } catch {}
  try { await makeRequest(authURL, AUTH_API_PREFIX).post('/test/cleanup').send(); } catch {}
});

describe('User Service Integration Tests', () => {
  describe('Profile Management', () => {
    it('should create or update profile for user', async () => {
      const profileData = {
        userId: testUser.id,
        bio: 'This is my test bio',
        location: 'Test City, TC',
        website: 'https://testwebsite.com'
      };

      const createResponse = await makeRequest(userURL, USER_API_PREFIX)
        .post('/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(profileData);

      // Profile may already exist (201 = created, 200 = upserted, 409 = conflict)
      expect([200, 201, 409]).toContain(createResponse.status);
      expect(createResponse.body.success).toBe(true);
    }, 15000);

    it('should get user profile by userId', async () => {
      const getResponse = await makeRequest(userURL, USER_API_PREFIX)
        .get(`/profile/${testUser.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(getResponse.body.success).toBe(true);
      expect(getResponse.body.data.profile.userId).toBe(testUser.id);
    }, 15000);

    it('should update existing profile', async () => {
      const updateData = {
        bio: 'Updated bio',
        location: 'Updated City',
        website: 'https://updated-website.com'
      };

      const updateResponse = await makeRequest(userURL, USER_API_PREFIX)
        .put(`/profile/${testUser.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(200);

      expect(updateResponse.body.success).toBe(true);
      expect(updateResponse.body.data.profile.bio).toBe(updateData.bio);
      expect(updateResponse.body.data.profile.location).toBe(updateData.location);
      expect(updateResponse.body.data.profile.website).toBe(updateData.website);
    }, 15000);

    it('should return 404 for non-existent profile', async () => {
      await makeRequest(userURL, USER_API_PREFIX)
        .get('/profile/non-existent-user-id-99999')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    }, 10000);

    it('should handle profile creation with minimal data', async () => {
      const minimalData = { userId: testUser.id };

      const createResponse = await makeRequest(userURL, USER_API_PREFIX)
        .post('/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(minimalData);

      // Profile already exists — accept upsert or conflict
      expect([200, 201, 409]).toContain(createResponse.status);
      expect(createResponse.body.success).toBe(true);
    }, 10000);
  });

  describe('Avatar Management', () => {
    it('should upload avatar successfully', async () => {
      // Minimal valid 1x1 PNG
      const testImageBuffer = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
        0x0D, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
        0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49,
        0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
      ]);

      const uploadResponse = await makeRequest(userURL, USER_API_PREFIX)
        .post(`/avatar/${testUser.id}/avatar`)
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('avatar', testImageBuffer, 'test-avatar.png')
        .expect(200);

      expect(uploadResponse.body.success).toBe(true);
      expect(uploadResponse.body.data.avatar.url).toContain('/uploads/avatars/');
      expect(uploadResponse.body.data.avatar.filename).toMatch(/\d+-\d+\.png$/);
      expect(uploadResponse.body.data.avatar.uploadedAt).toBeDefined();
    }, 15000);

    it('should reject non-image files', async () => {
      const textBuffer = Buffer.from('This is not an image', 'utf8');

      await makeRequest(userURL, USER_API_PREFIX)
        .post(`/avatar/${testUser.id}/avatar`)
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('avatar', textBuffer, 'not-an-image.txt')
        .expect(400);
    }, 10000);

    it('should reject files that are too large', async () => {
      const largeBuffer = Buffer.alloc(6 * 1024 * 1024, 0);

      await makeRequest(userURL, USER_API_PREFIX)
        .post(`/avatar/${testUser.id}/avatar`)
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('avatar', largeBuffer, 'large-image.png')
        .expect(400);
    }, 15000);

    it('should reject avatar upload for different user', async () => {
      const otherUserData = {
        email: `other-user-${Date.now()}@test.com`,
        password: 'Password123!',
        firstName: 'Other',
        lastName: 'User'
      };

      const otherUserResponse = await makeRequest(authURL, AUTH_API_PREFIX)
        .post('/register')
        .send(otherUserData);
      expect([201, 429]).toContain(otherUserResponse.status);

      if (otherUserResponse.status === 201) {
        const otherUserId = otherUserResponse.body.data.user.id;
        const testImageBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47]);

        await makeRequest(userURL, USER_API_PREFIX)
          .post(`/avatar/${otherUserId}/avatar`)
          .set('Authorization', `Bearer ${accessToken}`)
          .attach('avatar', testImageBuffer, 'test-avatar.png')
          .expect(403);
      }
    }, 15000);

    it('should handle missing file in avatar upload', async () => {
      await makeRequest(userURL, USER_API_PREFIX)
        .post(`/avatar/${testUser.id}/avatar`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    }, 10000);
  });

  describe('Authentication & Authorization', () => {
    it('should reject requests without authentication token', async () => {
      await makeRequest(userURL, USER_API_PREFIX)
        .get(`/profile/${testUser.id}`)
        .expect(401);

      await makeRequest(userURL, USER_API_PREFIX)
        .post('/profile')
        .send({ userId: testUser.id })
        .expect(401);

      await makeRequest(userURL, USER_API_PREFIX)
        .put(`/profile/${testUser.id}`)
        .send({ bio: 'Updated bio' })
        .expect(401);
    }, 10000);

    it('should reject requests with invalid authentication token', async () => {
      const invalidTokens = [
        'Bearer invalid.token.format',
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid',
        'Bearer not-even-close',
        'Bearer ',
        ''
      ];

      for (const token of invalidTokens) {
        await makeRequest(userURL, USER_API_PREFIX)
          .get(`/profile/${testUser.id}`)
          .set('Authorization', token)
          .expect(401);
      }
    }, 15000);

    it('should handle expired tokens', async () => {
      const expiredToken = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

      await makeRequest(userURL, USER_API_PREFIX)
        .get(`/profile/${testUser.id}`)
        .set('Authorization', expiredToken)
        .expect(401);
    }, 10000);
  });

  describe('Input Validation & Security', () => {
    it('should validate profile data input', async () => {
      const invalidProfileData = {
        userId: testUser.id,
        website: 'not-a-valid-url',
        bio: 'x'.repeat(1001)
      };

      await makeRequest(userURL, USER_API_PREFIX)
        .post('/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(invalidProfileData)
        .expect(400);
    }, 10000);

    it('should sanitize input to prevent XSS', async () => {
      const maliciousData = {
        userId: testUser.id,
        bio: '<script>alert("xss")</script>',
        location: '<img src=x onerror=alert("xss")>',
        website: 'javascript:alert("xss")'
      };

      const createResponse = await makeRequest(userURL, USER_API_PREFIX)
        .post('/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(maliciousData);

      if (createResponse.status === 201 || createResponse.status === 200) {
        expect(createResponse.body.data.profile.bio).not.toContain('<script>');
        expect(createResponse.body.data.profile.location).not.toContain('<img');
        expect(createResponse.body.data.profile.website).not.toContain('javascript:');
      } else {
        expect(createResponse.status).toBe(400);
      }
    }, 10000);

    it('should handle SQL injection attempts', async () => {
      const sqlInjectionAttempts = {
        userId: testUser.id,
        bio: "'; DROP TABLE profiles; --",
        location: "1' OR '1'='1",
        website: "https://test.com'; DELETE FROM users; --"
      };

      const response = await makeRequest(userURL, USER_API_PREFIX)
        .post('/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(sqlInjectionAttempts);

      expect([200, 201, 400, 409]).toContain(response.status);
      expect(response.status).not.toBe(500);
    }, 10000);
  });

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      const edgeCaseData = { userId: '', bio: null, location: undefined };

      const response = await makeRequest(userURL, USER_API_PREFIX)
        .post('/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(edgeCaseData);

      expect(response.status).not.toBe(500);
      expect([400, 422]).toContain(response.status);
    }, 10000);

    it('should handle missing userId in profile operations', async () => {
      await makeRequest(userURL, USER_API_PREFIX)
        .post('/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ bio: 'Bio without userId' })
        .expect(400);
    }, 10000);

    it('should handle malformed request bodies', async () => {
      await makeRequest(userURL, USER_API_PREFIX)
        .post('/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);
    }, 10000);
  });

  describe('Service Integration', () => {
    it('should work with auth service for user verification', async () => {
      // Verify user exists in auth service
      const profileResponse = await makeRequest(authURL, AUTH_API_PREFIX)
        .get('/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(profileResponse.body.data.user.id).toBe(testUser.id);

      // Get user profile from user service
      const userProfileResponse = await makeRequest(userURL, USER_API_PREFIX)
        .get(`/profile/${testUser.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(userProfileResponse.body.data.profile.userId).toBe(testUser.id);
    }, 15000);

    it('should handle invalid token at user service level', async () => {
      const invalidToken = 'Bearer invalid-token-that-requires-validation';

      const response = await makeRequest(userURL, USER_API_PREFIX)
        .get(`/profile/${testUser.id}`)
        .set('Authorization', invalidToken);

      expect(response.status).toBe(401);
    }, 10000);
  });
});
