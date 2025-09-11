const axios = require('axios');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

beforeAll(async () => {
  console.log('🚀 Setting up auth integration tests...');

  const maxRetries = 10;
  const retryDelay = 1000;
  const serverUrl = process.env.BASE_SERVICE_URL;
  const authServiceUrl = process.env.AUTH_SERVICE_URL;

  for (let i = 0; i < maxRetries; i++) {
    try {
      console.log('serverUrl', serverUrl);
      await axios.get(`${serverUrl}/health`, { timeout: 5000 });
      console.log('✅ Auth service is ready');
      break;
    } catch (error) {
      if (i === maxRetries - 1) {
        console.error('❌ Auth service not available after max retries');
        throw new Error(`Auth service not available at ${serverUrl}`);
      }
      console.log(`⏳ Waiting for auth service... (${i + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }

  try {
    await axios.post(`${authServiceUrl}/test/reset`);
    console.log('✅ Test database reset via auth service');
  } catch (error) {
    console.error('❌ Failed to reset test database:', error.message);
    throw error;
  }
});

afterAll(async () => {
  console.log('🧹 Cleaning up auth integration tests...');
  const authServiceUrl = process.env.AUTH_SERVICE_URL;

  try {
    console.log('authServiceUrl', authServiceUrl);
    await axios.post(`${authServiceUrl}/test/cleanup`);
    console.log('✅ Auth test cleanup completed via auth service');
  } catch (error) {
    console.error('⚠️ Cleanup error:', error.message);
  }
});

jest.setTimeout(30000);

process.on('unhandledRejection', (reason, promise) => {
  console.log('Unhandled Rejection at:', promise, 'reason:', reason);
});