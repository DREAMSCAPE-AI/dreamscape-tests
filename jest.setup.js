// Global test setup
require('dotenv').config();

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  // Keep error and warn for debugging
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn()
};

// Global test timeout
jest.setTimeout(30000);

// Mock environment variables
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-testing';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-jwt-refresh-secret-for-testing';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'mongodb://localhost:27017/dreamscape-test';
process.env.NODE_ENV = 'test';

// Global test utilities
global.testUtils = {
  // Generate test JWT token
  generateTestToken: (userId = 'test-user-id', email = 'test@example.com') => {
    const jwt = require('jsonwebtoken');
    return jwt.sign(
      { userId, email, type: 'access' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  },
  
  // Wait utility
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Generate random test data
  generateTestUser: () => ({
    email: `test${Date.now()}@example.com`,
    password: 'TestPassword123!',
    firstName: 'Test',
    lastName: 'User',
    username: `testuser${Date.now()}`
  })
};

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});

// Global error handler for unhandled promises
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});