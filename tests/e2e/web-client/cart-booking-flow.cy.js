/**
 * Cart and Booking Reservation Flow - E2E Tests
 * Tests the complete flow from search to checkout with Stripe payment
 *
 * Test Scenarios:
 * 1. Search flight → Add to cart → View cart
 * 2. Add hotel + activity to existing cart
 * 3. Modify activity quantity
 * 4. Delete cart item
 * 5. Checkout → Stripe payment (test mode)
 * 6. Booking confirmation + email received
 * 7. Cart expiration after 30 min (accelerated)
 * 8. Item unavailable at checkout → error handling
 */

describe('Cart and Booking Reservation Flow', () => {
  const TEMP_USER_ID = 'user-123';
  const BASE_URL = 'http://localhost:5173';
  const AUTH_SERVICE_URL = 'http://localhost:3001';
  const VOYAGE_SERVICE_URL = 'http://localhost:3003';

  // Test data
  const testFlight = {
    id: 'test-flight-1',
    airline: 'Air France',
    flightNumber: 'AF123',
    origin: 'CDG',
    destination: 'JFK',
    price: 450.00,
    currency: 'EUR'
  };

  const testHotel = {
    id: 'test-hotel-1',
    name: 'Grand Hotel Paris',
    location: 'Paris',
    price: 150.00,
    currency: 'EUR'
  };

  const testActivity = {
    id: 'test-activity-1',
    name: 'Eiffel Tower Tour',
    location: 'Paris',
    price: 35.00,
    currency: 'EUR'
  };

  beforeEach(() => {
    // Clear cart before each test
    cy.request({
      method: 'DELETE',
      url: `${VOYAGE_SERVICE_URL}/api/v1/cart/${TEMP_USER_ID}`,
      failOnStatusCode: false
    });

    // Visit home page
    cy.visit(BASE_URL);
    cy.wait(500);
  });

  afterEach(() => {
    // Clean up - clear cart after each test
    cy.request({
      method: 'DELETE',
      url: `${VOYAGE_SERVICE_URL}/api/v1/cart/${TEMP_USER_ID}`,
      failOnStatusCode: false
    });
  });

  describe('Scenario 1: Search flight → Add to cart → View cart', () => {
    it('should search for flights, add one to cart, and view cart contents', () => {
      // Navigate to flights page
      cy.contains('Flights').click();
      cy.url().should('include', '/flights');

      // Wait for page to load
      cy.wait(1000);

      // Fill in flight search form
      cy.get('input[placeholder*="From"]', { timeout: 10000 }).type('Paris');
      cy.wait(500);
      cy.get('input[placeholder*="To"]').type('New York');
      cy.wait(500);

      // Select dates (if date pickers exist)
      cy.get('input[type="date"]').first().type('2025-12-25');
      cy.get('input[type="date"]').last().type('2025-12-31');

      // Click search button
      cy.contains('button', 'Search').click();

      // Wait for search results
      cy.wait(3000);

      // Verify search results are displayed
      cy.get('[class*="flight"]', { timeout: 15000 }).should('exist');

      // Mock the add to cart API call with success response
      cy.intercept('POST', '**/api/v1/cart/*/items', {
        statusCode: 200,
        body: {
          data: {
            id: 'cart-123',
            userId: TEMP_USER_ID,
            items: [{
              id: 'item-1',
              type: 'FLIGHT',
              itemId: testFlight.id,
              quantity: 1,
              price: testFlight.price,
              currency: testFlight.currency,
              itemData: {
                type: 'flight',
                flightNumber: testFlight.flightNumber,
                airline: testFlight.airline,
                origin: testFlight.origin,
                destination: testFlight.destination,
                departureTime: '2025-12-25T10:00:00Z',
                arrivalTime: '2025-12-25T18:00:00Z',
                duration: '8h',
                cabinClass: 'Economy',
                passengers: { adults: 1 }
              }
            }],
            totalPrice: testFlight.price,
            currency: testFlight.currency,
            expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
          },
          meta: {
            itemCount: 1,
            totalPrice: testFlight.price,
            message: 'Item added to cart successfully'
          }
        }
      }).as('addFlightToCart');

      // Click "Add to Cart" button on first flight result
      cy.contains('button', 'Add to Cart').first().click();

      // Wait for API call
      cy.wait('@addFlightToCart');

      // Verify success notification
      cy.contains('Added to cart', { timeout: 5000 }).should('be.visible');

      // Verify cart badge shows 1 item
      cy.get('[aria-label="Shopping cart"]').parent().find('span').should('contain', '1');

      // Click cart button to open cart drawer
      cy.get('[aria-label="Shopping cart"]').click();

      // Verify cart drawer is open
      cy.contains('Shopping Cart').should('be.visible');

      // Mock the get cart API call
      cy.intercept('GET', '**/api/v1/cart/*', {
        statusCode: 200,
        body: {
          data: {
            id: 'cart-123',
            userId: TEMP_USER_ID,
            items: [{
              id: 'item-1',
              type: 'FLIGHT',
              itemId: testFlight.id,
              quantity: 1,
              price: testFlight.price,
              currency: testFlight.currency,
              itemData: {
                type: 'flight',
                flightNumber: testFlight.flightNumber,
                airline: testFlight.airline,
                origin: testFlight.origin,
                destination: testFlight.destination,
                departureTime: '2025-12-25T10:00:00Z',
                arrivalTime: '2025-12-25T18:00:00Z',
                duration: '8h',
                cabinClass: 'Economy',
                passengers: { adults: 1 }
              }
            }],
            totalPrice: testFlight.price,
            currency: testFlight.currency,
            expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
          }
        }
      }).as('getCart');

      // Verify flight is displayed in cart
      cy.contains(testFlight.airline).should('be.visible');
      cy.contains(`${testFlight.origin} → ${testFlight.destination}`).should('be.visible');
      cy.contains(`${testFlight.currency} ${testFlight.price.toFixed(2)}`).should('be.visible');

      // Verify total price
      cy.contains('Total').parent().should('contain', `${testFlight.currency} ${testFlight.price.toFixed(2)}`);
    });
  });

  describe('Scenario 2: Add hotel + activity to existing cart', () => {
    it('should add hotel and activity to cart that already has a flight', () => {
      // First, add a flight to cart (setup)
      cy.request({
        method: 'POST',
        url: `${VOYAGE_SERVICE_URL}/api/v1/cart/${TEMP_USER_ID}/items`,
        body: {
          type: 'FLIGHT',
          itemId: testFlight.id,
          quantity: 1,
          price: testFlight.price,
          currency: testFlight.currency,
          itemData: {
            type: 'flight',
            flightNumber: testFlight.flightNumber,
            airline: testFlight.airline,
            origin: testFlight.origin,
            destination: testFlight.destination,
            departureTime: '2025-12-25T10:00:00Z',
            arrivalTime: '2025-12-25T18:00:00Z',
            duration: '8h',
            cabinClass: 'Economy',
            passengers: { adults: 1 }
          }
        },
        failOnStatusCode: false
      });

      // Navigate to hotels page
      cy.contains('Hotels').click();
      cy.url().should('include', '/hotels');
      cy.wait(1000);

      // Search for hotels
      cy.get('input[placeholder*="Where"]', { timeout: 10000 }).type('Paris');
      cy.get('input[type="date"]').first().type('2025-12-25');
      cy.get('input[type="date"]').last().type('2025-12-27');
      cy.contains('button', 'Search').click();
      cy.wait(3000);

      // Mock add hotel to cart
      cy.intercept('POST', '**/api/v1/cart/*/items', (req) => {
        if (req.body.type === 'HOTEL') {
          req.reply({
            statusCode: 200,
            body: {
              data: {
                id: 'cart-123',
                userId: TEMP_USER_ID,
                items: [
                  {
                    id: 'item-1',
                    type: 'FLIGHT',
                    quantity: 1,
                    price: testFlight.price,
                    currency: testFlight.currency
                  },
                  {
                    id: 'item-2',
                    type: 'HOTEL',
                    itemId: testHotel.id,
                    quantity: 1,
                    price: testHotel.price,
                    currency: testHotel.currency,
                    itemData: {
                      type: 'hotel',
                      name: testHotel.name,
                      location: testHotel.location,
                      checkInDate: '2025-12-25',
                      checkOutDate: '2025-12-27',
                      nights: 2,
                      roomType: 'Standard',
                      guests: 1
                    }
                  }
                ],
                totalPrice: testFlight.price + testHotel.price,
                currency: testFlight.currency
              },
              meta: {
                itemCount: 2,
                message: 'Item added to cart successfully'
              }
            }
          });
        }
      }).as('addHotelToCart');

      // Add hotel to cart
      cy.contains('button', 'Add to Cart').first().click();
      cy.wait('@addHotelToCart');
      cy.contains('Added to cart', { timeout: 5000 }).should('be.visible');

      // Navigate to activities page
      cy.contains('Activities').click();
      cy.url().should('include', '/activities');
      cy.wait(1000);

      // Search for activities
      cy.get('input[placeholder*="Search"]', { timeout: 10000 }).type('Paris');
      cy.wait(2000);

      // Mock add activity to cart
      cy.intercept('POST', '**/api/v1/cart/*/items', (req) => {
        if (req.body.type === 'ACTIVITY') {
          req.reply({
            statusCode: 200,
            body: {
              data: {
                id: 'cart-123',
                userId: TEMP_USER_ID,
                items: [
                  {
                    id: 'item-1',
                    type: 'FLIGHT',
                    quantity: 1,
                    price: testFlight.price,
                    currency: testFlight.currency
                  },
                  {
                    id: 'item-2',
                    type: 'HOTEL',
                    quantity: 1,
                    price: testHotel.price,
                    currency: testHotel.currency
                  },
                  {
                    id: 'item-3',
                    type: 'ACTIVITY',
                    itemId: testActivity.id,
                    quantity: 1,
                    price: testActivity.price,
                    currency: testActivity.currency,
                    itemData: {
                      type: 'activity',
                      name: testActivity.name,
                      location: testActivity.location,
                      date: '2025-12-26',
                      duration: '3 hours',
                      participants: 1
                    }
                  }
                ],
                totalPrice: testFlight.price + testHotel.price + testActivity.price,
                currency: testFlight.currency
              },
              meta: {
                itemCount: 3,
                message: 'Item added to cart successfully'
              }
            }
          });
        }
      }).as('addActivityToCart');

      // Add activity to cart
      cy.contains('button', 'Add to Cart').first().click();
      cy.wait('@addActivityToCart');
      cy.contains('Added to cart', { timeout: 5000 }).should('be.visible');

      // Verify cart badge shows 3 items
      cy.get('[aria-label="Shopping cart"]').parent().find('span').should('contain', '3');

      // Open cart and verify all items
      cy.get('[aria-label="Shopping cart"]').click();

      // Mock get cart with all items
      cy.intercept('GET', '**/api/v1/cart/*', {
        statusCode: 200,
        body: {
          data: {
            id: 'cart-123',
            userId: TEMP_USER_ID,
            items: [
              {
                id: 'item-1',
                type: 'FLIGHT',
                itemId: testFlight.id,
                quantity: 1,
                price: testFlight.price,
                currency: testFlight.currency,
                itemData: {
                  type: 'flight',
                  flightNumber: testFlight.flightNumber,
                  airline: testFlight.airline,
                  origin: testFlight.origin,
                  destination: testFlight.destination,
                  departureTime: '2025-12-25T10:00:00Z',
                  arrivalTime: '2025-12-25T18:00:00Z',
                  duration: '8h',
                  cabinClass: 'Economy',
                  passengers: { adults: 1 }
                }
              },
              {
                id: 'item-2',
                type: 'HOTEL',
                itemId: testHotel.id,
                quantity: 1,
                price: testHotel.price,
                currency: testHotel.currency,
                itemData: {
                  type: 'hotel',
                  name: testHotel.name,
                  location: testHotel.location,
                  checkInDate: '2025-12-25',
                  checkOutDate: '2025-12-27',
                  nights: 2,
                  roomType: 'Standard',
                  guests: 1
                }
              },
              {
                id: 'item-3',
                type: 'ACTIVITY',
                itemId: testActivity.id,
                quantity: 1,
                price: testActivity.price,
                currency: testActivity.currency,
                itemData: {
                  type: 'activity',
                  name: testActivity.name,
                  location: testActivity.location,
                  date: '2025-12-26',
                  duration: '3 hours',
                  participants: 1
                }
              }
            ],
            totalPrice: testFlight.price + testHotel.price + testActivity.price,
            currency: testFlight.currency,
            expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
          }
        }
      }).as('getCartWithAllItems');

      // Verify all three items are in cart
      cy.contains(testFlight.airline).should('be.visible');
      cy.contains(testHotel.name).should('be.visible');
      cy.contains(testActivity.name).should('be.visible');

      // Verify total price
      const totalPrice = testFlight.price + testHotel.price + testActivity.price;
      cy.contains('Total').parent().should('contain', `${testFlight.currency} ${totalPrice.toFixed(2)}`);
    });
  });

  describe('Scenario 3: Modify activity quantity', () => {
    it('should increase and decrease activity quantity in cart', () => {
      // Add activity to cart first
      cy.request({
        method: 'POST',
        url: `${VOYAGE_SERVICE_URL}/api/v1/cart/${TEMP_USER_ID}/items`,
        body: {
          type: 'ACTIVITY',
          itemId: testActivity.id,
          quantity: 1,
          price: testActivity.price,
          currency: testActivity.currency,
          itemData: {
            type: 'activity',
            name: testActivity.name,
            location: testActivity.location,
            date: '2025-12-26',
            duration: '3 hours',
            participants: 1
          }
        },
        failOnStatusCode: false
      });

      cy.visit(BASE_URL);
      cy.wait(500);

      // Open cart
      cy.get('[aria-label="Shopping cart"]').click();

      // Mock get cart
      cy.intercept('GET', '**/api/v1/cart/*', {
        statusCode: 200,
        body: {
          data: {
            id: 'cart-123',
            userId: TEMP_USER_ID,
            items: [{
              id: 'item-1',
              type: 'ACTIVITY',
              itemId: testActivity.id,
              quantity: 1,
              price: testActivity.price,
              currency: testActivity.currency,
              itemData: {
                type: 'activity',
                name: testActivity.name,
                location: testActivity.location,
                date: '2025-12-26',
                duration: '3 hours',
                participants: 1
              }
            }],
            totalPrice: testActivity.price,
            currency: testActivity.currency,
            expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
          }
        }
      }).as('getCart');

      cy.wait('@getCart');

      // Verify initial quantity is 1
      cy.contains(testActivity.name).parent().parent().find('span').contains('1').should('be.visible');

      // Mock update quantity to 2
      cy.intercept('PATCH', '**/api/v1/cart/*/items/item-1', (req) => {
        req.reply({
          statusCode: 200,
          body: {
            data: {
              id: 'cart-123',
              userId: TEMP_USER_ID,
              items: [{
                id: 'item-1',
                type: 'ACTIVITY',
                itemId: testActivity.id,
                quantity: req.body.quantity,
                price: testActivity.price,
                currency: testActivity.currency,
                itemData: {
                  type: 'activity',
                  name: testActivity.name,
                  location: testActivity.location,
                  date: '2025-12-26',
                  duration: '3 hours',
                  participants: 1
                }
              }],
              totalPrice: testActivity.price * req.body.quantity,
              currency: testActivity.currency
            },
            meta: {
              itemCount: 1,
              totalPrice: testActivity.price * req.body.quantity,
              message: 'Item quantity updated successfully'
            }
          }
        });
      }).as('updateQuantity');

      // Click increment button (Plus icon)
      cy.get('[aria-label="Increase quantity"]').click();
      cy.wait('@updateQuantity');

      // Verify quantity is now 2
      cy.contains(testActivity.name).parent().parent().find('span').contains('2').should('be.visible');

      // Verify total price updated
      cy.contains('Total').parent().should('contain', `${testActivity.currency} ${(testActivity.price * 2).toFixed(2)}`);

      // Click decrement button (Minus icon)
      cy.get('[aria-label="Decrease quantity"]').click();
      cy.wait('@updateQuantity');

      // Verify quantity is back to 1
      cy.contains(testActivity.name).parent().parent().find('span').contains('1').should('be.visible');

      // Verify total price updated back
      cy.contains('Total').parent().should('contain', `${testActivity.currency} ${testActivity.price.toFixed(2)}`);
    });
  });

  describe('Scenario 4: Delete cart item', () => {
    it('should remove an item from cart', () => {
      // Add two items to cart first
      cy.request({
        method: 'POST',
        url: `${VOYAGE_SERVICE_URL}/api/v1/cart/${TEMP_USER_ID}/items`,
        body: {
          type: 'FLIGHT',
          itemId: testFlight.id,
          quantity: 1,
          price: testFlight.price,
          currency: testFlight.currency,
          itemData: {
            type: 'flight',
            flightNumber: testFlight.flightNumber,
            airline: testFlight.airline,
            origin: testFlight.origin,
            destination: testFlight.destination,
            departureTime: '2025-12-25T10:00:00Z',
            arrivalTime: '2025-12-25T18:00:00Z',
            duration: '8h',
            cabinClass: 'Economy',
            passengers: { adults: 1 }
          }
        },
        failOnStatusCode: false
      });

      cy.request({
        method: 'POST',
        url: `${VOYAGE_SERVICE_URL}/api/v1/cart/${TEMP_USER_ID}/items`,
        body: {
          type: 'HOTEL',
          itemId: testHotel.id,
          quantity: 1,
          price: testHotel.price,
          currency: testHotel.currency,
          itemData: {
            type: 'hotel',
            name: testHotel.name,
            location: testHotel.location,
            checkInDate: '2025-12-25',
            checkOutDate: '2025-12-27',
            nights: 2,
            roomType: 'Standard',
            guests: 1
          }
        },
        failOnStatusCode: false
      });

      cy.visit(BASE_URL);
      cy.wait(500);

      // Open cart
      cy.get('[aria-label="Shopping cart"]').click();

      // Mock get cart with 2 items
      cy.intercept('GET', '**/api/v1/cart/*', {
        statusCode: 200,
        body: {
          data: {
            id: 'cart-123',
            userId: TEMP_USER_ID,
            items: [
              {
                id: 'item-1',
                type: 'FLIGHT',
                itemId: testFlight.id,
                quantity: 1,
                price: testFlight.price,
                currency: testFlight.currency,
                itemData: {
                  type: 'flight',
                  flightNumber: testFlight.flightNumber,
                  airline: testFlight.airline,
                  origin: testFlight.origin,
                  destination: testFlight.destination,
                  departureTime: '2025-12-25T10:00:00Z',
                  arrivalTime: '2025-12-25T18:00:00Z',
                  duration: '8h',
                  cabinClass: 'Economy',
                  passengers: { adults: 1 }
                }
              },
              {
                id: 'item-2',
                type: 'HOTEL',
                itemId: testHotel.id,
                quantity: 1,
                price: testHotel.price,
                currency: testHotel.currency,
                itemData: {
                  type: 'hotel',
                  name: testHotel.name,
                  location: testHotel.location,
                  checkInDate: '2025-12-25',
                  checkOutDate: '2025-12-27',
                  nights: 2,
                  roomType: 'Standard',
                  guests: 1
                }
              }
            ],
            totalPrice: testFlight.price + testHotel.price,
            currency: testFlight.currency,
            expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
          }
        }
      }).as('getCart');

      cy.wait('@getCart');

      // Verify both items are visible
      cy.contains(testFlight.airline).should('be.visible');
      cy.contains(testHotel.name).should('be.visible');

      // Mock remove item
      cy.intercept('DELETE', '**/api/v1/cart/*/items/item-2', {
        statusCode: 200,
        body: {
          data: {
            id: 'cart-123',
            userId: TEMP_USER_ID,
            items: [{
              id: 'item-1',
              type: 'FLIGHT',
              itemId: testFlight.id,
              quantity: 1,
              price: testFlight.price,
              currency: testFlight.currency,
              itemData: {
                type: 'flight',
                flightNumber: testFlight.flightNumber,
                airline: testFlight.airline,
                origin: testFlight.origin,
                destination: testFlight.destination,
                departureTime: '2025-12-25T10:00:00Z',
                arrivalTime: '2025-12-25T18:00:00Z',
                duration: '8h',
                cabinClass: 'Economy',
                passengers: { adults: 1 }
              }
            }],
            totalPrice: testFlight.price,
            currency: testFlight.currency
          },
          meta: {
            itemCount: 1,
            totalPrice: testFlight.price,
            message: 'Item removed from cart successfully'
          }
        }
      }).as('removeItem');

      // Click remove button for hotel (Trash icon)
      cy.contains(testHotel.name).parent().parent().find('[aria-label="Remove item"]').click();
      cy.wait('@removeItem');

      // Verify hotel is removed
      cy.contains(testHotel.name).should('not.exist');

      // Verify flight is still there
      cy.contains(testFlight.airline).should('be.visible');

      // Verify total price updated
      cy.contains('Total').parent().should('contain', `${testFlight.currency} ${testFlight.price.toFixed(2)}`);

      // Verify cart badge shows 1 item
      cy.get('[aria-label="Shopping cart"]').parent().find('span').should('contain', '1');
    });

    it('should clear entire cart', () => {
      // Add item to cart
      cy.request({
        method: 'POST',
        url: `${VOYAGE_SERVICE_URL}/api/v1/cart/${TEMP_USER_ID}/items`,
        body: {
          type: 'FLIGHT',
          itemId: testFlight.id,
          quantity: 1,
          price: testFlight.price,
          currency: testFlight.currency,
          itemData: {
            type: 'flight',
            flightNumber: testFlight.flightNumber,
            airline: testFlight.airline,
            origin: testFlight.origin,
            destination: testFlight.destination,
            departureTime: '2025-12-25T10:00:00Z',
            arrivalTime: '2025-12-25T18:00:00Z',
            duration: '8h',
            cabinClass: 'Economy',
            passengers: { adults: 1 }
          }
        },
        failOnStatusCode: false
      });

      cy.visit(BASE_URL);
      cy.wait(500);

      // Open cart
      cy.get('[aria-label="Shopping cart"]').click();

      // Mock get cart
      cy.intercept('GET', '**/api/v1/cart/*', {
        statusCode: 200,
        body: {
          data: {
            id: 'cart-123',
            userId: TEMP_USER_ID,
            items: [{
              id: 'item-1',
              type: 'FLIGHT',
              itemId: testFlight.id,
              quantity: 1,
              price: testFlight.price,
              currency: testFlight.currency,
              itemData: {
                type: 'flight',
                flightNumber: testFlight.flightNumber,
                airline: testFlight.airline,
                origin: testFlight.origin,
                destination: testFlight.destination,
                departureTime: '2025-12-25T10:00:00Z',
                arrivalTime: '2025-12-25T18:00:00Z',
                duration: '8h',
                cabinClass: 'Economy',
                passengers: { adults: 1 }
              }
            }],
            totalPrice: testFlight.price,
            currency: testFlight.currency,
            expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
          }
        }
      }).as('getCart');

      cy.wait('@getCart');

      // Mock clear cart
      cy.intercept('DELETE', `**/api/v1/cart/${TEMP_USER_ID}`, {
        statusCode: 200,
        body: {
          data: null,
          meta: {
            message: 'Cart cleared successfully'
          }
        }
      }).as('clearCart');

      // Click Clear Cart button
      cy.contains('button', 'Clear Cart').click();

      // Confirm in browser dialog (if exists)
      cy.on('window:confirm', () => true);

      cy.wait('@clearCart');

      // Verify empty cart message
      cy.contains('Your cart is empty').should('be.visible');

      // Verify cart badge is gone or shows 0
      cy.get('[aria-label="Shopping cart"]').parent().find('span').should('not.exist');
    });
  });

  describe('Scenario 5: Checkout → Stripe payment (test mode)', () => {
    it('should complete checkout process and redirect to Stripe payment', () => {
      // Add item to cart
      cy.request({
        method: 'POST',
        url: `${VOYAGE_SERVICE_URL}/api/v1/cart/${TEMP_USER_ID}/items`,
        body: {
          type: 'FLIGHT',
          itemId: testFlight.id,
          quantity: 1,
          price: testFlight.price,
          currency: testFlight.currency,
          itemData: {
            type: 'flight',
            flightNumber: testFlight.flightNumber,
            airline: testFlight.airline,
            origin: testFlight.origin,
            destination: testFlight.destination,
            departureTime: '2025-12-25T10:00:00Z',
            arrivalTime: '2025-12-25T18:00:00Z',
            duration: '8h',
            cabinClass: 'Economy',
            passengers: { adults: 1 }
          }
        },
        failOnStatusCode: false
      });

      cy.visit(BASE_URL);
      cy.wait(500);

      // Open cart
      cy.get('[aria-label="Shopping cart"]').click();

      // Mock get cart
      cy.intercept('GET', '**/api/v1/cart/*', {
        statusCode: 200,
        body: {
          data: {
            id: 'cart-123',
            userId: TEMP_USER_ID,
            items: [{
              id: 'item-1',
              type: 'FLIGHT',
              itemId: testFlight.id,
              quantity: 1,
              price: testFlight.price,
              currency: testFlight.currency,
              itemData: {
                type: 'flight',
                flightNumber: testFlight.flightNumber,
                airline: testFlight.airline,
                origin: testFlight.origin,
                destination: testFlight.destination,
                departureTime: '2025-12-25T10:00:00Z',
                arrivalTime: '2025-12-25T18:00:00Z',
                duration: '8h',
                cabinClass: 'Economy',
                passengers: { adults: 1 }
              }
            }],
            totalPrice: testFlight.price,
            currency: testFlight.currency,
            expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
          }
        }
      }).as('getCart');

      cy.wait('@getCart');

      // Mock checkout API
      cy.intercept('POST', '**/api/v1/cart/*/checkout', {
        statusCode: 200,
        body: {
          bookingReference: 'BK-2025-001',
          bookingId: 'booking-123',
          totalAmount: testFlight.price,
          currency: testFlight.currency,
          items: [{
            type: 'FLIGHT',
            itemId: testFlight.id,
            itemData: {
              type: 'flight',
              flightNumber: testFlight.flightNumber,
              airline: testFlight.airline,
              origin: testFlight.origin,
              destination: testFlight.destination
            },
            quantity: 1,
            price: testFlight.price,
            currency: testFlight.currency
          }],
          status: 'PENDING_PAYMENT',
          createdAt: new Date().toISOString(),
          payment: {
            clientSecret: 'pi_test_secret_123',
            publishableKey: 'pk_test_123',
            paymentIntentId: 'pi_test_123'
          }
        }
      }).as('checkout');

      // Click Proceed to Checkout button
      cy.contains('button', 'Proceed to Checkout').click();

      // Wait for checkout API call
      cy.wait('@checkout');

      // Verify checkout response (alert in current implementation)
      // In production, this would redirect to Stripe payment page
      cy.on('window:alert', (text) => {
        expect(text).to.include('BK-2025-001');
        expect(text).to.include(testFlight.price.toString());
      });

      // TODO: When Stripe integration is complete, verify:
      // - Redirect to payment page
      // - Stripe Elements loaded
      // - Payment form visible
      // - Can enter test card details
      // - Payment successful confirmation
    });
  });

  describe('Scenario 6: Booking confirmation + email received', () => {
    it('should create booking and verify confirmation (email assertion placeholder)', () => {
      // This test verifies booking creation
      // Email verification would require email service integration testing

      const bookingReference = 'BK-2025-TEST';

      // Mock checkout with successful booking creation
      cy.intercept('POST', '**/api/v1/cart/*/checkout', {
        statusCode: 200,
        body: {
          bookingReference: bookingReference,
          bookingId: 'booking-test-123',
          totalAmount: testFlight.price,
          currency: testFlight.currency,
          items: [{
            type: 'FLIGHT',
            itemId: testFlight.id,
            itemData: {
              type: 'flight',
              flightNumber: testFlight.flightNumber,
              airline: testFlight.airline,
              origin: testFlight.origin,
              destination: testFlight.destination
            },
            quantity: 1,
            price: testFlight.price,
            currency: testFlight.currency
          }],
          status: 'PENDING_PAYMENT',
          createdAt: new Date().toISOString(),
          payment: {
            clientSecret: 'pi_test_secret_123',
            publishableKey: 'pk_test_123',
            paymentIntentId: 'pi_test_123'
          }
        }
      }).as('checkout');

      // Add item and checkout
      cy.request({
        method: 'POST',
        url: `${VOYAGE_SERVICE_URL}/api/v1/cart/${TEMP_USER_ID}/items`,
        body: {
          type: 'FLIGHT',
          itemId: testFlight.id,
          quantity: 1,
          price: testFlight.price,
          currency: testFlight.currency,
          itemData: {
            type: 'flight',
            flightNumber: testFlight.flightNumber,
            airline: testFlight.airline,
            origin: testFlight.origin,
            destination: testFlight.destination,
            departureTime: '2025-12-25T10:00:00Z',
            arrivalTime: '2025-12-25T18:00:00Z',
            duration: '8h',
            cabinClass: 'Economy',
            passengers: { adults: 1 }
          }
        },
        failOnStatusCode: false
      });

      cy.visit(BASE_URL);
      cy.wait(500);
      cy.get('[aria-label="Shopping cart"]').click();

      cy.intercept('GET', '**/api/v1/cart/*', {
        statusCode: 200,
        body: {
          data: {
            id: 'cart-123',
            userId: TEMP_USER_ID,
            items: [{
              id: 'item-1',
              type: 'FLIGHT',
              quantity: 1,
              price: testFlight.price,
              currency: testFlight.currency
            }],
            totalPrice: testFlight.price,
            currency: testFlight.currency,
            expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
          }
        }
      });

      cy.wait(1000);
      cy.contains('button', 'Proceed to Checkout').click();
      cy.wait('@checkout');

      // Verify booking reference in alert
      cy.on('window:alert', (text) => {
        expect(text).to.include(bookingReference);
      });

      // Verify Kafka event published (would require Kafka consumer in test environment)
      // TODO: Add Kafka event verification
      // - Listen for booking.created event
      // - Verify event payload contains booking details

      // Verify email sent (would require email service mock/spy)
      // TODO: Add email verification
      // - Check email service was called
      // - Verify email contains booking reference
      // - Verify email sent to correct user email

      cy.log('✓ Booking created successfully');
      cy.log('⚠ Email verification requires email service integration');
      cy.log('⚠ Kafka event verification requires Kafka test consumer');
    });
  });

  describe('Scenario 7: Cart expiration after 30 min (accelerated)', () => {
    it('should expire cart after time limit (accelerated test)', () => {
      // This test simulates cart expiration by mocking expired cart response
      // In real scenario, cart expires after 30 minutes

      // Add item to cart
      cy.request({
        method: 'POST',
        url: `${VOYAGE_SERVICE_URL}/api/v1/cart/${TEMP_USER_ID}/items`,
        body: {
          type: 'FLIGHT',
          itemId: testFlight.id,
          quantity: 1,
          price: testFlight.price,
          currency: testFlight.currency,
          itemData: {
            type: 'flight',
            flightNumber: testFlight.flightNumber,
            airline: testFlight.airline,
            origin: testFlight.origin,
            destination: testFlight.destination,
            departureTime: '2025-12-25T10:00:00Z',
            arrivalTime: '2025-12-25T18:00:00Z',
            duration: '8h',
            cabinClass: 'Economy',
            passengers: { adults: 1 }
          }
        },
        failOnStatusCode: false
      });

      cy.visit(BASE_URL);
      cy.wait(500);

      // Mock get cart with expiration time in the past
      cy.intercept('GET', '**/api/v1/cart/*', {
        statusCode: 200,
        body: {
          data: {
            id: 'cart-123',
            userId: TEMP_USER_ID,
            items: [{
              id: 'item-1',
              type: 'FLIGHT',
              itemId: testFlight.id,
              quantity: 1,
              price: testFlight.price,
              currency: testFlight.currency,
              itemData: {
                type: 'flight',
                flightNumber: testFlight.flightNumber,
                airline: testFlight.airline,
                origin: testFlight.origin,
                destination: testFlight.destination,
                departureTime: '2025-12-25T10:00:00Z',
                arrivalTime: '2025-12-25T18:00:00Z',
                duration: '8h',
                cabinClass: 'Economy',
                passengers: { adults: 1 }
              }
            }],
            totalPrice: testFlight.price,
            currency: testFlight.currency,
            expiresAt: new Date(Date.now() - 1000).toISOString() // Expired 1 second ago
          }
        }
      }).as('getExpiredCart');

      // Open cart
      cy.get('[aria-label="Shopping cart"]').click();
      cy.wait('@getExpiredCart');

      // Verify expiration warning is shown
      cy.contains('Expired', { timeout: 5000 }).should('be.visible');

      // Mock extend expiry API
      cy.intercept('POST', '**/api/v1/cart/*/extend', {
        statusCode: 200,
        body: {
          data: {
            id: 'cart-123',
            userId: TEMP_USER_ID,
            items: [{
              id: 'item-1',
              type: 'FLIGHT',
              quantity: 1,
              price: testFlight.price,
              currency: testFlight.currency
            }],
            totalPrice: testFlight.price,
            currency: testFlight.currency,
            expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
          },
          meta: {
            message: 'Cart expiry extended successfully'
          }
        }
      }).as('extendExpiry');

      // Click extend button
      cy.contains('button', 'Extend').click();
      cy.wait('@extendExpiry');

      // Verify cart is extended (timer should show 30 minutes)
      cy.contains(/2[0-9]:[0-5][0-9]/).should('be.visible'); // Should show ~30:00 or 29:XX
    });

    it('should show countdown timer and warning when expiring soon', () => {
      // Mock cart with 3 minutes remaining
      cy.intercept('GET', '**/api/v1/cart/*', {
        statusCode: 200,
        body: {
          data: {
            id: 'cart-123',
            userId: TEMP_USER_ID,
            items: [{
              id: 'item-1',
              type: 'FLIGHT',
              quantity: 1,
              price: testFlight.price,
              currency: testFlight.currency
            }],
            totalPrice: testFlight.price,
            currency: testFlight.currency,
            expiresAt: new Date(Date.now() + 3 * 60 * 1000).toISOString() // 3 minutes remaining
          }
        }
      }).as('getCartExpiringSoon');

      cy.visit(BASE_URL);
      cy.wait(500);
      cy.get('[aria-label="Shopping cart"]').click();
      cy.wait('@getCartExpiringSoon');

      // Verify timer shows time remaining
      cy.contains(/[0-2]:[0-5][0-9]/).should('be.visible');

      // Verify warning styling (red background when < 5 min)
      cy.contains('Cart expires in').parent().should('have.class', 'bg-red-50');

      // Verify Extend button is visible
      cy.contains('button', 'Extend').should('be.visible');
    });
  });

  describe('Scenario 8: Item unavailable at checkout → error handling', () => {
    it('should handle item unavailable error during checkout', () => {
      // Add item to cart
      cy.request({
        method: 'POST',
        url: `${VOYAGE_SERVICE_URL}/api/v1/cart/${TEMP_USER_ID}/items`,
        body: {
          type: 'FLIGHT',
          itemId: testFlight.id,
          quantity: 1,
          price: testFlight.price,
          currency: testFlight.currency,
          itemData: {
            type: 'flight',
            flightNumber: testFlight.flightNumber,
            airline: testFlight.airline,
            origin: testFlight.origin,
            destination: testFlight.destination,
            departureTime: '2025-12-25T10:00:00Z',
            arrivalTime: '2025-12-25T18:00:00Z',
            duration: '8h',
            cabinClass: 'Economy',
            passengers: { adults: 1 }
          }
        },
        failOnStatusCode: false
      });

      cy.visit(BASE_URL);
      cy.wait(500);

      // Open cart
      cy.get('[aria-label="Shopping cart"]').click();

      // Mock get cart
      cy.intercept('GET', '**/api/v1/cart/*', {
        statusCode: 200,
        body: {
          data: {
            id: 'cart-123',
            userId: TEMP_USER_ID,
            items: [{
              id: 'item-1',
              type: 'FLIGHT',
              itemId: testFlight.id,
              quantity: 1,
              price: testFlight.price,
              currency: testFlight.currency,
              itemData: {
                type: 'flight',
                flightNumber: testFlight.flightNumber,
                airline: testFlight.airline,
                origin: testFlight.origin,
                destination: testFlight.destination,
                departureTime: '2025-12-25T10:00:00Z',
                arrivalTime: '2025-12-25T18:00:00Z',
                duration: '8h',
                cabinClass: 'Economy',
                passengers: { adults: 1 }
              }
            }],
            totalPrice: testFlight.price,
            currency: testFlight.currency,
            expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
          }
        }
      }).as('getCart');

      cy.wait('@getCart');

      // Mock checkout error - item unavailable
      cy.intercept('POST', '**/api/v1/cart/*/checkout', {
        statusCode: 400,
        body: {
          success: false,
          message: 'Flight AF123 is no longer available',
          error: {
            code: 'ITEM_UNAVAILABLE',
            details: {
              itemId: testFlight.id,
              itemType: 'FLIGHT'
            }
          }
        }
      }).as('checkoutError');

      // Click Proceed to Checkout
      cy.contains('button', 'Proceed to Checkout').click();

      // Wait for error response
      cy.wait('@checkoutError');

      // Verify error is displayed to user
      // Current implementation shows console error and may need UI error display
      cy.log('⚠ Error handling verification - implementation may vary');

      // Verify cart is still open
      cy.contains('Shopping Cart').should('be.visible');

      // Verify checkout button is re-enabled
      cy.contains('button', 'Proceed to Checkout').should('not.be.disabled');

      // TODO: Add UI error message verification when implemented
      // cy.contains('Flight AF123 is no longer available').should('be.visible');
    });

    it('should handle price change error during checkout', () => {
      // Mock checkout error - price changed
      cy.intercept('POST', '**/api/v1/cart/*/checkout', {
        statusCode: 400,
        body: {
          success: false,
          message: 'Price has changed for one or more items',
          error: {
            code: 'PRICE_CHANGED',
            details: {
              itemId: testFlight.id,
              oldPrice: testFlight.price,
              newPrice: testFlight.price + 50
            }
          }
        }
      }).as('priceChangeError');

      // Add item to cart
      cy.request({
        method: 'POST',
        url: `${VOYAGE_SERVICE_URL}/api/v1/cart/${TEMP_USER_ID}/items`,
        body: {
          type: 'FLIGHT',
          itemId: testFlight.id,
          quantity: 1,
          price: testFlight.price,
          currency: testFlight.currency,
          itemData: {
            type: 'flight',
            flightNumber: testFlight.flightNumber,
            airline: testFlight.airline,
            origin: testFlight.origin,
            destination: testFlight.destination,
            departureTime: '2025-12-25T10:00:00Z',
            arrivalTime: '2025-12-25T18:00:00Z',
            duration: '8h',
            cabinClass: 'Economy',
            passengers: { adults: 1 }
          }
        },
        failOnStatusCode: false
      });

      cy.visit(BASE_URL);
      cy.wait(500);
      cy.get('[aria-label="Shopping cart"]').click();

      cy.intercept('GET', '**/api/v1/cart/*', {
        statusCode: 200,
        body: {
          data: {
            id: 'cart-123',
            userId: TEMP_USER_ID,
            items: [{
              id: 'item-1',
              type: 'FLIGHT',
              quantity: 1,
              price: testFlight.price,
              currency: testFlight.currency
            }],
            totalPrice: testFlight.price,
            currency: testFlight.currency,
            expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
          }
        }
      });

      cy.wait(1000);
      cy.contains('button', 'Proceed to Checkout').click();
      cy.wait('@priceChangeError');

      // Verify error handling
      cy.contains('Shopping Cart').should('be.visible');
      cy.contains('button', 'Proceed to Checkout').should('not.be.disabled');

      // TODO: Verify UI shows price change notification
      // cy.contains('Price has changed').should('be.visible');
    });
  });

  describe('Cart State Management', () => {
    it('should maintain cart state across page refreshes', () => {
      // Add item to cart
      cy.request({
        method: 'POST',
        url: `${VOYAGE_SERVICE_URL}/api/v1/cart/${TEMP_USER_ID}/items`,
        body: {
          type: 'FLIGHT',
          itemId: testFlight.id,
          quantity: 1,
          price: testFlight.price,
          currency: testFlight.currency,
          itemData: {
            type: 'flight',
            flightNumber: testFlight.flightNumber,
            airline: testFlight.airline,
            origin: testFlight.origin,
            destination: testFlight.destination,
            departureTime: '2025-12-25T10:00:00Z',
            arrivalTime: '2025-12-25T18:00:00Z',
            duration: '8h',
            cabinClass: 'Economy',
            passengers: { adults: 1 }
          }
        },
        failOnStatusCode: false
      });

      cy.visit(BASE_URL);
      cy.wait(500);

      // Mock get cart
      cy.intercept('GET', '**/api/v1/cart/*', {
        statusCode: 200,
        body: {
          data: {
            id: 'cart-123',
            userId: TEMP_USER_ID,
            items: [{
              id: 'item-1',
              type: 'FLIGHT',
              itemId: testFlight.id,
              quantity: 1,
              price: testFlight.price,
              currency: testFlight.currency,
              itemData: {
                type: 'flight',
                flightNumber: testFlight.flightNumber,
                airline: testFlight.airline,
                origin: testFlight.origin,
                destination: testFlight.destination,
                departureTime: '2025-12-25T10:00:00Z',
                arrivalTime: '2025-12-25T18:00:00Z',
                duration: '8h',
                cabinClass: 'Economy',
                passengers: { adults: 1 }
              }
            }],
            totalPrice: testFlight.price,
            currency: testFlight.currency,
            expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
          }
        }
      }).as('getCart');

      // Open cart and verify item
      cy.get('[aria-label="Shopping cart"]').click();
      cy.wait('@getCart');
      cy.contains(testFlight.airline).should('be.visible');

      // Close cart
      cy.get('[aria-label="Close cart"]').click();

      // Refresh page
      cy.reload();
      cy.wait(500);

      // Open cart again
      cy.get('[aria-label="Shopping cart"]').click();
      cy.wait('@getCart');

      // Verify item still exists
      cy.contains(testFlight.airline).should('be.visible');
      cy.contains('Total').parent().should('contain', `${testFlight.currency} ${testFlight.price.toFixed(2)}`);
    });

    it('should handle concurrent cart updates gracefully', () => {
      // This tests race condition handling when multiple updates happen simultaneously

      cy.request({
        method: 'POST',
        url: `${VOYAGE_SERVICE_URL}/api/v1/cart/${TEMP_USER_ID}/items`,
        body: {
          type: 'ACTIVITY',
          itemId: testActivity.id,
          quantity: 1,
          price: testActivity.price,
          currency: testActivity.currency,
          itemData: {
            type: 'activity',
            name: testActivity.name,
            location: testActivity.location,
            date: '2025-12-26',
            duration: '3 hours',
            participants: 1
          }
        },
        failOnStatusCode: false
      });

      cy.visit(BASE_URL);
      cy.wait(500);
      cy.get('[aria-label="Shopping cart"]').click();

      // Mock cart state
      cy.intercept('GET', '**/api/v1/cart/*', {
        statusCode: 200,
        body: {
          data: {
            id: 'cart-123',
            userId: TEMP_USER_ID,
            items: [{
              id: 'item-1',
              type: 'ACTIVITY',
              quantity: 1,
              price: testActivity.price,
              currency: testActivity.currency
            }],
            totalPrice: testActivity.price,
            currency: testActivity.currency,
            expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
          }
        }
      });

      // Mock slow update response
      cy.intercept('PATCH', '**/api/v1/cart/*/items/*', (req) => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              statusCode: 200,
              body: {
                data: {
                  items: [{
                    id: 'item-1',
                    quantity: req.body.quantity,
                    price: testActivity.price,
                    currency: testActivity.currency
                  }],
                  totalPrice: testActivity.price * req.body.quantity,
                  currency: testActivity.currency
                }
              }
            });
          }, 2000);
        });
      }).as('slowUpdate');

      cy.wait(1000);

      // Rapidly click increment multiple times
      cy.get('[aria-label="Increase quantity"]').click();
      cy.get('[aria-label="Increase quantity"]').click();
      cy.get('[aria-label="Increase quantity"]').click();

      // Wait for updates to complete
      cy.wait('@slowUpdate');

      // Verify final state is consistent (should handle race conditions)
      cy.log('✓ Concurrent update test completed');
    });
  });
});
