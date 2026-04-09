const path = require('path');

module.exports = {
  rootDir: path.resolve(__dirname),
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/integration/api/ai/**/*.integration.test.ts'],
  transform: { '^.+\\.ts$': 'ts-jest' },
  modulePathIgnorePatterns: ['<rootDir>/cypress/', '<rootDir>/node_modules/cypress/'],
  coverageDirectory: '<rootDir>/coverage/dr616-ai-integration',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  collectCoverageFrom: [
    '<rootDir>/integration/api/ai/**/*.ts',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
  forceCoverageMatch: ['**/integration/api/ai/**/*.integration.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/integration/api/ai/setup.js'],
  globalTeardown: '<rootDir>/integration/api/ai/teardown.js',
  testTimeout: 30000,
  collectCoverage: true,
  coverageProvider: 'v8',
  coverageThreshold: {
    global: { branches: 55, functions: 60, lines: 60, statements: 60 },
  },
  verbose: true,
  detectOpenHandles: true,
  forceExit: true,
  maxWorkers: 1,
  globals: { 'ts-jest': { tsconfig: './tsconfig.integration.json' } },
};
