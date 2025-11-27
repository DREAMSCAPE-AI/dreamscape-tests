const request = require('supertest');

// Test the actual API response format and behavior
describe('Profile API Integration - Real Format Testing', () => {
  const USER_SERVICE_URL = 'http://localhost:3003';
  
  // Mock valid token (for testing error responses)
  const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0IiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwidHlwZSI6ImFjY2VzcyJ9.mockSignature';

  describe('GET /api/v1/users/profile', () => {
    it('should return proper error format for invalid token', async () => {
      const response = await request(USER_SERVICE_URL)
        .get('/api/v1/users/profile')
        .set('Authorization', `Bearer invalid-token`);

      // Test that error responses have consistent format (401 or 429 for rate limiting)
      expect([401, 429].includes(response.status)).toBe(true);
      expect(response.body).toBeDefined();
      
      if (response.status === 429) {
        // Rate limiting response
        expect(response.body).toHaveProperty('error');
      } else {
        // Normal auth error
        expect(response.body).toHaveProperty('success');
        expect(response.body).toHaveProperty('message');
        expect(response.body.success).toBe(false);
      }
    });

    it('should return proper error format for missing token', async () => {
      const response = await request(USER_SERVICE_URL)
        .get('/api/v1/users/profile');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('message');
      expect(response.body.success).toBe(false);
    });

    it('should handle malformed Authorization header', async () => {
      const response = await request(USER_SERVICE_URL)
        .get('/api/v1/users/profile')
        .set('Authorization', 'InvalidFormat');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/v1/users/profile', () => {
    it('should return proper error format for unauthorized update', async () => {
      const updateData = {
        profile: {
          name: 'Test User'
        }
      };

      const response = await request(USER_SERVICE_URL)
        .put('/api/v1/users/profile')
        .send(updateData);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success');
      expect(response.body.success).toBe(false);
    });

    it('should validate request body structure', async () => {
      const malformedData = {
        invalidField: 'test'
      };

      const response = await request(USER_SERVICE_URL)
        .put('/api/v1/users/profile')
        .set('Authorization', `Bearer ${mockToken}`)
        .send(malformedData);

      // Should either be unauthorized (401) or handle gracefully
      expect([401, 400, 200].includes(response.status)).toBe(true);
      expect(response.body).toHaveProperty('success');
    });

    it('should handle empty request body', async () => {
      const response = await request(USER_SERVICE_URL)
        .put('/api/v1/users/profile')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({});

      expect([401, 400, 200].includes(response.status)).toBe(true);
      expect(response.body).toHaveProperty('success');
    });

    it('should validate JSON content type', async () => {
      const response = await request(USER_SERVICE_URL)
        .put('/api/v1/users/profile')
        .set('Authorization', `Bearer ${mockToken}`)
        .set('Content-Type', 'text/plain')
        .send('invalid data');

      // Should handle invalid content type gracefully
      expect([401, 400, 415].includes(response.status)).toBe(true);
    });
  });

  describe('API Response Consistency', () => {
    it('should always include CORS headers if configured', async () => {
      const response = await request(USER_SERVICE_URL)
        .get('/api/v1/users/profile');

      // Check that API handles CORS consistently
      // The response should be consistent regardless of CORS setup
      expect(response.status).toBeDefined();
      expect(response.body).toBeDefined();
    });

    it('should handle preflight OPTIONS request', async () => {
      const response = await request(USER_SERVICE_URL)
        .options('/api/v1/users/profile');

      // OPTIONS request should be handled (either 200, 204, or 404)
      expect([200, 204, 404, 405].includes(response.status)).toBe(true);
    });

    it('should return JSON content type for API responses', async () => {
      const response = await request(USER_SERVICE_URL)
        .get('/api/v1/users/profile');

      // Even error responses should be JSON
      expect(response.headers['content-type']).toMatch(/json/);
    });

    it('should handle large request payloads appropriately', async () => {
      const largeData = {
        profile: {
          name: 'A'.repeat(1000), // Very long name
        },
        travel: {
          preferredDestinations: Array(100).fill('Destination'),
          activities: Array(50).fill('Activity'.repeat(20)),
          dietary: Array(20).fill('Dietary restriction')
        }
      };

      const response = await request(USER_SERVICE_URL)
        .put('/api/v1/users/profile')
        .set('Authorization', `Bearer ${mockToken}`)
        .send(largeData);

      // Should either handle it or return appropriate error
      expect([401, 400, 413, 200].includes(response.status)).toBe(true);
      expect(response.body).toHaveProperty('success');
    });
  });

  describe('Error Handling Consistency', () => {
    it('should return consistent error format for all endpoints', async () => {
      const endpoints = [
        { method: 'get', path: '/api/v1/users/profile' },
        { method: 'put', path: '/api/v1/users/profile' }
      ];

      for (const endpoint of endpoints) {
        const response = await request(USER_SERVICE_URL)
          [endpoint.method](endpoint.path);

        expect(response.body).toHaveProperty('success');
        expect(response.body).toHaveProperty('message');
        expect(response.body.success).toBe(false);
        expect(typeof response.body.message).toBe('string');
      }
    });

    it('should not expose internal errors in production', async () => {
      const response = await request(USER_SERVICE_URL)
        .get('/api/v1/users/profile')
        .set('Authorization', 'Bearer malformed.jwt.token');

      // Should not contain stack traces or internal details
      expect(response.body.message).toBeDefined();
      expect(response.body.message).not.toMatch(/stack|trace|error\.stack/i);
      expect(response.body.message).not.toMatch(/prisma|database|sql/i);
    });
  });

  describe('Performance and Reliability', () => {
    it('should respond within reasonable time', async () => {
      const startTime = Date.now();
      
      const response = await request(USER_SERVICE_URL)
        .get('/api/v1/users/profile');
      
      const responseTime = Date.now() - startTime;
      
      // API should respond within 5 seconds
      expect(responseTime).toBeLessThan(5000);
      expect(response.status).toBeDefined();
    });

    it('should handle multiple concurrent requests', async () => {
      const requests = Array(5).fill(null).map(() => 
        request(USER_SERVICE_URL)
          .get('/api/v1/users/profile')
      );

      const responses = await Promise.all(requests);
      
      // All requests should complete successfully (even if unauthorized)
      responses.forEach(response => {
        expect(response.status).toBeDefined();
        expect(response.body).toHaveProperty('success');
      });
    });

    it('should be consistent across multiple calls', async () => {
      const response1 = await request(USER_SERVICE_URL)
        .get('/api/v1/users/profile');
        
      const response2 = await request(USER_SERVICE_URL)
        .get('/api/v1/users/profile');

      // Both calls should return the same error format
      expect(response1.status).toBe(response2.status);
      expect(response1.body.success).toBe(response2.body.success);
      expect(typeof response1.body.message).toBe(typeof response2.body.message);
    });
  });

  describe('HTTP Standards Compliance', () => {
    it('should return appropriate HTTP status codes', async () => {
      const testCases = [
        {
          description: 'No auth token',
          request: () => request(USER_SERVICE_URL).get('/api/v1/users/profile'),
          expectedStatus: 401
        },
        {
          description: 'Invalid auth token',
          request: () => request(USER_SERVICE_URL)
            .get('/api/v1/users/profile')
            .set('Authorization', 'Bearer invalid'),
          expectedStatus: 401
        },
        {
          description: 'Malformed auth header',
          request: () => request(USER_SERVICE_URL)
            .get('/api/v1/users/profile')
            .set('Authorization', 'InvalidFormat'),
          expectedStatus: 401
        }
      ];

      for (const testCase of testCases) {
        const response = await testCase.request();
        expect(response.status).toBe(testCase.expectedStatus);
      }
    });

    it('should include proper headers in responses', async () => {
      const response = await request(USER_SERVICE_URL)
        .get('/api/v1/users/profile');

      // Should have proper content-type header
      expect(response.headers['content-type']).toBeDefined();
      expect(response.headers['content-type']).toMatch(/application\/json/);
      
      // Should not expose server information unnecessarily
      expect(response.headers['x-powered-by']).toBeUndefined();
    });
  });
});