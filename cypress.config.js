const { defineConfig } = require('cypress');
const { kafkaTasks } = require('./cypress/plugins/kafka-consumer');

module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173',
    viewportWidth: 1280,
    viewportHeight: 720,
    supportFile: false,
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
      USER_SERVICE_URL: 'http://localhost:3003',
      WEB_CLIENT_URL: 'http://localhost:5173',
      KAFKA_BROKERS: 'localhost:9092'
    }
  },
});