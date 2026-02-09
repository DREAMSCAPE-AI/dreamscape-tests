/**
 * Example Test Using Language Helpers
 *
 * This file demonstrates how to use the language-helpers.js functions
 * in your own tests for simplified language testing.
 */

import {
  switchToFrench,
  switchToEnglish,
  verifyCurrentLanguage,
  verifyFrenchContent,
  verifyEnglishContent,
  clearLanguagePreference,
  visitWithLanguage,
  verifyLanguagePersisted,
  switchLanguageAndNavigate,
} from '../../../cypress/support/language-helpers';

describe('i18n Helper Functions - Example Usage', () => {
  const baseUrl = 'http://localhost:5173';

  beforeEach(() => {
    clearLanguagePreference();
    cy.visit(baseUrl);
    cy.wait(500);
  });

  it('Example 1: Simple language switch to French', () => {
    // Using helper function instead of manual clicks
    switchToFrench();

    // Verify French content
    verifyFrenchContent();
    verifyCurrentLanguage('fr');
  });

  it('Example 2: Toggle between languages', () => {
    // Switch to French
    switchToFrench();
    verifyCurrentLanguage('fr');

    // Switch back to English
    switchToEnglish();
    verifyCurrentLanguage('en');
  });

  it('Example 3: Visit page with pre-set language', () => {
    // Visit page with French already set
    visitWithLanguage(baseUrl, 'fr');

    // Verify page loaded in French
    verifyFrenchContent();
    verifyCurrentLanguage('fr');
  });

  it('Example 4: Verify language persistence', () => {
    // Switch to French
    switchToFrench();

    // Check localStorage was updated
    verifyLanguagePersisted('fr');

    // Reload and verify persistence
    cy.reload();
    cy.wait(1000);
    verifyCurrentLanguage('fr');
  });

  it('Example 5: Switch language and navigate', () => {
    // Switch to French and navigate to Destinations
    switchLanguageAndNavigate('fr', 'Destinations');

    // Verify we're on destinations page in French
    cy.url().should('include', '/destinations');
    verifyCurrentLanguage('fr');
  });

  it('Example 6: Test multi-language workflow', () => {
    // Start in English
    verifyEnglishContent();

    // User searches for flights in French
    switchToFrench();
    cy.contains('Vols').click();

    // Verify still in French after navigation
    cy.url().should('include', '/flights');
    verifyCurrentLanguage('fr');

    // User views hotels
    cy.contains('Hôtels').click();
    cy.url().should('include', '/hotels');
    verifyCurrentLanguage('fr');

    // User switches back to English
    switchToEnglish();
    verifyEnglishContent();
  });

  it('Example 7: Verify translation after page reload', () => {
    switchToFrench();
    verifyFrenchContent();

    cy.reload();
    cy.wait(1000);

    // Should still be in French
    verifyFrenchContent();
    verifyCurrentLanguage('fr');
    verifyLanguagePersisted('fr');
  });

  it('Example 8: Clear and reset language', () => {
    // Switch to French
    switchToFrench();
    verifyLanguagePersisted('fr');

    // Clear preference
    clearLanguagePreference();

    // Reload should default to English (browser default)
    cy.reload();
    cy.wait(1000);
    verifyEnglishContent();
  });
});

/**
 * Example: Custom test combining helpers with business logic
 */
describe('i18n in User Workflows - Example', () => {
  const baseUrl = 'http://localhost:5173';

  beforeEach(() => {
    clearLanguagePreference();
    cy.visit(baseUrl);
    cy.wait(500);
  });

  it('Example: French user booking flow', () => {
    // User prefers French
    switchToFrench();

    // Navigate to flights
    cy.contains('Vols').click();
    cy.url().should('include', '/flights');

    // Mock flight search results
    cy.intercept('GET', '/api/v1/flights/search*', {
      statusCode: 200,
      body: {
        data: [
          {
            id: 'flight-1',
            airline: 'Air France',
            price: 450,
            origin: 'CDG',
            destination: 'JFK',
          },
        ],
      },
    }).as('flightSearch');

    // Perform search (if form exists)
    cy.get('body').then(($body) => {
      if ($body.find('input[placeholder*="Origine"]').length) {
        cy.get('input[placeholder*="Origine"]').type('Paris');
        cy.get('input[placeholder*="Destination"]').type('New York');
        cy.contains('button', 'Rechercher').click();
      }
    });

    // Verify language maintained throughout flow
    verifyCurrentLanguage('fr');
    verifyLanguagePersisted('fr');
  });

  it('Example: Switch language mid-booking', () => {
    // Start booking in English
    verifyEnglishContent();
    cy.contains('Hotels').click();

    // User decides to switch to French
    switchToFrench();

    // Verify UI updated
    cy.contains('Hôtels').should('be.visible');
    verifyCurrentLanguage('fr');

    // Continue booking in French
    // ... rest of booking flow
  });
});

/**
 * Example: Testing specific translations
 */
describe('i18n Specific Translations - Example', () => {
  const baseUrl = 'http://localhost:5173';

  beforeEach(() => {
    clearLanguagePreference();
    cy.visit(baseUrl);
    cy.wait(500);
  });

  it('Example: Verify authentication button translations', () => {
    // Check English
    cy.get('body').then(($body) => {
      const hasSignUp = $body.text().includes('Sign Up');
      if (hasSignUp) {
        cy.contains('Sign Up').should('be.visible');

        // Switch to French
        switchToFrench();

        // Verify French translation
        cy.contains("S'inscrire").should('be.visible');
        cy.contains('Connexion').should('be.visible');
      }
    });
  });

  it('Example: Verify hero section translations', () => {
    switchToFrench();

    // Check for French hero text
    cy.get('body').should(($body) => {
      const text = $body.text();
      expect(text).to.match(/Votre|Voyage|Découvrez/);
    });
  });
});
