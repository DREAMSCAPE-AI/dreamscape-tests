const axios = require('axios');

module.exports = async () => {
  const voyageServiceUrl = process.env.VOYAGE_SERVICE_URL || 'http://localhost:3003';
  try {
    console.log('🧹 Global teardown for voyage tests...');
    await axios.post(`${voyageServiceUrl}/api/v1/voyage/test/cleanup`);
    console.log('✅ Global voyage teardown completed');
  } catch (error) {
    console.warn('⚠️ Global teardown error:', error.message);
  }
};
