/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  rootDir: '../',

  roots: [
    '<rootDir>/dreamscape-tests/tests/US-TEST-019-onboarding-orchestrator',
    '<rootDir>/dreamscape-services/ai/src/onboarding',
    '<rootDir>/dreamscape-services/ai/src/handlers',
  ],
  testMatch: ['**/US-TEST-019-onboarding-orchestrator/**/*.test.ts'],

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
    '<rootDir>/dreamscape-services/ai/src/onboarding/onboarding-orchestrator.service.ts',
    '<rootDir>/dreamscape-services/ai/src/handlers/userEventsHandler.ts',
    '<rootDir>/dreamscape-services/ai/src/handlers/voyageEventsHandler.ts',
  ],
  coverageDirectory: '<rootDir>/dreamscape-tests/coverage/test019',
  coverageThreshold: {
    global: { branches: 80, functions: 80, lines: 80, statements: 80 },
  },

  clearMocks: true,
  testTimeout: 10000,
  verbose: true,
};
