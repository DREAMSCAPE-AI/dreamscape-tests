/**
 * DR-523 — Authentication E2E Tests
 *
 * Covers:
 * 1. Inscription complète (signup)
 * 2. Connexion réussie (login)
 * 3. Redirection protégée → /auth si non connecté
 * 4. Déconnexion
 * 5. Erreurs de validation côté client
 * 6. Erreurs d'authentification côté API (mauvais mdp, email inconnu)
 * 7. Toggle login ↔ signup sur la même page
 */

const BASE_URL = 'http://localhost:5173';
const AUTH_URL = `${BASE_URL}/login`; // /login redirects to /auth
const AUTH_SERVICE_URL = Cypress.env('AUTH_SERVICE_URL') || 'http://localhost:3001';

// Generate a unique email per run to avoid conflicts (no + to avoid normalization issues)
const ts = Date.now();
const TEST_USER = {
  firstName: 'Alice',
  lastName: 'E2E',
  email: `alice${ts}@dreamscape.test`,
  password: 'SecurePass123!',
};

// Pre-seeded user guaranteed to exist (created via db:seed)
const SEED_USER = {
  email: Cypress.env('SEED_USER_EMAIL') || 'seed@dreamscape.test',
  password: Cypress.env('SEED_USER_PASSWORD') || 'SeedPass123!',
};

describe('Authentication — Signup', () => {
  beforeEach(() => {
    cy.logout();
    cy.visit(AUTH_URL);
    // Wait for login form to render before toggling to signup
    cy.get('#login-email', { timeout: 10000 }).should('exist');
    // Switch to signup form (FR: "S'inscrire" / EN: "Sign Up")
    cy.contains('button', /inscrire|sign.?up/i).click();
  });

  it('should display the signup form', () => {
    cy.get('#signup-firstname').should('be.visible');
    cy.get('#signup-lastname').should('be.visible');
    cy.get('#signup-email').should('be.visible');
    cy.get('#signup-password').should('be.visible');
    cy.get('#signup-confirm-password').should('be.visible');
  });

  it('should show validation errors on empty submit', () => {
    cy.get('form').submit();
    cy.get('[role="alert"]').should('have.length.at.least', 1);
  });

  it('should show error when passwords do not match', () => {
    cy.get('#signup-firstname').type(TEST_USER.firstName);
    cy.get('#signup-lastname').type(TEST_USER.lastName);
    cy.get('#signup-email').type(TEST_USER.email);
    cy.get('#signup-password').type(TEST_USER.password);
    cy.get('#signup-confirm-password').type('WrongPassword999!');
    cy.get('form').submit();
    cy.get('[id="signup-confirm-password-error"]').should('be.visible');
  });

  it('should show error when password is too short', () => {
    cy.get('#signup-firstname').type(TEST_USER.firstName);
    cy.get('#signup-lastname').type(TEST_USER.lastName);
    cy.get('#signup-email').type(TEST_USER.email);
    cy.get('#signup-password').type('short');
    cy.get('#signup-confirm-password').type('short');
    cy.get('form').submit();
    cy.get('[id="signup-password-error"]').should('be.visible');
  });

  it('should register a new user and redirect to home', () => {
    cy.get('#signup-firstname').type(TEST_USER.firstName);
    cy.get('#signup-lastname').type(TEST_USER.lastName);
    cy.get('#signup-email').type(TEST_USER.email);
    cy.get('#signup-password').type(TEST_USER.password);
    cy.get('#signup-confirm-password').type(TEST_USER.password);
    cy.get('form').submit();

    cy.url({ timeout: 10000 }).should('not.include', '/auth');
    cy.window().then((win) => {
      const stored = JSON.parse(win.localStorage.getItem('auth-storage') || '{}');
      expect(stored.state?.isAuthenticated).to.eq(true);
      expect(stored.state?.token).to.be.a('string');
    });
  });

  it('should show API error when registering with an existing email', () => {
    // Use a known existing email
    cy.get('#signup-firstname').type('Bob');
    cy.get('#signup-lastname').type('Duplicate');
    cy.get('#signup-email').type(TEST_USER.email);
    cy.get('#signup-password').type(TEST_USER.password);
    cy.get('#signup-confirm-password').type(TEST_USER.password);
    cy.get('form').submit();

    // Wait for potential API error message (email already taken)
    cy.get('[role="alert"], .text-red-500, .text-red-600', { timeout: 8000 })
      .should('be.visible');
  });
});

