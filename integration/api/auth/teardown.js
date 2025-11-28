const axios = require('axios');

module.exports = async () => {
  const authServiceUrl = process.env.AUTH_SERVICE_URL;

  try {
    console.log('🧹 Global teardown for auth tests...');
    await axios.post(`${authServiceUrl}/test/cleanup`);
    console.log('✅ Global auth teardown completed via auth service');
  } catch (error) {
    console.error('⚠️ Global teardown error:', error.message);
  }
};