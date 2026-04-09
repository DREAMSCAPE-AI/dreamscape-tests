const axios = require('axios');

module.exports = async () => {
  const paymentServiceUrl = process.env.PAYMENT_SERVICE_URL || 'http://localhost:3004';
  try {
    console.log('🧹 Global teardown for payment tests...');
    await axios.post(`${paymentServiceUrl}/api/v1/payment/test/cleanup`);
    console.log('✅ Global payment teardown completed');
  } catch (error) {
    console.warn('⚠️ Global teardown error:', error.message);
  }
};
