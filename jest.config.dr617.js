const path = require('path');

module.exports = {
  rootDir: path.resolve(__dirname),
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/integration/api/gateway/**/*.integration.test.ts'],
  transform: { '^.+\\.ts$': 'ts-jest' },
  modulePathIgnorePatterns: ['<rootDir>/cypress/', '<rootDir>/node_modules/cypress/'],
  coverageDirectory: '<rootDir>/coverage/dr617-gateway-integration',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  collectCoverageFrom: [
    'integration/api/gateway/**/*.ts',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/setup.js',
    '!**/teardown.js',
  ],
  setupFilesAfterEnv: ['<rootDir>/integration/api/gateway/setup.js'],
  globalTeardown: '<rootDir>/integration/api/gateway/teardown.js',
  testTimeout: 30000,
  collectCoverage: true,
  coverageThreshold: {
    global: { branches: 60, functions: 60, lines: 60, statements: 60 },
  },
  verbose: true,
  detectOpenHandles: true,
  forceExit: true,
  maxWorkers: 1,
  globals: { 'ts-jest': { tsconfig: './tsconfig.integration.json' } },
};
