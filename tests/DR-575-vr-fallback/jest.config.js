/**
 * Jest config for DR-575 VR Fallback tests
 * Uses jsdom environment and transforms panorama source files with JSX support
 */
const path = require('path');

module.exports = {
  testEnvironment: 'jsdom',
  rootDir: '../..',
  testMatch: [
    '<rootDir>/tests/DR-575-vr-fallback/**/*.test.js',
  ],
  transform: {
    '^.+\\.jsx?$': ['babel-jest', {
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        ['@babel/preset-react', { runtime: 'automatic' }],
      ],
    }],
  },
  transformIgnorePatterns: [
    '/node_modules/',
  ],
  // Force all imports of 'react' and 'react-dom' to use dreamscape-tests' versions
  // This avoids dual React instance issues when importing panorama components
  moduleNameMapper: {
    '^react$': path.resolve(__dirname, '../../node_modules/react'),
    '^react/(.*)$': path.resolve(__dirname, '../../node_modules/react/$1'),
    '^react-dom$': path.resolve(__dirname, '../../node_modules/react-dom'),
    '^react-dom/(.*)$': path.resolve(__dirname, '../../node_modules/react-dom/$1'),
  },
  moduleFileExtensions: ['js', 'jsx', 'json'],
  verbose: true,
  testTimeout: 15000,
};
