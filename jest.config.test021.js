/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  rootDir: '../',

  roots: [
    '<rootDir>/dreamscape-tests/tests/US-TEST-021-middleware',
    '<rootDir>/dreamscape-services/ai/src/middleware',
  ],
  testMatch: ['**/US-TEST-021-middleware/**/*.test.ts'],

  moduleNameMapper: {
    '^@dreamscape/db$': '<rootDir>/dreamscape-tests/__mocks__/db.ts',
    '^@dreamscape/kafka$': '<rootDir>/dreamscape-services/shared/kafka/src/index.ts',
    '^@/(.*)$': '<rootDir>/dreamscape-services/ai/src/$1',
    '^@ai/(.*)$': '<rootDir>/dreamscape-services/ai/src/$1',
    '^jsonwebtoken$': require.resolve('jsonwebtoken'),
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
    '<rootDir>/dreamscape-services/ai/src/middleware/auth.ts',
    '<rootDir>/dreamscape-services/ai/src/middleware/errorHandler.ts',
    '<rootDir>/dreamscape-services/ai/src/middleware/rateLimiter.ts',
  ],
  coverageDirectory: '<rootDir>/dreamscape-tests/coverage/test021',
  coverageThreshold: {
    global: { branches: 80, functions: 80, lines: 80, statements: 80 },
  },

  clearMocks: true,
  testTimeout: 10000,
  verbose: true,
};
