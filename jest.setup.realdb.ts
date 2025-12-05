/**
 * Jest Setup for Health Check Tests with REAL DATABASE - INFRA-013.1
 *
 * This file runs before tests to ensure Docker services are running.
 * Uses real PostgreSQL and Redis instead of mocks.
 */

import { execSync } from 'child_process';
import '@testing-library/jest-dom';

// Set up environment variables for tests
process.env.NODE_ENV = 'test';
process.env.npm_package_version = '1.0.0';

// Database configuration
process.env.DATABASE_URL = 'postgresql://dev:dev123@localhost:5432/dreamscape_dev';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';

console.log('🚀 Starting Docker services for integration tests...');

// Check if Docker is running
try {
  execSync('docker --version', { stdio: 'ignore' });
} catch (error) {
  console.error('❌ Docker is not installed or not running');
  process.exit(1);
}

// Start required Docker services
beforeAll(async () => {
  try {
    console.log('📦 Starting PostgreSQL and Redis...');

    // Start services
    execSync(
      'docker-compose -f ../dreamscape-infra/docker/docker-compose.bigpods.dev.yml up -d postgres redis',
      {
        cwd: __dirname,
        stdio: 'inherit'
      }
    );

    // Wait for services to be healthy
    console.log('⏳ Waiting for services to be healthy...');
    let retries = 30;
    while (retries > 0) {
      try {
        execSync('docker exec dreamscape-postgres pg_isready -U dev -d dreamscape_dev', {
          stdio: 'ignore'
        });
        execSync('docker exec dreamscape-redis redis-cli ping', {
          stdio: 'ignore'
        });
        console.log('✅ PostgreSQL and Redis are ready!');
        break;
      } catch (error) {
        retries--;
        if (retries === 0) {
          throw new Error('Timeout waiting for services to be healthy');
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  } catch (error) {
    console.error('❌ Failed to start Docker services:', error);
    throw error;
  }
}, 120000); // 2 minutes timeout

// Clean up after all tests
afterAll(async () => {
  console.log('🧹 Tests completed. Docker services will remain running for next test run.');
  console.log('💡 To stop services: cd dreamscape-infra/docker && docker-compose down');
});

// Mock console methods to reduce noise in tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

global.console = {
  ...console,
  log: jest.fn((...args) => {
    if (process.env.VERBOSE === 'true' || args[0]?.includes('✅') || args[0]?.includes('❌')) {
      originalConsoleLog(...args);
    }
  }),
  error: jest.fn((...args) => {
    originalConsoleError(...args);
  }),
};

// Global timeout for all tests
jest.setTimeout(30000);

// Global test utilities
global.sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Type augmentation for global utilities
declare global {
  var sleep: (ms: number) => Promise<void>;
}

export {};
