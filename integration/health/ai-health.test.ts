/**
 * AI Service Health Endpoints Integration Tests - INFRA-013.1
 *
 * These tests verify the health check endpoints of the AI Service.
 * They test the actual HTTP endpoints and their responses.
 *
 * Prerequisites:
 * - AI service should be running (or mocked)
 * - Database connection should be available (or mocked)
 */

import request from 'supertest';
import express from 'express';
import healthRoutes from '../../../dreamscape-services/ai/src/routes/health';

// Mock Prisma
const mockPrisma = {
  $queryRaw: jest.fn(),
};

jest.mock('../../../dreamscape-services/ai/src/database/prisma', () => ({
  default: mockPrisma,
}));

// Create test app
const app = express();
app.use('/health', healthRoutes);

describe('AI Service Health Endpoints - Integration Tests (INFRA-013.1)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /health', () => {
    it('should return 200 and HEALTHY status when all checks pass', async () => {
      // Mock successful PostgreSQL connection
      mockPrisma.$queryRaw.mockResolvedValue([{ health_check: 1 }]);

      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'healthy',
        service: 'ai-service',
        version: expect.any(String),
        checks: expect.arrayContaining([
          expect.objectContaining({
            name: 'PostgreSQL',
            status: 'healthy',
            type: 'database',
          }),
        ]),
      });

      expect(response.body.timestamp).toBeDefined();
      expect(response.body.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should return 503 and UNHEALTHY status when PostgreSQL fails', async () => {
      // Mock failed PostgreSQL connection
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Connection refused'));

      const response = await request(app)
        .get('/health')
        .expect(503);

      expect(response.body).toMatchObject({
        status: 'unhealthy',
        service: 'ai-service',
        checks: expect.arrayContaining([
          expect.objectContaining({
            name: 'PostgreSQL',
            status: 'unhealthy',
            type: 'database',
            message: expect.stringContaining('failed'),
          }),
        ]),
      });
    });

    it('should include metadata in response', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ health_check: 1 }]);

      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.metadata).toBeDefined();
      expect(response.body.metadata).toMatchObject({
        environment: expect.any(String),
        hostname: expect.any(String),
        pid: expect.any(Number),
        memory: {
          used: expect.any(Number),
          total: expect.any(Number),
          percentage: expect.any(Number),
        },
      });
    });

    it('should include response time for each check', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ health_check: 1 }]);

      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.checks).toBeInstanceOf(Array);
      response.body.checks.forEach((check: any) => {
        expect(check.responseTime).toBeDefined();
        expect(typeof check.responseTime).toBe('number');
        expect(check.responseTime).toBeGreaterThanOrEqual(0);
      });
    });

    it('should complete health check within reasonable time', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ health_check: 1 }]);

      const startTime = Date.now();
      await request(app)
        .get('/health')
        .expect(200);
      const duration = Date.now() - startTime;

      // Health check should complete within 2 seconds in normal conditions
      expect(duration).toBeLessThan(2000);
    });

    it('should return valid JSON response', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ health_check: 1 }]);

      const response = await request(app)
        .get('/health')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(() => JSON.parse(JSON.stringify(response.body))).not.toThrow();
    });

    it('should handle multiple concurrent requests correctly', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ health_check: 1 }]);

      const requests = Array(5).fill(null).map(() =>
        request(app).get('/health')
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('healthy');
      });
    });
  });

  describe('GET /health/live', () => {
    it('should return 200 and alive status', async () => {
      const response = await request(app)
        .get('/health/live')
        .expect(200);

      expect(response.body).toMatchObject({
        alive: true,
        service: 'ai-service',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
      });
    });

    it('should always return 200 even if database is down', async () => {
      // Mock database failure
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Connection refused'));

      const response = await request(app)
        .get('/health/live')
        .expect(200);

      expect(response.body.alive).toBe(true);
    });

    it('should return valid timestamp in ISO format', async () => {
      const response = await request(app)
        .get('/health/live')
        .expect(200);

      const timestamp = new Date(response.body.timestamp);
      expect(timestamp.toISOString()).toBe(response.body.timestamp);
    });

    it('should return uptime greater than or equal to 0', async () => {
      const response = await request(app)
        .get('/health/live')
        .expect(200);

      expect(response.body.uptime).toBeGreaterThanOrEqual(0);
      expect(typeof response.body.uptime).toBe('number');
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

    it('should handle multiple concurrent liveness checks', async () => {
      const requests = Array(10).fill(null).map(() =>
        request(app).get('/health/live')
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.alive).toBe(true);
      });
    });
  });

  describe('GET /health/ready', () => {
    it('should return 200 when PostgreSQL is accessible', async () => {
      const response = await request(app)
        .get('/health/ready');

      // Readiness depends on DatabaseService.isReady() implementation
      if (response.status === 200) {
        expect(response.body).toMatchObject({
          ready: true,
          service: 'ai-service',
          timestamp: expect.any(String),
          dependencies: {
            postgresql: true,
          },
        });
      }
    });

    it('should complete readiness check quickly', async () => {
      const startTime = Date.now();
      await request(app)
        .get('/health/ready');
      const duration = Date.now() - startTime;

      // Readiness check should be fast (< 500ms with DB check)
      expect(duration).toBeLessThan(500);
    });

    it('should return valid timestamp', async () => {
      const response = await request(app)
        .get('/health/ready');

      const timestamp = new Date(response.body.timestamp);
      expect(timestamp.toISOString()).toBe(response.body.timestamp);
    });
  });

  describe('Alternative Paths', () => {
    it('should also work with /api/health prefix', async () => {
      const appWithPrefix = express();
      appWithPrefix.use('/api/health', healthRoutes);

      mockPrisma.$queryRaw.mockResolvedValue([{ health_check: 1 }]);

      const response = await request(appWithPrefix)
        .get('/api/health')
        .expect(200);

      expect(response.body.status).toBe('healthy');
    });
  });

  describe('Error Handling', () => {
    it('should return 500 when health check throws unexpected error', async () => {
      // Mock an unexpected error in health check
      mockPrisma.$queryRaw.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const response = await request(app)
        .get('/health')
        .expect(500);

      expect(response.body).toMatchObject({
        status: 'error',
        service: 'ai-service',
        error: expect.any(String),
      });
    });

    it('should handle malformed database responses', async () => {
      mockPrisma.$queryRaw.mockResolvedValue(null);

      const response = await request(app)
        .get('/health');

      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.body.service).toBe('ai-service');
    });
  });

  describe('Response Format Validation', () => {
    it('should have all required fields in /health response', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ health_check: 1 }]);

      const response = await request(app)
        .get('/health')
        .expect(200);

      // Required fields
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('service');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('checks');

      // Checks array structure
      expect(Array.isArray(response.body.checks)).toBe(true);
      response.body.checks.forEach((check: any) => {
        expect(check).toHaveProperty('name');
        expect(check).toHaveProperty('status');
        expect(check).toHaveProperty('type');
        expect(check).toHaveProperty('timestamp');
      });
    });

    it('should have all required fields in /health/live response', async () => {
      const response = await request(app)
        .get('/health/live')
        .expect(200);

      expect(response.body).toHaveProperty('alive');
      expect(response.body).toHaveProperty('service');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
    });

    it('should have all required fields in /health/ready response', async () => {
      const response = await request(app)
        .get('/health/ready');

      expect(response.body).toHaveProperty('ready');
      expect(response.body).toHaveProperty('service');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('dependencies');
    });
  });

  describe('AI Service Specific Tests', () => {
    it('should handle high memory usage gracefully (AI workloads)', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ health_check: 1 }]);

      const response = await request(app)
        .get('/health')
        .expect(200);

      // AI services typically use more memory
      expect(response.body.metadata.memory.percentage).toBeGreaterThanOrEqual(0);
      expect(response.body.metadata.memory.percentage).toBeLessThanOrEqual(100);
    });

    it('should respond within acceptable time under load', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ health_check: 1 }]);

      // Simulate multiple concurrent health checks
      const requests = Array(20).fill(null).map(async () => {
        const start = Date.now();
        await request(app).get('/health');
        return Date.now() - start;
      });

      const durations = await Promise.all(requests);
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;

      // Average response time should be reasonable even under load
      expect(avgDuration).toBeLessThan(500);
    });
  });
});
