const axios = require('axios');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

beforeAll(async () => {
  console.log('🚀 Setting up AI service integration tests...');

  const maxRetries = 10;
  const retryDelay = 1000;
  const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:3005';
  const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';

  for (let i = 0; i < maxRetries; i++) {
    try {
      await axios.get(`${aiServiceUrl}/health`, { timeout: 5000, validateStatus: s => s < 500 });
      console.log('✅ AI service is ready');
      break;
    } catch (error) {
      if (i === maxRetries - 1) {
        console.warn('⚠️ AI service not available, tests may fail');
        return;
      }
      console.log(`⏳ Waiting for AI service... (${i + 1}/${maxRetries})`);
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

  try {
    await axios.post(`${aiServiceUrl}/api/v1/ai/test/reset`);
    console.log('✅ AI service test reset');
  } catch {
    console.warn('⚠️ AI reset endpoint not available, continuing...');
  }
});

afterAll(async () => {
  console.log('🧹 Cleaning up AI integration tests...');
  const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:3005';
  const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';

  try {
    await axios.post(`${aiServiceUrl}/api/v1/ai/test/cleanup`);
    console.log('✅ AI test cleanup completed');
  } catch (error) {
    console.warn('⚠️ AI cleanup endpoint not available:', error.message);
  }

  try {
    await axios.post(`${authServiceUrl}/api/v1/auth/test/cleanup`);
  } catch {}
});

jest.setTimeout(30000);

process.on('unhandledRejection', (reason, promise) => {
  console.log('Unhandled Rejection at:', promise, 'reason:', reason);
});
