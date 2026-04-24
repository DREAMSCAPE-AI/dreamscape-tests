const axios = require('axios');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

function isValidHttpUrl(s) {
  try { const u = new URL(s); return u.protocol === 'http:' || u.protocol === 'https:'; }
  catch { return false; }
}

async function waitForService(name, url, retries = 10, delay = 1000, headers = {}) {
  if (!isValidHttpUrl(url)) {
    console.warn(`⚠️ ${name} URL is missing or invalid (${JSON.stringify(url)}) — skipping readiness check`);
    return;
  }
  for (let i = 0; i < retries; i++) {
    try {
      await axios.get(`${url}/health`, { timeout: 5000, headers, validateStatus: s => s < 500 });
      console.log(`✅ ${name} is ready`);
      return;
    } catch {
      if (i === retries - 1) {
        console.warn(`⚠️ ${name} not reachable at ${url} — continuing; tests will handle unavailability`);
        return;
      }
      console.log(`⏳ Waiting for ${name}... (${i + 1}/${retries})`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

beforeAll(async () => {
  console.log('🚀 Setting up user integration tests...');

  const baseServiceUrl = process.env.BASE_SERVICE_URL;
  const userServiceUrl = process.env.USER_SERVICE_URL;
  const authServiceUrl = process.env.AUTH_SERVICE_URL;
  const rateLimitBypassHeaders = { 'x-test-rate-limit': 'true' };

  if (baseServiceUrl && baseServiceUrl !== userServiceUrl) {
    await waitForService('Base service', baseServiceUrl, 10, 1000, rateLimitBypassHeaders);
  }
  await waitForService('User service', userServiceUrl, 10, 1000, rateLimitBypassHeaders);
  await waitForService('Auth service', authServiceUrl, 10, 1000, rateLimitBypassHeaders);

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