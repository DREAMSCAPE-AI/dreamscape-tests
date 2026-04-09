const axios = require('axios');

module.exports = async () => {
  const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:3005';
  try {
    console.log('🧹 Global teardown for AI tests...');
    await axios.post(`${aiServiceUrl}/api/v1/ai/test/cleanup`);
    console.log('✅ Global AI teardown completed');
  } catch (error) {
    console.warn('⚠️ Global teardown error:', error.message);
  }
};
