const path = require('path');

module.exports = {
  rootDir: path.resolve(__dirname, '../..'),
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/integration'],
  testMatch: [
    '**/integration/api/auth/**/*.test.ts',
    '**/integration/api/auth/**/*.integration.test.ts',
    '**/integration/api/user/**/*.test.ts',
    '**/integration/api/user/**/*.integration.test.ts'
  ],
  transform: {
    '^.+\\.ts': 'ts-jest',
  },
  modulePathIgnorePatterns: ['<rootDir>/cypress/', '<rootDir>/node_modules/cypress/'],
  collectCoverageFrom: [
    'integration/api/auth/**/*.ts',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/setup.js',
    '!**/teardown.js'
  ],
  coverageDirectory: '<rootDir>/coverage/auth-integration',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  setupFilesAfterEnv: ['<rootDir>/integration/api/auth/setup.js'],
  globalTeardown: '<rootDir>/integration/api/auth/teardown.js',
  testTimeout: 30000,
  collectCoverage: true,
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  verbose: true,
  detectOpenHandles: true,
  forceExit: true,
  maxWorkers: 1,
  testSequencer: '<rootDir>/tools/setup/test-sequencer.js',
  globals: {
    'ts-jest': {
      tsconfig: './tsconfig.integration.json'
    }
  }
};