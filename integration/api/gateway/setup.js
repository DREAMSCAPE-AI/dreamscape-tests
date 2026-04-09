const axios = require('axios');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

beforeAll(async () => {
  console.log('🚀 Setting up gateway integration tests...');

  const maxRetries = 10;
  const retryDelay = 1000;
  const gatewayUrl = process.env.GATEWAY_URL || 'http://localhost:4000';
  const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';

  for (let i = 0; i < maxRetries; i++) {
    try {
      await axios.get(`${gatewayUrl}/health`, { timeout: 5000, validateStatus: s => s < 500 });
      console.log('✅ Gateway is ready');
      break;
    } catch (error) {
      if (i === maxRetries - 1) {
        console.warn('⚠️ Gateway not available, tests may fail');
        return;
      }
      console.log(`⏳ Waiting for gateway... (${i + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }

  for (let i = 0; i < maxRetries; i++) {
    try {
      await axios.get(`${authServiceUrl}/health`, { timeout: 5000, validateStatus: s => s < 500 });
      console.log('✅ Auth service is ready');
      break;
    } catch (error) {
      if (i === maxRetries - 1) {
        console.warn('⚠️ Auth service not available');
        return;
      }
      console.log(`⏳ Waiting for auth service... (${i + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
});

afterAll(async () => {
  console.log('🧹 Cleaning up gateway integration tests...');
  const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
  try {
    await axios.post(`${authServiceUrl}/api/v1/auth/test/cleanup`);
  } catch {}
});

jest.setTimeout(30000);

process.on('unhandledRejection', (reason, promise) => {
  console.log('Unhandled Rejection at:', promise, 'reason:', reason);
});
