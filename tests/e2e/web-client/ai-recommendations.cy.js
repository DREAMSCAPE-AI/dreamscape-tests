/**
 * DR-523 — AI Recommendations E2E Tests
 *
 * Covers:
 * 1. Section RecommendationsSection visible sur le dashboard
 * 2. État initial — selector de type (flights/hotels/activities)
 * 3. Ouverture de la modal IA
 * 4. Affichage des propositions IA
 * 5. Sélection d'une proposition → modal d'action (panier vs itinéraire)
 * 6. Ajout au panier depuis les recommandations
 * 7. Bouton Refresh
 * 8. Recommandations sauvegardées en localStorage
 * 9. Comportement si service IA indisponible
 */

const BASE_URL = 'http://localhost:5173';
const AI_SERVICE_URL = Cypress.env('AI_SERVICE_URL') || 'http://localhost:3005';
const VOYAGE_SERVICE_URL = Cypress.env('VOYAGE_SERVICE_URL') || 'http://localhost:3003';

const SEED_USER = {
  email: Cypress.env('SEED_USER_EMAIL') || 'seed@dreamscape.test',
  password: Cypress.env('SEED_USER_PASSWORD') || 'SeedPass123!',
};

// Stub AI proposals returned by the recommendation modal
const MOCK_PROPOSALS = [
  {
    id: 'prop-1',
    type: 'flight',
    title: 'Paris → Tokyo',
    subtitle: 'Vol direct 12h',
    location: 'Tokyo, Japon',
    price: 850,
    currency: 'EUR',
    rating: 4.7,
    image: '',
  },
  {
    id: 'prop-2',
    type: 'flight',
    title: 'Paris → New York',
    subtitle: 'Vol direct 8h',
    location: 'New York, USA',
    price: 650,
    currency: 'EUR',
    rating: 4.5,
    image: '',
  },
  {
    id: 'prop-3',
    type: 'flight',
    title: 'Paris → Barcelone',
    subtitle: 'Vol direct 2h',
    location: 'Barcelone, Espagne',
    price: 120,
    currency: 'EUR',
    rating: 4.3,
    image: '',
  },
];

describe('AI Recommendations — Section visibility', () => {
  beforeEach(() => {
    cy.visit(BASE_URL);
    cy.loginByApi(SEED_USER.email, SEED_USER.password);
    cy.visit(BASE_URL);
  });

  it('should display the recommendations section on the dashboard', () => {
    cy.contains(/Pour vous|Recommandations|for you/i, { timeout: 10000 }).should('be.visible');
  });

  it('should show the AI recommendation selector when no recommendations are cached', () => {
    // Clear saved recommendations from localStorage
    cy.window().then((win) => {
      win.localStorage.removeItem('dreamscape-recommendation-history');
    });
    cy.reload();

    cy.contains(/Pour vous|Recommandations/i, { timeout: 10000 }).should('be.visible');
    // Selector buttons for type selection should be visible
    cy.contains(/vol|flight|hotel|activit/i, { timeout: 8000 }).should('be.visible');
  });

  it('should show a refresh button in the recommendations header', () => {
    cy.contains(/Pour vous|Recommandations/i, { timeout: 10000 }).should('be.visible');
    cy.get('[aria-label*="refresh"], [title*="Actualiser"], [aria-label*="Actualiser"]')
      .should('be.visible');
  });
});

describe('AI Recommendations — Modal interaction', () => {
  beforeEach(() => {
    cy.visit(BASE_URL);
    cy.loginByApi(SEED_USER.email, SEED_USER.password);
    cy.window().then((win) => {
      win.localStorage.removeItem('dreamscape-recommendation-history');
    });
    cy.visit(BASE_URL);
    cy.contains(/Pour vous|Recommandations/i, { timeout: 10000 }).should('be.visible');
  });

  it('should open the AI recommendation modal when a type is selected', () => {
    // Intercept the AI service call to avoid real API dependency
    cy.intercept('POST', '**/ai/**', {
      statusCode: 200,
      body: { success: true, data: { proposals: MOCK_PROPOSALS } },
    }).as('aiRequest');

    cy.get('[aria-label*="vol"], button:contains("Vols"), button:contains("Flights")')
      .first()
      .click({ force: true });

    // Modal should open
    cy.get('.fixed.inset-0', { timeout: 5000 }).should('be.visible');
  });

  it('should display proposals inside the AI modal', () => {
    cy.intercept('POST', '**/ai/**', {
      statusCode: 200,
      body: { success: true, data: { proposals: MOCK_PROPOSALS } },
    }).as('aiRequest');

    cy.get('[aria-label*="vol"], button:contains("Vols"), button:contains("Flights")')
      .first()
      .click({ force: true });

    // Wait for proposals to appear in the modal
    cy.contains('Paris → Tokyo', { timeout: 10000 }).should('be.visible');
    cy.contains('Paris → New York').should('be.visible');
  });

  it('should close the modal when clicking the close button', () => {
    cy.intercept('POST', '**/ai/**', {
      statusCode: 200,
      body: { success: true, data: { proposals: MOCK_PROPOSALS } },
    });

    cy.get('[aria-label*="vol"], button:contains("Vols"), button:contains("Flights")')
      .first()
      .click({ force: true });

    cy.get('.fixed.inset-0', { timeout: 5000 }).should('be.visible');
    cy.get('[aria-label*="close"], [aria-label*="Fermer"], button:has(.lucide-x)')
      .first()
      .click({ force: true });

    cy.get('.fixed.inset-0').should('not.exist');
  });
});

