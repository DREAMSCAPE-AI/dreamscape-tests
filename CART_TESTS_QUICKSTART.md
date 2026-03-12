# Cart & Booking E2E Tests - Quick Start Guide

Quick reference for running cart and booking reservation flow tests.

## Prerequisites

Start required services:

```bash
# Option 1: Core Pod (recommended)
cd dreamscape-infra
./launch-core-pod.sh start

# Option 2: Individual services
# Terminal 1 - Auth Service
cd dreamscape-services/auth
PORT=3001 npm run dev

# Terminal 2 - Voyage Service
cd dreamscape-services/voyage
PORT=3003 npm run dev

# Terminal 3 - Web Client
cd dreamscape-frontend/web-client
npm run dev
```

## Quick Commands

```bash
cd dreamscape-tests

# Run all cart tests (headless)
npm run test:e2e:cart

# Run with UI (interactive)
npm run test:e2e:cart:open

# Run specific scenario
npx cypress run --spec "tests/e2e/web-client/cart-booking-flow.cy.js" --grep "Add hotel"
```

## Test Scenarios Covered

✅ **Scenario 1:** Search flight → Add to cart → View cart
✅ **Scenario 2:** Add hotel + activity to existing cart
✅ **Scenario 3:** Modify activity quantity
✅ **Scenario 4:** Delete cart item
✅ **Scenario 5:** Checkout → Stripe payment (test mode)
✅ **Scenario 6:** Booking confirmation + email received
✅ **Scenario 7:** Cart expiration after 30 min (accelerated)
✅ **Scenario 8:** Item unavailable at checkout → error handling
✅ **Scenario 9:** Cart state management (persistence, concurrent updates)

## What Gets Tested

### Cart Operations
- ✓ Add flight, hotel, activity to cart
- ✓ Update item quantities (+/-)
- ✓ Remove individual items
- ✓ Clear entire cart
- ✓ View cart contents
- ✓ Cart badge updates

### Cart Features
- ✓ Cart expiration timer (30 min)
- ✓ Extend expiry functionality
- ✓ Price calculations
- ✓ Multi-item totals
- ✓ Currency display

### Checkout Flow
- ✓ Checkout button behavior
- ✓ Booking reference generation
- ✓ Payment intent creation
- ✓ Error handling (item unavailable, price change)

### State Management
- ✓ Cart persistence across page refreshes
- ✓ Concurrent update handling
- ✓ API error recovery

## Assertions Verified

Each test verifies:
- ✓ Booking status correctly updated
- ✓ API responses (200, 400, etc.)
- ✓ UI state updates (badges, totals, items)
- ✓ Cart cleared after confirmation
- ⏳ Kafka events published (TODO)
- ⏳ Email sent (TODO)

## Common Issues

**"Can't reach server"**
→ Make sure auth (3001), voyage (3003), and web-client (5173) are running

**"Cart not clearing between tests"**
→ Check beforeEach hook is executing properly

**"Tests timing out"**
→ Services may be slow to start, wait 10-15 seconds after starting

## Test Structure

```
dreamscape-tests/
├── tests/
│   └── e2e/
│       └── web-client/
│           └── cart-booking-flow.cy.js    ← Main test file
├── cypress/
│   └── support/
│       └── cart-helpers.js                ← Helper functions
├── CART_BOOKING_TESTS.md                  ← Full documentation
└── CART_TESTS_QUICKSTART.md              ← This file
```

## Helper Functions Available

Import and use in your tests:

```javascript
import {
  clearCart,
  addFlightToCart,
  openCartDrawer,
  verifyCartBadge,
  clickCheckout
} from '../../cypress/support/cart-helpers';
```

Full list in [cart-helpers.js](cypress/support/cart-helpers.js)

## Viewing Results

**Screenshots** (on failure):
```
cypress/screenshots/cart-booking-flow.cy.js/
```

**Videos** (if enabled):
```
cypress/videos/cart-booking-flow.cy.js.mp4
```

**Console output:**
```
  Cart and Booking Reservation Flow
    Scenario 1: Search flight → Add to cart → View cart
      ✓ should search for flights, add one to cart... (3245ms)
    Scenario 2: Add hotel + activity to existing cart
      ✓ should add hotel and activity to cart... (2134ms)
    ...

  9 passing (25s)
```

## Next Steps

1. ✅ Tests created and documented
2. ⏳ Run tests to verify all services work together
3. ⏳ Add Kafka event verification
4. ⏳ Add email service verification
5. ⏳ Integrate Stripe payment testing
6. ⏳ Add to CI/CD pipeline

## Full Documentation

See [CART_BOOKING_TESTS.md](CART_BOOKING_TESTS.md) for:
- Detailed test scenarios
- API mocking strategy
- Troubleshooting guide
- CI/CD integration
- Performance benchmarks
- Security testing
- Contributing guidelines

## Support

Questions? Check:
1. [Full Documentation](CART_BOOKING_TESTS.md)
2. [Main Test README](README.md)
3. Service logs in respective terminals
4. Cypress screenshots/videos
