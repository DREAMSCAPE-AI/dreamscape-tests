/// <reference types="jest" />
/**
 * Voyage Service Health Endpoints - REAL HTTP SERVER Tests
 *
 * Prerequisites:
 * - Voyage service MUST be running on port 3003
 * - PostgreSQL MUST be connected
 *
 * Run with: npm run test:health:realdb
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:3003';

describe('Voyage Service - Real HTTP Server Tests', () => {
  describe('GET /api/health', () => {
    it('should return 200 and healthy status', async () => {
      const response = await axios.get(`${BASE_URL}/api/health`);

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('healthy');
      expect(response.data.service).toBe('voyage-service');
    });
  });

  describe('GET /metrics', () => {
    it('should return Prometheus metrics', async () => {
      const response = await axios.get(`${BASE_URL}/metrics`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/plain');
      expect(response.data).toContain('dreamscape_voyage');
    });
  });
});
