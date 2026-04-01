describe('GDPR Compliance - Cookie Consent Banner', () => {
  beforeEach(() => {
    // Ensure clean state for cookie consent tests — must visit first to clear AUT localStorage
    cy.visit('http://localhost:5173/');
    cy.clearLocalStorage('cookie-consent');
  });

  it('should show cookie banner on first visit', () => {
    cy.visit('http://localhost:5173/');

    // Verify banner is visible
    cy.get('[data-testid="cookie-banner"]', { timeout: 10000 })
      .should('be.visible');

    // Verify all required buttons are present
    cy.contains('button', 'Accept All').should('be.visible');
    cy.contains('button', 'Reject All').should('be.visible');
    cy.contains('button', 'Customize').should('be.visible');

    // Verify banner has informative text
    cy.get('[data-testid="cookie-banner"]')
      .should('contain', 'cookie')
      .or('contain', 'Cookie');
  });

  it('should hide banner after accepting all cookies', () => {
    cy.visit('http://localhost:5173/');

    // Wait for banner to appear
    cy.get('[data-testid="cookie-banner"]', { timeout: 10000 })
      .should('be.visible');

    // Click Accept All button
    cy.contains('button', 'Accept All').click();

    // Verify banner is hidden
    cy.get('[data-testid="cookie-banner"]').should('not.exist');

    // Verify localStorage has consent data
    cy.window().then((win) => {
      const consent = JSON.parse(win.localStorage.getItem('cookie-consent'));
      expect(consent).to.not.be.null;
      expect(consent).to.have.property('analytics', true);
      expect(consent).to.have.property('marketing', true);
      expect(consent).to.have.property('functional', true);
      expect(consent).to.have.property('preferences', true);
      expect(consent).to.have.property('timestamp');
    });
  });

  it('should show granular options in customize mode', () => {
    cy.visit('http://localhost:5173/');

    // Wait for banner and click Customize
    cy.get('[data-testid="cookie-banner"]', { timeout: 10000 })
      .should('be.visible');
    cy.contains('button', 'Customize').click();

    // Verify granular options are visible
    cy.contains('Analytics').should('be.visible');
    cy.contains('Marketing').should('be.visible');
    cy.contains('Preferences').should('be.visible');

    // Verify toggles are present
    cy.get('input[type="checkbox"]').should('have.length.at.least', 3);

    // Verify functional cookies are always required (disabled toggle)
    cy.contains('Functional')
      .parent()
      .find('input[type="checkbox"]')
      .should('be.disabled')
      .and('be.checked');
  });

  it('should persist consent across page reloads', () => {
    cy.visit('http://localhost:5173/');

    // Accept all cookies
    cy.get('[data-testid="cookie-banner"]', { timeout: 10000 })
      .should('be.visible');
    cy.contains('button', 'Accept All').click();

    // Reload the page
    cy.reload();

    // Verify banner does not appear again
    cy.get('[data-testid="cookie-banner"]').should('not.exist');

    // Verify consent is still in localStorage
    cy.window().then((win) => {
      const consent = JSON.parse(win.localStorage.getItem('cookie-consent'));
      expect(consent).to.not.be.null;
      expect(consent).to.have.property('timestamp');
    });
  });

  it('should not show banner if consent already given', () => {
    // Manually set consent in localStorage before visiting
    cy.window().then((win) => {
      const consentData = {
        analytics: true,
        marketing: true,
        functional: true,
        preferences: true,
        timestamp: new Date().toISOString(),
      };
      win.localStorage.setItem('cookie-consent', JSON.stringify(consentData));
    });

    cy.visit('http://localhost:5173/');

    // Verify banner does not appear
    cy.get('[data-testid="cookie-banner"]').should('not.exist');
  });
});

