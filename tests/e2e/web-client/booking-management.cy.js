/**
 * DR-523 — Booking Management E2E Tests
 *
 * Covers:
 * 1. Page /bookings — affichage liste, état vide
 * 2. Filtres et recherche
 * 3. Navigation vers détail (/bookings/:reference)
 * 4. Annulation d'une réservation (dialog + confirmation)
 * 5. Pagination
 *
 * Prérequis : un utilisateur avec au moins une réservation CONFIRMED.
 * Les tests "avec réservation" utilisent un utilisateur de seed connu.
 */

const BASE_URL = 'http://localhost:5173';
const VOYAGE_SERVICE_URL = Cypress.env('VOYAGE_SERVICE_URL') || 'http://localhost:3003';
const AUTH_SERVICE_URL = Cypress.env('AUTH_SERVICE_URL') || 'http://localhost:3001';

// Credentials for a seed user that has existing bookings (created via db:seed)
const SEED_USER = {
  email: Cypress.env('SEED_USER_EMAIL') || 'seed@dreamscape.test',
  password: Cypress.env('SEED_USER_PASSWORD') || 'SeedPass123!',
};

describe('Booking Management — Empty state', () => {
  let freshUser;

  before(() => {
    // Register a fresh user with no bookings
    const ts = Date.now();
    freshUser = {
      firstName: 'Fresh',
      lastName: 'User',
      email: `fresh${ts}@dreamscape.test`,
      password: 'FreshPass123!',
    };

    cy.request({
      method: 'POST',
      url: `${AUTH_SERVICE_URL}/api/v1/auth/register`,
      body: freshUser,
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status).to.be.oneOf([200, 201]);
    });
  });

  beforeEach(() => {
    // Visit first to establish origin context before setting localStorage
    cy.visit(BASE_URL);
    cy.loginByApi(freshUser.email, freshUser.password);
    cy.visit(`${BASE_URL}/bookings`);
  });

  it('should show the bookings page title', () => {
    cy.contains('Mes Reservations', { timeout: 8000 }).should('be.visible');
  });

  it('should show empty state message when no bookings exist', () => {
    cy.contains('Aucune reservation', { timeout: 8000 }).should('be.visible');
    cy.contains('Explorer les vols').should('be.visible');
  });

  it('should navigate to /flights when clicking "Explorer les vols"', () => {
    cy.contains('Explorer les vols').click();
    cy.url().should('include', '/flights');
  });
});

describe('Booking Management — With bookings', () => {
  beforeEach(() => {
    cy.visit(BASE_URL);
    cy.loginByApi(SEED_USER.email, SEED_USER.password);
    cy.visit(`${BASE_URL}/bookings`);
    cy.contains('Mes Reservations', { timeout: 10000 }).should('be.visible');
    // Wait for bookings to load
    cy.get('body').should('not.contain', 'Chargement');
  });

  it('should display stats cards (total, confirmed, en cours, total dépensé)', () => {
    cy.contains('Total').should('be.visible');
    cy.contains('Confirmees').should('be.visible');
    cy.contains('En cours').should('be.visible');
    cy.contains('Total depense').should('be.visible');
  });

  it('should display at least one booking card', () => {
    // Booking cards are direct children of the container with class space-y-3
    cy.get('.space-y-3 > div', { timeout: 8000 }).should('have.length.at.least', 1);
  });

  it('should filter bookings by status', () => {
    cy.get('select').first().select('CONFIRMED');
    cy.get('body').should('not.contain', 'Chargement');
    // Active filter chip should appear
    cy.contains('Statut').should('be.visible');
  });

  it('should clear a filter chip', () => {
    cy.get('select').first().select('CONFIRMED');
    cy.contains('span', 'Statut').find('button').click();
    cy.contains('Statut').should('not.exist');
  });

  it('should filter bookings by type', () => {
    cy.get('select').eq(1).select('FLIGHT');
    cy.get('body').should('not.contain', 'Chargement');
    cy.contains('Type').should('be.visible');
  });

  it('should search by reference', () => {
    // Type in the search input and verify filter chip appears
    cy.get('input[placeholder*="reference"]').type('DS');
    cy.contains('Recherche: DS').should('be.visible');
  });

  it('should navigate to booking detail page', () => {
    // Click the "Details" button on the first visible booking card
    cy.contains('button', 'Details').first().click();
    cy.url({ timeout: 8000 }).should('match', /\/bookings\/[A-Z0-9-]+/);
  });
});

describe('Booking Management — Detail page', () => {
  let bookingRef;

  before(() => {
    // Get the first booking reference via API
    cy.visit(BASE_URL);
    cy.loginByApi(SEED_USER.email, SEED_USER.password);
    cy.window().then((win) => {
      const stored = JSON.parse(win.localStorage.getItem('auth-storage') || '{}');
      const token = stored.state?.token;
      const userId = stored.state?.user?.id;

      cy.request({
        url: `${VOYAGE_SERVICE_URL}/api/v1/bookings?userId=${userId}&limit=1`,
        headers: { Authorization: `Bearer ${token}` },
        failOnStatusCode: false,
      }).then((res) => {
        if (res.status === 200 && res.body?.data?.length > 0) {
          bookingRef = res.body.data[0].reference;
        }
      });
    });
  });

  beforeEach(() => {
    cy.visit(BASE_URL);
    cy.loginByApi(SEED_USER.email, SEED_USER.password);
  });

  it('should load the booking detail page', function () {
    if (!bookingRef) this.skip();
    cy.visit(`${BASE_URL}/bookings/${bookingRef}`);
    cy.contains(bookingRef, { timeout: 8000 }).should('be.visible');
  });

  it('should display booking status badge', function () {
    if (!bookingRef) this.skip();
    cy.visit(`${BASE_URL}/bookings/${bookingRef}`);
    cy.contains(/(CONFIRMED|PENDING|COMPLETED|CANCELLED|FAILED)/i, { timeout: 8000 }).should('be.visible');
  });

  it('should have a back button that returns to bookings list', function () {
    if (!bookingRef) this.skip();
    cy.visit(`${BASE_URL}/bookings/${bookingRef}`);
    cy.get('button[aria-label="Go back"], button:contains("Retour")').first().click();
    cy.url().should('include', '/bookings');
  });
});

describe('Booking Management — Cancellation flow', () => {
  beforeEach(() => {
    cy.visit(BASE_URL);
    cy.loginByApi(SEED_USER.email, SEED_USER.password);
    cy.visit(`${BASE_URL}/bookings`);
    cy.contains('Mes Reservations', { timeout: 10000 }).should('be.visible');
    cy.get('body').should('not.contain', 'Chargement');
  });

  it('should open the cancel confirmation modal', () => {
    // Find any cancel button (only CONFIRMED/PENDING bookings have one)
    cy.contains('button', /annuler/i).first().click();
    cy.contains('Annuler la reservation', { timeout: 5000 }).should('be.visible');
    cy.contains("Confirmer l'annulation").should('be.visible');
    cy.contains('Retour').should('be.visible');
  });

  it('should close cancel modal when clicking "Retour"', () => {
    cy.contains('button', /annuler/i).first().click();
    cy.contains('Annuler la reservation').should('be.visible');
    cy.contains('Retour').click();
    cy.contains('Annuler la reservation').should('not.exist');
  });

  it('should show the booking reference and amount in the cancel modal', () => {
    cy.contains('button', /annuler/i).first().click();
    cy.contains('Annuler la reservation').should('be.visible');
    cy.contains('Ref:').should('be.visible');
    cy.contains('Montant:').should('be.visible');
  });
});
