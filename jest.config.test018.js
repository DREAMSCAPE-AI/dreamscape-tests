/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  rootDir: '../',

  roots: [
    '<rootDir>/dreamscape-tests/tests/US-TEST-018-popularity-segment',
    // Reuse existing cold-start / segment tests from US-IA-002
    '<rootDir>/dreamscape-tests/tests/US-IA-002-cold-start/unit',
    '<rootDir>/dreamscape-services/ai/src/recommendations',
    '<rootDir>/dreamscape-services/ai/src/segments',
  ],
  testMatch: [
    '**/US-TEST-018-popularity-segment/**/*.test.ts',
    '**/US-IA-002-cold-start/unit/cold-start-core.test.ts',
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
    '<rootDir>/dreamscape-services/ai/src/recommendations/popularity.service.ts',
    '<rootDir>/dreamscape-services/ai/src/recommendations/popularity-cache.service.ts',
    '<rootDir>/dreamscape-services/ai/src/segments/segment-engine.service.ts',
    '<rootDir>/dreamscape-services/ai/src/segments/segment-to-vector.service.ts',
  ],
  coverageDirectory: '<rootDir>/dreamscape-tests/coverage/test018',
  coverageThreshold: {
    global: { branches: 80, functions: 80, lines: 80, statements: 80 },
  },

  clearMocks: true,
  testTimeout: 10000,
  verbose: true,
};
