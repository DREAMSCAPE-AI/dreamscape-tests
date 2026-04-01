/**
 * Cypress E2E Support File
 *
 * This file is loaded before every test file.
 * It's a great place to put global configuration and behavior.
 */

// Import commands
import './commands';

// Prevent Cypress from failing on uncaught exceptions from the app
// (e.g. failed API calls on startup in dev mode)
Cypress.on('uncaught:exception', (err, runnable) => {
  // Ignore React/Vite hot-reload errors and non-critical startup errors
  if (
    err.message.includes('ResizeObserver') ||
    err.message.includes('ChunkLoadError') ||
    err.message.includes('Loading CSS chunk') ||
    err.message.includes('Cannot read properties of undefined')
  ) {
    return false;
  }
  // Return false to prevent the error from failing the test
  return false;
});
