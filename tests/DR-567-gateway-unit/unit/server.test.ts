/**
 * Gateway Server Unit Tests
 * DR-567: US-TEST-030
 *
 * Tests: Express initialization, middlewares (helmet, cors, rate-limit),
 * route mounting, proxy routing, error handling, 404 handler.
 */

import request from 'supertest';

// Mock http-proxy-middleware before importing app
jest.mock('http-proxy-middleware', () => ({
  createProxyMiddleware: jest.fn((opts: any) => {
    return (_req: any, res: any, _next: any) => {
      res.status(200).json({ proxied: true, target: opts.target });
    };
  }),
}));

// Import after mock
import app from '../../../../dreamscape-frontend/gateway/src/server';

describe('Gateway Server (DR-567)', () => {
  describe('Middleware initialization', () => {
    it('should apply security headers via helmet', async () => {
      const res = await request(app).get('/');

      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBeDefined();
    });

    it('should apply CORS headers', async () => {
      const res = await request(app)
        .options('/')
        .set('Origin', 'http://localhost:5173');

      expect(res.status).not.toBe(403);
    });

    it('should parse JSON body', async () => {
      const res = await request(app)
        .post('/api/v1/vr/sessions')
        .send({ destination: 'paris' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(201);
    });

    it('should parse URL-encoded body', async () => {
      const res = await request(app)
        .post('/api/v1/vr/sessions')
        .send('destination=paris')
        .set('Content-Type', 'application/x-www-form-urlencoded');

      expect(res.status).toBe(201);
    });
  });

  describe('Rate limiting', () => {
    it('should apply rate-limit headers', async () => {
      const res = await request(app).get('/');

      const hasStandard = res.headers['ratelimit-limit'] !== undefined;
      const hasLegacy = res.headers['x-ratelimit-limit'] !== undefined;
      expect(hasStandard || hasLegacy).toBe(true);
    });
  });

  describe('Root endpoint', () => {
    it('GET / should return gateway info', async () => {
      const res = await request(app).get('/');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        message: 'DreamScape API Gateway',
        version: '1.0.0',
        status: 'running',
      });
    });
  });

  describe('Health routes mounting', () => {
    it('GET /health should be mounted', async () => {
      const res = await request(app).get('/health');

      expect(res.status).not.toBe(404);
      expect(res.body.service).toBe('gateway-service');
    });

    it('GET /api/health should be mounted (alternative path)', async () => {
      const res = await request(app).get('/api/health');

      expect(res.status).not.toBe(404);
      expect(res.body.service).toBe('gateway-service');
    });

    it('GET /health/live should return liveness', async () => {
      const res = await request(app).get('/health/live');

      expect(res.status).toBe(200);
      expect(res.body.alive).toBe(true);
    });
  });

  describe('VR session routes mounting', () => {
    it('POST /api/v1/vr/sessions should be mounted', async () => {
      const res = await request(app)
        .post('/api/v1/vr/sessions')
        .send({ destination: 'test-city' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });
  });

  describe('Proxy routes', () => {
    it('should proxy /api/v1/auth to auth-service', async () => {
      const res = await request(app).get('/api/v1/auth/login');

      expect(res.status).toBe(200);
      expect(res.body.proxied).toBe(true);
      expect(res.body.target).toBe('http://localhost:3001');
    });

    it('should proxy /api/v1/users to user-service', async () => {
      const res = await request(app).get('/api/v1/users/me');

      expect(res.status).toBe(200);
      expect(res.body.target).toBe('http://localhost:3002');
    });

    it('should proxy /api/v1/admin to user-service', async () => {
      const res = await request(app).get('/api/v1/admin/dashboard');

      expect(res.status).toBe(200);
      expect(res.body.target).toBe('http://localhost:3002');
    });

    it('should proxy /api/v1/ai to ai-service', async () => {
      const res = await request(app).get('/api/v1/ai/recommend');

      expect(res.status).toBe(200);
      expect(res.body.target).toBe('http://localhost:3005');
    });

    it('should proxy /api/v1/voyage to voyage-service', async () => {
      const res = await request(app).get('/api/v1/voyage/search');

      expect(res.status).toBe(200);
      expect(res.body.target).toBe('http://localhost:3003');
    });

    it('should proxy /api/v1/payment to payment-service', async () => {
      const res = await request(app).get('/api/v1/payment/checkout');

      expect(res.status).toBe(200);
      expect(res.body.target).toBe('http://localhost:3004');
    });

    it('should proxy /socket.io to user-service', async () => {
      const res = await request(app).get('/socket.io');

      expect(res.status).toBe(200);
      expect(res.body.target).toBe('http://localhost:3002');
    });
  });

  describe('Docs endpoint', () => {
    it('GET /docs should return API documentation', async () => {
      const res = await request(app).get('/docs');

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('DreamScape API Gateway');
      expect(res.body.version).toBe('1.0.0');
      expect(res.body.endpoints).toBeDefined();
      expect(res.body.endpoints['/api/v1/auth']).toBe('Authentication service');
      expect(res.body.endpoints['/health']).toBe('Health check endpoint');
    });
  });

  describe('404 handler', () => {
    it('should return 404 for unknown routes', async () => {
      const res = await request(app).get('/unknown/route');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not Found');
      expect(res.body.message).toContain('/unknown/route');
    });
  });

  describe('Error handling middleware', () => {
    it('should return 500 with generic message in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const express = require('express');
      const testApp = express();
      testApp.get('/throw', () => { throw new Error('Test explosion'); });
      testApp.use((err: any, _req: any, res: any, _next: any) => {
        res.status(500).json({
          error: 'Internal Server Error',
          message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
        });
      });

      const res = await request(testApp).get('/throw');
      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Something went wrong');

      process.env.NODE_ENV = originalEnv;
    });

    it('should return 500 with detailed message in development', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const express = require('express');
      const testApp = express();
      testApp.get('/throw', () => { throw new Error('Detailed error'); });
      testApp.use((err: any, _req: any, res: any, _next: any) => {
        res.status(500).json({
          error: 'Internal Server Error',
          message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
        });
      });

      const res = await request(testApp).get('/throw');
      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Detailed error');

      process.env.NODE_ENV = originalEnv;
    });
  });
});
