const { defineConfig } = require('cypress');
const { kafkaTasks } = require('./cypress/plugins/kafka-consumer');

module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173',
    viewportWidth: 1280,
    viewportHeight: 720,
    supportFile: 'cypress/support/e2e.js',
    specPattern: 'tests/e2e/**/*.cy.{js,jsx,ts,tsx}',
    screenshotsFolder: 'cypress/screenshots',
    videosFolder: 'cypress/videos',
    fixturesFolder: 'cypress/fixtures',
    video: false,
    chromeWebSecurity: false,
    setupNodeEvents(on, config) {
      // Register Kafka tasks for event verification
      on('task', {
        ...kafkaTasks,
        // Log task for debugging
        log(message) {
          console.log(message);
          return null;
        }
      });

      // Start Kafka consumer before all tests
      on('before:run', async () => {
        console.log('Starting Kafka consumer for E2E tests...');
        try {
          await kafkaTasks['kafka:start']();
        } catch (error) {
          console.warn('Warning: Could not start Kafka consumer:', error.message);
          console.warn('Kafka event verification will be skipped');
        }
      });

      // Stop Kafka consumer after all tests
      on('after:run', async () => {
        console.log('Stopping Kafka consumer...');
        try {
          await kafkaTasks['kafka:stop']();
        } catch (error) {
          console.warn('Warning: Error stopping Kafka consumer:', error.message);
        }
      });

      return config;
    },
    env: {
      AUTH_SERVICE_URL: 'http://localhost:3001',
      USER_SERVICE_URL: 'http://localhost:3002',
      VOYAGE_SERVICE_URL: 'http://localhost:3003',
      AI_SERVICE_URL: 'http://localhost:3005',
      GATEWAY_URL: 'http://localhost:4000',
      WEB_CLIENT_URL: 'http://localhost:5173',
      KAFKA_BROKERS: 'localhost:9092',
      // Seed user with pre-existing bookings (created via npm run db:seed)
      SEED_USER_EMAIL: 'seed@dreamscape.test',
      SEED_USER_PASSWORD: 'SeedPass123!'
    },
    retries: {
      runMode: 2,   // retry failed tests twice in CI
      openMode: 0,
    },
    defaultCommandTimeout: 8000,
    requestTimeout: 15000,
    responseTimeout: 15000
  },
});