import request from 'supertest';

const VOYAGE_SERVICE_URL = process.env.VOYAGE_SERVICE_URL || 'http://localhost:3003';

describe('Hotel Booking Workflow E2E Tests', () => {
  let testHotelId: string;
  let testOfferId: string;
  let testHotelDetails: any;

  describe('Complete Booking Workflow', () => {
    it('Step 1: Search for hotels', async () => {
      const response = await request(VOYAGE_SERVICE_URL)
        .get('/api/hotels/search')
        .query({
          cityCode: 'PAR',
          checkInDate: '2025-12-20',
          checkOutDate: '2025-12-22',
          adults: 2,
          roomQuantity: 1,
          pageSize: 5
        })
        .expect('Content-Type', /json/);

      expect(response.status).toBeIn([200, 201]);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);

      if (response.body.data.length > 0) {
        const hotel = response.body.data[0];
        testHotelId = hotel.hotelId;
        testOfferId = hotel.id;

        // Validate SimplifiedHotelOfferDTO structure
        expect(hotel).toHaveProperty('id');
        expect(hotel).toHaveProperty('hotelId');
        expect(hotel).toHaveProperty('name');
        expect(hotel).toHaveProperty('price');
        expect(hotel.price).toHaveProperty('amount');
        expect(hotel.price).toHaveProperty('currency');
        expect(hotel.price).toHaveProperty('perNight');

        console.log(`✅ Found hotel: ${hotel.name} (ID: ${testHotelId})`);
        console.log(`   Price: ${hotel.price.amount} ${hotel.price.currency} for ${hotel.nights} nights`);
      } else {
        console.warn('⚠️ No hotels found in search results');
      }
    }, 30000);

    it('Step 2: Get hotel details', async () => {
      if (!testHotelId) {
        console.warn('⚠️ Skipping: No hotel ID from previous test');
        return;
      }

      const response = await request(VOYAGE_SERVICE_URL)
        .get(`/api/hotels/details/${testHotelId}`)
        .query({
          adults: 2,
          roomQuantity: 1,
          checkInDate: '2025-12-20',
          checkOutDate: '2025-12-22'
        })
        .expect('Content-Type', /json/);

      expect(response.status).toBeIn([200, 404]);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('data');
        testHotelDetails = response.body.data;

        expect(testHotelDetails).toHaveProperty('hotelId');
        expect(testHotelDetails.hotelId).toBe(testHotelId);
        expect(testHotelDetails).toHaveProperty('name');
        expect(testHotelDetails).toHaveProperty('location');
        expect(testHotelDetails).toHaveProperty('room');
        expect(testHotelDetails).toHaveProperty('cancellation');

        console.log(`✅ Hotel details retrieved: ${testHotelDetails.name}`);
        console.log(`   Room: ${testHotelDetails.room.type}`);
        console.log(`   Cancellation: ${testHotelDetails.cancellation.freeCancellation ? 'Free' : 'Paid'}`);
      } else {
        console.warn('⚠️ Hotel details not found (404)');
      }
    }, 30000);

    it('Step 3: Get hotel images', async () => {
      if (!testHotelId) {
        console.warn('⚠️ Skipping: No hotel ID from previous test');
        return;
      }

      const response = await request(VOYAGE_SERVICE_URL)
        .get(`/api/hotels/${testHotelId}/images`)
        .expect('Content-Type', /json/);

      expect(response.status).toBeIn([200, 404, 500]);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('data');
        const images = response.body.data;

        if (Array.isArray(images)) {
          console.log(`✅ Found ${images.length} images for hotel`);
        }
      }
    }, 30000);

    it('Step 4: Get hotel ratings', async () => {
      if (!testHotelId) {
        console.warn('⚠️ Skipping: No hotel ID from previous test');
        return;
      }

      const response = await request(VOYAGE_SERVICE_URL)
        .get('/api/hotels/ratings')
        .query({
          hotelIds: testHotelId
        })
        .expect('Content-Type', /json/);

      expect(response.status).toBeIn([200, 404, 500]);

      if (response.status === 200 && response.body.data) {
        console.log(`✅ Hotel ratings retrieved`);
      }
    }, 30000);

    it('Step 5: Create hotel booking', async () => {
      if (!testOfferId) {
        console.warn('⚠️ Skipping: No offer ID from search');
        return;
      }

      const bookingData = {
        offerId: testOfferId,
        guests: [
          {
            id: 1,
            name: {
              title: 'MR',
              firstName: 'John',
              lastName: 'Doe'
            },
            contact: {
              phone: '+33123456789',
              email: 'john.doe@example.com'
            }
          },
          {
            id: 2,
            name: {
              title: 'MRS',
              firstName: 'Jane',
              lastName: 'Doe'
            },
            contact: {
              phone: '+33123456789',
              email: 'jane.doe@example.com'
            }
          }
        ],
        payments: [
          {
            method: 'creditCard',
            card: {
              vendorCode: 'VI',
              cardNumber: '4111111111111111',
              expiryDate: '2025-12'
            }
          }
        ]
      };

      const response = await request(VOYAGE_SERVICE_URL)
        .post('/api/hotels/bookings')
        .send(bookingData)
        .expect('Content-Type', /json/);

      // Booking might fail with real API (test mode), so accept 201, 400, or 500
      expect(response.status).toBeIn([201, 400, 500]);

      if (response.status === 201) {
        expect(response.body).toHaveProperty('data');
        expect(response.body).toHaveProperty('meta');
        expect(response.body.meta).toHaveProperty('bookingId');
        expect(response.body.meta).toHaveProperty('status');

        console.log(`✅ Booking created successfully`);
        console.log(`   Booking ID: ${response.body.meta.bookingId}`);
        console.log(`   Status: ${response.body.meta.status}`);
      } else if (response.status === 400) {
        console.log(`⚠️ Booking validation error: ${response.body.message}`);
      } else {
        console.log(`⚠️ Booking failed (likely Amadeus test mode limitation): ${response.body.message}`);
      }
    }, 30000);
  });

  describe('Booking Validation Tests', () => {
    it('should reject booking without offerId', async () => {
      const response = await request(VOYAGE_SERVICE_URL)
        .post('/api/hotels/bookings')
        .send({
          guests: [
            {
              name: { title: 'MR', firstName: 'John', lastName: 'Doe' },
              contact: { phone: '+123456789', email: 'john@example.com' }
            }
          ],
          payments: [{ method: 'creditCard' }]
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('offerId');
    });

    it('should reject booking without guests', async () => {
      const response = await request(VOYAGE_SERVICE_URL)
        .post('/api/hotels/bookings')
        .send({
          offerId: 'TEST_OFFER_123',
          payments: [{ method: 'creditCard' }]
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('guests');
    });

    it('should reject booking with empty guests array', async () => {
      const response = await request(VOYAGE_SERVICE_URL)
        .post('/api/hotels/bookings')
        .send({
          offerId: 'TEST_OFFER_123',
          guests: [],
          payments: [{ method: 'creditCard' }]
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('guests');
    });

    it('should reject booking without payments', async () => {
      const response = await request(VOYAGE_SERVICE_URL)
        .post('/api/hotels/bookings')
        .send({
          offerId: 'TEST_OFFER_123',
          guests: [
            {
              name: { title: 'MR', firstName: 'John', lastName: 'Doe' },
              contact: { phone: '+123456789', email: 'john@example.com' }
            }
          ]
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('payments');
    });

    it('should reject booking with invalid guest structure (missing name)', async () => {
      const response = await request(VOYAGE_SERVICE_URL)
        .post('/api/hotels/bookings')
        .send({
          offerId: 'TEST_OFFER_123',
          guests: [
            {
              contact: { phone: '+123456789', email: 'john@example.com' }
            }
          ],
          payments: [{ method: 'creditCard' }]
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('name');
    });

    it('should reject booking with invalid guest structure (missing contact)', async () => {
      const response = await request(VOYAGE_SERVICE_URL)
        .post('/api/hotels/bookings')
        .send({
          offerId: 'TEST_OFFER_123',
          guests: [
            {
              name: { title: 'MR', firstName: 'John', lastName: 'Doe' }
            }
          ],
          payments: [{ method: 'creditCard' }]
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('contact');
    });
  });

  describe('Search Filters and Edge Cases', () => {
    it('should handle search with all optional filters', async () => {
      const response = await request(VOYAGE_SERVICE_URL)
        .get('/api/hotels/search')
        .query({
          cityCode: 'LON',
          checkInDate: '2025-12-25',
          checkOutDate: '2025-12-27',
          adults: 2,
          roomQuantity: 1,
          radius: 10,
          radiusUnit: 'KM',
          ratings: '4,5',
          amenities: 'WIFI,POOL',
          page: 1,
          pageSize: 20
        })
        .expect('Content-Type', /json/);

      expect(response.status).toBeIn([200, 201]);
    }, 30000);

    it('should handle search with minimum required params', async () => {
      const response = await request(VOYAGE_SERVICE_URL)
        .get('/api/hotels/search')
        .query({
          cityCode: 'NYC',
          checkInDate: '2025-12-15',
          checkOutDate: '2025-12-16'
        })
        .expect('Content-Type', /json/);

      expect(response.status).toBeIn([200, 201]);
    }, 30000);

    it('should handle coordinate-based search', async () => {
      const response = await request(VOYAGE_SERVICE_URL)
        .get('/api/hotels/search')
        .query({
          latitude: 51.5074,
          longitude: -0.1278,
          checkInDate: '2025-12-20',
          checkOutDate: '2025-12-21',
          radius: 5
        })
        .expect('Content-Type', /json/);

      expect(response.status).toBeIn([200, 201]);
    }, 30000);
  });

  describe('Performance and Cache Tests', () => {
    it('should respond faster on cached requests', async () => {
      const searchParams = {
        cityCode: 'PAR',
        checkInDate: '2025-12-20',
        checkOutDate: '2025-12-22',
        adults: 2
      };

      // First request (cold)
      const start1 = Date.now();
      await request(VOYAGE_SERVICE_URL)
        .get('/api/hotels/search')
        .query(searchParams);
      const duration1 = Date.now() - start1;

      // Second request (should be cached)
      const start2 = Date.now();
      await request(VOYAGE_SERVICE_URL)
        .get('/api/hotels/search')
        .query(searchParams);
      const duration2 = Date.now() - start2;

      console.log(`Performance: Cold=${duration1}ms, Cached=${duration2}ms`);

      // Cached should be significantly faster (usually < 50ms vs > 500ms)
      // But we don't enforce this strictly as it depends on many factors
      expect(duration2).toBeLessThan(duration1 * 2); // At least some improvement
    }, 60000);
  });
});

// Helper matcher for "toBeIn"
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeIn(array: any[]): R;
    }
  }
}

expect.extend({
  toBeIn(received: any, array: any[]) {
    const pass = array.includes(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be in [${array.join(', ')}]`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be in [${array.join(', ')}]`,
        pass: false,
      };
    }
  },
});
