/**
 * US-GW-001 — Gateway VR Sessions Routes Unit Tests
 *
 * Tests for gateway/src/routes/vr-sessions.ts:
 * - POST /sessions  (create with destination)
 * - GET  /sessions/:pin (validate PIN)
 * - PIN expiration and used-PIN rejection
 */

import request from 'supertest';
import express from 'express';
import vrSessionRoutes, { sessions, SESSION_TTL_MS } from '@gateway/routes/vr-sessions';

const makeApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/vr', vrSessionRoutes);
  return app;
};

describe('US-GW-001 — VR Session Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    sessions.clear();
    app = makeApp();
  });

  // ── POST /sessions ───────────────────────────────────────────────────────────

  describe('POST /api/v1/vr/sessions', () => {
    it('should create a session and return a 6-digit PIN', async () => {
      const res = await request(app)
        .post('/api/v1/vr/sessions')
        .send({ destination: 'Paris' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.pin).toMatch(/^\d{6}$/);
      expect(res.body.data.destination).toBe('paris');
      expect(res.body.data.expiresAt).toBeGreaterThan(Date.now());
    });

    it('should normalise destination to lowercase', async () => {
      const res = await request(app)
        .post('/api/v1/vr/sessions')
        .send({ destination: 'TOKYO' });

      expect(res.status).toBe(201);
      expect(res.body.data.destination).toBe('tokyo');
    });

    it('should store the session in the sessions map', async () => {
      const res = await request(app)
        .post('/api/v1/vr/sessions')
        .send({ destination: 'rome' });

      const { pin } = res.body.data;
      expect(sessions.has(pin)).toBe(true);
      expect(sessions.get(pin)?.destination).toBe('rome');
    });

    it('should return 400 when destination is missing', async () => {
      const res = await request(app)
        .post('/api/v1/vr/sessions')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/destination/i);
    });

    it('should return 400 when destination is not a string', async () => {
      const res = await request(app)
        .post('/api/v1/vr/sessions')
        .send({ destination: 42 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should generate unique PINs for concurrent sessions', async () => {
      const results = await Promise.all([
        request(app).post('/api/v1/vr/sessions').send({ destination: 'a' }),
        request(app).post('/api/v1/vr/sessions').send({ destination: 'b' }),
        request(app).post('/api/v1/vr/sessions').send({ destination: 'c' }),
      ]);
      const pins = results.map(r => r.body.data.pin);
      const unique = new Set(pins);
      expect(unique.size).toBe(3);
    });
  });

  // ── GET /sessions/:pin ───────────────────────────────────────────────────────

  describe('GET /api/v1/vr/sessions/:pin', () => {
    it('should validate an existing PIN and return destination + autoVR', async () => {
      const createRes = await request(app)
        .post('/api/v1/vr/sessions')
        .send({ destination: 'london' });

      const { pin } = createRes.body.data;
      const res = await request(app).get(`/api/v1/vr/sessions/${pin}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.destination).toBe('london');
      expect(res.body.data.autoVR).toBe(true);
    });

    it('should mark the session as used after validation', async () => {
      const createRes = await request(app)
        .post('/api/v1/vr/sessions')
        .send({ destination: 'berlin' });

      const { pin } = createRes.body.data;
      await request(app).get(`/api/v1/vr/sessions/${pin}`);

      expect(sessions.get(pin)?.used).toBe(true);
    });

    it('should return 400 for a non-numeric PIN', async () => {
      const res = await request(app).get('/api/v1/vr/sessions/abcdef');
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 for a PIN shorter than 6 digits', async () => {
      const res = await request(app).get('/api/v1/vr/sessions/12345');
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 for a PIN longer than 6 digits', async () => {
      const res = await request(app).get('/api/v1/vr/sessions/1234567');
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 404 for a non-existent PIN', async () => {
      const res = await request(app).get('/api/v1/vr/sessions/999999');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should return 409 when PIN has already been used', async () => {
      const createRes = await request(app)
        .post('/api/v1/vr/sessions')
        .send({ destination: 'sydney' });

      const { pin } = createRes.body.data;

      await request(app).get(`/api/v1/vr/sessions/${pin}`); // first use
      const res = await request(app).get(`/api/v1/vr/sessions/${pin}`); // second use

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/already been used/i);
    });

    it('should return 410 when PIN has expired', async () => {
      const pin = '555555';
      sessions.set(pin, {
        pin,
        destination: 'dubai',
        createdAt: Date.now() - SESSION_TTL_MS - 1000,
        expiresAt: Date.now() - 1000,
        used: false,
      });

      const res = await request(app).get(`/api/v1/vr/sessions/${pin}`);

      expect(res.status).toBe(410);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/expired/i);
    });

    it('should remove expired session from store after 410', async () => {
      const pin = '444444';
      sessions.set(pin, {
        pin,
        destination: 'cairo',
        createdAt: Date.now() - SESSION_TTL_MS - 1000,
        expiresAt: Date.now() - 1000,
        used: false,
      });

      await request(app).get(`/api/v1/vr/sessions/${pin}`);

      expect(sessions.has(pin)).toBe(false);
    });
  });
});
