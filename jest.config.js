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
    '^@ai/(.*)$': '<rootDir>/../dreamscape-services/ai/src/$1',
    // User-service internal aliases
    '^@controllers/(.*)$': '<rootDir>/../dreamscape-services/user/src/controllers/$1',
    '^@services/(.*)$': '<rootDir>/../dreamscape-services/user/src/services/$1',
    '^@middleware/(.*)$': '<rootDir>/../dreamscape-services/user/src/middleware/$1',
    '^@routes/(.*)$': '<rootDir>/../dreamscape-services/user/src/routes/$1',
    '^@types/(.*)$': '<rootDir>/../dreamscape-services/user/src/types/$1',
    '^@types_onboarding$': '<rootDir>/../dreamscape-services/user/src/types/onboarding.ts',
    // Canonical resolution so jest.mock('express-rate-limit') intercepts the same module instance
    '^express-rate-limit$': '<rootDir>/../dreamscape-services/user/node_modules/express-rate-limit'
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
          '@dreamscape/kafka': ['../dreamscape-services/shared/kafka/src/index.ts'],
          '@controllers/*': ['../dreamscape-services/user/src/controllers/*'],
          '@services/*': ['../dreamscape-services/user/src/services/*'],
          '@middleware/*': ['../dreamscape-services/user/src/middleware/*'],
          '@routes/*': ['../dreamscape-services/user/src/routes/*'],
          '@types/*': ['../dreamscape-services/user/src/types/*'],
          '@types_onboarding': ['../dreamscape-services/user/src/types/onboarding.ts']
        }
      }
    }],
    '^.+\\.js$': 'babel-jest'
  },
  
  // Module file extensions
  moduleFileExtensions: ['js', 'json', 'ts', 'tsx'],

  // Allow resolution of service-level node_modules (redis, multer, ioredis, etc.)
  modulePaths: [
    '<rootDir>/../dreamscape-services/auth/node_modules',
    '<rootDir>/../dreamscape-services/user/node_modules',
    '<rootDir>/../dreamscape-services/ai/node_modules',
    '<rootDir>/../dreamscape-services/payment/node_modules',
    '<rootDir>/../dreamscape-services/voyage/node_modules'
  ]
};