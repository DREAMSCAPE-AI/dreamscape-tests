/// <reference types="jest" />
/**
 * All Services - REAL HTTP SERVER Tests - INFRA-013.1
 * Prerequisites: All services MUST be running on their respective ports
 * - Auth: 3001
 * - User: 3002
 * - Voyage: 3003
 * - AI: 3004
 * - Gateway: 3000
 */

import axios from 'axios';

const SERVICES = [
  { name: 'Auth', port: 3001, service: 'auth-service', metricsPrefix: 'dreamscape_auth' },
  { name: 'User', port: 3002, service: 'user-service', metricsPrefix: 'dreamscape_user' },
  { name: 'Voyage', port: 3003, service: 'voyage-service', metricsPrefix: 'http_requests_total' },
  { name: 'AI', port: 3004, service: 'ai-service', metricsPrefix: 'dreamscape_ai' },
  { name: 'Gateway', port: 3000, service: 'gateway-service', metricsPrefix: 'http_requests_total' },
];

describe('All Services - Health Check Tests - INFRA-013.1', () => {
  describe.each(SERVICES)('$name Service (Port $port)', ({ name, port, service, metricsPrefix }) => {
    const BASE_URL = `http://localhost:${port}`;

    describe('GET /health', () => {
      it('should return 200 and healthy status', async () => {
        const response = await axios.get(`${BASE_URL}/health`);

        expect(response.status).toBe(200);
        expect(response.data.status).toBe('healthy');
        expect(response.data.service).toBe(service);
      });
    });

    describe('GET /api/health', () => {
      it('should return 200 and healthy status', async () => {
        const response = await axios.get(`${BASE_URL}/api/health`);

        expect(response.status).toBe(200);
        expect(response.data.status).toBe('healthy');
        expect(response.data.service).toBe(service);
      });
    });

    describe('GET /health/live', () => {
      it('should return 200 and alive status', async () => {
        const response = await axios.get(`${BASE_URL}/health/live`);

        expect(response.status).toBe(200);
        expect(response.data.alive).toBe(true);
        expect(response.data.service).toBe(service);
      });
    });

    describe('GET /health/ready', () => {
      it('should return 200 and ready status', async () => {
        const response = await axios.get(`${BASE_URL}/health/ready`);

        expect(response.status).toBe(200);
        expect(response.data.ready).toBe(true);
        expect(response.data.service).toBe(service);
      });
    });

    describe('GET /metrics', () => {
      it('should return Prometheus metrics', async () => {
        const response = await axios.get(`${BASE_URL}/metrics`);

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toContain('text/plain');
        expect(response.data).toContain(metricsPrefix);
      });
    });
  });
});
