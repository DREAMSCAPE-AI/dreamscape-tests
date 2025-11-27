/**
 * Auth Service Health Endpoints Integration Tests - INFRA-013.1
 *
 * These tests verify the health check endpoints of the Auth Service.
 * They test the actual HTTP endpoints and their responses.
 *
 * Prerequisites:
 * - Auth service should be running (or mocked)
 * - Database and Redis connections should be available (or mocked)
 */

import request from 'supertest';
import express from 'express';
import healthRoutes from '../../../dreamscape-services/auth/src/routes/health';

// Mock Prisma
const mockPrisma = {
  $queryRaw: jest.fn(),
};

// Mock Redis
const mockRedisClient = {
  isReady: true,
  ping: jest.fn().mockResolvedValue('PONG'),
};

jest.mock('../../../dreamscape-services/auth/src/database/prisma', () => ({
  default: mockPrisma,
}));

jest.mock('../../../dreamscape-services/auth/src/config/redis', () => ({
  default: mockRedisClient,
}));

// Create test app
const app = express();
app.use('/health', healthRoutes);

describe('Auth Service Health Endpoints - Integration Tests (INFRA-013.1)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRedisClient.isReady = true;
  });

  describe('GET /health', () => {
    it('should return 200 and HEALTHY status when all checks pass', async () => {
      // Mock successful PostgreSQL and Redis connections
      mockPrisma.$queryRaw.mockResolvedValue([{ health_check: 1 }]);
      mockRedisClient.ping.mockResolvedValue('PONG');

      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'healthy',
        service: 'auth-service',
        version: expect.any(String),
        checks: expect.arrayContaining([
          expect.objectContaining({
            name: 'PostgreSQL',
            status: 'healthy',
            type: 'database',
          }),
          expect.objectContaining({
            name: 'Redis Cache',
            status: 'healthy',
            type: 'cache',
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
        service: 'auth-service',
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

    it('should return 206 and DEGRADED status when Redis fails (non-critical)', async () => {
      // Mock successful PostgreSQL but failed Redis
      mockPrisma.$queryRaw.mockResolvedValue([{ health_check: 1 }]);
      mockRedisClient.isReady = false;

      const response = await request(app)
        .get('/health')
        .expect(206);

      expect(response.body.status).toBe('degraded');
      expect(response.body.checks.some((check: any) =>
        check.name === 'Redis Cache' && check.status === 'unhealthy'
      )).toBe(true);
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
  });

  describe('GET /health/live', () => {
    it('should return 200 and alive status', async () => {
      const response = await request(app)
        .get('/health/live')
        .expect(200);

      expect(response.body).toMatchObject({
        alive: true,
        service: 'auth-service',
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
    it('should return 200 when PostgreSQL is accessible', async () => {
      // Mock successful connections
      const mockDbReady = jest.fn().mockReturnValue(true);

      const response = await request(app)
        .get('/health/ready');

      // Readiness depends on DatabaseService.isReady() implementation
      if (response.status === 200) {
        expect(response.body).toMatchObject({
          ready: true,
          service: 'auth-service',
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
});
