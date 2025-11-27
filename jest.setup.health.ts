/**
 * Jest Setup for Health Check Tests - INFRA-013.1
 *
 * This file runs before each test suite to set up the test environment.
 */

// Extend Jest matchers if needed
import '@testing-library/jest-dom';

// Set up environment variables for tests
process.env.NODE_ENV = 'test';
process.env.npm_package_version = '1.0.0';

// Mock console methods to reduce noise in tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

global.console = {
  ...console,
  log: jest.fn((...args) => {
    // Only log in verbose mode or for important messages
    if (process.env.VERBOSE === 'true' || args[0]?.includes('IMPORTANT')) {
      originalConsoleLog(...args);
    }
  }),
  error: jest.fn((...args) => {
    // Always log errors
    originalConsoleError(...args);
  }),
};

// Global timeout for all tests
jest.setTimeout(10000);

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});

// Global test utilities
global.sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Type augmentation for global utilities
declare global {
  var sleep: (ms: number) => Promise<void>;
}

export {};
