/// <reference types="jest" />
/**
 * Gateway Service Health Endpoints Integration Tests - INFRA-013.1
 *
 * These tests verify the health check endpoints of the Gateway Service.
 * Gateway checks the health of downstream services (Auth, User, Voyage, AI).
 *
 * Prerequisites:
 * - Docker must be running
 * - Services should be accessible (handled by jest.setup.realdb.ts)
 *
 * Run with: npm run test:health:realdb
 */

import request from 'supertest';
import express from 'express';
import healthRoutes from '../../../dreamscape-frontend/gateway/src/routes/health';

// NO MOCKS - Using real service connections

// Create test app
const app = express();
// @ts-expect-error - Express Router is compatible with app.use(), TypeScript types issue
app.use('/health', healthRoutes);

describe('Gateway Service Health Endpoints - Integration Tests with Real Services (INFRA-013.1)', () => {
  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health');

      // Gateway might be healthy or degraded depending on downstream services
      expect([200, 206, 503]).toContain(response.status);
      expect(response.body).toMatchObject({
        service: 'gateway-service',
        version: expect.any(String),
        checks: expect.any(Array),
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
      });
    });

    it('should complete health check within reasonable time', async () => {
      const startTime = Date.now();
      await request(app)
        .get('/health');
      const duration = Date.now() - startTime;

      // Health check with real services should complete within 10 seconds
      expect(duration).toBeLessThan(10000);
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

    it('should respond very quickly (liveness check)', async () => {
      const startTime = Date.now();
      await request(app)
        .get('/health/live')
        .expect(200);
      const duration = Date.now() - startTime;

      // Liveness check should be very fast (< 200ms)
      expect(duration).toBeLessThan(200);
    });
  });

  describe('GET /health/ready', () => {
    it('should return readiness status', async () => {
      const response = await request(app)
        .get('/health/ready');

      // Gateway might be ready or not depending on downstream services
      expect([200, 503]).toContain(response.status);
      expect(response.body).toMatchObject({
        service: 'gateway-service',
        timestamp: expect.any(String),
      });

      expect(response.body.dependencies).toBeDefined();
    });

    it('should complete readiness check quickly', async () => {
      const startTime = Date.now();
      await request(app)
        .get('/health/ready');
      const duration = Date.now() - startTime;

      // Readiness check should be fast (< 5000ms with service checks)
      expect(duration).toBeLessThan(5000);
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
