/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  rootDir: '../',

  roots: [
    '<rootDir>/dreamscape-tests/tests/DR-538-US-TEST-024',
    '<rootDir>/dreamscape-services/payment/src/services',
  ],
  testMatch: ['**/DR-538-US-TEST-024/**/*.test.ts'],

  moduleNameMapper: {
    '^@dreamscape/kafka$': '<rootDir>/dreamscape-services/shared/kafka/dist/index.js',
    '^@dreamscape/db$': '<rootDir>/dreamscape-tests/__mocks__/db.ts',
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
    '<rootDir>/dreamscape-services/payment/src/services/KafkaService.ts',
    '<rootDir>/dreamscape-services/payment/src/services/DatabaseService.ts',
  ],
  coverageDirectory: '<rootDir>/dreamscape-tests/coverage/test024',
  coverageThreshold: {
    global: { branches: 80, functions: 80, lines: 80, statements: 80 },
  },

  clearMocks: true,
  testTimeout: 10000,
  verbose: true,
};
