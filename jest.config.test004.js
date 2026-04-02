/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  rootDir: '../',

  roots: [
    '<rootDir>/dreamscape-tests/tests/DR-538-US-TEST-004',
    '<rootDir>/dreamscape-services/auth/src/services',
  ],
  testMatch: ['**/DR-538-US-TEST-004/**/*.test.ts'],

  moduleNameMapper: {
    '^@dreamscape/kafka$': '<rootDir>/dreamscape-services/shared/kafka/dist/index.js',
    '^@dreamscape/db$': '<rootDir>/dreamscape-tests/__mocks__/db.ts',
    '^@config/redis$': '<rootDir>/dreamscape-tests/__mocks__/redis.ts',
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

  collectCoverageFrom: [
    '<rootDir>/dreamscape-services/auth/src/services/KafkaService.ts',
  ],
  coverageDirectory: '<rootDir>/dreamscape-tests/coverage/test004',
  coverageThreshold: {
    global: { branches: 80, functions: 80, lines: 80, statements: 80 },
  },

  clearMocks: true,
  testTimeout: 10000,
  verbose: true,
};
