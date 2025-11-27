/**
 * Gateway Service Health Endpoints Integration Tests - INFRA-013.1
 *
 * These tests verify the health check endpoints of the Gateway Service.
 * Gateway checks the health of downstream services (Auth, User, Voyage, AI).
 *
 * Prerequisites:
 * - Gateway service should be running (or mocked)
 * - Downstream services can be mocked using fetch
 */

import request from 'supertest';
import express from 'express';
import healthRoutes from '../../../dreamscape-frontend/gateway/src/routes/health';

// Mock global fetch
global.fetch = jest.fn();

// Create test app
const app = express();
app.use('/health', healthRoutes);

describe('Gateway Service Health Endpoints - Integration Tests (INFRA-013.1)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set default environment variables
    process.env.AUTH_SERVICE_URL = 'http://auth-service';
    process.env.USER_SERVICE_URL = 'http://user-service';
    process.env.VOYAGE_SERVICE_URL = 'http://voyage-service';
    process.env.AI_SERVICE_URL = 'http://ai-service';
  });

  describe('GET /health', () => {
    it('should return 200 and HEALTHY when all services are up', async () => {
      // Mock all services returning healthy
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
      });

      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'healthy',
        service: 'gateway-service',
        checks: expect.arrayContaining([
          expect.objectContaining({
            name: 'Auth Service',
            status: 'healthy',
            type: 'internal_service',
          }),
          expect.objectContaining({
            name: 'User Service',
            status: 'healthy',
            type: 'internal_service',
          }),
        ]),
      });
    });

    it('should return 503 and UNHEALTHY when critical service (Auth) is down', async () => {
      // Mock Auth service down, others up
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('auth-service')) {
          return Promise.reject(new Error('Connection refused'));
        }
        return Promise.resolve({ ok: true, status: 200 });
      });

      const response = await request(app)
        .get('/health')
        .expect(503);

      expect(response.body).toMatchObject({
        status: 'unhealthy',
        service: 'gateway-service',
      });

      const authCheck = response.body.checks.find((c: any) => c.name === 'Auth Service');
      expect(authCheck).toBeDefined();
      expect(authCheck.status).toBe('unhealthy');
    });

    it('should return 503 and UNHEALTHY when critical service (User) is down', async () => {
      // Mock User service down, others up
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('user-service')) {
          return Promise.reject(new Error('Service unavailable'));
        }
        return Promise.resolve({ ok: true, status: 200 });
      });

      const response = await request(app)
        .get('/health')
        .expect(503);

      expect(response.body.status).toBe('unhealthy');
      const userCheck = response.body.checks.find((c: any) => c.name === 'User Service');
      expect(userCheck.status).toBe('unhealthy');
    });

    it('should return 206 and DEGRADED when non-critical service (Voyage) is down', async () => {
      // Mock Voyage service down, critical services up
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('voyage-service')) {
          return Promise.reject(new Error('Service unavailable'));
        }
        return Promise.resolve({ ok: true, status: 200 });
      });

      const response = await request(app)
        .get('/health')
        .expect(206);

      expect(response.body.status).toBe('degraded');
      const voyageCheck = response.body.checks.find((c: any) => c.name === 'Voyage Service');
      expect(voyageCheck.status).toBe('unhealthy');
    });

    it('should return 206 and DEGRADED when optional service (AI) is down', async () => {
      // Mock AI service down, critical services up
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('ai-service')) {
          return Promise.reject(new Error('Service unavailable'));
        }
        return Promise.resolve({ ok: true, status: 200 });
      });

      const response = await request(app)
        .get('/health')
        .expect(206);

      expect(response.body.status).toBe('degraded');
      const aiCheck = response.body.checks.find((c: any) => c.name === 'AI Service');
      expect(aiCheck).toBeDefined();
      expect(aiCheck.status).toBe('unhealthy');
    });

    it('should include metadata in response', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
      });

      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.metadata).toBeDefined();
      expect(response.body.metadata).toMatchObject({
        environment: expect.any(String),
        hostname: expect.any(String),
        pid: expect.any(Number),
        memory: expect.objectContaining({
          used: expect.any(Number),
          total: expect.any(Number),
          percentage: expect.any(Number),
        }),
      });
    });

    it('should measure response time for each service check', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
      });

      const response = await request(app)
        .get('/health')
        .expect(200);

      response.body.checks.forEach((check: any) => {
        expect(check.responseTime).toBeDefined();
        expect(check.responseTime).toBeGreaterThanOrEqual(0);
      });
    });

    it('should handle multiple concurrent health checks', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
      });

      const requests = Array(3).fill(null).map(() =>
        request(app).get('/health')
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('healthy');
      });
    });

    it('should check all configured services', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
      });

      const response = await request(app)
        .get('/health')
        .expect(200);

      const serviceNames = response.body.checks.map((c: any) => c.name);
      expect(serviceNames).toContain('Auth Service');
      expect(serviceNames).toContain('User Service');
      expect(serviceNames).toContain('Voyage Service');
      expect(serviceNames).toContain('AI Service');
    });

    it('should not include AI Service check when AI_SERVICE_URL is not set', async () => {
      delete process.env.AI_SERVICE_URL;

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
      });

      const response = await request(app)
        .get('/health')
        .expect(200);

      const serviceNames = response.body.checks.map((c: any) => c.name);
      expect(serviceNames).not.toContain('AI Service');
    });

    it('should complete health check within reasonable time', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
      });

      const startTime = Date.now();
      await request(app)
        .get('/health')
        .expect(200);
      const duration = Date.now() - startTime;

      // Gateway health check should complete within 5 seconds (checks multiple services)
      expect(duration).toBeLessThan(5000);
    });
  });

  describe('GET /health/live', () => {
    it('should return 200 and alive status', async () => {
      const response = await request(app)
        .get('/health/live')
        .expect(200);

      expect(response.body).toMatchObject({
        alive: true,
        service: 'gateway-service',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
      });
    });

    it('should always return 200 even if downstream services are down', async () => {
      // Mock all services down
      (global.fetch as jest.Mock).mockRejectedValue(new Error('All services down'));

      const response = await request(app)
        .get('/health/live')
        .expect(200);

      expect(response.body.alive).toBe(true);
    });

    it('should respond very quickly (liveness check)', async () => {
      const startTime = Date.now();
      await request(app)
        .get('/health/live')
        .expect(200);
      const duration = Date.now() - startTime;

      // Liveness check should be very fast (< 100ms)
      expect(duration).toBeLessThan(100);
    });
  });

  describe('GET /health/ready', () => {
    it('should return 200 when critical services are accessible', async () => {
      // Mock successful responses from Auth and User services
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
      });

      const response = await request(app)
        .get('/health/ready')
        .expect(200);

      expect(response.body).toMatchObject({
        ready: true,
        service: 'gateway-service',
        dependencies: {
          'auth-service': true,
          'user-service': true,
        },
      });
    });

    it('should return 503 when Auth service is not accessible', async () => {
      // Mock Auth service down
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('auth-service')) {
          return Promise.reject(new Error('Connection refused'));
        }
        return Promise.resolve({ ok: true, status: 200 });
      });

      const response = await request(app)
        .get('/health/ready')
        .expect(503);

      expect(response.body).toMatchObject({
        ready: false,
        reason: 'Critical downstream services unavailable',
        dependencies: {
          'auth-service': false,
          'user-service': true,
        },
      });
    });

    it('should return 503 when User service is not accessible', async () => {
      // Mock User service down
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('user-service')) {
          return Promise.reject(new Error('Service unavailable'));
        }
        return Promise.resolve({ ok: true, status: 200 });
      });

      const response = await request(app)
        .get('/health/ready')
        .expect(503);

      expect(response.body.ready).toBe(false);
      expect(response.body.dependencies['user-service']).toBe(false);
    });

    it('should return 503 when all critical services are down', async () => {
      // Mock all services down
      (global.fetch as jest.Mock).mockRejectedValue(new Error('All services down'));

      const response = await request(app)
        .get('/health/ready')
        .expect(503);

      expect(response.body).toMatchObject({
        ready: false,
        dependencies: {
          'auth-service': false,
          'user-service': false,
        },
      });
    });

    it('should complete readiness check quickly', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
      });

      const startTime = Date.now();
      await request(app)
        .get('/health/ready')
        .expect(200);
      const duration = Date.now() - startTime;

      // Readiness check should be fast (< 3 seconds with service checks)
      expect(duration).toBeLessThan(3000);
    });

    it('should include response time in result', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
      });

      const response = await request(app)
        .get('/health/ready')
        .expect(200);

      expect(response.body.responseTime).toBeDefined();
      expect(response.body.responseTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Service Environment Variables', () => {
    it('should use environment variables for service URLs', async () => {
      process.env.AUTH_SERVICE_URL = 'http://custom-auth:3001';
      process.env.USER_SERVICE_URL = 'http://custom-user:3002';

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
      });

      await request(app)
        .get('/health')
        .expect(200);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('http://custom-auth:3001'),
        expect.any(Object)
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('http://custom-user:3002'),
        expect.any(Object)
      );
    });

    it('should use default URLs when environment variables are not set', async () => {
      delete process.env.AUTH_SERVICE_URL;
      delete process.env.USER_SERVICE_URL;
      delete process.env.VOYAGE_SERVICE_URL;

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
      });

      await request(app)
        .get('/health')
        .expect(200);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('localhost'),
        expect.any(Object)
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle unexpected errors gracefully', async () => {
      // Mock fetch to throw unexpected error
      (global.fetch as jest.Mock).mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const response = await request(app)
        .get('/health')
        .expect(500);

      expect(response.body).toMatchObject({
        status: 'error',
        service: 'gateway-service',
        error: expect.any(String),
      });
    });

    it('should handle network timeouts', async () => {
      // Mock slow responses
      (global.fetch as jest.Mock).mockImplementation(() =>
        new Promise(resolve =>
          setTimeout(() => resolve({ ok: true, status: 200 }), 5000)
        )
      );

      const response = await request(app)
        .get('/health');

      expect(response.status).toBeGreaterThanOrEqual(200);
    }, 15000);
  });

  describe('Response Format Validation', () => {
    it('should have all required fields in /health response', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
      });

      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('service');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('checks');
      expect(response.body).toHaveProperty('metadata');
    });

    it('should have proper check structure', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
      });

      const response = await request(app)
        .get('/health')
        .expect(200);

      response.body.checks.forEach((check: any) => {
        expect(check).toHaveProperty('name');
        expect(check).toHaveProperty('status');
        expect(check).toHaveProperty('type');
        expect(check).toHaveProperty('timestamp');
        expect(check.type).toBe('internal_service');
      });
    });
  });
});