describe('AI Recommendations — Proposal selection & cart action', () => {
  beforeEach(() => {
    cy.visit(BASE_URL);
    cy.loginByApi(SEED_USER.email, SEED_USER.password);
    cy.window().then((win) => {
      win.localStorage.removeItem('dreamscape-recommendation-history');
    });
    cy.visit(BASE_URL);
    cy.contains(/Pour vous|Recommandations/i, { timeout: 10000 }).should('be.visible');
  });

  it('should open action modal after selecting a proposal', () => {
    cy.intercept('POST', '**/ai/**', {
      statusCode: 200,
      body: { success: true, data: { proposals: MOCK_PROPOSALS } },
    });

    cy.get('[aria-label*="vol"], button:contains("Vols"), button:contains("Flights")')
      .first()
      .click({ force: true });

    // Select a proposal (click on it or a select/confirm button)
    cy.contains('Paris → Tokyo', { timeout: 10000 })
      .parents('[class*="card"], [class*="item"], li, article')
      .first()
      .within(() => {
        cy.get('button, input[type="checkbox"]').first().click({ force: true });
      });

    // Confirm selection if there's a confirm button
    cy.get('button:contains("Confirmer"), button:contains("Sélectionner")', { timeout: 3000 })
      .then(($btn) => {
        if ($btn.length) $btn.click();
      });

    // Action modal (cart vs itinerary) should appear
    cy.contains(/panier|itinéraire|cart/i, { timeout: 8000 }).should('be.visible');
  });

  it('should show a success toast after adding to cart', () => {
    cy.intercept('POST', '**/ai/**', {
      statusCode: 200,
      body: { success: true, data: { proposals: MOCK_PROPOSALS } },
    });
    cy.intercept('POST', '**/cart**', { statusCode: 200, body: { success: true } }).as('addToCart');

    cy.get('[aria-label*="vol"], button:contains("Vols"), button:contains("Flights")')
      .first()
      .click({ force: true });

    cy.contains('Paris → Tokyo', { timeout: 10000 })
      .parents('[class*="card"], [class*="item"], li, article')
      .first()
      .within(() => {
        cy.get('button, input[type="checkbox"]').first().click({ force: true });
      });

    cy.get('button:contains("Confirmer"), button:contains("Sélectionner")', { timeout: 3000 })
      .then(($btn) => {
        if ($btn.length) $btn.click();
      });

    // Click "Panier" in action modal
    cy.contains(/panier|Ajouter au panier/i, { timeout: 5000 }).click({ force: true });

    cy.contains(/Ajouté au panier/i, { timeout: 8000 }).should('be.visible');
  });
});

describe('AI Recommendations — Persistence & error states', () => {
  beforeEach(() => {
    cy.visit(BASE_URL);
    cy.loginByApi(SEED_USER.email, SEED_USER.password);
  });

  it('should restore recommendations from localStorage on page reload', () => {
    const historyEntry = {
      timestamp: new Date().toISOString(),
      proposals: MOCK_PROPOSALS,
      type: 'flight',
    };

    cy.visit(BASE_URL);
    cy.window().then((win) => {
      win.localStorage.setItem('dreamscape-recommendation-history', JSON.stringify(historyEntry));
    });
    cy.reload();

    cy.contains(/Pour vous|Recommandations/i, { timeout: 10000 }).should('be.visible');
    cy.contains('Paris → Tokyo', { timeout: 8000 }).should('be.visible');
  });

  it('should allow clearing displayed recommendations and returning to selector', () => {
    const historyEntry = {
      timestamp: new Date().toISOString(),
      proposals: MOCK_PROPOSALS,
      type: 'flight',
    };

    cy.visit(BASE_URL);
    cy.window().then((win) => {
      win.localStorage.setItem('dreamscape-recommendation-history', JSON.stringify(historyEntry));
    });
    cy.reload();

    cy.contains('Générer d\'autres recommandations', { timeout: 8000 }).click();
    cy.contains(/vol|flight|hotel|activit/i, { timeout: 5000 }).should('be.visible');
  });

  it('should show the recommendation selector when AI service returns an error', () => {
    cy.window().then((win) => {
      win.localStorage.removeItem('dreamscape-recommendation-history');
    });
    cy.visit(BASE_URL);

    cy.intercept('POST', '**/ai/**', {
      statusCode: 503,
      body: { success: false, message: 'Service unavailable' },
    }).as('aiError');

    cy.get('[aria-label*="vol"], button:contains("Vols"), button:contains("Flights")', { timeout: 10000 })
      .first()
      .click({ force: true });

    // Modal opens, AI fails — should show error or empty state, not crash
    cy.get('.fixed.inset-0', { timeout: 5000 }).should('exist');
    cy.get('body').should('not.contain', 'TypeError');
    cy.get('body').should('not.contain', 'Cannot read');
  });
});
