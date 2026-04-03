/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  rootDir: '../',

  roots: [
    '<rootDir>/dreamscape-tests/tests/DR-538-US-TEST-023',
    '<rootDir>/dreamscape-services/payment/src',
  ],
  testMatch: ['**/DR-538-US-TEST-023/**/*.test.ts'],

  moduleNameMapper: {
    '^@dreamscape/db$': '<rootDir>/dreamscape-tests/__mocks__/db.ts',
    '^stripe$': '<rootDir>/dreamscape-services/payment/node_modules/stripe',
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
    '<rootDir>/dreamscape-services/payment/src/services/WebhookService.ts',
    '<rootDir>/dreamscape-services/payment/src/routes/payment.ts',
    '<rootDir>/dreamscape-services/payment/src/middleware/rawBody.ts',
  ],
  coverageDirectory: '<rootDir>/dreamscape-tests/coverage/test023',
  coverageThreshold: {
    global: { branches: 80, functions: 80, lines: 80, statements: 80 },
  },

  clearMocks: true,
  testTimeout: 10000,
  verbose: true,
};