describe('GDPR Compliance - Settings Data & Privacy Section', () => {
  const testUser = {
    email: Cypress.env('SEED_USER_EMAIL') || 'seed@dreamscape.test',
    password: Cypress.env('SEED_USER_PASSWORD') || 'SeedPass123!',
  };

  beforeEach(() => {
    // Login before each test using programmatic API to avoid UI flakiness
    cy.visit('http://localhost:5173/');
    cy.loginByApi(testUser.email, testUser.password);
  });

  it('should display "Data & Privacy" tab in settings', () => {
    // Navigate to settings page
    cy.visit('http://localhost:5173/settings');

    // Verify Data & Privacy tab exists
    cy.contains('Data & Privacy', { timeout: 10000 }).should('be.visible');

    // Click on the tab
    cy.contains('Data & Privacy').click();

    // Verify we're in the Data & Privacy section
    cy.url().should('include', 'privacy').or('contain', 'data');
  });

  it('should show consent toggles with current values', () => {
    // Mock API response for current consent settings
    cy.intercept('GET', '/api/v1/users/gdpr/consent', {
      statusCode: 200,
      body: {
        data: {
          analytics: true,
          marketing: false,
          functional: true,
          preferences: true,
        },
      },
    }).as('getConsent');

    cy.visit('http://localhost:5173/settings');
    cy.contains('Data & Privacy').click();

    // Wait for API call
    cy.wait('@getConsent');

    // Verify consent toggles are visible with correct states
    cy.contains('Analytics Cookies').should('be.visible');
    cy.contains('Marketing Cookies').should('be.visible');
    cy.contains('Preferences').should('be.visible');

    // Verify toggles reflect current values
    cy.get('[data-testid="consent-analytics"]')
      .should('exist')
      .and('be.checked');

    cy.get('[data-testid="consent-marketing"]')
      .should('exist')
      .and('not.be.checked');
  });

  it('should update consent via toggles', () => {
    // Mock GET consent
    cy.intercept('GET', '/api/v1/users/gdpr/consent', {
      statusCode: 200,
      body: {
        data: {
          analytics: true,
          marketing: false,
          functional: true,
          preferences: true,
        },
      },
    }).as('getConsent');

    // Mock PATCH consent update
    cy.intercept('PATCH', '/api/v1/users/gdpr/consent', {
      statusCode: 200,
      body: {
        success: true,
        message: 'Consent preferences updated successfully',
      },
    }).as('updateConsent');

    cy.visit('http://localhost:5173/settings');
    cy.contains('Data & Privacy').click();
    cy.wait('@getConsent');

    // Toggle analytics consent
    cy.get('[data-testid="consent-analytics"]').click();

    // Wait for API call
    cy.wait('@updateConsent');

    // Verify success message appears
    cy.contains('success', { matchCase: false, timeout: 5000 }).should('be.visible')
      .or('contain', 'updated');
  });

  it('should show privacy policy section', () => {
    cy.visit('http://localhost:5173/settings');
    cy.contains('Data & Privacy').click();

    // Verify privacy policy link exists
    cy.contains('Privacy Policy', { timeout: 10000 }).should('be.visible');

    // Verify it links to privacy policy page
    cy.contains('Privacy Policy')
      .should('have.attr', 'href')
      .and('include', 'privacy');
  });

  it('should request data export', () => {
    // Mock data export request
    cy.intercept('POST', '/api/v1/users/gdpr/export', {
      statusCode: 202,
      body: {
        success: true,
        message: 'Data export request received. You will receive an email when ready.',
        requestId: 'export-request-123',
      },
    }).as('exportData');

    cy.visit('http://localhost:5173/settings');
    cy.contains('Data & Privacy').click();

    // Click Export My Data button
    cy.contains('button', 'Export My Data').click();

    // Confirm in dialog if present
    cy.get('body').then(($body) => {
      if ($body.text().includes('confirm') || $body.text().includes('Confirm')) {
        cy.contains('button', 'Confirm').click();
      }
    });

    // Wait for API call
    cy.wait('@exportData');

    // Verify success message
    cy.contains('export', { matchCase: false, timeout: 5000 })
      .should('be.visible');
  });

  it('should request account deletion', () => {
    // Mock account deletion request
    cy.intercept('POST', '/api/v1/users/gdpr/delete-account', {
      statusCode: 202,
      body: {
        success: true,
        message: 'Account deletion scheduled. You will be logged out shortly.',
      },
    }).as('deleteAccount');

    cy.visit('http://localhost:5173/settings');
    cy.contains('Data & Privacy').click();

    // Click Delete My Account button
    cy.contains('button', 'Delete My Account').click();

    // Type DELETE in confirmation input
    cy.get('input[placeholder*="DELETE"]', { timeout: 5000 })
      .or('input[placeholder*="delete"]')
      .type('DELETE');

    // Click confirm deletion button
    cy.contains('button', 'Confirm').or('button', 'Delete').click();

    // Wait for API call
    cy.wait('@deleteAccount');

    // Verify success/confirmation message
    cy.contains('deletion', { matchCase: false, timeout: 5000 })
      .or('contain', 'scheduled')
      .should('be.visible');
  });

  it('should display pending GDPR requests', () => {
    // Mock pending requests
    cy.intercept('GET', '/api/v1/users/gdpr/requests', {
      statusCode: 200,
      body: {
        data: [
          {
            id: 'req-1',
            type: 'DATA_EXPORT',
            status: 'PROCESSING',
            requestedAt: new Date().toISOString(),
          },
          {
            id: 'req-2',
            type: 'ACCOUNT_DELETION',
            status: 'PENDING',
            requestedAt: new Date(Date.now() - 86400000).toISOString(),
          },
        ],
      },
    }).as('getPendingRequests');

    cy.visit('http://localhost:5173/settings');
    cy.contains('Data & Privacy').click();

    // Wait for pending requests
    cy.wait('@getPendingRequests');

    // Verify pending requests are displayed
    cy.contains('Pending Requests').should('be.visible');
    cy.contains('DATA_EXPORT').or('contain', 'Export').should('be.visible');
    cy.contains('PROCESSING').or('contain', 'Processing').should('be.visible');
  });
});

