const request = require('supertest');

describe('API Integration Test', () => {
  it('should return 200 for the health endpoint', async () => {
    const response = await request('http://localhost:3000').get('/health');
    expect(response.status).toBe(200);
  });
});
