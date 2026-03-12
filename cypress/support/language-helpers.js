/**
 * Cypress Helper Functions for i18n/Language Testing
 * Reusable utilities for language switching scenarios
 */

/**
 * Switch language using header selector
 * @param {string} language - 'en' or 'fr'
 */
export const switchLanguage = (language) => {
  const languageMap = {
    en: 'English',
    fr: 'Français',
  };

  const targetLanguage = languageMap[language];
  if (!targetLanguage) {
    throw new Error(`Invalid language: ${language}. Use 'en' or 'fr'.`);
  }

  // Click language selector button
  cy.get('button')
    .contains(language === 'en' ? 'FR' : 'EN', { matchCase: false })
    .click();

  // Select target language
  cy.contains(targetLanguage).click();

  // Wait for language change to complete
  cy.wait(1000);
};

/**
 * Switch to French from header
 */
export const switchToFrench = () => {
  switchLanguage('fr');
};

/**
 * Switch to English from header
 */
export const switchToEnglish = () => {
  switchLanguage('en');
};

/**
 * Verify current language in header
 * @param {string} language - 'en' or 'fr'
 */
export const verifyCurrentLanguage = (language) => {
  const code = language === 'en' ? 'EN' : 'FR';
  cy.get('button')
    .contains(code, { matchCase: false })
    .should('be.visible');
};

/**
 * Verify English translations are displayed
 */
export const verifyEnglishContent = () => {
  cy.contains('Flights').should('be.visible');
  cy.contains('Hotels').should('be.visible');
  cy.contains('Activities').should('be.visible');
  cy.contains('Destinations').should('be.visible');
};

/**
 * Verify French translations are displayed
 */
export const verifyFrenchContent = () => {
  cy.contains('Vols').should('be.visible');
  cy.contains('Hôtels').should('be.visible');
  cy.contains('Activités').should('be.visible');
  cy.contains('Destinations').should('be.visible');
};

/**
 * Clear language preference from localStorage
 */
export const clearLanguagePreference = () => {
  cy.window().then((win) => {
    win.localStorage.removeItem('dreamscape-language');
  });
};

/**
 * Set language preference in localStorage
 * @param {string} language - 'en' or 'fr'
 */
export const setLanguagePreference = (language) => {
  if (!['en', 'fr'].includes(language)) {
    throw new Error(`Invalid language: ${language}. Use 'en' or 'fr'.`);
  }

  cy.window().then((win) => {
    win.localStorage.setItem('dreamscape-language', language);
  });
};

/**
 * Get current language from localStorage
 * @returns {Cypress.Chainable<string>} Current language code
 */
export const getCurrentLanguage = () => {
  return cy.window().then((win) => {
    return win.localStorage.getItem('dreamscape-language') || 'en';
  });
};

/**
 * Open language dropdown (without selecting)
 */
export const openLanguageDropdown = () => {
  cy.get('button')
    .contains(/EN|FR/i)
    .click();
};

/**
 * Verify language dropdown is open
 */
export const verifyDropdownOpen = () => {
  cy.contains('English').should('be.visible');
  cy.contains('Français').should('be.visible');
};

/**
 * Verify language dropdown is closed
 */
export const verifyDropdownClosed = () => {
  cy.contains('English').should('not.exist');
  cy.contains('Français').should('not.exist');
};

/**
 * Verify selected language has checkmark in dropdown
 * @param {string} language - 'en' or 'fr'
 */
export const verifySelectedLanguage = (language) => {
  const languageName = language === 'en' ? 'English' : 'Français';

  openLanguageDropdown();
  cy.contains(languageName)
    .parent()
    .should('contain', '✓')
    .and('have.class', 'bg-orange-50')
    .and('have.class', 'text-orange-500');
};

/**
 * Switch language from footer
 * @param {string} language - 'en' or 'fr'
 */
export const switchLanguageFromFooter = (language) => {
  const languageMap = {
    en: 'English',
    fr: 'Français',
  };

  const targetLanguage = languageMap[language];
  if (!targetLanguage) {
    throw new Error(`Invalid language: ${language}. Use 'en' or 'fr'.`);
  }

  // Scroll to footer
  cy.scrollTo('bottom');
  cy.wait(500);

  // Click footer language selector
  cy.get('footer').within(() => {
    cy.get('button').contains(/English|Français/).click();
  });

  // Select target language
  cy.contains(targetLanguage).click();
  cy.wait(1000);
};

/**
 * Verify language persisted in localStorage
 * @param {string} expectedLanguage - 'en' or 'fr'
 */
export const verifyLanguagePersisted = (expectedLanguage) => {
  cy.window().then((win) => {
    const storedLanguage = win.localStorage.getItem('dreamscape-language');
    expect(storedLanguage).to.equal(expectedLanguage);
  });
};

/**
 * Visit page with specific language pre-set
 * @param {string} url - URL to visit
 * @param {string} language - 'en' or 'fr'
 */
export const visitWithLanguage = (url, language) => {
  cy.visit(url, {
    onBeforeLoad(win) {
      win.localStorage.setItem('dreamscape-language', language);
    },
  });
  cy.wait(1000);
};

/**
 * Verify translations loaded for specific namespace
 * @param {string} namespace - e.g., 'common', 'auth', 'flights'
 */
export const verifyTranslationsLoaded = (namespace) => {
  cy.window().then((win) => {
    // Access i18next instance
    const i18n = win.i18next;
    if (i18n) {
      expect(i18n.hasResourceBundle(i18n.language, namespace)).to.be.true;
    }
  });
};

/**
 * Mock translation file loading
 * @param {string} language - 'en' or 'fr'
 * @param {string} namespace - 'common', 'auth', etc.
 * @param {object} translations - Translation object
 */
export const mockTranslations = (language, namespace, translations) => {
  cy.intercept(`/locales/${language}/${namespace}.json`, {
    statusCode: 200,
    body: translations,
  });
};

/**
 * Verify specific translation key is rendered
 * @param {string} translationKey - Translation key (e.g., 'nav.flights')
 * @param {string} expectedText - Expected translated text
 */
export const verifyTranslation = (translationKey, expectedText) => {
  cy.contains(expectedText).should('be.visible');
};

/**
 * Test language switching with navigation
 * @param {string} targetLanguage - 'en' or 'fr'
 * @param {string} navigationLink - Link text to click after switching
 */
export const switchLanguageAndNavigate = (targetLanguage, navigationLink) => {
  switchLanguage(targetLanguage);
  cy.contains(navigationLink).click();
  cy.wait(1000);
  verifyCurrentLanguage(targetLanguage);
};

// Export all functions as default object
export default {
  switchLanguage,
  switchToFrench,
  switchToEnglish,
  verifyCurrentLanguage,
  verifyEnglishContent,
  verifyFrenchContent,
  clearLanguagePreference,
  setLanguagePreference,
  getCurrentLanguage,
  openLanguageDropdown,
  verifyDropdownOpen,
  verifyDropdownClosed,
  verifySelectedLanguage,
  switchLanguageFromFooter,
  verifyLanguagePersisted,
  visitWithLanguage,
  verifyTranslationsLoaded,
  mockTranslations,
  verifyTranslation,
  switchLanguageAndNavigate,
};
