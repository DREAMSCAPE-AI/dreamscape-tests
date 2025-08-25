// Environment setup script for Dreamscape tests
const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up Dreamscape test environment...');

// Create necessary directories
const directories = [
  'coverage',
  'reports',
  'logs'
];

directories.forEach(dir => {
  const dirPath = path.join(__dirname, '../..', dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`✅ Created directory: ${dir}`);
  }
});

// Setup environment variables for testing
const testEnv = {
  NODE_ENV: 'test',
  TEST_DATABASE_URL: process.env.TEST_DATABASE_URL || 'mongodb://localhost:27017/dreamscape_test',
  API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:3000',
  VOYAGE_SERVICE_URL: process.env.VOYAGE_SERVICE_URL || 'http://localhost:3001',
  AUTH_SERVICE_URL: process.env.AUTH_SERVICE_URL || 'http://localhost:3002',
  USER_SERVICE_URL: process.env.USER_SERVICE_URL || 'http://localhost:3003',
  AI_SERVICE_URL: process.env.AI_SERVICE_URL || 'http://localhost:3004',
  PAYMENT_SERVICE_URL: process.env.PAYMENT_SERVICE_URL || 'http://localhost:3005',
  WEB_CLIENT_URL: process.env.WEB_CLIENT_URL || 'http://localhost:3006',
  PANORAMA_SERVICE_URL: process.env.PANORAMA_SERVICE_URL || 'http://localhost:3007'
};

// Write test environment file
const envContent = Object.entries(testEnv)
  .map(([key, value]) => `${key}=${value}`)
  .join('\n');

fs.writeFileSync(path.join(__dirname, '../..', '.env.test'), envContent);
console.log('✅ Created .env.test file');

// Setup global test configuration
const globalConfig = {
  testTimeout: 30000,
  setupFilesAfterEnv: ['<rootDir>/tools/setup/global-setup.js'],
  testEnvironment: 'node',
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  }
};

fs.writeFileSync(
  path.join(__dirname, 'global-config.json'),
  JSON.stringify(globalConfig, null, 2)
);
console.log('✅ Created global test configuration');

console.log('🎉 Test environment setup completed!');
console.log('\nNext steps:');
console.log('1. Install dependencies: npm install');
console.log('2. Start mock services: npm run mock:start');
console.log('3. Run tests: npm test');