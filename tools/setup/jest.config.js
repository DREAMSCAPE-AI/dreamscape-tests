module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/integration'],
  testMatch: [
    '**/integration/**/*.test.ts',
    '**/integration/**/*.test.tsx',
    '**/integration/**/*.test.js'
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'integration/**/*.ts',
    'integration/**/*.tsx',
    'integration/**/*.js',
    '!**/*.d.ts',
    '!**/node_modules/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html'
  ],
  setupFilesAfterEnv: ['<rootDir>/integration/api/setup.ts'],
  moduleNameMapping: {},
  testTimeout: 10000,
  globalTeardown: '<rootDir>/integration/api/teardown.ts',
  collectCoverage: true,
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};