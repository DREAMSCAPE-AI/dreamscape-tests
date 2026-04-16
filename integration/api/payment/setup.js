const axios = require('axios');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

beforeAll(async () => {
  console.log('🚀 Setting up payment integration tests...');

  const maxRetries = 10;
  const retryDelay = 1000;
  const paymentServiceUrl = process.env.PAYMENT_SERVICE_URL || 'http://localhost:3004';
  const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';

  for (let i = 0; i < maxRetries; i++) {
    try {
      await axios.get(`${paymentServiceUrl}/health`, { timeout: 5000, validateStatus: s => s < 500 });
      console.log('✅ Payment service is ready');
      break;
    } catch (error) {
      if (i === maxRetries - 1) {
        console.warn('⚠️ Payment service not available, tests may fail');
        return;
      }
      console.log(`⏳ Waiting for payment service... (${i + 1}/${maxRetries})`);
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
    await axios.post(`${paymentServiceUrl}/api/v1/payment/test/reset`);
    console.log('✅ Payment service test reset');
  } catch {
    console.warn('⚠️ Payment reset endpoint not available, continuing...');
  }
});

afterAll(async () => {
  console.log('🧹 Cleaning up payment integration tests...');
  const paymentServiceUrl = process.env.PAYMENT_SERVICE_URL || 'http://localhost:3004';
  const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';

  try {
    await axios.post(`${paymentServiceUrl}/api/v1/payment/test/cleanup`);
    console.log('✅ Payment test cleanup completed');
  } catch (error) {
    console.warn('⚠️ Payment cleanup endpoint not available:', error.message);
  }

  try {
    await axios.post(`${authServiceUrl}/api/v1/auth/test/cleanup`);
  } catch {}
});

jest.setTimeout(30000);

process.on('unhandledRejection', (reason, promise) => {
  console.log('Unhandled Rejection at:', promise, 'reason:', reason);
});