describe('Authentication — Login', () => {
  beforeEach(() => {
    cy.logout();
    cy.visit(AUTH_URL);
    // Wait for the login form to fully render
    cy.get('#login-email', { timeout: 10000 }).should('exist');
  });

  it('should display the login form by default', () => {
    cy.get('#login-email').should('be.visible');
    cy.get('#login-password').should('be.visible');
    cy.get('button[type="submit"]').should('be.visible');
  });

  it('should show validation error for invalid email format', () => {
    cy.get('#login-email').type('not-an-email');
    cy.get('#login-password').type('somepassword');
    cy.get('form').submit();
    cy.get('[id="login-email-error"]').should('be.visible');
  });

  it('should show validation error for missing password', () => {
    cy.get('#login-email').type('user@example.com');
    cy.get('form').submit();
    cy.get('[id="login-password-error"]').should('be.visible');
  });

  it('should show error on wrong credentials', () => {
    cy.get('#login-email').type('nonexistent@dreamscape.test');
    cy.get('#login-password').type('WrongPassword123!');
    cy.get('form').submit();

    cy.get('.text-red-500, .text-red-600, [role="alert"]', { timeout: 8000 })
      .should('be.visible');
    cy.url().should('include', '/auth');
  });

  it('should toggle password visibility', () => {
    cy.get('#login-password').type('mypassword');
    cy.get('#login-password').should('have.attr', 'type', 'password');

    cy.get('[aria-label*="Afficher"]').click();
    cy.get('#login-password').should('have.attr', 'type', 'text');

    cy.get('[aria-label*="Masquer"]').click();
    cy.get('#login-password').should('have.attr', 'type', 'password');
  });

  it('should login successfully and redirect to home', () => {
    cy.loginByApi(SEED_USER.email, SEED_USER.password);
    cy.visit(BASE_URL);
    cy.url().should('not.include', '/auth');
    cy.window().then((win) => {
      const stored = JSON.parse(win.localStorage.getItem('auth-storage') || '{}');
      expect(stored.state?.isAuthenticated).to.eq(true);
    });
  });

  it('should switch from login to signup form', () => {
    cy.contains('button', /inscrire|sign.?up/i).click();
    cy.get('#signup-firstname').should('be.visible');
    cy.get('#login-email').should('not.exist');
  });
});

describe('Authentication — Protected routes & Logout', () => {
  it('should redirect unauthenticated user to /auth when accessing /bookings', () => {
    cy.visit(AUTH_URL);
    cy.logout();
    cy.visit(`${BASE_URL}/bookings`);
    cy.url({ timeout: 5000 }).should('include', '/auth');
  });

  it('should allow authenticated user to access /bookings', () => {
    cy.visit(AUTH_URL);
    cy.loginByApi(SEED_USER.email, SEED_USER.password);
    cy.visit(`${BASE_URL}/bookings`);
    cy.url().should('include', '/bookings');
    cy.contains(/mes.r.servations|bookings/i, { timeout: 8000 }).should('be.visible');
  });

  it('should logout and clear auth state', () => {
    cy.visit(AUTH_URL);
    cy.loginByApi(SEED_USER.email, SEED_USER.password);
    cy.visit(BASE_URL);

    // Open user menu dropdown first, then click logout
    cy.get('[aria-label="Menu utilisateur"]', { timeout: 8000 }).click();
    cy.get('[role="menuitem"]').contains(/logout|déconnexion/i).click({ force: true });

    cy.window().then((win) => {
      const stored = JSON.parse(win.localStorage.getItem('auth-storage') || '{}');
      expect(stored.state?.isAuthenticated).to.not.eq(true);
    });
  });
});