describe('GDPR Compliance - Privacy Policy Page', () => {
  const mockPrivacyPolicy = {
    version: '2.1.0',
    effectiveDate: '2024-01-01',
    lastUpdated: '2024-01-15',
    sections: [
      {
        title: 'Introduction',
        content: 'This Privacy Policy describes how DreamScape collects, uses, and protects your personal data.',
      },
      {
        title: 'Data Collection',
        content: 'We collect information you provide directly to us, such as your name, email, and travel preferences.',
      },
      {
        title: 'Your Rights',
        content: 'Under GDPR, you have the right to access, rectify, erase, and port your personal data.',
      },
    ],
  };

  it('should display privacy policy at /privacy-policy', () => {
    // Mock privacy policy API
    cy.intercept('GET', '/api/v1/users/gdpr/privacy-policy', {
      statusCode: 200,
      body: {
        data: mockPrivacyPolicy,
      },
    }).as('getPrivacyPolicy');

    cy.visit('http://localhost:5173/privacy-policy');

    // Wait for API call
    cy.wait('@getPrivacyPolicy');

    // Verify policy content is visible
    cy.contains('Privacy Policy', { timeout: 10000 }).should('be.visible');
    cy.contains('Introduction').should('be.visible');
    cy.contains('Data Collection').should('be.visible');
    cy.contains('Your Rights').should('be.visible');

    // Verify policy text is displayed
    cy.contains('DreamScape collects').should('be.visible');
    cy.contains('GDPR').should('be.visible');
  });

  it('should show version badge', () => {
    cy.intercept('GET', '/api/v1/users/gdpr/privacy-policy', {
      statusCode: 200,
      body: {
        data: mockPrivacyPolicy,
      },
    }).as('getPrivacyPolicy');

    cy.visit('http://localhost:5173/privacy-policy');
    cy.wait('@getPrivacyPolicy');

    // Verify version information is displayed
    cy.contains('Version').should('be.visible');
    cy.contains('2.1.0').should('be.visible');

    // Verify effective date or last updated date
    cy.get('body').should(($body) => {
      const text = $body.text();
      expect(text).to.match(/2024|Effective|Updated/);
    });
  });

  it('should show accept button for logged-in user', () => {
    // Login first via API
    cy.visit('http://localhost:5173/');
    cy.loginByApi(
      Cypress.env('SEED_USER_EMAIL') || 'seed@dreamscape.test',
      Cypress.env('SEED_USER_PASSWORD') || 'SeedPass123!'
    );

    // Mock privacy policy and acceptance
    cy.intercept('GET', '/api/v1/users/gdpr/privacy-policy', {
      statusCode: 200,
      body: {
        data: mockPrivacyPolicy,
      },
    }).as('getPrivacyPolicy');

    cy.intercept('POST', '/api/v1/users/gdpr/accept-privacy-policy', {
      statusCode: 200,
      body: {
        success: true,
        message: 'Privacy policy accepted',
      },
    }).as('acceptPolicy');

    cy.visit('http://localhost:5173/privacy-policy');
    cy.wait('@getPrivacyPolicy');

    // Verify accept button is visible
    cy.contains('button', 'Accept').or('button', 'I Accept').should('be.visible');

    // Click accept button
    cy.contains('button', 'Accept').click();

    // Verify API call was made
    cy.wait('@acceptPolicy');

    // Verify success feedback
    cy.contains('accepted', { matchCase: false, timeout: 5000 })
      .or('contain', 'success')
      .should('be.visible');
  });
});
