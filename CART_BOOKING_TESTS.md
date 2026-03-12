# Cart and Booking Reservation Flow - E2E Tests

Complete end-to-end testing suite for DreamScape's cart and booking reservation flow.

## Overview

This test suite covers the complete user journey from searching for travel items (flights, hotels, activities) through adding them to cart, managing the cart, and completing checkout with payment.

## Test Scenarios

### 1. Search Flight → Add to Cart → View Cart
- Search for flights with origin/destination
- Add flight to cart from search results
- Verify cart badge updates
- Open cart drawer and verify flight details
- Verify total price calculation

### 2. Add Hotel + Activity to Existing Cart
- Start with flight in cart
- Search and add hotel
- Search and add activity
- Verify all 3 items in cart
- Verify total price combines all items

### 3. Modify Activity Quantity
- Add activity to cart
- Increase quantity using + button
- Verify price updates
- Decrease quantity using - button
- Verify price recalculates

### 4. Delete Cart Item
- Add multiple items to cart
- Remove individual item
- Verify item removed and total updated
- Clear entire cart
- Verify empty cart message

### 5. Checkout → Stripe Payment (Test Mode)
- Complete cart with items
- Click checkout button
- Verify checkout API called
- Verify booking reference generated
- (Placeholder for Stripe redirect)

### 6. Booking Confirmation + Email Received
- Complete checkout process
- Verify booking created with reference
- Verify booking status
- (Placeholder for email verification)
- (Placeholder for Kafka event verification)

### 7. Cart Expiration After 30 Min (Accelerated)
- Add items to cart
- Mock expired cart (expiresAt in past)
- Verify expiration warning shown
- Click extend button
- Verify cart extended with new expiry

### 8. Item Unavailable at Checkout → Error Handling
- Add item to cart
- Mock checkout error (item unavailable)
- Verify error displayed
- Verify cart remains open
- Mock price change error
- Verify error handling

### 9. Cart State Management
- Verify cart persists across page refreshes
- Test concurrent cart updates
- Verify race condition handling

## Prerequisites

### Required Services Running

All tests require the following services to be running:

```bash
# Option 1: Using Core Pod (recommended)
cd dreamscape-infra
./launch-core-pod.sh start

# Option 2: Run services individually
cd dreamscape-services/auth
PORT=3001 npm run dev

cd dreamscape-services/voyage
PORT=3003 npm run dev

cd dreamscape-frontend/web-client
npm run dev  # Port 5173
```

### Database Setup

Ensure PostgreSQL and Redis are running with proper schemas:

```bash
# Apply Prisma migrations
cd dreamscape-services/db
npx prisma db push

# Verify databases
psql -h localhost -U postgres -d dreamscape
redis-cli ping
```

## Running the Tests

### Run All Cart Tests

```bash
cd dreamscape-tests
npm run test:e2e:cart
```

### Run Specific Test File

```bash
npx cypress run --spec "tests/e2e/web-client/cart-booking-flow.cy.js"
```

### Run in Interactive Mode

```bash
npx cypress open
# Then select cart-booking-flow.cy.js from the UI
```

### Run Specific Scenario

```bash
# Run only checkout tests
npx cypress run --spec "tests/e2e/web-client/cart-booking-flow.cy.js" --grep "Checkout"

# Run only cart management tests
npx cypress run --spec "tests/e2e/web-client/cart-booking-flow.cy.js" --grep "Delete cart item"
```

## Test Configuration

### Environment Variables

