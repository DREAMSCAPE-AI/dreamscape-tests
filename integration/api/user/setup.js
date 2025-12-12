const axios = require('axios');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

beforeAll(async () => {
  console.log('🚀 Setting up user integration tests...');

  const maxRetries = 10;
  const retryDelay = 1000;
  const baseServiceUrl = process.env.BASE_SERVICE_URL;
  const userServiceUrl = process.env.USER_SERVICE_URL;
  const authServiceUrl = process.env.AUTH_SERVICE_URL;

  // Wait for base service (if different from user service)
  if (baseServiceUrl && baseServiceUrl !== userServiceUrl) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        console.log('baseServiceUrl', baseServiceUrl);
        await axios.get(`${baseServiceUrl}/health`, { timeout: 5000 });
        console.log('✅ Base service is ready');
        break;
      } catch (error) {
        if (i === maxRetries - 1) {
          console.error('❌ Base service not available after max retries');
          throw new Error(`Base service not available at ${baseServiceUrl}`);
        }
        console.log(`⏳ Waiting for base service... (${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }

  // Wait for user service
  for (let i = 0; i < maxRetries; i++) {
    try {
      console.log('userServiceUrl', userServiceUrl);
      await axios.get(`${userServiceUrl}/health`, { timeout: 5000 });
      console.log('✅ User service is ready');
      break;
    } catch (error) {
      if (i === maxRetries - 1) {
        console.error('❌ User service not available after max retries');
        throw new Error(`User service not available at ${userServiceUrl}`);
      }
      console.log(`⏳ Waiting for user service... (${i + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }

  // Wait for auth service (needed for user creation)
  for (let i = 0; i < maxRetries; i++) {
    try {
      console.log('authServiceUrl', authServiceUrl);
      await axios.get(`${authServiceUrl}/health`, { timeout: 5000 });
      console.log('✅ Auth service is ready');
      break;
    } catch (error) {
      if (i === maxRetries - 1) {
        console.error('❌ Auth service not available after max retries');
        throw new Error(`Auth service not available at ${authServiceUrl}`);
      }
      console.log(`⏳ Waiting for auth service... (${i + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }

  // Reset test databases (optional - don't fail if endpoints don't exist)
  try {
    await axios.post(`${userServiceUrl}/api/v1/users/test/reset`);
    console.log('✅ User service test database reset');
  } catch (error) {
    console.warn('⚠️ User service reset endpoint not available, continuing without reset...');
  }

  try {
    await axios.post(`${authServiceUrl}/api/v1/auth/test/reset`);
    console.log('✅ Auth service test database reset');
  } catch (error) {
    console.warn('⚠️ Auth service reset endpoint not available, continuing without reset...');
  }

  // Ensure uploads directory exists for avatar tests
  try {
    const fs = require('fs');
    const uploadDir = path.join(process.cwd(), 'uploads', 'avatars');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
      console.log('✅ Created uploads directory for avatar tests');
    }
  } catch (error) {
    console.warn('⚠️ Could not create uploads directory:', error.message);
  }
});

afterAll(async () => {
  console.log('🧹 Cleaning up user integration tests...');
  const userServiceUrl = process.env.USER_SERVICE_URL || 'http://localhost:3002';
  const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';

  try {
    await axios.post(`${userServiceUrl}/api/v1/users/test/cleanup`);
    console.log('✅ User test cleanup completed via user service');
  } catch (error) {
    console.warn('⚠️ User service cleanup endpoint not available:', error.message);
  }

  try {
    await axios.post(`${authServiceUrl}/api/v1/auth/test/cleanup`);
    console.log('✅ Auth test cleanup completed via auth service');
  } catch (error) {
    console.warn('⚠️ Auth service cleanup endpoint not available:', error.message);
  }

  // Clean up uploaded test files
  try {
    const fs = require('fs');
    const path = require('path');
    const uploadDir = path.join(process.cwd(), 'uploads', 'avatars');
    
    if (fs.existsSync(uploadDir)) {
      const files = fs.readdirSync(uploadDir);
      for (const file of files) {
        if (file.startsWith('test-') || /^\d+-\d+\.(png|jpg|jpeg|webp)$/.test(file)) {
          fs.unlinkSync(path.join(uploadDir, file));
        }
      }
      console.log('✅ Cleaned up test avatar files');
    }
  } catch (error) {
    console.warn('⚠️ Could not clean up avatar files:', error.message);
  }
});

jest.setTimeout(30000);

process.on('unhandledRejection', (reason, promise) => {
  console.log('Unhandled Rejection at:', promise, 'reason:', reason);
});