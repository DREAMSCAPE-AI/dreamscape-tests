const axios = require('axios');

module.exports = async () => {
  const serverUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:3000';

  try {
    console.log('🧹 Global teardown for auth tests...');
    await axios.post(`${serverUrl}/api/v1/auth/test/cleanup`);
    console.log('✅ Global auth teardown completed via auth service');
  } catch (error) {
    console.error('⚠️ Global teardown error:', error.message);
  }
};