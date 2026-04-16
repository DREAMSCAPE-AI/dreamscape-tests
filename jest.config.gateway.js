const path = require('path');

module.exports = {
  rootDir: path.resolve(__dirname, '..'),
  testEnvironment: 'node',
  testMatch: ['**/dreamscape-tests/tests/US-GW-001-gateway/**/*.test.ts'],
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
  moduleNameMapper: {
    '^@gateway/(.*)$': '<rootDir>/dreamscape-frontend/gateway/src/$1',
  },
  modulePaths: [
    '<rootDir>/dreamscape-tests/node_modules',
    '<rootDir>/dreamscape-frontend/gateway/node_modules',
  ],
  setupFilesAfterEnv: ['<rootDir>/dreamscape-tests/jest.setup.js'],
  collectCoverageFrom: [
    '<rootDir>/dreamscape-frontend/gateway/src/routes/health.ts',
    '<rootDir>/dreamscape-frontend/gateway/src/routes/vr-sessions.ts',
  ],
  coverageDirectory: '<rootDir>/dreamscape-tests/coverage/gateway',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  coverageThreshold: {
    global: { branches: 60, functions: 70, lines: 70, statements: 70 },
  },
  forceExit: true,
  verbose: true,
  testTimeout: 15000,
};
