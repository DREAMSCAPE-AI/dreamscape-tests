const axios = require('axios');

module.exports = async () => {
  const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
  try {
    console.log('🧹 Global teardown for gateway tests...');
    await axios.post(`${authServiceUrl}/api/v1/auth/test/cleanup`);
    console.log('✅ Global gateway teardown completed');
  } catch (error) {
    console.warn('⚠️ Global teardown error:', error.message);
  }
};
