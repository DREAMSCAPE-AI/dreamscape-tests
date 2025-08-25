module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/../../integration'],
  testMatch: [
    '**/integration/api/unit-tests/**/*.test.ts',
    '**/integration/api/unit-tests/**/*.test.tsx',
    '**/integration/api/unit-tests/**/*.test.js'
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'integration/api/**/*.ts',
    'integration/api/**/*.tsx',
    'integration/api/**/*.js',
    '!**/*.d.ts',
    '!**/node_modules/**'
  ],
  coverageDirectory: 'coverage/unit',
  coverageReporters: [
    'text',
    'lcov',
    'html'
  ],
  setupFilesAfterEnv: ['<rootDir>/../../integration/api/setup.ts'],
  moduleNameMapper: {},
  testTimeout: 10000,
  globalTeardown: '<rootDir>/../../integration/api/teardown.ts',
  collectCoverage: false
};