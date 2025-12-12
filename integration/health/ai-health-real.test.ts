/// <reference types="jest" />
/**
 * AI Service - REAL HTTP SERVER Tests
 * Prerequisites: AI service MUST be running on port 3004
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:3004';

describe('AI Service - Real HTTP Server Tests', () => {
  describe('GET /health', () => {
    it('should return 200 and ok status', async () => {
      const response = await axios.get(`${BASE_URL}/health`);

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('ok');
      expect(response.data.service).toBe('ai-service');
    });
  });
});
