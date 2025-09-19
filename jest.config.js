module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Root directory for tests
  rootDir: '.',
  
  // Test file patterns
  testMatch: [
    '<rootDir>/tests/**/*.test.js',
    '<rootDir>/tests/**/*.spec.js'
  ],
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  
  // Coverage configuration
  collectCoverageFrom: [
    '../dreamscape-services/**/src/**/*.{js,ts}',
    '../dreamscape-frontend/**/src/**/*.{js,ts,tsx}',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/build/**',
    '!**/*.d.ts'
  ],
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  
  // Module path mapping
  moduleNameMapper: {
    '^@dreamscape/db$': '<rootDir>/../dreamscape-services/db/src/index.ts'
  },
  
  // Timeout for tests
  testTimeout: 30000,
  
  // Verbose output
  verbose: true,
  
  // Transform files
  transform: {
    '^.+\\.(js|ts|tsx)$': ['ts-jest', {
      useESM: false,
      tsconfig: {
        module: 'commonjs'
      }
    }]
  },
  
  // Module file extensions
  moduleFileExtensions: ['js', 'json', 'ts', 'tsx']
};