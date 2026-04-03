/**
 * Jest configuration for DR-562 → DR-566: Frontend unit tests
 * (Auth/Common components, Services, Zustand stores, Pages, Booking components)
 *
 * Environment: jsdom (React + DOM APIs available)
 * Transform:   ts-jest with JSX support + babel-jest for .js files
 * Path alias:  @/ → dreamscape-frontend/web-client/src/
 */

const path = require('path');
const testsDir = path.resolve(__dirname);

/** @type {import('jest').Config} */
module.exports = {
  displayName: 'frontend',
  testEnvironment: 'jest-environment-jsdom',

  // rootDir = monorepo root so both tests/ and source files are within scope
  rootDir: '..',

  roots: [
    '<rootDir>/dreamscape-tests/tests/DR-562-frontend-auth-common',
    '<rootDir>/dreamscape-tests/tests/DR-563-frontend-services',
    '<rootDir>/dreamscape-tests/tests/DR-564-frontend-stores',
    '<rootDir>/dreamscape-tests/tests/DR-565-frontend-pages',
    '<rootDir>/dreamscape-tests/tests/DR-566-frontend-booking-components',
  ],

  testMatch: [
    '**/DR-56[2-6]-*/**/*.test.{ts,tsx}',
  ],

  setupFilesAfterEnv: [
    '<rootDir>/dreamscape-tests/jest.setup.js',
    '<rootDir>/dreamscape-tests/jest.setup.frontend.ts',
  ],

  moduleNameMapper: {
    // Path alias → web-client src
    '^@/(.*)$': '<rootDir>/dreamscape-frontend/web-client/src/$1',

    // Force single React copy (web-client version) to avoid "multiple React" error
    '^react$': '<rootDir>/dreamscape-frontend/web-client/node_modules/react',
    '^react/(.*)$': '<rootDir>/dreamscape-frontend/web-client/node_modules/react/$1',
    '^react-dom$': '<rootDir>/dreamscape-frontend/web-client/node_modules/react-dom',
    '^react-dom/(.*)$': '<rootDir>/dreamscape-frontend/web-client/node_modules/react-dom/$1',
    '^react-router-dom$': '<rootDir>/dreamscape-frontend/web-client/node_modules/react-router-dom',
    '^zustand$': '<rootDir>/dreamscape-frontend/web-client/node_modules/zustand',
    '^zustand/(.*)$': '<rootDir>/dreamscape-frontend/web-client/node_modules/zustand/$1',

    // Static assets
    '\\.(css|less|scss|sass)$': '<rootDir>/dreamscape-tests/__mocks__/styleMock.js',
    '\\.(jpg|jpeg|png|gif|svg|webp|ico)$': '<rootDir>/dreamscape-tests/__mocks__/fileMock.js',

    // Force single axios copy so jest.mock('axios') works across all imports
    '^axios$': '<rootDir>/dreamscape-tests/node_modules/axios',

    // ESM-only packages that need CJS compat
    '^mapbox-gl$': '<rootDir>/dreamscape-tests/__mocks__/mapboxMock.js',
  },

  transform: {
    '^.+\\.(ts|tsx)$': path.resolve(testsDir, 'transforms/vite-meta-transform.js'),
    '^.+\\.jsx?$': path.resolve(testsDir, 'node_modules/babel-jest'),
  },

  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],

  // Module resolution paths
  modulePaths: [
    '<rootDir>/dreamscape-frontend/web-client/node_modules',
    '<rootDir>/dreamscape-tests/node_modules',
  ],

  // Coverage — now relative to monorepo rootDir
  collectCoverageFrom: [
    'dreamscape-frontend/web-client/src/components/auth/**/*.{ts,tsx}',
    'dreamscape-frontend/web-client/src/components/common/**/*.{ts,tsx}',
    'dreamscape-frontend/web-client/src/services/**/*.ts',
    'dreamscape-frontend/web-client/src/store/**/*.ts',
    'dreamscape-frontend/web-client/src/pages/**/*.{ts,tsx}',
    'dreamscape-frontend/web-client/src/components/bookings/**/*.{ts,tsx}',
    'dreamscape-frontend/web-client/src/components/cart/**/*.{ts,tsx}',
    'dreamscape-frontend/web-client/src/components/flights/**/*.{ts,tsx}',
    'dreamscape-frontend/web-client/src/components/hotels/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],

  coverageDirectory: '<rootDir>/dreamscape-tests/coverage/frontend-dr562-566',
  coverageProvider: 'v8',

  testTimeout: 10000,
  verbose: true,
  clearMocks: true,
};
