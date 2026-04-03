/**
 * Health Routes Unit Tests
 * DR-567: US-TEST-030
 *
 * Tests: GET /health, /health/live, /health/ready,
 * SKIP_DEPENDENCY_HEALTH_CHECKS, critical vs optional failures.
 */

import express from 'express';
import request from 'supertest';
import healthRoutes from '../../../../dreamscape-frontend/gateway/src/routes/health';

const originalFetch = global.fetch;

function createTestApp() {
  const app = express();
  app.use('/health', healthRoutes);
  return app;
}

describe('Health Routes (DR-567)', () => {
  let app: express.Express;

  beforeEach(() => {
    app = createTestApp();
    delete process.env.SKIP_DEPENDENCY_HEALTH_CHECKS;
    delete process.env.AI_SERVICE_URL;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  // --- /health/live ---

  describe('GET /health/live', () => {
    it('should return alive status', async () => {
      const res = await request(app).get('/health/live');

      expect(res.status).toBe(200);
      expect(res.body.alive).toBe(true);
      expect(res.body.service).toBe('gateway-service');
      expect(res.body.timestamp).toBeDefined();
      expect(res.body.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  // --- /health with SKIP ---

  describe('GET /health (SKIP_DEPENDENCY_HEALTH_CHECKS)', () => {
    it('should skip checks and return healthy', async () => {
      process.env.SKIP_DEPENDENCY_HEALTH_CHECKS = 'true';

      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body.checksSkipped).toBe(true);
      expect(res.body.reason).toBe('SKIP_DEPENDENCY_HEALTH_CHECKS=true');
      expect(res.body.dependencies).toBeUndefined();
    });
  });

  // --- /health with dependency checks ---

  describe('GET /health (dependency checks)', () => {
    it('should return healthy when all deps are up', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 }) as jest.Mock;

      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body.dependencies).toBeDefined();
      expect(res.body.dependencies.length).toBeGreaterThanOrEqual(3);
      res.body.dependencies.forEach((dep: any) => {
        expect(dep.healthy).toBe(true);
      });
    });

    it('should return unhealthy (503) when critical dep is down', async () => {
      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes('3001')) return Promise.reject(new Error('Connection refused'));
        return Promise.resolve({ ok: true, status: 200 });
      }) as jest.Mock;

      const res = await request(app).get('/health');

      expect(res.status).toBe(503);
      expect(res.body.status).toBe('unhealthy');
    });

    it('should return degraded (206) when optional dep is down', async () => {
      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes('3003')) return Promise.reject(new Error('Connection refused'));
        return Promise.resolve({ ok: true, status: 200 });
      }) as jest.Mock;

      const res = await request(app).get('/health');

      expect(res.status).toBe(206);
      expect(res.body.status).toBe('degraded');
    });

    it('should include AI service when AI_SERVICE_URL is set', async () => {
      process.env.AI_SERVICE_URL = 'http://localhost:3005';
      global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 }) as jest.Mock;

      const res = await request(app).get('/health');

      const aiDep = res.body.dependencies.find((d: any) => d.name === 'ai-service');
      expect(aiDep).toBeDefined();
      expect(aiDep.critical).toBe(false);
    });

    it('should not include AI service when AI_SERVICE_URL is unset', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 }) as jest.Mock;

      const res = await request(app).get('/health');

      const aiDep = res.body.dependencies.find((d: any) => d.name === 'ai-service');
      expect(aiDep).toBeUndefined();
    });

    it('should report HTTP error for non-ok response', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 }) as jest.Mock;

      const res = await request(app).get('/health');

      expect(res.body.dependencies[0].healthy).toBe(false);
      expect(res.body.dependencies[0].error).toBe('HTTP 503');
      expect(res.body.dependencies[0].statusCode).toBe(503);
    });

    it('should report error string when fetch rejects', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) as jest.Mock;

      const res = await request(app).get('/health');

      expect(res.body.dependencies[0].healthy).toBe(false);
      expect(res.body.dependencies[0].error).toBe('ECONNREFUSED');
    });

    it('should measure response time for each dependency', async () => {
      global.fetch = jest.fn().mockImplementation(() =>
        new Promise((resolve) => setTimeout(() => resolve({ ok: true, status: 200 }), 10))
      ) as jest.Mock;

      const res = await request(app).get('/health');

      res.body.dependencies.forEach((dep: any) => {
        expect(dep.responseTimeMs).toBeGreaterThanOrEqual(0);
      });
    });
  });

  // --- /health/ready ---

  describe('GET /health/ready', () => {
    it('should skip checks when env is set', async () => {
      process.env.SKIP_DEPENDENCY_HEALTH_CHECKS = 'true';

      const res = await request(app).get('/health/ready');

      expect(res.status).toBe(200);
      expect(res.body.ready).toBe(true);
      expect(res.body.checksSkipped).toBe(true);
    });

    it('should return ready when all critical deps are healthy', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 }) as jest.Mock;

      const res = await request(app).get('/health/ready');

      expect(res.status).toBe(200);
      expect(res.body.ready).toBe(true);
    });

    it('should return not ready (503) when critical dep is down', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Connection refused')) as jest.Mock;

      const res = await request(app).get('/health/ready');

      expect(res.status).toBe(503);
      expect(res.body.ready).toBe(false);
    });

    it('should only check critical dependencies', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 }) as jest.Mock;

      const res = await request(app).get('/health/ready');

      res.body.dependencies.forEach((dep: any) => {
        expect(dep.critical).toBe(true);
      });
    });

    it('should handle unexpected rejection gracefully', async () => {
      global.fetch = jest.fn().mockImplementation(() => {
        throw new Error('Unexpected crash');
      }) as jest.Mock;

      const res = await request(app).get('/health/ready');

      expect(res.status).toBe(503);
      expect(res.body.ready).toBe(false);
    });
  });
});
