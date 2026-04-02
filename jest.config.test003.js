/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  rootDir: '../',

  roots: [
    '<rootDir>/dreamscape-tests/tests/DR-538-US-TEST-003',
    '<rootDir>/dreamscape-services/auth/src/routes',
  ],
  testMatch: ['**/DR-538-US-TEST-003/**/*.test.ts'],

  moduleNameMapper: {
    '^@types$': '<rootDir>/dreamscape-services/auth/src/types/index.ts',
    '^@dreamscape/db$': '<rootDir>/dreamscape-tests/__mocks__/db.ts',
    '^@config/redis$': '<rootDir>/dreamscape-tests/__mocks__/redis.ts',
    '^@services/(.*)$': '<rootDir>/dreamscape-services/auth/src/services/$1',
    '^@middleware/(.*)$': '<rootDir>/dreamscape-services/auth/src/middleware/$1',
    '^jsonwebtoken$': '<rootDir>/dreamscape-services/auth/node_modules/jsonwebtoken',
    '^bcryptjs$': '<rootDir>/dreamscape-services/auth/node_modules/bcryptjs',
    '^express-validator$': '<rootDir>/dreamscape-services/auth/node_modules/express-validator',
    '^cookie-parser$': '<rootDir>/dreamscape-services/auth/node_modules/cookie-parser',
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
        baseUrl: '<rootDir>/dreamscape-services/auth',
        paths: {
          '@types': ['src/types/index.ts'],
          '@services/*': ['src/services/*'],
          '@middleware/*': ['src/middleware/*'],
          '@config/*': ['src/config/*'],
        },
      },
    }],
  },

  collectCoverageFrom: [
    '<rootDir>/dreamscape-services/auth/src/routes/auth.ts',
  ],
  coverageDirectory: '<rootDir>/dreamscape-tests/coverage/test003',
  coverageThreshold: {
    global: { branches: 80, functions: 80, lines: 80, statements: 80 },
  },

  clearMocks: true,
  testTimeout: 10000,
  verbose: true,
};
