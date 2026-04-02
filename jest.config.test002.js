/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  rootDir: '../',

  roots: [
    '<rootDir>/dreamscape-tests/tests/DR-538-US-TEST-002',
    '<rootDir>/dreamscape-services/auth/src/middleware',
  ],
  testMatch: ['**/DR-538-US-TEST-002/**/*.test.ts'],

  moduleNameMapper: {
    '^@types$': '<rootDir>/dreamscape-services/auth/src/types/index.ts',
    '^@dreamscape/db$': '<rootDir>/dreamscape-tests/__mocks__/db.ts',
    '^@config/redis$': '<rootDir>/dreamscape-tests/__mocks__/redis.ts',
    '^jsonwebtoken$': '<rootDir>/dreamscape-services/auth/node_modules/jsonwebtoken',
    '^bcryptjs$': '<rootDir>/dreamscape-services/auth/node_modules/bcryptjs',
    '^express-rate-limit$': '<rootDir>/dreamscape-services/auth/node_modules/express-rate-limit',
    '^rate-limit-redis$': '<rootDir>/dreamscape-services/auth/node_modules/rate-limit-redis',
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
        paths: {
          '@config/redis': ['<rootDir>/dreamscape-tests/__mocks__/redis.ts'],
        },
      },
    }],
  },

  collectCoverageFrom: [
    '<rootDir>/dreamscape-services/auth/src/middleware/auth.ts',
    '<rootDir>/dreamscape-services/auth/src/middleware/errorHandler.ts',
    '<rootDir>/dreamscape-services/auth/src/middleware/rateLimiter.ts',
    '<rootDir>/dreamscape-services/auth/src/middleware/cache.ts',
    '<rootDir>/dreamscape-services/auth/src/middleware/sessionManager.ts',
  ],
  coverageDirectory: '<rootDir>/dreamscape-tests/coverage/test002',
  coverageThreshold: {
    global: { branches: 80, functions: 80, lines: 80, statements: 80 },
  },

  // clearMocks only (NOT resetMocks) — rateLimiter.ts captures Redis state at module load time
  clearMocks: true,
  testTimeout: 10000,
  verbose: true,
};
