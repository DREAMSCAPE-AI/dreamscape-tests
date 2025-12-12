/// <reference types="jest" />
/**
 * Auth Service - REAL HTTP SERVER Tests
 * Prerequisites: Auth service MUST be running on port 3001
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:3001';

describe('Auth Service - Real HTTP Server Tests', () => {
  describe('GET /health', () => {
    it('should return 200 and healthy status', async () => {
      const response = await axios.get(`${BASE_URL}/api/health`);

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('healthy');
      expect(response.data.service).toBe('auth-service');
    });
  });

  describe('GET /metrics', () => {
    it('should return Prometheus metrics', async () => {
      const response = await axios.get(`${BASE_URL}/metrics`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/plain');
      expect(response.data).toContain('dreamscape_auth');
    });
  });
});
