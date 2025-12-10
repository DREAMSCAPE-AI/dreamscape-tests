const axios = require('axios');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

beforeAll(async () => {
  console.log('🚀 Setting up auth integration tests...');

  const maxRetries = 10;
  const retryDelay = 1000;
  const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';

  for (let i = 0; i < maxRetries; i++) {
    try {
      await axios.get(`${authServiceUrl}/health`, { timeout: 5000 });
      console.log('✅ Auth service is ready');
      break;
    } catch (error) {
      if (i === maxRetries - 1) {
        console.error('❌ Auth service not available after max retries');
        console.warn('⚠️ Skipping tests - Auth service is not running');
        return; // Don't throw, just skip tests
      }
      console.log(`⏳ Waiting for auth service... (${i + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }

  // Optional: Try to reset database, but don't fail if endpoint doesn't exist
  try {
    await axios.post(`${authServiceUrl}/api/v1/auth/test/reset`);
    console.log('✅ Test database reset via auth service');
  } catch (error) {
    console.warn('⚠️ Test reset endpoint not available, continuing without reset...');
  }
});

afterAll(async () => {
  console.log('🧹 Cleaning up auth integration tests...');
  const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';

  try {
    await axios.post(`${authServiceUrl}/api/v1/auth/test/cleanup`);
    console.log('✅ Auth test cleanup completed via auth service');
  } catch (error) {
    console.warn('⚠️ Cleanup endpoint not available:', error.message);
  }
});

jest.setTimeout(30000);

process.on('unhandledRejection', (reason, promise) => {
  console.log('Unhandled Rejection at:', promise, 'reason:', reason);
});