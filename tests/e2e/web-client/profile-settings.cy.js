describe('Profile Settings - Username Change', () => {
  const testUser = {
    email: 'testuser@dreamscape.com',
    password: 'TestPassword123!',
    originalUsername: 'testuser_original',
    newUsername: 'testuser_updated'
  };

  beforeEach(() => {
    // Visit the login page
    cy.visit('http://localhost:5173/login');
    
    // Login with test user
    cy.get('input[type="email"]').type(testUser.email);
    cy.get('input[type="password"]').type(testUser.password);
    cy.get('button[type="submit"]').click();
    
    // Wait for successful login and redirect
    cy.url().should('not.include', '/login');
    cy.wait(1000);
  });

  it('should successfully change username through settings page', () => {
    // Navigate to settings page
    cy.get('[data-cy="user-menu"]').click(); // Assuming user menu exists
    cy.get('[data-cy="settings-link"]').click(); // Or direct navigation
    // Alternative direct navigation:
    cy.visit('http://localhost:5173/settings');
    
    // Wait for settings page to load
    cy.url().should('include', '/settings');
    cy.contains('Profile Settings').should('be.visible');

    // Click on Profile section if not already active
    cy.get('[data-cy="profile-section"]').click();
    
    // Verify current profile information is loaded
    cy.get('input[name="name"]').should('not.be.empty');
    cy.get('input[name="email"]').should('have.value', testUser.email);

    // Find and clear the name field, then enter new username
    cy.get('input[name="name"]')
      .clear()
      .type(testUser.newUsername);

    // Save the changes
    cy.get('button').contains('Save Changes').click();

    // Verify loading state
    cy.get('button').contains('Saving...').should('be.visible');
    
    // Wait for save to complete and verify success toast
    cy.contains('Profile saved successfully!', { timeout: 5000 })
      .should('be.visible');
    
    // Verify the toast disappears after 3 seconds
    cy.contains('Profile saved successfully!')
      .should('not.exist', { timeout: 4000 });

    // Verify the updated username is displayed
    cy.get('input[name="name"]').should('have.value', testUser.newUsername);

    // Navigate away and back to verify persistence
    cy.get('[data-cy="dashboard-link"]').click(); // Or home page
    cy.visit('http://localhost:5173/settings');
    
    // Verify the username change persisted
    cy.get('input[name="name"]').should('have.value', testUser.newUsername);
  });

  it('should handle username update errors gracefully', () => {
    cy.visit('http://localhost:5173/settings');
    
    // Mock API error response
    cy.intercept('PUT', '**/api/v1/users/profile', {
      statusCode: 400,
      body: {
        success: false,
        message: 'Username already exists'
      }
    }).as('updateProfileError');

    // Try to update username
    cy.get('input[name="name"]')
      .clear()
      .type('existing_username');

    cy.get('button').contains('Save Changes').click();

    // Wait for API call
    cy.wait('@updateProfileError');

    // Verify error handling (you might want to add error toast/message)
    // cy.contains('Username already exists').should('be.visible');
    // For now, just verify the save button is no longer loading
    cy.get('button').contains('Save Changes').should('be.visible');
  });

  it('should validate required fields before saving', () => {
    cy.visit('http://localhost:5173/settings');
    
    // Clear required name field
    cy.get('input[name="name"]').clear();

    // Try to save
    cy.get('button').contains('Save Changes').click();

    // Verify field validation (assuming validation is implemented)
    cy.get('input[name="name"]:invalid').should('exist');
    // Or verify that save doesn't proceed without required fields
  });

  it('should show correct profile information on page load', () => {
    // Mock profile data
    cy.intercept('GET', '**/api/v1/users/profile', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          profile: {
            name: testUser.originalUsername,
            email: testUser.email,
            photo: null
          },
          preferences: {
            language: 'English',
            currency: 'USD',
            timezone: 'UTC'
          },
          notifications: {
            dealAlerts: true,
            tripReminders: true,
            priceAlerts: false,
            newsletter: true
          },
          privacy: {
            profileVisibility: 'public',
            dataSharing: false,
            marketing: true
          },
          travel: {
            preferredDestinations: ['Paris', 'Tokyo'],
            accommodationType: ['Hotel', 'Apartment'],
            activities: ['Sightseeing', 'Food'],
            dietary: ['Vegetarian']
          }
        }
      }
    }).as('getProfile');

    cy.visit('http://localhost:5173/settings');
    
    // Wait for profile to load
    cy.wait('@getProfile');

    // Verify profile information is displayed correctly
    cy.get('input[name="name"]').should('have.value', testUser.originalUsername);
    cy.get('input[name="email"]').should('have.value', testUser.email);
    
    // Verify other sections have correct data
    cy.get('[data-cy="preferences-section"]').click();
    cy.get('select[name="language"]').should('have.value', 'English');
    cy.get('select[name="currency"]').should('have.value', 'USD');

    // Verify travel preferences
    cy.get('[data-cy="travel-section"]').click();
    cy.contains('Paris').should('be.visible');
    cy.contains('Tokyo').should('be.visible');
    cy.contains('Hotel').should('be.visible');
    cy.contains('Sightseeing').should('be.visible');
    cy.contains('Vegetarian').should('be.visible');
  });

  it('should handle network errors during profile update', () => {
    cy.visit('http://localhost:5173/settings');
    
    // Simulate network error
    cy.intercept('PUT', '**/api/v1/users/profile', {
      forceNetworkError: true
    }).as('networkError');

    // Update username
    cy.get('input[name="name"]')
      .clear()
      .type('networktest_user');

    cy.get('button').contains('Save Changes').click();

    // Wait for network error
    cy.wait('@networkError');

    // Verify error handling
    cy.get('button').contains('Save Changes').should('be.visible');
    // The form should still be editable after error
    cy.get('input[name="name"]').should('not.be.disabled');
  });

  afterEach(() => {
    // Cleanup: Reset username back to original if it was changed
    // This helps maintain test isolation
    cy.visit('http://localhost:5173/settings');
    cy.get('input[name="name"]')
      .clear()
      .type(testUser.originalUsername);
    cy.get('button').contains('Save Changes').click();
    
    // Logout
    cy.get('[data-cy="user-menu"]').click();
    cy.get('[data-cy="logout-button"]').click();
  });
});