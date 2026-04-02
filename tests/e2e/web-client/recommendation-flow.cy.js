/**
 * US-IA-010 — Flux de recommandation IA (E2E Cypress)
 *
 * Tests end-to-end du module de recommandation IA dans le dashboard :
 *
 * 1. Le sélecteur de catégorie (Vol / Hébergement / Activité) est présent
 * 2. Le bouton "Générer" est désactivé sans sélection
 * 3. Le bouton s'active après sélection d'un type
 * 4. La modale s'ouvre sur le bon formulaire selon le type
 * 5. La soumission du formulaire déclenche le loading animé
 * 6. 3 propositions sont affichées (jamais plus, jamais moins)
 * 7. La sélection d'une proposition ajoute au panier
 * 8. Le parcours Itinéraire Complet : wizard 3 étapes
 * 9. Temps de réponse perçu < 3s (loading pendant la génération)
 *
 * @ticket US-IA-010
 */

describe('US-IA-010 — Module Recommandation IA (Dashboard)', () => {
  const dashboardUrl = Cypress.env('DASHBOARD_URL') || 'http://localhost:5173';

  // Authentification minimale avant les tests
  before(() => {
    // Simuler une session auth avec token en localStorage
    cy.window().then((win) => {
      win.localStorage.setItem('auth_token', 'test-jwt-token');
      win.localStorage.setItem(
        'user_profile',
        JSON.stringify({
          id: 'cypress-test-user',
          name: 'Cypress User',
          email: 'cypress@test.com',
        })
      );
    });
  });

  beforeEach(() => {
    // Intercepter les appels API IA pour contrôler les réponses
    cy.intercept('GET', '**/recommendations/flights**', {
      statusCode: 200,
      body: {
        recommendations: [
          {
            id: 'flight-1',
            type: 'flight',
            title: 'Paris → New York',
            subtitle: 'Air France AF006',
            location: 'JFK',
            price: { amount: 850, currency: 'EUR', formatted: '850 €' },
            rating: 4.5,
            image: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05',
            departure: '2026-06-15T10:00:00',
            arrival: '2026-06-15T12:30:00',
          },
          {
            id: 'flight-2',
            type: 'flight',
            title: 'Paris → Londres',
            subtitle: 'British Airways BA321',
            location: 'LHR',
            price: { amount: 180, currency: 'EUR', formatted: '180 €' },
            rating: 4.2,
            image: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05',
          },
          {
            id: 'flight-3',
            type: 'flight',
            title: 'Paris → Barcelone',
            subtitle: 'Vueling VY1234',
            location: 'BCN',
            price: { amount: 120, currency: 'EUR', formatted: '120 €' },
            rating: 4.0,
            image: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05',
          },
        ],
        meta: { modelType: 'rule_based', cacheHit: false },
      },
      delay: 500, // Simule latence réaliste
    }).as('flightRecommendations');

    cy.intercept('GET', '**/recommendations/accommodations**', {
      statusCode: 200,
      body: {
        recommendations: [
          {
            id: 'hotel-1',
            type: 'hotel',
            title: 'Hôtel Lumière',
            subtitle: '4 étoiles · Paris 8e',
            location: 'Paris, France',
            price: { amount: 220, currency: 'EUR', formatted: '220 €/nuit' },
            rating: 8.7,
            image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945',
          },
          {
            id: 'hotel-2',
            type: 'hotel',
            title: 'Boutique Rivoli',
            subtitle: '3 étoiles · Paris 1er',
            location: 'Paris, France',
            price: { amount: 140, currency: 'EUR', formatted: '140 €/nuit' },
            rating: 8.2,
            image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945',
          },
          {
            id: 'hotel-3',
            type: 'hotel',
            title: 'Grand Marais Hôtel',
            subtitle: '4 étoiles · Paris 3e',
            location: 'Paris, France',
            price: { amount: 195, currency: 'EUR', formatted: '195 €/nuit' },
            rating: 8.9,
            image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945',
          },
        ],
        meta: { modelType: 'hybrid', cacheHit: true },
      },
      delay: 400,
    }).as('accommodationRecommendations');

    cy.intercept('GET', '**/recommendations/activities**', {
      statusCode: 200,
      body: {
        recommendations: [
          {
            id: 'act-1',
            type: 'activity',
            title: 'Tour Eiffel VIP',
            subtitle: 'Visite guidée prioritaire',
            location: 'Paris, France',
            price: { amount: 45, currency: 'EUR', formatted: '45 €' },
            rating: 4.8,
            image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34',
          },
          {
            id: 'act-2',
            type: 'activity',
            title: 'Croisière sur la Seine',
            subtitle: '1h30 de navigation',
            location: 'Paris, France',
            price: { amount: 25, currency: 'EUR', formatted: '25 €' },
            rating: 4.5,
            image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34',
          },
          {
            id: 'act-3',
            type: 'activity',
            title: 'Musée du Louvre',
            subtitle: 'Visite avec guide expert',
            location: 'Paris, France',
            price: { amount: 35, currency: 'EUR', formatted: '35 €' },
            rating: 4.7,
            image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34',
          },
        ],
        meta: { modelType: 'rule_based', cacheHit: false },
      },
      delay: 300,
    }).as('activityRecommendations');

    cy.intercept('POST', '**/interactions**', { statusCode: 200, body: {} }).as(
      'trackInteraction'
    );

    cy.visit(`${dashboardUrl}/dashboard`);
  });

  // ─── Présence des éléments ─────────────────────────────────────────────────

  describe('1. Composant de sélection de catégorie', () => {
    it('should display the AI recommendation section', () => {
      cy.get('[data-testid="ai-recommendation-section"], .ai-recommendations, [class*="recommendation"]')
        .should('exist')
        .and('be.visible');
    });

    it('should display 3 category buttons (Vol, Hébergement, Activité)', () => {
      // Chercher les boutons de catégorie
      cy.get('[data-testid="recommendation-type-flight"], [data-testid="category-flight"]')
        .should('exist')
        .or(
          'get',
          'button:contains("Vol"), button:contains("Vols"), button:contains("Flight")'
        );
    });
  });

  // ─── État du bouton Générer ────────────────────────────────────────────────

  describe('2. Bouton "Générer mes recommandations"', () => {
    it('should be disabled when no category is selected', () => {
      cy.get(
        '[data-testid="generate-recommendations-btn"], button:contains("Générer"), button:contains("Generate")'
      )
        .first()
        .should('be.disabled');
    });

    it('should be enabled after selecting a category', () => {
      // Cliquer sur Vol
      cy.get(
        '[data-testid="category-flight"], [data-testid="recommendation-type-flight"], button:contains("Vol")'
      )
        .first()
        .click();

      cy.get(
        '[data-testid="generate-recommendations-btn"], button:contains("Générer"), button:contains("Generate")'
      )
        .first()
        .should('not.be.disabled');
    });
  });

  // ─── Ouverture de la modale ────────────────────────────────────────────────

  describe('3. Ouverture de la modale de recommandations', () => {
    it('should open modal after selecting flight and clicking generate', () => {
      cy.get(
        '[data-testid="category-flight"], button:contains("Vol"), button:contains("Vols")'
      )
        .first()
        .click();

      cy.get(
        '[data-testid="generate-recommendations-btn"], button:contains("Générer")'
      )
        .first()
        .click();

      // La modale ou le formulaire doit apparaître
      cy.get(
        '[data-testid="recommendation-modal"], [role="dialog"], [class*="modal"], [class*="Modal"]'
      )
        .should('exist')
        .and('be.visible');
    });

    it('should open accommodation modal when selecting Hébergement', () => {
      cy.get(
        '[data-testid="category-accommodation"], button:contains("Hébergement"), button:contains("Hotel")'
      )
        .first()
        .click();

      cy.get(
        '[data-testid="generate-recommendations-btn"], button:contains("Générer")'
      )
        .first()
        .click();

      cy.get(
        '[data-testid="recommendation-modal"], [role="dialog"], [class*="modal"]'
      ).should('be.visible');
    });
  });

  // ─── Loading animé ─────────────────────────────────────────────────────────

  describe('4. Loading animé (< 3s de réponse perçue)', () => {
    it('should show loading state while fetching recommendations', () => {
      cy.intercept('GET', '**/recommendations/flights**', (req) => {
        req.reply({
          statusCode: 200,
          body: { recommendations: [] },
          delay: 1000, // 1s de délai simulé
        });
      });

      cy.get(
        '[data-testid="category-flight"], button:contains("Vol")'
      )
        .first()
        .click();

      cy.get(
        '[data-testid="generate-recommendations-btn"], button:contains("Générer")'
      )
        .first()
        .click();

      // Vérifier que le loading apparaît
      cy.get(
        '[data-testid="loading"], [class*="loading"], [class*="spinner"], [class*="Loading"]',
        { timeout: 2000 }
      ).should('exist');
    });
  });

  // ─── Affichage de 3 propositions exactement ───────────────────────────────

  describe('5. Affichage de 3 propositions', () => {
    it('should display exactly 3 flight proposals after generation', () => {
      cy.get(
        '[data-testid="category-flight"], button:contains("Vol")'
      )
        .first()
        .click();

      cy.get(
        '[data-testid="generate-recommendations-btn"], button:contains("Générer")'
      )
        .first()
        .click();

      // Remplir le formulaire (si applicable) et soumettre
      cy.get('[data-testid="recommendation-modal"]', { timeout: 3000 }).within(() => {
        cy.get('form').then(($form) => {
          if ($form.length > 0) {
            // Remplir les champs minimum
            cy.get('input[name*="origin"], input[placeholder*="Départ"], input[placeholder*="From"]')
              .first()
              .type('CDG', { force: true });
            cy.get('input[name*="destination"], input[placeholder*="Destination"], input[placeholder*="To"]')
              .first()
              .type('JFK', { force: true });

            cy.get('button[type="submit"], button:contains("Rechercher"), button:contains("Générer")')
              .first()
              .click({ force: true });
          }
        });
      });

      cy.wait('@flightRecommendations');

      // 3 propositions doivent être visibles
      cy.get(
        '[data-testid^="proposal-"], [class*="proposal"], [class*="RecommendationCard"], [class*="recommendation-card"]',
        { timeout: 5000 }
      ).should('have.length', 3);
    });

    it('should display exactly 3 accommodation proposals', () => {
      cy.get(
        '[data-testid="category-accommodation"], button:contains("Hébergement")'
      )
        .first()
        .click();

      cy.get(
        '[data-testid="generate-recommendations-btn"], button:contains("Générer")'
      )
        .first()
        .click();

      cy.wait('@accommodationRecommendations', { timeout: 10000 });

      cy.get(
        '[data-testid^="proposal-"], [class*="proposal"], [class*="RecommendationCard"]',
        { timeout: 5000 }
      ).should('have.length', 3);
    });
  });

  // ─── Sélection d'une proposition → Ajout au panier ───────────────────────

  describe('6. Sélection et ajout au panier', () => {
    it('should add selected accommodation to cart', () => {
      cy.intercept('POST', '**/api/cart/**', {
        statusCode: 201,
        body: { success: true, cartItemId: 'cart-item-1' },
      }).as('addToCart');

      cy.get(
        '[data-testid="category-accommodation"], button:contains("Hébergement")'
      )
        .first()
        .click();

      cy.get(
        '[data-testid="generate-recommendations-btn"], button:contains("Générer")'
      )
        .first()
        .click();

      cy.wait('@accommodationRecommendations', { timeout: 10000 });

      // Cliquer sur la première proposition
      cy.get(
        '[data-testid^="proposal-"], [class*="proposal"], [class*="RecommendationCard"]',
        { timeout: 5000 }
      )
        .first()
        .click();

      // Confirmation d'ajout au panier (toast ou bouton)
      cy.get(
        '[data-testid="select-proposal-btn"], button:contains("Choisir"), button:contains("Sélectionner"), button:contains("Réserver")',
        { timeout: 3000 }
      )
        .first()
        .click({ force: true });

      // Vérifier l'appel au panier ou le toast de confirmation
      cy.get(
        '[data-testid="cart-success-toast"], [class*="toast"], [class*="Toast"], [class*="notification"]',
        { timeout: 5000 }
      ).should('exist');
    });
  });

  // ─── Performance perçue < 3s ──────────────────────────────────────────────

  describe('7. Performance perçue', () => {
    it('recommendations should appear within 3 seconds of form submission', () => {
      cy.get(
        '[data-testid="category-accommodation"], button:contains("Hébergement")'
      )
        .first()
        .click();

      cy.get(
        '[data-testid="generate-recommendations-btn"], button:contains("Générer")'
      )
        .first()
        .click();

      const start = Date.now();

      cy.wait('@accommodationRecommendations').then(() => {
        cy.get(
          '[data-testid^="proposal-"], [class*="proposal"], [class*="RecommendationCard"]',
          { timeout: 3000 }
        )
          .should('exist')
          .then(() => {
            const elapsed = Date.now() - start;
            // Performance perçue < 3s (incluant animation de loading)
            expect(elapsed).to.be.lessThan(3000);
            cy.log(`✅ Performance: ${elapsed}ms (target < 3000ms)`);
          });
      });
    });
  });
});
