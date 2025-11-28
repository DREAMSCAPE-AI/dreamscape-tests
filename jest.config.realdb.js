/**
 * Jest Configuration for Health Check Tests with REAL DATABASE 
 *
 * This configuration uses real PostgreSQL and Redis 
 * Run with: npm run test:health:realdb
 */

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',

  // Test file patterns
  testMatch: [
    '**/integration/health/**/*.test.ts',
  ],

  // Module path aliases - NO MOCKS FOR DB
  moduleNameMapper: {
    '^@dreamscape/shared/health$': '<rootDir>/../dreamscape-services/shared/health',
    // Map the relative Prisma path to the absolute path in db package
    '^\\.\\./\\.\\./\\.\\./db/node_modules/@prisma/client$': '<rootDir>/../dreamscape-services/db/node_modules/@prisma/client',
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

  coverageDirectory: 'coverage/health-realdb',

  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },

  // Setup files - Use real DB setup
  setupFilesAfterEnv: ['<rootDir>/jest.setup.realdb.ts'],

  // Timeouts - Longer for real DB tests
  testTimeout: 30000,

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

  // Don't clear mocks for real DB
  clearMocks: false,
  resetMocks: false,
  restoreMocks: false,
};