Tests use the following environment variables (defined in [cypress.config.js](cypress.config.js#L18-L22)):

```javascript
env: {
  AUTH_SERVICE_URL: 'http://localhost:3001',
  USER_SERVICE_URL: 'http://localhost:3003',
  WEB_CLIENT_URL: 'http://localhost:5173'
}
```

### Test Data

Default test data is defined in the test file:

```javascript
const testFlight = {
  id: 'test-flight-1',
  airline: 'Air France',
  flightNumber: 'AF123',
  origin: 'CDG',
  destination: 'JFK',
  price: 450.00,
  currency: 'EUR'
};
```

## Helper Functions

The test suite includes comprehensive helper functions in [cypress/support/cart-helpers.js](cypress/support/cart-helpers.js):

### Cart Operations
- `clearCart(userId)` - Clear cart via API
- `addFlightToCart(flightData, userId)` - Add flight via API
- `addHotelToCart(hotelData, userId)` - Add hotel via API
- `addActivityToCart(activityData, userId)` - Add activity via API
- `getCart(userId)` - Get cart data via API
- `updateItemQuantity(itemId, quantity, userId)` - Update item quantity
- `removeItemFromCart(itemId, userId)` - Remove item from cart
- `checkoutCart(userId, metadata)` - Checkout cart
- `extendCartExpiry(userId)` - Extend cart expiration

### Mock Functions
- `mockAddToCart(item, existingCart)` - Mock add to cart response
- `mockGetCart(cartData)` - Mock get cart response
- `mockCheckout(bookingData)` - Mock checkout response
- `mockCheckoutError(errorCode, message)` - Mock checkout error

### UI Interactions
- `openCartDrawer()` - Open cart drawer
- `closeCartDrawer()` - Close cart drawer
- `clickCheckout()` - Click checkout button
- `increaseQuantity()` - Click + button
- `decreaseQuantity()` - Click - button
- `removeItem(itemName)` - Click remove button for item
- `clickClearCart()` - Click clear cart button

### Verification
- `verifyCartBadge(expectedCount)` - Verify cart badge count
- `verifyCartItem(itemData)` - Verify item in cart
- `verifyCartTotal(expectedTotal, currency)` - Verify total price
- `verifyEmptyCart()` - Verify empty cart message
- `verifyExpirationTimer(isExpiring)` - Verify expiration timer

### Data Generators
- `generateFlightData(overrides)` - Generate test flight data
- `generateHotelData(overrides)` - Generate test hotel data
- `generateActivityData(overrides)` - Generate test activity data
- `generateCartData(items, userId)` - Generate complete cart data

## Using Helper Functions

Example usage in tests:

```javascript
import {
  clearCart,
  addFlightToCart,
  openCartDrawer,
  verifyCartBadge,
  generateFlightData
} from '../../cypress/support/cart-helpers';

describe('My Cart Test', () => {
  beforeEach(() => {
    clearCart();
  });

  it('should add flight to cart', () => {
    const flight = generateFlightData({ airline: 'Test Airlines' });
    addFlightToCart(flight);

    cy.visit('http://localhost:5173');
    verifyCartBadge(1);
    openCartDrawer();
    verifyCartItem(flight);
  });
});
```

## API Mocking Strategy

Tests use Cypress intercepts to mock API responses for consistent testing:

```javascript
// Mock successful add to cart
cy.intercept('POST', '**/api/v1/cart/*/items', {
  statusCode: 200,
  body: {
    data: { /* cart data */ },
    meta: { message: 'Item added to cart successfully' }
  }
}).as('addToCart');

// Wait for API call
cy.wait('@addToCart');
```

### Mocked Endpoints

- `POST /api/v1/cart/:userId/items` - Add item to cart
- `GET /api/v1/cart/:userId` - Get cart data
- `PATCH /api/v1/cart/:userId/items/:itemId` - Update item quantity
- `DELETE /api/v1/cart/:userId/items/:itemId` - Remove item
- `DELETE /api/v1/cart/:userId` - Clear cart
- `POST /api/v1/cart/:userId/checkout` - Checkout
- `POST /api/v1/cart/:userId/extend` - Extend expiry

## Test Assertions

### Booking Status Verification

```javascript
cy.wait('@checkout').then((interception) => {
  expect(interception.response.statusCode).to.equal(200);
  expect(interception.response.body.bookingReference).to.match(/^BK-/);
  expect(interception.response.body.status).to.equal('PENDING_PAYMENT');
});
```

### Kafka Event Verification (TODO)

```javascript
// Requires Kafka test consumer setup
// TODO: Implement Kafka event listener in test environment
cy.task('waitForKafkaEvent', {
  topic: 'booking.created',
  timeout: 5000
}).then((event) => {
  expect(event.bookingId).to.exist;
  expect(event.userId).to.equal(TEMP_USER_ID);
});
```

### Email Verification (TODO)

```javascript
// Requires email service mock/test inbox
// TODO: Implement email verification
cy.task('getTestEmails', { recipient: 'test@example.com' })
  .then((emails) => {
    const confirmationEmail = emails.find(e =>
      e.subject.includes('Booking Confirmation')
    );
    expect(confirmationEmail).to.exist;
    expect(confirmationEmail.body).to.include(bookingReference);
  });
```

## Troubleshooting

### Common Issues

**1. Services not running**
```bash
Error: connect ECONNREFUSED localhost:3003
```
Solution: Start all required services (auth, voyage, web-client)

**2. Database connection errors**
```bash
Error: Can't reach database server
```
Solution: Ensure PostgreSQL and Redis are running

**3. Cart not clearing between tests**
```bash
Error: Expected 0 items but found 2
```
Solution: Verify `beforeEach` hook is clearing cart properly

**4. Timeout errors**
```bash
Error: Timed out retrying after 10000ms
```
Solution: Increase timeout or check if services are responding slowly

### Debug Mode

Run tests with debug output:

```bash
DEBUG=cypress:* npx cypress run --spec "tests/e2e/web-client/cart-booking-flow.cy.js"
```

View test execution in real-time:

```bash
npx cypress open
```

### Screenshots and Videos

Failed tests automatically capture screenshots:
```
dreamscape-tests/cypress/screenshots/cart-booking-flow.cy.js/
```

Enable video recording in [cypress.config.js](cypress.config.js#L13):
```javascript
video: true
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Cart E2E Tests

on: [push, pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Start services
        run: |
          docker-compose -f docker/docker-compose.core-pod.yml up -d
          sleep 10

      - name: Run tests
        run: |
          cd dreamscape-tests
          npm install
          npm run test:e2e:cart

      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: cypress-screenshots
          path: dreamscape-tests/cypress/screenshots
```

## Test Coverage

### Current Coverage
- ✅ Add items to cart (flight, hotel, activity)
- ✅ Update item quantities
- ✅ Remove items from cart
- ✅ Clear entire cart
- ✅ View cart contents
- ✅ Cart expiration handling
- ✅ Checkout process initiation
- ✅ Error handling (item unavailable, price change)
- ✅ Cart persistence across page refreshes
- ✅ Concurrent update handling

### TODO Coverage
- ⏳ Stripe payment integration
- ⏳ Email confirmation verification
- ⏳ Kafka event verification
- ⏳ Multiple user session handling
- ⏳ Cart merge on login
- ⏳ Promo code application
- ⏳ Currency conversion
- ⏳ Tax calculation

## Performance Benchmarks

Target performance metrics:
- Add to cart: < 500ms
- Get cart: < 300ms
- Update quantity: < 400ms
- Checkout: < 2000ms
- Page load with cart: < 1500ms

## Security Testing

Security aspects covered:
- User ID isolation (each user only sees their cart)
- Cart expiration enforcement
- Price validation at checkout
- SQL injection prevention (via Prisma)
- XSS prevention (React escaping)

## Contributing

When adding new test scenarios:

1. Add test to appropriate describe block
2. Use helper functions from cart-helpers.js
3. Mock API responses for consistency
4. Add clear comments explaining test purpose
5. Include both positive and negative test cases
6. Update this documentation

## Related Documentation

- [Main README](README.md) - Overall test suite documentation
- [Cypress Configuration](cypress.config.js) - Cypress setup
- [Cart Store](../dreamscape-frontend/web-client/src/store/cartStore.ts) - Frontend cart state management
- [Cart API](../dreamscape-services/voyage/src/routes/cart.ts) - Backend cart endpoints
- [Database Schema](../dreamscape-services/db/prisma/schema.prisma) - Cart data models

## Support

For issues or questions:
- Check [troubleshooting](#troubleshooting) section
- Review test output and screenshots
- Check service logs
- Open issue in GitHub repository
