module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/integration'],
  testMatch: [
    '**/integration/api/**/*.integration.test.ts'
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'integration/api/**/*.ts',
    '!**/*.d.ts',
    '!**/node_modules/**'
  ],
  coverageDirectory: 'coverage/integration',
  coverageReporters: [
    'text',
    'lcov',
    'html'
  ],
  setupFilesAfterEnv: ['<rootDir>/integration/api/setup.ts'],
  moduleNameMapping: {},
  testTimeout: 30000,
  globalTeardown: '<rootDir>/integration/api/teardown.ts',
  collectCoverage: true,
  coverageThreshold: {
    global: {
      branches: 5,
      functions: 10,
      lines: 15,
      statements: 15
    }
  }
};