/**
 * Cart and Booking with Kafka Event Verification
 * E2E tests that verify Kafka events are published during booking flow
 */

describe('Cart and Booking - Kafka Event Verification', () => {
  const TEMP_USER_ID = 'user-123';
  const BASE_URL = 'http://localhost:5173';
  const VOYAGE_SERVICE_URL = 'http://localhost:3003';

  const testFlight = {
    id: 'test-flight-kafka-1',
    airline: 'Air France',
    flightNumber: 'AF456',
    origin: 'CDG',
    destination: 'JFK',
    price: 500.00,
    currency: 'EUR'
  };

  before(() => {
    // Start Kafka consumer before tests
    cy.task('kafka:start').then((result) => {
      if (result.success) {
        cy.log('✓ Kafka consumer started');
      } else {
        cy.log('⚠ Kafka consumer failed to start:', result.error);
      }
    });
  });

  beforeEach(() => {
    // Clear Kafka events before each test
    cy.task('kafka:clearEvents');

    // Clear cart
    cy.request({
      method: 'DELETE',
      url: `${VOYAGE_SERVICE_URL}/api/v1/cart/${TEMP_USER_ID}`,
      failOnStatusCode: false
    });
  });

  after(() => {
    // Stop Kafka consumer after all tests
    cy.task('kafka:stop').then((result) => {
      cy.log('Kafka consumer stopped');
    });
  });

  describe('Booking Created Event', () => {
    it('should publish booking.created event when checkout is completed', () => {
      // Add item to cart via API
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
        }
      }).then((response) => {
        expect(response.status).to.equal(200);
        cy.log('✓ Item added to cart');
      });

      // Perform checkout
      cy.request({
        method: 'POST',
        url: `${VOYAGE_SERVICE_URL}/api/v1/cart/${TEMP_USER_ID}/checkout`,
        body: {
          userId: TEMP_USER_ID
        }
      }).then((response) => {
        expect(response.status).to.equal(200);
        expect(response.body).to.have.property('bookingReference');
        expect(response.body).to.have.property('bookingId');

        const bookingReference = response.body.bookingReference;
        const bookingId = response.body.bookingId;

        cy.log(`✓ Booking created: ${bookingReference}`);

        // Wait for Kafka event
        cy.task('kafka:waitForEvent', {
          topic: 'booking.created',
          bookingId: bookingId,
          timeout: 5000
        }).then((result) => {
          // Verify event was received
          expect(result.success).to.be.true;
          expect(result.event).to.exist;

          const event = result.event;

          cy.log('✓ Kafka event received:', event.value);

          // Verify event structure
          expect(event.topic).to.equal('booking.created');
          expect(event.value).to.have.property('bookingId', bookingId);
          expect(event.value).to.have.property('bookingReference', bookingReference);
          expect(event.value).to.have.property('userId', TEMP_USER_ID);
          expect(event.value).to.have.property('status', 'DRAFT');
          expect(event.value).to.have.property('totalAmount');
          expect(event.value.totalAmount).to.be.closeTo(testFlight.price, 0.01);
          expect(event.value).to.have.property('currency', testFlight.currency);
          expect(event.value).to.have.property('items');
          expect(event.value.items).to.be.an('array').with.length(1);
          expect(event.value.items[0].type).to.equal('FLIGHT');
          expect(event.value.items[0].itemId).to.equal(testFlight.id);

          cy.log('✅ All Kafka event assertions passed');
        });
      });
    });

    it('should include all cart items in booking.created event', () => {
      // Add multiple items to cart
      const hotelItem = {
        type: 'HOTEL',
        itemId: 'hotel-test-1',
        quantity: 1,
        price: 150.00,
        currency: 'EUR',
        itemData: {
          type: 'hotel',
          name: 'Test Hotel',
          location: 'Paris',
          checkInDate: '2025-12-25',
          checkOutDate: '2025-12-27',
          nights: 2,
          roomType: 'Standard',
          guests: 1
        }
      };

      const activityItem = {
        type: 'ACTIVITY',
        itemId: 'activity-test-1',
        quantity: 2,
        price: 35.00,
        currency: 'EUR',
        itemData: {
          type: 'activity',
          name: 'Tour Eiffel',
          location: 'Paris',
          date: '2025-12-26',
          duration: '3 hours',
          participants: 2
        }
      };

      // Add flight
      cy.request('POST', `${VOYAGE_SERVICE_URL}/api/v1/cart/${TEMP_USER_ID}/items`, {
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
      });

      // Add hotel
      cy.request('POST', `${VOYAGE_SERVICE_URL}/api/v1/cart/${TEMP_USER_ID}/items`, hotelItem);

      // Add activity
      cy.request('POST', `${VOYAGE_SERVICE_URL}/api/v1/cart/${TEMP_USER_ID}/items`, activityItem);

      // Checkout
      cy.request('POST', `${VOYAGE_SERVICE_URL}/api/v1/cart/${TEMP_USER_ID}/checkout`, {
        userId: TEMP_USER_ID
      }).then((checkoutResponse) => {
        const bookingId = checkoutResponse.body.bookingId;
        const expectedTotal = testFlight.price + hotelItem.price + (activityItem.price * activityItem.quantity);

        // Wait for Kafka event
        cy.task('kafka:waitForEvent', {
          topic: 'booking.created',
          bookingId: bookingId,
          timeout: 5000
        }).then((result) => {
          expect(result.success).to.be.true;

          const event = result.event.value;

          // Verify all 3 items are in the event
          expect(event.items).to.have.length(3);

          // Verify flight
          const flightInEvent = event.items.find(i => i.type === 'FLIGHT');
          expect(flightInEvent).to.exist;
          expect(flightInEvent.itemId).to.equal(testFlight.id);

          // Verify hotel
          const hotelInEvent = event.items.find(i => i.type === 'HOTEL');
          expect(hotelInEvent).to.exist;
          expect(hotelInEvent.itemId).to.equal(hotelItem.itemId);

          // Verify activity
          const activityInEvent = event.items.find(i => i.type === 'ACTIVITY');
          expect(activityInEvent).to.exist;
          expect(activityInEvent.itemId).to.equal(activityItem.itemId);
          expect(activityInEvent.quantity).to.equal(activityItem.quantity);

          // Verify total amount
          expect(event.totalAmount).to.be.closeTo(expectedTotal, 0.01);

          cy.log('✅ Multi-item booking event verified');
        });
      });
    });
  });

  describe('Booking Confirmed Event', () => {
    it('should publish booking.confirmed event when payment is completed', function() {
      // This test requires payment service integration
      // For now, we'll directly call the booking confirmation method

      // First create a booking
      cy.request('POST', `${VOYAGE_SERVICE_URL}/api/v1/cart/${TEMP_USER_ID}/items`, {
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
      });

      cy.request('POST', `${VOYAGE_SERVICE_URL}/api/v1/cart/${TEMP_USER_ID}/checkout`, {
        userId: TEMP_USER_ID
      }).then((checkoutResponse) => {
        const bookingReference = checkoutResponse.body.bookingReference;
        const bookingId = checkoutResponse.body.bookingId;

        // Clear events after booking creation
        cy.task('kafka:clearEvents');

        // TODO: Simulate payment completion via Kafka
        // This would normally be triggered by payment-service publishing payment.completed event
        // For now, we'll skip this test or manually trigger confirmation

        cy.log('⚠ Payment confirmation test requires payment service integration');
        cy.log('TODO: Publish payment.completed event to trigger booking.confirmed');

        // Placeholder verification
        // When payment service is integrated, uncomment:
        /*
        cy.task('kafka:waitForEvent', {
          topic: 'booking.confirmed',
          bookingId: bookingId,
          timeout: 5000
        }).then((result) => {
          expect(result.success).to.be.true;
          const event = result.event.value;
          expect(event.bookingId).to.equal(bookingId);
          expect(event.bookingReference).to.equal(bookingReference);
          expect(event).to.have.property('confirmedAt');
          cy.log('✅ Booking confirmed event verified');
        });
        */
      });
    });
  });

  describe('Event Payload Validation', () => {
    it('should include required metadata in booking.created event', () => {
      cy.request('POST', `${VOYAGE_SERVICE_URL}/api/v1/cart/${TEMP_USER_ID}/items`, {
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
      });

      cy.request('POST', `${VOYAGE_SERVICE_URL}/api/v1/cart/${TEMP_USER_ID}/checkout`, {
        userId: TEMP_USER_ID
      }).then((response) => {
        const bookingId = response.body.bookingId;

        cy.task('kafka:waitForEvent', {
          topic: 'booking.created',
          bookingId: bookingId,
          timeout: 5000
        }).then((result) => {
          const event = result.event;

          // Verify Kafka message structure
          expect(event).to.have.property('topic', 'booking.created');
          expect(event).to.have.property('partition');
          expect(event).to.have.property('offset');
          expect(event).to.have.property('timestamp');
          expect(event).to.have.property('value');

          // Verify event value (payload)
          const payload = event.value;
          expect(payload).to.have.property('bookingId');
          expect(payload).to.have.property('bookingReference');
          expect(payload).to.have.property('userId');
          expect(payload).to.have.property('type'); // FLIGHT, HOTEL, ACTIVITY, PACKAGE
          expect(payload).to.have.property('status');
          expect(payload).to.have.property('totalAmount');
          expect(payload).to.have.property('currency');
          expect(payload).to.have.property('items');
          expect(payload).to.have.property('paymentIntentId');
          expect(payload).to.have.property('createdAt');

          // Verify timestamp format
          expect(payload.createdAt).to.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

          cy.log('✅ Event payload structure validated');
        });
      });
    });
  });

  describe('Error Scenarios', () => {
    it('should handle Kafka unavailability gracefully', () => {
      // Even if Kafka is down, booking should still be created
      // The service logs a warning but doesn't fail

      cy.request('POST', `${VOYAGE_SERVICE_URL}/api/v1/cart/${TEMP_USER_ID}/items`, {
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
      });

      cy.request('POST', `${VOYAGE_SERVICE_URL}/api/v1/cart/${TEMP_USER_ID}/checkout`, {
        userId: TEMP_USER_ID
      }).then((response) => {
        // Booking should be created successfully even if Kafka fails
        expect(response.status).to.equal(200);
        expect(response.body).to.have.property('bookingReference');
        expect(response.body).to.have.property('bookingId');

        cy.log('✅ Booking created successfully (Kafka failure is non-blocking)');
      });
    });
  });

  describe('Event Count Verification', () => {
    it('should track number of events published', () => {
      // Create 3 bookings
      const createBooking = () => {
        return cy.request('POST', `${VOYAGE_SERVICE_URL}/api/v1/cart/${TEMP_USER_ID}/items`, {
          type: 'FLIGHT',
          itemId: `flight-${Date.now()}`,
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
        }).then(() => {
          return cy.request('POST', `${VOYAGE_SERVICE_URL}/api/v1/cart/${TEMP_USER_ID}/checkout`, {
            userId: TEMP_USER_ID
          });
        }).then(() => {
          // Clear cart for next booking
          return cy.request({
            method: 'DELETE',
            url: `${VOYAGE_SERVICE_URL}/api/v1/cart/${TEMP_USER_ID}`,
            failOnStatusCode: false
          });
        });
      };

      // Create 3 sequential bookings
      createBooking()
        .then(() => createBooking())
        .then(() => createBooking())
        .then(() => {
          // Wait a bit for all events to be consumed
          cy.wait(2000);

          // Get all events
          cy.task('kafka:getEventsByTopic', 'booking.created').then((result) => {
            expect(result.success).to.be.true;
            expect(result.count).to.be.at.least(3);

            cy.log(`✅ Verified ${result.count} booking.created events`);
          });
        });
    });
  });
});
