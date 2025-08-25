const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    supportFile: 'cypress/support/e2e.js',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    video: false,
    screenshot: false,
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
    env: {
      JWT_SECRET: 'test-jwt-secret',
      API_BASE_URL: 'http://localhost:3000/api/v1'
    }
  },
  component: {
    devServer: {
      framework: 'react',
      bundler: 'vite',
    },
  },
});