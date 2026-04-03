/**
 * Jest config for DR-567: Gateway unit tests (server.ts, health.ts)
 */

const path = require('path');

/** @type {import('jest').Config} */
module.exports = {
  displayName: 'gateway-unit',
  testEnvironment: 'node',

  rootDir: '../',

  roots: [
    '<rootDir>/dreamscape-tests/tests/DR-567-gateway-unit',
  ],

  testMatch: ['**/DR-567-gateway-unit/**/*.test.ts'],

  setupFilesAfterEnv: ['<rootDir>/dreamscape-tests/jest.setup.js'],

  moduleNameMapper: {
    // Resolve gateway imports
    '^http-proxy-middleware$': '<rootDir>/dreamscape-frontend/gateway/node_modules/http-proxy-middleware',
    '^express$': '<rootDir>/dreamscape-frontend/gateway/node_modules/express',
    '^express-rate-limit$': '<rootDir>/dreamscape-frontend/gateway/node_modules/express-rate-limit',
    '^helmet$': '<rootDir>/dreamscape-frontend/gateway/node_modules/helmet',
    '^cors$': '<rootDir>/dreamscape-frontend/gateway/node_modules/cors',
  },

  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],

  transform: {
    '^.+\\.ts$': ['<rootDir>/dreamscape-tests/node_modules/ts-jest', {
      diagnostics: false,
      tsconfig: {
        module: 'commonjs',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        strict: false,
        target: 'ES2022',
        lib: ['ES2022'],
      },
    }],
  },

  // Module resolution: gateway node_modules + tests node_modules
  modulePaths: [
    '<rootDir>/dreamscape-frontend/gateway/node_modules',
    '<rootDir>/dreamscape-tests/node_modules',
  ],

  collectCoverageFrom: [
    'dreamscape-frontend/gateway/src/server.ts',
    'dreamscape-frontend/gateway/src/routes/health.ts',
  ],
  coverageDirectory: '<rootDir>/dreamscape-tests/coverage/dr567',
  coverageThreshold: {
    global: { branches: 80, functions: 80, lines: 80, statements: 80 },
  },

  clearMocks: true,
  testTimeout: 15000,
  verbose: true,
};
