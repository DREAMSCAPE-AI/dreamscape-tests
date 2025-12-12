/**
 * Jest Configuration for Health Check Tests - INFRA-013.1
 *
 * This configuration is specifically for running health check tests.
 * Run with: npm run test:health
 */

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',

  // Test file patterns
  testMatch: [
    '**/unit/health/**/*.test.ts',
    '**/integration/health/**/*.test.ts',
  ],

  // Module path aliases
  moduleNameMapper: {
    '^@dreamscape/shared/health$': '<rootDir>/../dreamscape-services/shared/health',
    '^@dreamscape/db$': '<rootDir>/__mocks__/db.ts',
  },

  // Coverage configuration
  collectCoverageFrom: [
    '../dreamscape-services/shared/health/**/*.ts',
    '../dreamscape-services/*/src/routes/health.ts',
    '../dreamscape-frontend/gateway/src/routes/health.ts',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/dist/**',
  ],

  coverageDirectory: 'coverage/health',

  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/jest.setup.health.ts'],

  // Timeouts
  testTimeout: 10000,

  // Reporter
  reporters: ['default'],

  // Transform
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.jest.json',
        diagnostics: {
          ignoreCodes: [2339, 2551, 2345],
        },
        isolatedModules: true,
      },
    ],
  },

  // Verbose output
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};
