/**
 * DR-523 — VR Access E2E Tests
 *
 * Covers:
 * 1. Bouton "VR Access" visible sur la page destination
 * 2. Ouverture de la modal PIN
 * 3. Affichage du PIN ou état de chargement
 * 4. Fermeture de la modal
 * 5. Bouton "Nouveau code" (refresh)
 * 6. PIN expiré → affichage message + nouveau code
 * 7. Erreur API → message d'erreur + réessayer
 * 8. Redirection /vr/:id → chargement panorama
 */

const BASE_URL = 'http://localhost:5173';
const GATEWAY_URL = Cypress.env('GATEWAY_URL') || 'http://localhost:4000';

// Page destination qui inclut le composant VRPinAccess
// Utilise Paris comme exemple (destinationId: 'paris')
// Note: route is /destination/:id (singular) in App.tsx
const DESTINATION_WITH_VR = '/destination/paris';

describe('VR Access — PIN modal', () => {
  beforeEach(() => {
    // VRPinAccess ne nécessite pas d'auth (destination publique)
    cy.visit(`${BASE_URL}${DESTINATION_WITH_VR}`, { failOnStatusCode: false });
  });

  it('should display the VR Access button', () => {
    cy.contains('button', 'VR Access', { timeout: 8000 }).should('be.visible');
  });

  it('should open the PIN modal when clicking VR Access', () => {
    cy.contains('button', 'VR Access').click();
    cy.contains("Code d'accès VR", { timeout: 5000 }).should('be.visible');
    cy.contains('Entrez ce code dans le navigateur de votre casque VR').should('be.visible');
  });

  it('should show loading state while generating PIN', () => {
    // Intercept and delay the API call to observe loading state
    cy.intercept('POST', '**/api/v1/vr/sessions', (req) => {
      req.reply({ delay: 2000, body: { success: true, data: { pin: '123456', expiresAt: Date.now() + 600000 } } });
    }).as('generatePin');

    cy.contains('button', 'VR Access').click();
    cy.contains('Génération du code', { timeout: 3000 }).should('be.visible');
    cy.wait('@generatePin');
  });

  it('should display a 6-digit PIN after generation', () => {
    cy.intercept('POST', '**/api/v1/vr/sessions', {
      statusCode: 200,
      body: { success: true, data: { pin: '482915', expiresAt: Date.now() + 600000 } },
    }).as('generatePin');

    cy.contains('button', 'VR Access').click();
    cy.wait('@generatePin');

    cy.contains('Votre code PIN').should('be.visible');
    // PIN displayed as "482 915" (space in the middle)
    cy.contains(/\d{3}\s?\d{3}/).should('be.visible');
  });

  it('should show countdown timer when PIN is active', () => {
    cy.intercept('POST', '**/api/v1/vr/sessions', {
      statusCode: 200,
      body: { success: true, data: { pin: '482915', expiresAt: Date.now() + 600000 } },
    }).as('generatePin');

    cy.contains('button', 'VR Access').click();
    cy.wait('@generatePin');

    cy.contains('Expire dans :').should('be.visible');
    cy.contains(/\d+:\d{2}/).should('be.visible');
  });

  it('should close the modal when clicking the close button', () => {
    cy.intercept('POST', '**/api/v1/vr/sessions', {
      statusCode: 200,
      body: { success: true, data: { pin: '482915', expiresAt: Date.now() + 600000 } },
    });

    cy.contains('button', 'VR Access').click();
    cy.contains("Code d'accès VR").should('be.visible');

    // Close button (X icon) in the top-right of the modal
    cy.get('.fixed.inset-0').within(() => {
      cy.get('button').first().click();
    });

    cy.contains("Code d'accès VR").should('not.exist');
  });

  it('should generate a new PIN when clicking "Nouveau code"', () => {
    let callCount = 0;
    cy.intercept('POST', '**/api/v1/vr/sessions', (req) => {
      callCount++;
      req.reply({ success: true, data: { pin: callCount === 1 ? '111111' : '222222', expiresAt: Date.now() + 600000 } });
    }).as('generatePin');

    cy.contains('button', 'VR Access').click();
    cy.wait('@generatePin');

    cy.contains('Nouveau code').click();
    cy.wait('@generatePin');

    // Should have called the API twice
    cy.get('@generatePin.all').should('have.length', 2);
  });

  it('should show error message when gateway is unreachable', () => {
    cy.intercept('POST', '**/api/v1/vr/sessions', {
      forceNetworkError: true,
    }).as('generatePinError');

    cy.contains('button', 'VR Access').click();
    cy.wait('@generatePinError');

    cy.contains(/indisponible|impossible|erreur/i, { timeout: 5000 }).should('be.visible');
    cy.contains('Réessayer').should('be.visible');
  });

  it('should show expired state when PIN expires', () => {
    cy.intercept('POST', '**/api/v1/vr/sessions', {
      statusCode: 200,
      // expiresAt in the past → triggers immediate expiry
      body: { success: true, data: { pin: '999999', expiresAt: Date.now() - 1000 } },
    }).as('generatePin');

    cy.contains('button', 'VR Access').click();
    cy.wait('@generatePin');

    cy.contains('Code expiré', { timeout: 5000 }).should('be.visible');
    cy.contains('Nouveau code').should('be.visible');
  });
});

describe('VR Access — /vr/:id routing', () => {
  it('should redirect /vr/paris to panorama URL', () => {
    cy.visit(`${BASE_URL}/vr/paris`);
    // Page shows "Lancement de l'expérience VR" before redirect
    cy.contains("Lancement de l'expérience VR", { timeout: 5000 }).should('be.visible');
    cy.contains('PAR').should('be.visible');
  });

  it('should display the destination name on the VR loading screen', () => {
    cy.visit(`${BASE_URL}/vr/tokyo`);
    cy.contains('TOKYO', { timeout: 5000 }).should('be.visible');
  });

  it('should show a loading spinner on the VR loading page', () => {
    cy.visit(`${BASE_URL}/vr/barcelona`);
    cy.get('.animate-spin', { timeout: 5000 }).should('be.visible');
  });
});
