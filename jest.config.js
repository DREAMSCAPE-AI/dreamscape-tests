const voyageUnitCoverageTargets = [
  '<rootDir>/dreamscape-services/voyage/src/services/BookingService.ts',
  '<rootDir>/dreamscape-services/voyage/src/services/CartService.ts',
  '<rootDir>/dreamscape-services/voyage/src/services/AmadeusService.ts',
  '<rootDir>/dreamscape-services/voyage/src/services/KafkaService.ts',
  '<rootDir>/dreamscape-services/voyage/src/services/itinerary.export.service.ts',
  '<rootDir>/dreamscape-services/voyage/src/controllers/itinerary.controller.ts',
  '<rootDir>/dreamscape-services/voyage/src/handlers/paymentEventsHandler.ts',
  '<rootDir>/dreamscape-services/voyage/src/middleware/authProxy.ts',
  '<rootDir>/dreamscape-services/voyage/src/middleware/errorHandler.ts',
  '<rootDir>/dreamscape-services/voyage/src/middleware/rateLimiter.ts',
  '<rootDir>/dreamscape-services/voyage/src/middleware/hotelCache.ts',
  '<rootDir>/dreamscape-services/voyage/src/routes/flights.ts',
  '<rootDir>/dreamscape-services/voyage/src/routes/hotels.ts',
  '<rootDir>/dreamscape-services/voyage/src/routes/activities.ts',
  '<rootDir>/dreamscape-services/voyage/src/routes/bookings.ts',
  '<rootDir>/dreamscape-services/voyage/src/routes/cart.ts',
  '<rootDir>/dreamscape-services/voyage/src/routes/itineraries.ts',
  '<rootDir>/dreamscape-services/voyage/src/routes/airports.ts',
  '<rootDir>/dreamscape-services/voyage/src/routes/airlines.ts',
  '<rootDir>/dreamscape-services/voyage/src/routes/locations.ts',
  '<rootDir>/dreamscape-services/voyage/src/routes/transfers.ts'
];

module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Root directory for tests
  rootDir: '..',
  
  // Test file patterns
  testMatch: [
    '<rootDir>/dreamscape-tests/tests/**/*.test.js',
    '<rootDir>/dreamscape-tests/tests/**/*.spec.js',
    '<rootDir>/dreamscape-tests/tests/**/*.test.ts',
    '<rootDir>/dreamscape-tests/tests/**/*.spec.ts'
  ],
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/dreamscape-tests/jest.setup.js'],
  
  // Coverage configuration
  collectCoverageFrom: voyageUnitCoverageTargets,
  coverageProvider: 'v8',
  
  // Module path mapping
  moduleNameMapper: {
    '^@dreamscape/db$': '<rootDir>/dreamscape-services/db/index.ts',
    '^@dreamscape/kafka$': '<rootDir>/dreamscape-services/shared/kafka/src/index.ts',
    '^@/(.*)$': '<rootDir>/dreamscape-services/voyage/src/$1',
    '^@ai/(.*)$': '<rootDir>/dreamscape-services/ai/src/$1',
    '^axios$': '<rootDir>/dreamscape-services/voyage/node_modules/axios',
    // User-service internal aliases
    '^@controllers/(.*)$': '<rootDir>/dreamscape-services/user/src/controllers/$1',
    '^@services/(.*)$': '<rootDir>/dreamscape-services/user/src/services/$1',
    '^@middleware/(.*)$': '<rootDir>/dreamscape-services/user/src/middleware/$1',
    '^@routes/(.*)$': '<rootDir>/dreamscape-services/user/src/routes/$1',
    '^@types/(.*)$': '<rootDir>/dreamscape-services/user/src/types/$1',
    '^@types_onboarding$': '<rootDir>/dreamscape-services/user/src/types/onboarding.ts',
    // Canonical resolution so jest.mock('express-rate-limit') intercepts the same module instance
    '^express-rate-limit$': '<rootDir>/dreamscape-services/user/node_modules/express-rate-limit'
  },

  // Timeout for tests
  testTimeout: 30000,

  // Verbose output
  verbose: true,

  // Transform files
  transform: {
    '^.+\\.ts$': ['<rootDir>/dreamscape-tests/node_modules/ts-jest/dist/index.js', {
      useESM: false,
      diagnostics: false,
      tsconfig: {
        module: 'commonjs',
        allowJs: true,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        baseUrl: '.',
        paths: {
          '@/*': ['dreamscape-services/voyage/src/*'],
          '@ai/*': ['dreamscape-services/ai/src/*'],
          '@dreamscape/db': ['dreamscape-services/db/index.ts'],
          '@dreamscape/kafka': ['dreamscape-services/shared/kafka/src/index.ts'],
          '@controllers/*': ['dreamscape-services/user/src/controllers/*'],
          '@services/*': ['dreamscape-services/user/src/services/*'],
          '@middleware/*': ['dreamscape-services/user/src/middleware/*'],
          '@routes/*': ['dreamscape-services/user/src/routes/*'],
          '@types/*': ['dreamscape-services/user/src/types/*'],
          '@types_onboarding': ['dreamscape-services/user/src/types/onboarding.ts']
        }
      }
    }],
    '^.+\\.js$': '<rootDir>/dreamscape-tests/node_modules/jest-config/node_modules/babel-jest/build/index.js'
  },
  
  // Module file extensions
  moduleFileExtensions: ['js', 'json', 'ts', 'tsx'],

  // Allow resolution of service-level node_modules (redis, multer, ioredis, etc.)
  modulePaths: [
    '<rootDir>/dreamscape-services/auth/node_modules',
    '<rootDir>/dreamscape-services/user/node_modules',
    '<rootDir>/dreamscape-services/ai/node_modules',
    '<rootDir>/dreamscape-services/payment/node_modules',
    '<rootDir>/dreamscape-services/voyage/node_modules'
  ]
};
