/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  rootDir: '../',

  roots: [
    '<rootDir>/dreamscape-tests/tests/US-TEST-020-ai-routes',
    '<rootDir>/dreamscape-services/ai/src/routes',
  ],
  testMatch: ['**/US-TEST-020-ai-routes/**/*.test.ts'],

  moduleNameMapper: {
    '^@dreamscape/db$': '<rootDir>/dreamscape-tests/__mocks__/db.ts',
    '^@dreamscape/kafka$': '<rootDir>/dreamscape-services/shared/kafka/src/index.ts',
    // Override @/ to point to AI service (routes use @/ for internal imports)
    '^@/(.*)$': '<rootDir>/dreamscape-services/ai/src/$1',
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
    '<rootDir>/dreamscape-tests/node_modules',
  ],

  collectCoverageFrom: [
    '<rootDir>/dreamscape-services/ai/src/routes/predictions.ts',
    '<rootDir>/dreamscape-services/ai/src/routes/onboarding.ts',
    '<rootDir>/dreamscape-services/ai/src/routes/recommendations.ts',
    '<rootDir>/dreamscape-services/ai/src/routes/accommodations.ts',
  ],
  coverageDirectory: '<rootDir>/dreamscape-tests/coverage/test020',
  coverageThreshold: {
    global: { branches: 80, functions: 80, lines: 80, statements: 80 },
  },

  clearMocks: true,
  testTimeout: 10000,
  verbose: true,
};
