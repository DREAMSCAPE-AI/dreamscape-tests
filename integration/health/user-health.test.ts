/**
 * User Service Health Endpoints Integration Tests - INFRA-013.1
 *
 * These tests verify the health check endpoints of the User Service.
 * They test with REAL DATABASE connections (PostgreSQL).
 *
 * Prerequisites:
 * - Docker must be running
 * - PostgreSQL container must be started (handled by jest.setup.realdb.ts)
 *
 * Run with: npm run test:health:realdb
 */

import request from 'supertest';
import express from 'express';
import healthRoutes from '../../../dreamscape-services/user/src/routes/health';

// NO MOCKS - Using real database connections
// PostgreSQL is started by jest.setup.realdb.ts

// Create test app
const app = express();
app.use('/health', healthRoutes);

describe('User Service Health Endpoints - Integration Tests with Real DB (INFRA-013.1)', () => {
  describe('GET /health', () => {
    it('should return 200 and HEALTHY status with real database connection', async () => {
      const response = await request(app)
        .get('/health');

      // Should be healthy since PostgreSQL is running
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'healthy',
        service: 'user-service',
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

    it('should include metadata in response', async () => {
      const response = await request(app)
        .get('/health');

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
      const response = await request(app)
        .get('/health');

      expect(response.body.checks).toBeInstanceOf(Array);
      response.body.checks.forEach((check: any) => {
        expect(check.responseTime).toBeDefined();
        expect(typeof check.responseTime).toBe('number');
        expect(check.responseTime).toBeGreaterThanOrEqual(0);
      });
    });

    it('should complete health check within reasonable time', async () => {
      const startTime = Date.now();
      await request(app)
        .get('/health');
      const duration = Date.now() - startTime;

      // Health check with real DB should complete within 5 seconds
      expect(duration).toBeLessThan(5000);
    });

    it('should return valid JSON response', async () => {
      const response = await request(app)
        .get('/health')
        .expect('Content-Type', /json/);

      expect(() => JSON.parse(JSON.stringify(response.body))).not.toThrow();
    });

    it('should handle multiple concurrent requests correctly', async () => {
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
        service: 'user-service',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
      });
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

      // Liveness check should be very fast (< 200ms with real services)
      expect(duration).toBeLessThan(200);
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

      // Should be ready since PostgreSQL is running
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        ready: true,
        service: 'user-service',
        timestamp: expect.any(String),
      });

      expect(response.body.dependencies).toBeDefined();
    });

    it('should complete readiness check quickly', async () => {
      const startTime = Date.now();
      await request(app)
        .get('/health/ready');
      const duration = Date.now() - startTime;

      // Readiness check should be fast (< 1000ms with real DB check)
      expect(duration).toBeLessThan(1000);
    });

    it('should return valid timestamp', async () => {
      const response = await request(app)
        .get('/health/ready');

      const timestamp = new Date(response.body.timestamp);
      expect(timestamp.toISOString()).toBe(response.body.timestamp);
    });
  });

  describe('Response Format Validation', () => {
    it('should have all required fields in /health response', async () => {
      const response = await request(app)
        .get('/health');

      // Required fields
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('service');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('checks');
      expect(response.body).toHaveProperty('metadata');

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
