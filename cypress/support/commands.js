/**
 * Cypress Custom Commands
 *
 * Add custom Cypress commands here.
 *
 * Example:
 * Cypress.Commands.add('login', (email, password) => { ... })
 */

// Example custom command for API authentication
Cypress.Commands.add('login', (email, password) => {
  cy.request({
    method: 'POST',
    url: `${Cypress.env('AUTH_SERVICE_URL')}/api/v1/auth/login`,
    body: { email, password }
  }).then((response) => {
    window.localStorage.setItem('authToken', response.body.token);
  });
});

// Example custom command for waiting on API
Cypress.Commands.add('waitForAPI', (url, timeout = 5000) => {
  cy.request({
    url,
    timeout,
    failOnStatusCode: false
  });
});
