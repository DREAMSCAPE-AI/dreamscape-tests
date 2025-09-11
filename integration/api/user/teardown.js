const axios = require('axios');

module.exports = async () => {
  const userServiceUrl = process.env.USER_SERVICE_URL;
  const authServiceUrl = process.env.AUTH_SERVICE_URL;

  try {
    console.log('🧹 Global teardown for user tests...');
    
    // Cleanup user service
    await axios.post(`${userServiceUrl}/test/cleanup`);
    console.log('✅ Global user teardown completed via user service');
    
    // Cleanup auth service
    await axios.post(`${authServiceUrl}/test/cleanup`);
    console.log('✅ Global auth teardown completed via auth service');
    
  } catch (error) {
    console.error('⚠️ Global teardown error:', error.message);
  }

  // Final cleanup of avatar files
  try {
    const fs = require('fs');
    const path = require('path');
    const uploadDir = path.join(process.cwd(), 'uploads', 'avatars');
    
    if (fs.existsSync(uploadDir)) {
      const files = fs.readdirSync(uploadDir);
      for (const file of files) {
        if (file.includes('test') || /^\d+-\d+\.(png|jpg|jpeg|webp)$/.test(file)) {
          try {
            fs.unlinkSync(path.join(uploadDir, file));
          } catch (unlinkError) {
            console.warn(`Could not delete ${file}:`, unlinkError.message);
          }
        }
      }
      console.log('✅ Final cleanup of avatar files completed');
    }
  } catch (error) {
    console.warn('⚠️ Final avatar cleanup error:', error.message);
  }
};