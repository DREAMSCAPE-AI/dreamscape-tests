/**
 * Cypress Custom Commands
 */

const AUTH_SERVICE_URL = Cypress.env('AUTH_SERVICE_URL') || 'http://localhost:3001';
const VOYAGE_SERVICE_URL = Cypress.env('VOYAGE_SERVICE_URL') || 'http://localhost:3003';

/**
 * Programmatic login via API — bypasses UI, sets Zustand auth-storage directly.
 * Much faster than filling in the login form for tests that just need an authenticated state.
 */
Cypress.Commands.add('loginByApi', (email, password) => {
  cy.request({
    method: 'POST',
    url: `${AUTH_SERVICE_URL}/api/v1/auth/login`,
    body: { email, password },
    failOnStatusCode: false,
  }).then((response) => {
    expect(response.status, `Login API for ${email}`).to.eq(200);

    const { tokens, user } = response.body.data;
    const token = tokens?.accessToken;

    // Reproduce Zustand persist format: { state: {...}, version: 0 }
    const authStorage = {
      state: {
        user: {
          id: user.id,
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
          email: user.email,
          role: user.role === 'ADMIN' ? 'admin' : 'user',
          username: user.username,
          isVerified: user.isVerified,
          onboardingCompleted: user.onboardingCompleted,
          onboardingCompletedAt: user.onboardingCompletedAt,
        },
        token,
        isAuthenticated: true,
      },
      version: 0,
    };

    cy.window().then((win) => {
      win.localStorage.setItem('auth-storage', JSON.stringify(authStorage));
    });
  });
});

/**
 * Register a fresh user via API and log them in.
 * Generates a unique email to avoid conflicts across test runs.
 */
Cypress.Commands.add('registerAndLogin', (overrides = {}) => {
  const ts = Date.now();
  const user = {
    firstName: overrides.firstName || 'Test',
    lastName: overrides.lastName || 'User',
    email: overrides.email || `e2e+${ts}@dreamscape.test`,
    password: overrides.password || 'TestPassword123!',
  };

  cy.request({
    method: 'POST',
    url: `${AUTH_SERVICE_URL}/api/v1/auth/register`,
    body: user,
    failOnStatusCode: false,
  }).then((response) => {
    // 201 Created or 200 OK depending on service version
    expect(response.status).to.be.oneOf([200, 201]);

    const { tokens, user: createdUser } = response.body.data;
    const token = tokens?.accessToken;

    const authStorage = {
      state: {
        user: {
          id: createdUser.id,
          name: `${createdUser.firstName || ''} ${createdUser.lastName || ''}`.trim() || createdUser.email,
          email: createdUser.email,
          role: 'user',
          username: createdUser.username,
          isVerified: createdUser.isVerified,
          onboardingCompleted: createdUser.onboardingCompleted,
        },
        token,
        isAuthenticated: true,
      },
      version: 0,
    };

    cy.window().then((win) => {
      win.localStorage.setItem('auth-storage', JSON.stringify(authStorage));
    });

    // Expose the created user data to the test via alias
    cy.wrap({ ...user, id: createdUser.id, token }).as('currentUser');
  });
});

/**
 * Clear auth state (logout).
 */
Cypress.Commands.add('logout', () => {
  cy.clearLocalStorage('auth-storage');
});

/**
 * Seed a booking via API for use in booking management tests.
 */
Cypress.Commands.add('seedBooking', (userId, token) => {
  cy.request({
    method: 'POST',
    url: `${VOYAGE_SERVICE_URL}/api/v1/bookings/seed-test`,
    headers: { Authorization: `Bearer ${token}` },
    body: { userId },
    failOnStatusCode: false,
  });
});

/**
 * Wait for an element to stop showing a loading spinner.
 */
Cypress.Commands.add('waitForLoad', (selector = '[data-testid="loading-spinner"]') => {
  cy.get(selector, { timeout: 10000 }).should('not.exist');
});

// Legacy alias kept for compatibility with existing tests
Cypress.Commands.add('login', (email, password) => {
  cy.loginByApi(email, password);
});
