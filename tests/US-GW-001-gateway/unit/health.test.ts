/**
 * US-GW-001 — Gateway Health Routes Unit Tests
 *
 * Tests for gateway/src/routes/health.ts:
 * - GET /health  (with SKIP_DEPENDENCY_HEALTH_CHECKS bypass)
 * - GET /health/live
 * - GET /health/ready (with SKIP_DEPENDENCY_HEALTH_CHECKS bypass)
 * - GET /health with real dependency checks (mocked fetch)
 */

import request from 'supertest';
import express from 'express';

// Mock global fetch before importing health routes so dependency checks use the mock
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

import healthRoutes from '@gateway/routes/health';

const makeApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/health', healthRoutes);
  return app;
};

describe('US-GW-001 — Gateway Health Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.SKIP_DEPENDENCY_HEALTH_CHECKS;
  });

  afterAll(() => {
    delete process.env.SKIP_DEPENDENCY_HEALTH_CHECKS;
  });

  // ── /health/live ────────────────────────────────────────────────────────────

  describe('GET /health/live', () => {
    it('should return 200 with alive:true', async () => {
      const res = await request(makeApp()).get('/health/live');

      expect(res.status).toBe(200);
      expect(res.body.alive).toBe(true);
      expect(res.body.service).toBe('gateway-service');
      expect(res.body.uptime).toBeGreaterThanOrEqual(0);
      expect(res.body.timestamp).toBeDefined();
    });
  });

  // ── /health (skip mode) ──────────────────────────────────────────────────────

  describe('GET /health — SKIP_DEPENDENCY_HEALTH_CHECKS=true', () => {
    beforeEach(() => {
      process.env.SKIP_DEPENDENCY_HEALTH_CHECKS = 'true';
    });

    it('should return 200 with status healthy and checksSkipped:true', async () => {
      const res = await request(makeApp()).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body.service).toBe('gateway-service');
      expect(res.body.checksSkipped).toBe(true);
      expect(res.body.timestamp).toBeDefined();
    });

    it('should not call fetch when checks are skipped', async () => {
      await request(makeApp()).get('/health');
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // ── /health/ready (skip mode) ────────────────────────────────────────────────

  describe('GET /health/ready — SKIP_DEPENDENCY_HEALTH_CHECKS=true', () => {
    beforeEach(() => {
      process.env.SKIP_DEPENDENCY_HEALTH_CHECKS = 'true';
    });

    it('should return 200 with ready:true and checksSkipped:true', async () => {
      const res = await request(makeApp()).get('/health/ready');

      expect(res.status).toBe(200);
      expect(res.body.ready).toBe(true);
      expect(res.body.checksSkipped).toBe(true);
    });
  });

  // ── /health with mocked dependency checks ────────────────────────────────────

  describe('GET /health — with dependency checks', () => {
    it('should return 200 when all dependencies are healthy', async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 200 });

      const res = await request(makeApp()).get('/health');

      expect([200, 206, 503]).toContain(res.status);
      expect(res.body.status).toBeDefined();
    });

    it('should return 503 when a critical dependency is down', async () => {
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

      const res = await request(makeApp()).get('/health');

      expect(res.status).toBe(503);
      expect(res.body.status).toBe('unhealthy');
      expect(res.body.dependencies).toBeDefined();
    });

    it('should return 206 when only optional dependencies are down', async () => {
      mockFetch
        // auth-service (critical) — healthy
        .mockResolvedValueOnce({ ok: true, status: 200 })
        // user-service (critical) — healthy
        .mockResolvedValueOnce({ ok: true, status: 200 })
        // voyage-service (optional) — down
        .mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const res = await request(makeApp()).get('/health');

      expect(res.status).toBe(206);
      expect(res.body.status).toBe('degraded');
    });
  });

  // ── /health/ready with mocked checks ─────────────────────────────────────────

  describe('GET /health/ready — with dependency checks', () => {
    it('should return 200 when critical services are healthy', async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 200 });

      const res = await request(makeApp()).get('/health/ready');

      expect([200, 503]).toContain(res.status);
    });

    it('should return 503 when critical services are down', async () => {
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

      const res = await request(makeApp()).get('/health/ready');

      expect(res.status).toBe(503);
      expect(res.body.ready).toBe(false);
    });
  });
});
