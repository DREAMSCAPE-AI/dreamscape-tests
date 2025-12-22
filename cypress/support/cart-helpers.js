/**
 * Cypress Helper Functions for Cart and Booking Tests
 * Reusable utilities for cart testing scenarios
 */

// API URLs
export const API_URLS = {
  BASE_URL: 'http://localhost:5173',
  AUTH_SERVICE: 'http://localhost:3001',
  VOYAGE_SERVICE: 'http://localhost:3003',
  USER_SERVICE: 'http://localhost:3002',
  PAYMENT_SERVICE: 'http://localhost:3004'
};

// Test user ID
export const TEMP_USER_ID = 'user-123';

/**
 * Clear the cart for a specific user
 * @param {string} userId - User ID
 */
export const clearCart = (userId = TEMP_USER_ID) => {
  return cy.request({
    method: 'DELETE',
    url: `${API_URLS.VOYAGE_SERVICE}/api/v1/cart/${userId}`,
    failOnStatusCode: false
  });
};

/**
 * Add a flight item to cart
 * @param {object} flightData - Flight item data
 * @param {string} userId - User ID
 */
export const addFlightToCart = (flightData, userId = TEMP_USER_ID) => {
  return cy.request({
    method: 'POST',
    url: `${API_URLS.VOYAGE_SERVICE}/api/v1/cart/${userId}/items`,
    body: {
      type: 'FLIGHT',
      itemId: flightData.id,
      quantity: flightData.quantity || 1,
      price: flightData.price,
      currency: flightData.currency || 'EUR',
      itemData: {
        type: 'flight',
        flightNumber: flightData.flightNumber,
        airline: flightData.airline,
        origin: flightData.origin,
        destination: flightData.destination,
        departureTime: flightData.departureTime || new Date().toISOString(),
        arrivalTime: flightData.arrivalTime || new Date().toISOString(),
        duration: flightData.duration || '8h',
        cabinClass: flightData.cabinClass || 'Economy',
        passengers: flightData.passengers || { adults: 1 }
      }
    },
    failOnStatusCode: false
  });
};

/**
 * Add a hotel item to cart
 * @param {object} hotelData - Hotel item data
 * @param {string} userId - User ID
 */
export const addHotelToCart = (hotelData, userId = TEMP_USER_ID) => {
  return cy.request({
    method: 'POST',
    url: `${API_URLS.VOYAGE_SERVICE}/api/v1/cart/${userId}/items`,
    body: {
      type: 'HOTEL',
      itemId: hotelData.id,
      quantity: hotelData.quantity || 1,
      price: hotelData.price,
      currency: hotelData.currency || 'EUR',
      itemData: {
        type: 'hotel',
        name: hotelData.name,
        location: hotelData.location,
        checkInDate: hotelData.checkInDate || new Date().toISOString(),
        checkOutDate: hotelData.checkOutDate || new Date(Date.now() + 86400000).toISOString(),
        nights: hotelData.nights || 1,
        roomType: hotelData.roomType || 'Standard',
        guests: hotelData.guests || 1,
        rating: hotelData.rating,
        imageUrl: hotelData.imageUrl
      }
    },
    failOnStatusCode: false
  });
};

/**
 * Add an activity item to cart
 * @param {object} activityData - Activity item data
 * @param {string} userId - User ID
 */
export const addActivityToCart = (activityData, userId = TEMP_USER_ID) => {
  return cy.request({
    method: 'POST',
    url: `${API_URLS.VOYAGE_SERVICE}/api/v1/cart/${userId}/items`,
    body: {
      type: 'ACTIVITY',
      itemId: activityData.id,
      quantity: activityData.quantity || 1,
      price: activityData.price,
      currency: activityData.currency || 'EUR',
      itemData: {
        type: 'activity',
        name: activityData.name,
        location: activityData.location,
        date: activityData.date || new Date().toISOString(),
        duration: activityData.duration || '2 hours',
        participants: activityData.participants || 1,
        description: activityData.description,
        imageUrl: activityData.imageUrl
      }
    },
    failOnStatusCode: false
  });
};

/**
 * Get cart for a specific user
 * @param {string} userId - User ID
 */
export const getCart = (userId = TEMP_USER_ID) => {
  return cy.request({
    method: 'GET',
    url: `${API_URLS.VOYAGE_SERVICE}/api/v1/cart/${userId}`,
    failOnStatusCode: false
  });
};

/**
 * Update item quantity in cart
 * @param {string} itemId - Cart item ID
 * @param {number} quantity - New quantity
 * @param {string} userId - User ID
 */
export const updateItemQuantity = (itemId, quantity, userId = TEMP_USER_ID) => {
  return cy.request({
    method: 'PATCH',
    url: `${API_URLS.VOYAGE_SERVICE}/api/v1/cart/${userId}/items/${itemId}`,
    body: { quantity },
    failOnStatusCode: false
  });
};

/**
 * Remove item from cart
 * @param {string} itemId - Cart item ID
 * @param {string} userId - User ID
 */
