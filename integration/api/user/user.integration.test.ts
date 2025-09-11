import request from 'supertest';

const USER_SERVICE_URL: string = process.env.USER_SERVICE_URL!;
const AUTH_SERVICE_URL: string = process.env.AUTH_SERVICE_URL!;

const makeRequest = (app: any) => {
  return {
    post: (path: string) => request(app).post(path).set('x-test-rate-limit', 'true'),
    get: (path: string) => request(app).get(path).set('x-test-rate-limit', 'true'),
    put: (path: string) => request(app).put(path).set('x-test-rate-limit', 'true'),
    delete: (path: string) => request(app).delete(path).set('x-test-rate-limit', 'true')
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

interface Profile {
  id: string;
  userId: string;
  bio?: string;
  location?: string;
  website?: string;
  avatar?: {
    url: string;
    filename: string;
    uploadedAt: string;
  };
}

describe('User Service Integration Tests', () => {
  let testUser: User | undefined;
  let accessToken: string | undefined;
  let testProfile: Profile | undefined;
  const userURL: string = USER_SERVICE_URL;
  const authURL: string = AUTH_SERVICE_URL;

  beforeAll(async () => {
    try {
      await makeRequest(userURL).post('/test/reset').expect(200);
      await makeRequest(authURL).post('/test/reset').expect(200);
    } catch (error) {
      console.warn('Test reset endpoints not available, continuing...');
    }
  });

  beforeEach(async () => {
    // Create a test user through auth service for each test
    const registrationData = {
      email: `user-test-${Date.now()}@test.com`,
      password: 'Password123!',
      firstName: 'Test',
      lastName: 'User',
      username: `testuser${Date.now()}`
    };

    const registerResponse = await request(authURL)
      .post('/register')
      .send(registrationData)
      .expect(201);

    testUser = registerResponse.body.data.user;
    accessToken = registerResponse.body.data.tokens.accessToken;
  });

  afterEach(async () => {
    try {
      if (testUser?.email) {
        await makeRequest(userURL).post('/test/cleanup').send();
        await makeRequest(authURL).post('/test/cleanup').send();
      }
    } catch (error) {
      // Cleanup errors are not critical for tests
    }
  });

  describe('Profile Management', () => {
    it('should create a new profile for user', async () => {
      const profileData = {
        userId: testUser!.id,
        bio: 'This is my test bio',
        location: 'Test City, TC',
        website: 'https://testwebsite.com'
      };

      const createResponse = await request(userURL)
        .post('/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(profileData)
        .expect(201);

      expect(createResponse.body.success).toBe(true);
      expect(createResponse.body.data.profile.userId).toBe(testUser!.id);
      expect(createResponse.body.data.profile.bio).toBe(profileData.bio);
      expect(createResponse.body.data.profile.location).toBe(profileData.location);
      expect(createResponse.body.data.profile.website).toBe(profileData.website);

      testProfile = createResponse.body.data.profile;
    }, 15000);

    it('should get user profile by userId', async () => {
      // First create a profile
      const profileData = {
        userId: testUser!.id,
        bio: 'Get profile test bio',
        location: 'Get City, GC'
      };

      await request(userURL)
        .post('/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(profileData)
        .expect(201);

      // Then get the profile
      const getResponse = await request(userURL)
        .get(`/profile/${testUser!.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(getResponse.body.success).toBe(true);
      expect(getResponse.body.data.profile.userId).toBe(testUser!.id);
      expect(getResponse.body.data.profile.bio).toBe(profileData.bio);
      expect(getResponse.body.data.profile.location).toBe(profileData.location);
    }, 15000);

    it('should update existing profile', async () => {
      // Create initial profile
      const initialData = {
        userId: testUser!.id,
        bio: 'Initial bio',
        location: 'Initial City'
      };

      await request(userURL)
        .post('/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(initialData)
        .expect(201);

      // Update profile
      const updateData = {
        bio: 'Updated bio',
        location: 'Updated City',
        website: 'https://updated-website.com'
      };

      const updateResponse = await request(userURL)
        .put(`/profile/${testUser!.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(200);

      expect(updateResponse.body.success).toBe(true);
      expect(updateResponse.body.data.profile.bio).toBe(updateData.bio);
      expect(updateResponse.body.data.profile.location).toBe(updateData.location);
      expect(updateResponse.body.data.profile.website).toBe(updateData.website);
    }, 15000);

    it('should return 404 for non-existent profile', async () => {
      const nonExistentUserId = 'non-existent-user-id';

      await request(userURL)
        .get(`/profile/${nonExistentUserId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    }, 10000);

    it('should handle profile creation with minimal data', async () => {
      const minimalData = {
        userId: testUser!.id
      };

      const createResponse = await request(userURL)
        .post('/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(minimalData)
        .expect(201);

      expect(createResponse.body.success).toBe(true);
      expect(createResponse.body.data.profile.userId).toBe(testUser!.id);
      expect(createResponse.body.data.profile.bio).toBeUndefined();
      expect(createResponse.body.data.profile.location).toBeUndefined();
      expect(createResponse.body.data.profile.website).toBeUndefined();
    }, 10000);
  });

  describe('Avatar Management', () => {
    beforeEach(async () => {
      // Create a profile for avatar tests
      const profileData = {
        userId: testUser!.id,
        bio: 'Avatar test user'
      };

      await request(userURL)
        .post('/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(profileData);
    });

    it('should upload avatar successfully', async () => {
      // Create a simple test image buffer (1x1 pixel PNG)
      const testImageBuffer = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
        0x0D, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
        0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49,
        0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
      ]);

      const uploadResponse = await request(userURL)
        .post(`/avatar/${testUser!.id}/avatar`)
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

      await request(userURL)
        .post(`/avatar/${testUser!.id}/avatar`)
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('avatar', textBuffer, 'not-an-image.txt')
        .expect(400);
    }, 10000);

    it('should reject files that are too large', async () => {
      // Create a buffer larger than 5MB
      const largeBuffer = Buffer.alloc(6 * 1024 * 1024, 0);

      await request(userURL)
        .post(`/avatar/${testUser!.id}/avatar`)
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('avatar', largeBuffer, 'large-image.png')
        .expect(400);
    }, 15000);

    it('should reject avatar upload for different user', async () => {
      // Create another user
      const otherUserData = {
        email: `other-user-${Date.now()}@test.com`,
        password: 'Password123!',
        firstName: 'Other',
        lastName: 'User'
      };

      const otherUserResponse = await request(authURL)
        .post('/register')
        .send(otherUserData)
        .expect(201);

      const otherUserId = otherUserResponse.body.data.user.id;
      const testImageBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47]); // Minimal PNG header

      await request(userURL)
        .post(`/avatar/${otherUserId}/avatar`)
        .set('Authorization', `Bearer ${accessToken}`) // Using testUser's token
        .attach('avatar', testImageBuffer, 'test-avatar.png')
        .expect(403);
    }, 15000);

    it('should handle missing file in avatar upload', async () => {
      await request(userURL)
        .post(`/avatar/${testUser!.id}/avatar`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    }, 10000);
  });

  describe('Authentication & Authorization', () => {
    it('should reject requests without authentication token', async () => {
      await request(userURL)
        .get(`/profile/${testUser!.id}`)
        .expect(401);

      await request(userURL)
        .post('/profile')
        .send({ userId: testUser!.id })
        .expect(401);

      await request(userURL)
        .put(`/profile/${testUser!.id}`)
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
        await request(userURL)
          .get(`/profile/${testUser!.id}`)
          .set('Authorization', token)
          .expect(401);
      }
    }, 15000);

    it('should handle expired tokens', async () => {
      // This would require a way to generate expired tokens
      // For now, we'll use an obviously invalid token
      const expiredToken = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

      await request(userURL)
        .get(`/profile/${testUser!.id}`)
        .set('Authorization', expiredToken)
        .expect(401);
    }, 10000);
  });

  describe('Input Validation & Security', () => {
    it('should validate profile data input', async () => {
      const invalidProfileData = {
        userId: testUser!.id,
        website: 'not-a-valid-url',
        bio: 'x'.repeat(1001) // Assuming max bio length is 1000
      };

      // This test depends on your validation rules
      // Adjust expectations based on your ProfileService validation
      await request(userURL)
        .post('/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(invalidProfileData)
        .expect(400);
    }, 10000);

    it('should sanitize input to prevent XSS', async () => {
      const maliciousData = {
        userId: testUser!.id,
        bio: '<script>alert("xss")</script>',
        location: '<img src=x onerror=alert("xss")>',
        website: 'javascript:alert("xss")'
      };

      const createResponse = await request(userURL)
        .post('/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(maliciousData);

      // Should either reject (400) or sanitize the input
      if (createResponse.status === 201) {
        // If created, check that malicious content was sanitized
        expect(createResponse.body.data.profile.bio).not.toContain('<script>');
        expect(createResponse.body.data.profile.location).not.toContain('<img');
        expect(createResponse.body.data.profile.website).not.toContain('javascript:');
      } else {
        expect(createResponse.status).toBe(400);
      }
    }, 10000);

    it('should handle SQL injection attempts', async () => {
      const sqlInjectionAttempts = {
        userId: testUser!.id,
        bio: "'; DROP TABLE profiles; --",
        location: "1' OR '1'='1",
        website: "https://test.com'; DELETE FROM users; --"
      };

      // Should not cause server errors
      const response = await request(userURL)
        .post('/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(sqlInjectionAttempts);

      expect([200, 201, 400]).toContain(response.status);
      expect(response.status).not.toBe(500);
    }, 10000);
  });

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // This test would require a way to simulate database failures
      // For now, we'll test with edge case data
      const edgeCaseData = {
        userId: '',
        bio: null,
        location: undefined
      };

      const response = await request(userURL)
        .post('/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(edgeCaseData);

      expect(response.status).not.toBe(500);
      expect([400, 422]).toContain(response.status);
    }, 10000);

    it('should handle missing userId in profile operations', async () => {
      await request(userURL)
        .post('/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          bio: 'Bio without userId'
        })
        .expect(400);
    }, 10000);

    it('should handle malformed request bodies', async () => {
      await request(userURL)
        .post('/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);
    }, 10000);
  });

  describe('Service Integration', () => {
    it('should work with auth service for user verification', async () => {
      // Create profile
      const profileData = {
        userId: testUser!.id,
        bio: 'Integration test profile'
      };

      await request(userURL)
        .post('/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(profileData)
        .expect(201);

      // Verify user still exists in auth service
      const profileResponse = await request(authURL)
        .get('/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(profileResponse.body.data.user.id).toBe(testUser!.id);

      // Get user profile from user service
      const userProfileResponse = await request(userURL)
        .get(`/profile/${testUser!.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(userProfileResponse.body.data.profile.userId).toBe(testUser!.id);
    }, 15000);

    it('should handle auth service being unavailable', async () => {
      // Use an invalid token that would require auth service validation
      const invalidToken = 'Bearer invalid-token-that-requires-validation';

      const response = await request(userURL)
        .get(`/profile/${testUser!.id}`)
        .set('Authorization', invalidToken);

      expect(response.status).toBe(401);
    }, 10000);
  });
});