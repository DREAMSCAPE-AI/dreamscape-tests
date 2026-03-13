module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Root directory for tests
  rootDir: '.',
  
  // Test file patterns
  testMatch: [
    '<rootDir>/tests/**/*.test.js',
    '<rootDir>/tests/**/*.spec.js',
    '<rootDir>/tests/**/*.test.ts',
    '<rootDir>/tests/**/*.spec.ts'
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
  
  // Module path mapping
  moduleNameMapper: {
    '^@dreamscape/db$': '<rootDir>/../dreamscape-services/db/index.ts',
    '^@dreamscape/kafka$': '<rootDir>/../dreamscape-services/shared/kafka/src/index.ts',
    '^@/(.*)$': '<rootDir>/../dreamscape-services/voyage/src/$1',
    '^@ai/(.*)$': '<rootDir>/../dreamscape-services/ai/src/$1'
  },

  // Timeout for tests
  testTimeout: 30000,

  // Verbose output
  verbose: true,

  // Transform files
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: false,
      diagnostics: false,
      tsconfig: {
        module: 'commonjs',
        allowJs: true,
        baseUrl: '.',
        paths: {
          '@/*': ['../dreamscape-services/voyage/src/*'],
          '@ai/*': ['../dreamscape-services/ai/src/*'],
          '@dreamscape/db': ['../dreamscape-services/db/index.ts'],
          '@dreamscape/kafka': ['../dreamscape-services/shared/kafka/src/index.ts']
        }
      }
    }],
    '^.+\\.js$': 'babel-jest'
  },
  
  // Module file extensions
  moduleFileExtensions: ['js', 'json', 'ts', 'tsx']
};