export const removeItemFromCart = (itemId, userId = TEMP_USER_ID) => {
  return cy.request({
    method: 'DELETE',
    url: `${API_URLS.VOYAGE_SERVICE}/api/v1/cart/${userId}/items/${itemId}`,
    failOnStatusCode: false
  });
};

/**
 * Checkout cart
 * @param {string} userId - User ID
 * @param {object} metadata - Additional checkout metadata
 */
export const checkoutCart = (userId = TEMP_USER_ID, metadata = {}) => {
  return cy.request({
    method: 'POST',
    url: `${API_URLS.VOYAGE_SERVICE}/api/v1/cart/${userId}/checkout`,
    body: { metadata },
    failOnStatusCode: false
  });
};

/**
 * Extend cart expiry
 * @param {string} userId - User ID
 */
export const extendCartExpiry = (userId = TEMP_USER_ID) => {
  return cy.request({
    method: 'POST',
    url: `${API_URLS.VOYAGE_SERVICE}/api/v1/cart/${userId}/extend`,
    failOnStatusCode: false
  });
};

/**
 * Mock add to cart API response
 * @param {object} item - Item to be added
 * @param {object} existingCart - Existing cart data
 */
export const mockAddToCart = (item, existingCart = null) => {
  const cartItems = existingCart ? [...existingCart.items, item] : [item];
  const totalPrice = cartItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return cy.intercept('POST', '**/api/v1/cart/*/items', {
    statusCode: 200,
    body: {
      data: {
        id: existingCart?.id || 'cart-123',
        userId: TEMP_USER_ID,
        items: cartItems,
        totalPrice: totalPrice,
        currency: item.currency,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
      },
      meta: {
        itemCount: cartItems.length,
        totalPrice: totalPrice,
        message: 'Item added to cart successfully'
      }
    }
  });
};

/**
 * Mock get cart API response
 * @param {object} cartData - Cart data to return
 */
export const mockGetCart = (cartData) => {
  return cy.intercept('GET', '**/api/v1/cart/*', {
    statusCode: 200,
    body: {
      data: cartData
    }
  });
};

/**
 * Mock checkout API response
 * @param {object} bookingData - Booking data to return
 */
export const mockCheckout = (bookingData) => {
  return cy.intercept('POST', '**/api/v1/cart/*/checkout', {
    statusCode: 200,
    body: bookingData
  });
};

/**
 * Mock checkout error
 * @param {string} errorCode - Error code
 * @param {string} message - Error message
 */
export const mockCheckoutError = (errorCode, message) => {
  return cy.intercept('POST', '**/api/v1/cart/*/checkout', {
    statusCode: 400,
    body: {
      success: false,
      message: message,
      error: {
        code: errorCode
      }
    }
  });
};

/**
 * Open cart drawer
 */
export const openCartDrawer = () => {
  cy.get('[aria-label="Shopping cart"]').click();
};

/**
 * Close cart drawer
 */
export const closeCartDrawer = () => {
  cy.get('[aria-label="Close cart"]').click();
};

/**
 * Verify cart badge count
 * @param {number} expectedCount - Expected item count
 */
export const verifyCartBadge = (expectedCount) => {
  if (expectedCount === 0) {
    cy.get('[aria-label="Shopping cart"]').parent().find('span').should('not.exist');
  } else {
    cy.get('[aria-label="Shopping cart"]').parent().find('span').should('contain', expectedCount.toString());
  }
};

/**
 * Verify cart item in drawer
 * @param {object} itemData - Item data to verify
 */
export const verifyCartItem = (itemData) => {
  switch (itemData.type) {
    case 'FLIGHT':
      cy.contains(itemData.airline).should('be.visible');
      cy.contains(`${itemData.origin} → ${itemData.destination}`).should('be.visible');
      break;
    case 'HOTEL':
      cy.contains(itemData.name).should('be.visible');
      cy.contains(itemData.location).should('be.visible');
      break;
    case 'ACTIVITY':
      cy.contains(itemData.name).should('be.visible');
      cy.contains(itemData.location).should('be.visible');
      break;
  }
};

/**
 * Verify cart total price
 * @param {number} expectedTotal - Expected total price
 * @param {string} currency - Currency code
 */
export const verifyCartTotal = (expectedTotal, currency = 'EUR') => {
  cy.contains('Total').parent().should('contain', `${currency} ${expectedTotal.toFixed(2)}`);
};

/**
 * Click checkout button
 */
export const clickCheckout = () => {
  cy.contains('button', 'Proceed to Checkout').click();
};

/**
 * Wait for success notification
 * @param {string} message - Expected message
 */
export const waitForSuccessNotification = (message = 'Added to cart') => {
  cy.contains(message, { timeout: 5000 }).should('be.visible');
};

/**
 * Generate test flight data
 * @param {object} overrides - Override default values
 */
