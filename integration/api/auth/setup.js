const axios = require('axios');

beforeAll(async () => {
  console.log('🚀 Setting up auth integration tests...');

  const maxRetries = 30;
  const retryDelay = 1000;
  const serverUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:3000';

  for (let i = 0; i < maxRetries; i++) {
    try {
      await axios.get(`${serverUrl}/health`, { timeout: 2000 });
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
    await axios.post(`${serverUrl}/api/v1/test/reset`);
    console.log('✅ Test database reset via auth service');
  } catch (error) {
    console.error('❌ Failed to reset test database:', error.message);
    throw error;
  }
});

afterAll(async () => {
  console.log('🧹 Cleaning up auth integration tests...');

  try {
    await axios.post(`${process.env.AUTH_SERVICE_URL || 'http://localhost:3000'}/api/v1/test/cleanup`);
    console.log('✅ Auth test cleanup completed via auth service');
  } catch (error) {
    console.error('⚠️ Cleanup error:', error.message);
  }
});

jest.setTimeout(30000);

process.on('unhandledRejection', (reason, promise) => {
  console.log('Unhandled Rejection at:', promise, 'reason:', reason);
});