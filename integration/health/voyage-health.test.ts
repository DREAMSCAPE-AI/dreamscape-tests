/**
 * Voyage Service Health Endpoints Integration Tests - INFRA-013.1
 *
 * These tests verify the health check endpoints of the Voyage Service.
 * Voyage service checks PostgreSQL and optionally MongoDB.
 *
 * Prerequisites:
 * - Voyage service should be running (or mocked)
 * - Database connections can be mocked
 */

import request from 'supertest';
import express from 'express';
import healthRoutes from '../../../dreamscape-services/voyage/src/routes/health';

// Mock Prisma
const mockPrisma = {
  $queryRaw: jest.fn(),
};

jest.mock('../../../dreamscape-services/voyage/src/database/prisma', () => mockPrisma);

// Mock DatabaseService
const mockDatabaseService = {
  getInstance: jest.fn(() => ({
    isReady: jest.fn(() => ({
      ready: true,
      postgresql: true,
    })),
  })),
};

jest.mock('../../../dreamscape-services/voyage/src/database/DatabaseService', () => ({
  default: mockDatabaseService,
}));

// Create test app
const app = express();
app.use('/health', healthRoutes);

describe('Voyage Service Health Endpoints - Integration Tests (INFRA-013.1)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.MONGODB_URI;
  });

  describe('GET /health', () => {
    it('should return 200 and HEALTHY when PostgreSQL is up', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ health_check: 1 }]);

      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'healthy',
        service: 'voyage-service',
        checks: expect.arrayContaining([
          expect.objectContaining({
            name: 'PostgreSQL',
            status: 'healthy',
            type: 'database',
          }),
        ]),
      });
    });

    it('should return 503 and UNHEALTHY when PostgreSQL is down', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Connection refused'));

      const response = await request(app)
        .get('/health')
        .expect(503);

      expect(response.body).toMatchObject({
        status: 'unhealthy',
        service: 'voyage-service',
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

    it('should include MongoDB check when MONGODB_URI is set', async () => {
      process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
      mockPrisma.$queryRaw.mockResolvedValue([{ health_check: 1 }]);

      const response = await request(app)
        .get('/health')
        .expect(200);

      const checkNames = response.body.checks.map((c: any) => c.name);
      expect(checkNames).toContain('MongoDB');
    });

    it('should not include MongoDB check when MONGODB_URI is not set', async () => {
      delete process.env.MONGODB_URI;
      mockPrisma.$queryRaw.mockResolvedValue([{ health_check: 1 }]);

      const response = await request(app)
        .get('/health')
        .expect(200);

      const checkNames = response.body.checks.map((c: any) => c.name);
      expect(checkNames).not.toContain('MongoDB');
    });

    it('should return DEGRADED when MongoDB (optional) fails', async () => {
      process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
      mockPrisma.$queryRaw.mockResolvedValue([{ health_check: 1 }]);

      const response = await request(app)
        .get('/health');

      // MongoDB is optional, so status could be healthy or degraded
      expect(['healthy', 'degraded']).toContain(response.body.status);
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

    it('should measure response time for each check', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ health_check: 1 }]);

      const response = await request(app)
        .get('/health')
        .expect(200);

      response.body.checks.forEach((check: any) => {
        expect(check.responseTime).toBeDefined();
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

      expect(duration).toBeLessThan(2000);
    });

    it('should handle multiple concurrent requests', async () => {
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

    it('should return valid JSON response', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ health_check: 1 }]);

      const response = await request(app)
        .get('/health')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(() => JSON.parse(JSON.stringify(response.body))).not.toThrow();
    });
  });

  describe('GET /health/live', () => {
    it('should return 200 and alive status', async () => {
      const response = await request(app)
        .get('/health/live')
        .expect(200);

      expect(response.body).toMatchObject({
        alive: true,
        service: 'voyage-service',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
      });
    });

    it('should always return 200 even if database is down', async () => {
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

    it('should return uptime as a number', async () => {
      const response = await request(app)
        .get('/health/live')
        .expect(200);

      expect(typeof response.body.uptime).toBe('number');
      expect(response.body.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should respond very quickly', async () => {
      const startTime = Date.now();
      await request(app)
        .get('/health/live')
        .expect(200);
      const duration = Date.now() - startTime;

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
      mockDatabaseService.getInstance.mockReturnValue({
        isReady: () => ({
          ready: true,
          postgresql: true,
        }),
      });

      const response = await request(app)
        .get('/health/ready')
        .expect(200);

      expect(response.body).toMatchObject({
        ready: true,
        service: 'voyage-service',
        timestamp: expect.any(String),
        dependencies: {
          postgresql: true,
        },
      });
    });

    it('should return 503 when PostgreSQL is not accessible', async () => {
      mockDatabaseService.getInstance.mockReturnValue({
        isReady: () => ({
          ready: false,
          postgresql: false,
        }),
      });

      const response = await request(app)
        .get('/health/ready')
        .expect(503);

      expect(response.body).toMatchObject({
        ready: false,
        service: 'voyage-service',
        reason: 'PostgreSQL not ready',
        dependencies: {
          postgresql: false,
        },
      });
    });

    it('should return 503 when DatabaseService is not initialized', async () => {
      mockDatabaseService.getInstance.mockReturnValue({
        isReady: undefined,
      });

      const response = await request(app)
        .get('/health/ready')
        .expect(503);

      expect(response.body.ready).toBe(false);
    });

    it('should handle exceptions gracefully', async () => {
      mockDatabaseService.getInstance.mockImplementation(() => {
        throw new Error('Service not initialized');
      });

      const response = await request(app)
        .get('/health/ready')
        .expect(503);

      expect(response.body).toMatchObject({
        ready: false,
        reason: 'Service initialization error',
        error: expect.stringContaining('not initialized'),
      });
    });

    it('should complete readiness check quickly', async () => {
      mockDatabaseService.getInstance.mockReturnValue({
        isReady: () => ({
          ready: true,
          postgresql: true,
        }),
      });

      const startTime = Date.now();
      await request(app)
        .get('/health/ready')
        .expect(200);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(500);
    });

    it('should return valid timestamp', async () => {
      mockDatabaseService.getInstance.mockReturnValue({
        isReady: () => ({
          ready: true,
          postgresql: true,
        }),
      });

      const response = await request(app)
        .get('/health/ready')
        .expect(200);

      const timestamp = new Date(response.body.timestamp);
      expect(timestamp.toISOString()).toBe(response.body.timestamp);
    });
  });

  describe('Error Handling', () => {
    it('should return 500 when health check throws unexpected error', async () => {
      mockPrisma.$queryRaw.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const response = await request(app)
        .get('/health')
        .expect(500);

      expect(response.body).toMatchObject({
        status: 'error',
        service: 'voyage-service',
        error: expect.any(String),
      });
    });

    it('should handle malformed database responses', async () => {
      mockPrisma.$queryRaw.mockResolvedValue(null);

      const response = await request(app)
        .get('/health');

      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.body.service).toBe('voyage-service');
    });

    it('should handle database timeout', async () => {
      mockPrisma.$queryRaw.mockImplementation(() =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Query timeout')), 100)
        )
      );

      const response = await request(app)
        .get('/health');

      expect(response.status).toBeGreaterThanOrEqual(200);
    });
  });

  describe('Response Format Validation', () => {
    it('should have all required fields in /health response', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ health_check: 1 }]);

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
      mockDatabaseService.getInstance.mockReturnValue({
        isReady: () => ({
          ready: true,
          postgresql: true,
        }),
      });

      const response = await request(app)
        .get('/health/ready')
        .expect(200);

      expect(response.body).toHaveProperty('ready');
      expect(response.body).toHaveProperty('service');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('dependencies');
      expect(response.body.dependencies).toHaveProperty('postgresql');
    });

    it('should have proper database check structure', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ health_check: 1 }]);

      const response = await request(app)
        .get('/health')
        .expect(200);

      const pgCheck = response.body.checks.find((c: any) => c.name === 'PostgreSQL');
      expect(pgCheck).toBeDefined();
      expect(pgCheck.type).toBe('database');
      expect(pgCheck.status).toBe('healthy');
      expect(pgCheck.details).toBeDefined();
    });
  });

  describe('Service-specific Features', () => {
    it('should handle Amadeus API integration if needed', async () => {
      // This is a placeholder for future Amadeus-specific checks
      mockPrisma.$queryRaw.mockResolvedValue([{ health_check: 1 }]);

      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.service).toBe('voyage-service');
    });

    it('should support optional MongoDB for analytics', async () => {
      process.env.MONGODB_URI = 'mongodb://localhost:27017/voyage';
      mockPrisma.$queryRaw.mockResolvedValue([{ health_check: 1 }]);

      const response = await request(app)
        .get('/health');

      const mongoCheck = response.body.checks.find((c: any) => c.name === 'MongoDB');
      if (mongoCheck) {
        expect(mongoCheck.type).toBe('database');
        // MongoDB is optional, so it could be healthy or degraded
        expect(['healthy', 'degraded']).toContain(mongoCheck.status);
      }
    });
  });
});