export const generateFlightData = (overrides = {}) => {
  return {
    id: 'test-flight-' + Date.now(),
    airline: 'Air France',
    flightNumber: 'AF123',
    origin: 'CDG',
    destination: 'JFK',
    price: 450.00,
    currency: 'EUR',
    departureTime: '2025-12-25T10:00:00Z',
    arrivalTime: '2025-12-25T18:00:00Z',
    duration: '8h',
    cabinClass: 'Economy',
    passengers: { adults: 1 },
    ...overrides
  };
};

/**
 * Generate test hotel data
 * @param {object} overrides - Override default values
 */
export const generateHotelData = (overrides = {}) => {
  return {
    id: 'test-hotel-' + Date.now(),
    name: 'Grand Hotel Paris',
    location: 'Paris',
    price: 150.00,
    currency: 'EUR',
    checkInDate: '2025-12-25',
    checkOutDate: '2025-12-27',
    nights: 2,
    roomType: 'Standard',
    guests: 1,
    ...overrides
  };
};

/**
 * Generate test activity data
 * @param {object} overrides - Override default values
 */
export const generateActivityData = (overrides = {}) => {
  return {
    id: 'test-activity-' + Date.now(),
    name: 'Eiffel Tower Tour',
    location: 'Paris',
    price: 35.00,
    currency: 'EUR',
    date: '2025-12-26',
    duration: '3 hours',
    participants: 1,
    ...overrides
  };
};

/**
 * Generate complete cart data
 * @param {array} items - Array of cart items
 * @param {string} userId - User ID
 */
export const generateCartData = (items, userId = TEMP_USER_ID) => {
  const totalPrice = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const currency = items[0]?.currency || 'EUR';

  return {
    id: 'cart-' + Date.now(),
    userId: userId,
    items: items.map((item, index) => ({
      id: 'item-' + (index + 1),
      cartId: 'cart-' + Date.now(),
      type: item.type,
      itemId: item.itemId || item.id,
      quantity: item.quantity || 1,
      price: item.price,
      currency: item.currency || currency,
      itemData: item.itemData || item,
      createdAt: new Date().toISOString()
    })),
    totalPrice: totalPrice,
    currency: currency,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
};

/**
 * Wait for cart API calls to complete
 * @param {string} alias - Cypress alias to wait for
 */
export const waitForCartAPI = (alias) => {
  cy.wait(alias, { timeout: 10000 });
};

/**
 * Verify empty cart message
 */
export const verifyEmptyCart = () => {
  cy.contains('Your cart is empty').should('be.visible');
  cy.contains('Continue Shopping').should('be.visible');
};

/**
 * Click add to cart on search results
 * @param {number} index - Index of result to add (default: first)
 */
export const addResultToCart = (index = 0) => {
  if (index === 0) {
    cy.contains('button', 'Add to Cart').first().click();
  } else {
    cy.contains('button', 'Add to Cart').eq(index).click();
  }
};

/**
 * Verify cart expiration timer
 * @param {boolean} isExpiring - Whether cart is expiring soon
 */
export const verifyExpirationTimer = (isExpiring = false) => {
  cy.contains('Cart expires in').should('be.visible');

  if (isExpiring) {
    cy.contains('Cart expires in').parent().should('have.class', 'bg-red-50');
    cy.contains('button', 'Extend').should('be.visible');
  } else {
    cy.contains('Cart expires in').parent().should('have.class', 'bg-orange-50');
  }
};

/**
 * Click extend expiry button
 */
export const clickExtendExpiry = () => {
  cy.contains('button', 'Extend').click();
};

/**
 * Increase item quantity
 */
export const increaseQuantity = () => {
  cy.get('[aria-label="Increase quantity"]').click();
};

/**
 * Decrease item quantity
 */
export const decreaseQuantity = () => {
  cy.get('[aria-label="Decrease quantity"]').click();
};

/**
 * Remove specific item from cart
 * @param {string} itemName - Name of item to remove
 */
export const removeItem = (itemName) => {
  cy.contains(itemName).parent().parent().find('[aria-label="Remove item"]').click();
};

/**
 * Clear entire cart
 */
export const clickClearCart = () => {
  cy.contains('button', 'Clear Cart').click();
  cy.on('window:confirm', () => true);
};

// Export all functions as default object
export default {
  API_URLS,
  TEMP_USER_ID,
  clearCart,
  addFlightToCart,
  addHotelToCart,
  addActivityToCart,
  getCart,
  updateItemQuantity,
  removeItemFromCart,
  checkoutCart,
  extendCartExpiry,
  mockAddToCart,
  mockGetCart,
  mockCheckout,
  mockCheckoutError,
  openCartDrawer,
  closeCartDrawer,
  verifyCartBadge,
  verifyCartItem,
  verifyCartTotal,
  clickCheckout,
  waitForSuccessNotification,
  generateFlightData,
  generateHotelData,
  generateActivityData,
  generateCartData,
  waitForCartAPI,
  verifyEmptyCart,
  addResultToCart,
  verifyExpirationTimer,
  clickExtendExpiry,
  increaseQuantity,
  decreaseQuantity,
  removeItem,
  clickClearCart
};
