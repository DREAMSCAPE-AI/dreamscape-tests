/**
 * Jest config for DR-568: Panorama VR unit tests
 * (VRScene, Hotspot, TextureLoader, AssetCache, WebGLDetector)
 *
 * Environment: jsdom (React + DOM + WebGL mocks)
 */

const path = require('path');

/** @type {import('jest').Config} */
module.exports = {
  displayName: 'panorama-unit',
  testEnvironment: 'jest-environment-jsdom',

  rootDir: '../',

  roots: [
    '<rootDir>/dreamscape-tests/tests/DR-568-panorama-unit',
    '<rootDir>/dreamscape-frontend/panorama/src',
  ],

  testMatch: ['**/DR-568-panorama-unit/**/*.test.{js,ts,tsx}'],

  setupFilesAfterEnv: [
    '<rootDir>/dreamscape-tests/jest.setup.js',
    '<rootDir>/dreamscape-tests/tests/DR-568-panorama-unit/setup.js',
  ],

  moduleNameMapper: {
    // Static assets
    '\\.(css|less|scss|sass)$': '<rootDir>/dreamscape-tests/__mocks__/styleMock.js',
    '\\.(jpg|jpeg|png|gif|svg|webp|ico)$': '<rootDir>/dreamscape-tests/__mocks__/fileMock.js',
  },

  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],

  transform: {
    '^.+\\.(ts|tsx)$': ['<rootDir>/dreamscape-tests/node_modules/ts-jest', {
      diagnostics: false,
      tsconfig: {
        module: 'commonjs',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        strict: false,
        jsx: 'react-jsx',
        target: 'ES2022',
      },
    }],
    '^.+\\.jsx?$': ['<rootDir>/dreamscape-tests/node_modules/babel-jest', {
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        '@babel/preset-react',
      ],
    }],
  },

  transformIgnorePatterns: [
    // Only ignore node_modules EXCEPT packages that ship ESM
    'node_modules/(?!(three|@react-three|troika-three-text|troika-worker-utils)/)',
  ],

  modulePaths: [
    '<rootDir>/dreamscape-frontend/panorama/node_modules',
    '<rootDir>/dreamscape-tests/node_modules',
  ],

  collectCoverageFrom: [
    'dreamscape-frontend/panorama/src/services/AssetCache.js',
    'dreamscape-frontend/panorama/src/services/TextureLoader.js',
    'dreamscape-frontend/panorama/src/services/WebGLDetector.js',
  ],
  coverageDirectory: '<rootDir>/dreamscape-tests/coverage/dr568',
  coverageProvider: 'v8',
  forceCoverageMatch: ['**/panorama/src/services/**/*.js'],
  coverageThreshold: {
    global: { branches: 80, functions: 80, lines: 80, statements: 80 },
  },

  clearMocks: true,
  testTimeout: 15000,
  verbose: true,
};
