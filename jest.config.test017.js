/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  rootDir: '../',

  roots: [
    '<rootDir>/dreamscape-tests/tests/US-TEST-017-analytics-cache',
    // Reuse existing CacheService tests from US-IA-009
    '<rootDir>/dreamscape-tests/tests/US-IA-009-ml-diversity/unit',
    '<rootDir>/dreamscape-services/ai/src/services',
  ],
  testMatch: [
    '**/US-TEST-017-analytics-cache/**/*.test.ts',
    '**/US-IA-009-ml-diversity/unit/cache-service.test.ts',
  ],

  moduleNameMapper: {
    '^@dreamscape/db$': '<rootDir>/dreamscape-tests/__mocks__/db.ts',
    '^@dreamscape/kafka$': '<rootDir>/dreamscape-services/shared/kafka/src/index.ts',
    '^@ai/(.*)$': '<rootDir>/dreamscape-services/ai/src/$1',
  },

  setupFilesAfterEnv: ['<rootDir>/dreamscape-tests/jest.setup.js'],

  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transform: {
    '^.+\\.ts$': ['<rootDir>/dreamscape-tests/node_modules/ts-jest', {
      diagnostics: false,
      tsconfig: {
        module: 'commonjs',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        strict: false,
      },
    }],
  },

  modulePaths: [
    '<rootDir>/dreamscape-services/ai/node_modules',
  ],

  collectCoverageFrom: [
    '<rootDir>/dreamscape-services/ai/src/services/AnalyticsService.ts',
    '<rootDir>/dreamscape-services/ai/src/services/CacheService.ts',
  ],
  coverageDirectory: '<rootDir>/dreamscape-tests/coverage/test017',
  coverageThreshold: {
    global: { branches: 80, functions: 80, lines: 80, statements: 80 },
  },

  clearMocks: true,
  testTimeout: 10000,
  verbose: true,
};
