/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',

  // Remonter au niveau monorepo pour que Jest puisse instrumenter
  // les fichiers sources hors de dreamscape-tests/
  // Note: pas de preset:'ts-jest' ici — Jest le chercherait dans rootDir/node_modules
  // On configure ts-jest directement dans transform ci-dessous
  rootDir: '../',

  roots: [
    '<rootDir>/dreamscape-tests/tests/DR-538-US-TEST-001',
    '<rootDir>/dreamscape-services/auth/src/services',
  ],
  testMatch: ['**/DR-538-US-TEST-001/**/*.test.ts'],

  moduleNameMapper: {
    '^@types$': '<rootDir>/dreamscape-services/auth/src/types/index.ts',
    '^@dreamscape/db$': '<rootDir>/dreamscape-tests/__mocks__/db.ts',
    '^jsonwebtoken$': '<rootDir>/dreamscape-services/auth/node_modules/jsonwebtoken',
    '^bcryptjs$': '<rootDir>/dreamscape-services/auth/node_modules/bcryptjs',
  },

  setupFilesAfterEnv: ['<rootDir>/dreamscape-tests/jest.setup.js'],

  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transform: {
    '^.+\\.ts$': ['<rootDir>/dreamscape-tests/node_modules/ts-jest', {
      diagnostics: false,
      tsconfig: {
        module: 'commonjs',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        strict: false,
      },
    }],
  },

  collectCoverageFrom: [
    '<rootDir>/dreamscape-services/auth/src/services/AuthService.ts',
  ],
  coverageDirectory: '<rootDir>/dreamscape-tests/coverage/dr538',
  coverageThreshold: {
    global: { branches: 80, functions: 80, lines: 80, statements: 80 },
  },

  clearMocks: true,
  resetMocks: true,
  testTimeout: 10000,
  verbose: true,
};
