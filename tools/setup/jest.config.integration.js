const path = require('path');

module.exports = {
  rootDir: path.resolve(__dirname, '../..'),
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/integration'],
  testMatch: [
    '**/integration/api/auth/**/*.test.ts',
    '**/integration/api/auth/**/*.integration.test.ts'
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'integration/api/auth/**/*.ts',
    '!**/*.d.ts',
    '!**/node_modules/**'
  ],
  coverageDirectory: '<rootDir>/coverage/auth-service',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  setupFilesAfterEnv: ['<rootDir>/integration/api/auth/setup.js'],
  testTimeout: 30000,
  globalTeardown: '<rootDir>/integration/api/auth/teardown.js',
  collectCoverage: true,
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },
  verbose: true,
  detectOpenHandles: true,
  forceExit: true
};