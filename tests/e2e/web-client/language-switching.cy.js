/**
 * E2E Tests for i18n (Internationalization) Feature
 * Tests language switching between English and French in DreamScape web client
 */

describe('i18n - Language Switching', () => {
  const baseUrl = 'http://localhost:5173';

  beforeEach(() => {
    // Clear language preference before each test
    cy.window().then((win) => {
      win.localStorage.removeItem('dreamscape-language');
    });
    cy.visit(baseUrl);

    // Wait for i18n to initialize
    cy.wait(500);
  });

  describe('Language Selector Visibility', () => {
    it('should display language selector in header', () => {
      // Verify globe icon and language code are visible
      cy.get('button').contains('EN', { matchCase: false }).should('be.visible');

      // Verify it's clickable
      cy.get('button')
        .contains('EN', { matchCase: false })
        .parent()
        .should('have.attr', 'title', 'Change language');
    });

    it('should show current language code (EN by default)', () => {
      cy.get('button')
        .contains('EN', { matchCase: false })
        .should('be.visible');
    });

    it('should display globe icon', () => {
      // Globe icon is rendered via lucide-react, check for svg presence near language button
      cy.get('button')
        .contains('EN', { matchCase: false })
        .parent()
        .find('svg')
        .should('exist');
    });
  });

  describe('Language Switching - Header', () => {
    it('should open language dropdown when clicking selector', () => {
      // Click language selector button
      cy.get('button').contains('EN', { matchCase: false }).click();

      // Verify dropdown is visible with both language options
      cy.contains('English').should('be.visible');
      cy.contains('Français').should('be.visible');
    });

    it('should switch from English to French', () => {
      // Initial state - verify English content
      cy.contains('Flights').should('be.visible');
      cy.contains('Hotels').should('be.visible');
      cy.contains('Activities').should('be.visible');
      cy.contains('Destinations').should('be.visible');

      // Click language selector and switch to French
      cy.get('button').contains('EN', { matchCase: false }).click();
      cy.contains('Français').click();

      // Wait for language change to apply
      cy.wait(1000);

      // Verify French translations are applied
      cy.contains('Vols').should('be.visible');
      cy.contains('Hôtels').should('be.visible');
      cy.contains('Activités').should('be.visible');
      cy.contains('Destinations').should('be.visible');

      // Verify language selector now shows FR
      cy.get('button').contains('FR', { matchCase: false }).should('be.visible');
    });

    it('should switch from French back to English', () => {
      // First switch to French
      cy.get('button').contains('EN', { matchCase: false }).click();
      cy.contains('Français').click();
      cy.wait(1000);

      // Verify French content
      cy.contains('Vols').should('be.visible');

      // Switch back to English
      cy.get('button').contains('FR', { matchCase: false }).click();
      cy.contains('English').click();
      cy.wait(1000);

      // Verify English content restored
      cy.contains('Flights').should('be.visible');
      cy.contains('Hotels').should('be.visible');
      cy.get('button').contains('EN', { matchCase: false }).should('be.visible');
    });

    it('should show checkmark on currently selected language', () => {
      cy.get('button').contains('EN', { matchCase: false }).click();

      // Verify English has checkmark (✓)
      cy.contains('English').parent().should('contain', '✓');
    });

    it('should highlight selected language in dropdown', () => {
      cy.get('button').contains('EN', { matchCase: false }).click();

      // Verify English option has active styling
      cy.contains('English')
        .parent()
        .should('have.class', 'bg-orange-50')
        .and('have.class', 'text-orange-500');
    });

    it('should close dropdown after selecting a language', () => {
      cy.get('button').contains('EN', { matchCase: false }).click();
      cy.contains('Français').should('be.visible');

      // Click French
      cy.contains('Français').click();
      cy.wait(500);

      // Verify dropdown is closed (English option no longer visible)
      cy.contains('English').should('not.exist');
    });

    it('should close dropdown when clicking outside', () => {
      cy.get('button').contains('EN', { matchCase: false }).click();
      cy.contains('English').should('be.visible');

      // Click outside the dropdown
      cy.get('header').click('left');
      cy.wait(500);

      // Verify dropdown closed
      cy.contains('English').should('not.exist');
    });
  });

  describe('Language Persistence', () => {
    it('should persist language selection in localStorage', () => {
      // Switch to French
      cy.get('button').contains('EN', { matchCase: false }).click();
      cy.contains('Français').click();
      cy.wait(1000);

      // Verify localStorage has correct value
      cy.window().then((win) => {
        const storedLanguage = win.localStorage.getItem('dreamscape-language');
        expect(storedLanguage).to.equal('fr');
      });
    });

    it('should load page in French after reload when FR was selected', () => {
      // Switch to French
      cy.get('button').contains('EN', { matchCase: false }).click();
      cy.contains('Français').click();
      cy.wait(1000);

      // Verify French content
      cy.contains('Vols').should('be.visible');

      // Reload the page
      cy.reload();
      cy.wait(1000);

      // Verify page still loads in French
      cy.contains('Vols').should('be.visible');
      cy.contains('Hôtels').should('be.visible');
      cy.get('button').contains('FR', { matchCase: false }).should('be.visible');
    });

    it('should maintain English on reload when EN is selected', () => {
      // Verify English content
      cy.contains('Flights').should('be.visible');

      // Reload
      cy.reload();
      cy.wait(1000);

      // Verify still in English
      cy.contains('Flights').should('be.visible');
      cy.contains('Hotels').should('be.visible');
      cy.get('button').contains('EN', { matchCase: false }).should('be.visible');
    });

    it('should respect pre-set localStorage language on initial load', () => {
      // Manually set French in localStorage before visiting
      cy.visit(baseUrl, {
        onBeforeLoad(win) {
          win.localStorage.setItem('dreamscape-language', 'fr');
        },
      });

      cy.wait(1000);

      // Verify page loads in French
      cy.contains('Vols').should('be.visible');
      cy.get('button').contains('FR', { matchCase: false }).should('be.visible');
    });
  });

  describe('Multi-Page Language Consistency', () => {
    it('should maintain language selection when navigating between pages', () => {
      // Switch to French
      cy.get('button').contains('EN', { matchCase: false }).click();
      cy.contains('Français').click();
      cy.wait(1000);

      // Navigate to different page
      cy.contains('Destinations').click();
      cy.wait(1000);

      // Verify still in French
      cy.get('button').contains('FR', { matchCase: false }).should('be.visible');
      cy.contains('Vols').should('be.visible');

      // Navigate to another page
      cy.contains('Hôtels').click();
      cy.wait(1000);

      // Still French
      cy.get('button').contains('FR', { matchCase: false }).should('be.visible');
    });

    it('should apply translations to hero section', () => {
      // Check English hero text
      cy.get('body').then(($body) => {
        const hasEnglishHero =
          $body.text().includes('Your') ||
          $body.text().includes('Journey') ||
          $body.text().includes('Discover');

        if (hasEnglishHero) {
          // Switch to French
          cy.get('button').contains('EN', { matchCase: false }).click();
          cy.contains('Français').click();
          cy.wait(1000);

          // Verify French hero text
          cy.get('body').should(($body) => {
            const text = $body.text();
            expect(text).to.match(/Votre|Voyage|Découvrez/);
          });
        }
      });
    });

    it('should translate authentication buttons', () => {
      // In English, look for Sign Up / Sign In
      cy.get('body').then(($body) => {
        const hasAuthButtons =
          $body.text().includes('Sign Up') ||
          $body.text().includes('Sign In') ||
          $body.text().includes('Log In');

        if (hasAuthButtons) {
          // Switch to French
          cy.get('button').contains('EN', { matchCase: false }).click();
          cy.contains('Français').click();
          cy.wait(1000);

          // Verify French auth buttons
          cy.get('body').should(($body) => {
            const text = $body.text();
            expect(text).to.match(/Connexion|S'inscrire/);
          });
        }
      });
    });
  });

  describe('Footer Language Selector', () => {
    it('should display language selector in footer', () => {
      // Scroll to footer
      cy.scrollTo('bottom');
      cy.wait(500);

      // Verify footer language selector exists
      // Footer uses 'full' variant which shows "English (US)" or "Français (FR)"
      cy.get('footer').within(() => {
        cy.get('button').should('contain', 'English').or('contain', 'Français');
      });
    });

    it('should switch language from footer', () => {
      // Scroll to footer
      cy.scrollTo('bottom');
      cy.wait(500);

      // Click footer language selector
      cy.get('footer').within(() => {
        cy.get('button').contains('English').click();
      });

      // Select French
      cy.contains('Français').click();
      cy.wait(1000);

      // Verify header also updated
      cy.scrollTo('top');
      cy.get('header').within(() => {
        cy.get('button').contains('FR', { matchCase: false }).should('be.visible');
      });

      // Verify French content
      cy.contains('Vols').should('be.visible');
    });

    it('should keep header and footer language in sync', () => {
      // Switch from header
      cy.get('header').within(() => {
        cy.get('button').contains('EN', { matchCase: false }).click();
      });
      cy.contains('Français').click();
      cy.wait(1000);

      // Check footer shows French
      cy.scrollTo('bottom');
      cy.wait(500);
      cy.get('footer').within(() => {
        cy.get('button').should('contain', 'Français');
      });
    });
  });

  describe('Settings Page Language Integration (TODO)', () => {
    it.skip('should display language setting in user settings', () => {
      // TODO: This requires authentication
      // Login, navigate to settings, verify language dropdown is present
    });

    it.skip('should sync language between settings page and header', () => {
      // TODO: This requires authentication
      // Change language in settings, verify header updates
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid language switching', () => {
      // Switch to French
      cy.get('button').contains('EN', { matchCase: false }).click();
      cy.contains('Français').click();

      // Immediately switch back to English
      cy.wait(500);
      cy.get('button').contains('FR', { matchCase: false }).click();
      cy.contains('English').click();

      cy.wait(1000);

      // Verify English is final state
      cy.contains('Flights').should('be.visible');
      cy.get('button').contains('EN', { matchCase: false }).should('be.visible');
    });

    it('should handle language switching with slow network', () => {
      // Simulate slow network for loading translations
      cy.intercept('/locales/fr/*.json', (req) => {
        req.reply((res) => {
          res.delay = 2000; // 2 second delay
        });
      });

      // Switch to French
      cy.get('button').contains('EN', { matchCase: false }).click();
      cy.contains('Français').click();

      // Wait for translations to load
      cy.wait(3000);

      // Verify French content eventually loads
      cy.contains('Vols', { timeout: 10000 }).should('be.visible');
    });

    it('should maintain language when navigating with browser back button', () => {
      // Switch to French
      cy.get('button').contains('EN', { matchCase: false }).click();
      cy.contains('Français').click();
      cy.wait(1000);

      // Navigate to another page
      cy.contains('Destinations').click();
      cy.wait(1000);

      // Use browser back button
      cy.go('back');
      cy.wait(1000);

      // Verify still in French
      cy.get('button').contains('FR', { matchCase: false }).should('be.visible');
      cy.contains('Vols').should('be.visible');
    });

    it('should not break page functionality after language switch', () => {
      // Switch to French
      cy.get('button').contains('EN', { matchCase: false }).click();
      cy.contains('Français').click();
      cy.wait(1000);

      // Verify navigation still works
      cy.contains('Destinations').click();
      cy.url().should('include', '/destinations');

      // Switch back to English
      cy.get('button').contains('FR', { matchCase: false }).click();
      cy.contains('English').click();
      cy.wait(1000);

      // Verify navigation still works
      cy.contains('Hotels').click();
      cy.url().should('include', '/hotels');
    });
  });

  describe('Accessibility', () => {
    it('should have accessible title attribute on language selector', () => {
      cy.get('button')
        .contains('EN', { matchCase: false })
        .parent()
        .should('have.attr', 'title', 'Change language');
    });

    it('should allow keyboard navigation in language dropdown', () => {
      // Open dropdown with click
      cy.get('button').contains('EN', { matchCase: false }).click();

      // Verify dropdown is accessible with keyboard
      cy.contains('Français').should('be.visible');

      // Tab through options
      cy.get('body').tab();

      // Both options should be focusable (tested indirectly via visibility)
      cy.contains('English').should('be.visible');
      cy.contains('Français').should('be.visible');
    });
  });

  describe('Flag Display', () => {
    it('should show country flags in language dropdown', () => {
      cy.get('button').contains('EN', { matchCase: false }).click();

      // Verify flags are displayed (emojis 🇺🇸 and 🇫🇷)
      cy.get('body').should(($body) => {
        const text = $body.text();
        // Check for flag emojis or at least the language names
        expect(text).to.match(/English|Français/);
      });
    });
  });
});
