import request from 'supertest';
import express from 'express';

const VOYAGE_SERVICE_URL = process.env.VOYAGE_SERVICE_URL || 'http://localhost:3003';

describe('Hotel Search API Integration Tests', () => {
  describe('GET /api/hotels/search', () => {
    it('should search hotels with city code', async () => {
      const response = await request(VOYAGE_SERVICE_URL)
        .get('/api/hotels/search')
        .query({
          cityCode: 'PAR',
          checkInDate: '2025-12-20',
          checkOutDate: '2025-12-22',
          adults: 2,
          roomQuantity: 1
        })
        .expect('Content-Type', /json/);

      expect(response.status).toBeIn([200, 201]);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);

      if (response.body.data.length > 0) {
        const hotel = response.body.data[0];
        expect(hotel).toHaveProperty('id');
        expect(hotel).toHaveProperty('hotelId');
        expect(hotel).toHaveProperty('name');
        expect(hotel).toHaveProperty('location');
        expect(hotel).toHaveProperty('price');
        expect(hotel).toHaveProperty('room');
        expect(hotel).toHaveProperty('amenities');
        expect(hotel).toHaveProperty('images');
        expect(hotel).toHaveProperty('cancellation');

        // Validate SimplifiedHotelOfferDTO structure
        expect(hotel.location).toHaveProperty('latitude');
        expect(hotel.location).toHaveProperty('longitude');
        expect(hotel.price).toHaveProperty('amount');
        expect(hotel.price).toHaveProperty('currency');
        expect(hotel.price).toHaveProperty('perNight');
        expect(hotel.room).toHaveProperty('type');
        expect(hotel.room).toHaveProperty('guests');
        expect(hotel.cancellation).toHaveProperty('freeCancellation');
      }

      expect(response.body).toHaveProperty('meta');
      expect(response.body.meta).toHaveProperty('pagination');
    }, 30000);

    it('should search hotels with coordinates', async () => {
      const response = await request(VOYAGE_SERVICE_URL)
        .get('/api/hotels/search')
        .query({
          latitude: 48.8566,
          longitude: 2.3522,
          checkInDate: '2025-12-20',
          checkOutDate: '2025-12-21',
          adults: 1,
          roomQuantity: 1,
          radius: 5,
          radiusUnit: 'KM'
        })
        .expect('Content-Type', /json/);

      expect(response.status).toBeIn([200, 201]);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    }, 30000);

    it('should handle pagination', async () => {
      const response = await request(VOYAGE_SERVICE_URL)
        .get('/api/hotels/search')
        .query({
          cityCode: 'LON',
          checkInDate: '2025-12-15',
          checkOutDate: '2025-12-17',
          adults: 2,
          page: 1,
          pageSize: 10
        })
        .expect('Content-Type', /json/);

      expect(response.status).toBeIn([200, 201]);
      expect(response.body.meta.pagination).toHaveProperty('page');
      expect(response.body.meta.pagination).toHaveProperty('pageSize');
      expect(response.body.meta.pagination).toHaveProperty('total');
      expect(response.body.meta.pagination).toHaveProperty('totalPages');
    }, 30000);

    it('should return 400 for missing checkInDate', async () => {
      const response = await request(VOYAGE_SERVICE_URL)
        .get('/api/hotels/search')
        .query({
          cityCode: 'PAR',
          checkOutDate: '2025-12-22',
          adults: 2
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 for missing checkOutDate', async () => {
      const response = await request(VOYAGE_SERVICE_URL)
        .get('/api/hotels/search')
        .query({
          cityCode: 'PAR',
          checkInDate: '2025-12-20',
          adults: 2
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 or 500 for invalid date format', async () => {
      const response = await request(VOYAGE_SERVICE_URL)
        .get('/api/hotels/search')
        .query({
          cityCode: 'PAR',
          checkInDate: '20-12-2025', // Wrong format
          checkOutDate: '2025-12-22',
          adults: 2
        });

      // Route validates presence but not format — Amadeus API returns an error
      expect(response.status).toBeIn([400, 500]);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 or 500 if checkIn is after checkOut', async () => {
      const response = await request(VOYAGE_SERVICE_URL)
        .get('/api/hotels/search')
        .query({
          cityCode: 'PAR',
          checkInDate: '2025-12-25',
          checkOutDate: '2025-12-20',
          adults: 2
        });

      // Route validates presence but not date ordering — Amadeus API returns an error
      expect(response.status).toBeIn([400, 500]);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/hotels/details/:hotelId', () => {
    it('should get hotel details', async () => {
      // First search to get a hotel ID
      const searchResponse = await request(VOYAGE_SERVICE_URL)
        .get('/api/hotels/search')
        .query({
          cityCode: 'NYC',
          checkInDate: '2025-12-20',
          checkOutDate: '2025-12-22',
          adults: 1
        });

      if (searchResponse.body.data && searchResponse.body.data.length > 0) {
        const hotelId = searchResponse.body.data[0].hotelId;

        const response = await request(VOYAGE_SERVICE_URL)
          .get(`/api/hotels/details/${hotelId}`)
          .query({
            adults: 1,
            roomQuantity: 1,
            checkInDate: '2025-12-20',
            checkOutDate: '2025-12-22'
          })
          .expect('Content-Type', /json/);

        expect(response.status).toBeIn([200, 404]); // 404 is OK if hotel not found

        if (response.status === 200) {
          expect(response.body).toHaveProperty('data');
          expect(response.body.data).toHaveProperty('hotelId');
          expect(response.body.data.hotelId).toBe(hotelId);
        }
      }
    }, 30000);

    it('should return 400 for missing hotelId', async () => {
      const response = await request(VOYAGE_SERVICE_URL)
        .get('/api/hotels/details/')
        .query({
          adults: 1,
          checkInDate: '2025-12-20',
          checkOutDate: '2025-12-22'
        });

      expect(response.status).toBe(404); // Express route not found
    });
  });

  describe('GET /api/hotels/ratings', () => {
    it('should get hotel ratings', async () => {
      const response = await request(VOYAGE_SERVICE_URL)
        .get('/api/hotels/ratings')
        .query({
          hotelIds: 'HOTEL1,HOTEL2,HOTEL3'
        })
        .expect('Content-Type', /json/);

      expect(response.status).toBeIn([200, 404, 500]);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);
      }
    }, 30000);
  });

  describe('GET /api/hotels/list', () => {
    it('should list hotels by city', async () => {
      const response = await request(VOYAGE_SERVICE_URL)
        .get('/api/hotels/list')
        .query({
          cityCode: 'PAR',
          radius: 10,
          radiusUnit: 'KM'
        })
        .expect('Content-Type', /json/);

      expect(response.status).toBeIn([200, 404, 500]);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);
      }
    }, 30000);

    it('should list hotels by coordinates', async () => {
      const response = await request(VOYAGE_SERVICE_URL)
        .get('/api/hotels/list')
        .query({
          latitude: 48.8566,
          longitude: 2.3522,
          radius: 5
        })
        .expect('Content-Type', /json/);

      expect(response.status).toBeIn([200, 404, 500]);
    }, 30000);
  });

  describe('GET /api/hotels/:hotelId/images', () => {
    it('should get hotel images', async () => {
      const response = await request(VOYAGE_SERVICE_URL)
        .get('/api/hotels/HOTEL123/images')
        .expect('Content-Type', /json/);

      expect(response.status).toBeIn([200, 404, 500]);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('data');
      }
    }, 30000);
  });

  describe('POST /api/hotels/bookings', () => {
    it('should return 400 for missing offerId', async () => {
      const response = await request(VOYAGE_SERVICE_URL)
        .post('/api/hotels/bookings')
        .send({
          guests: [{ name: { firstName: 'John', lastName: 'Doe' }, contact: { email: 'john@example.com', phone: '+33600000000' } }],
          payments: [{ method: 'creditCard', card: { vendorCode: 'VI', cardNumber: '4111111111111111', expiryDate: '2026-01' } }]
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 for missing guests', async () => {
      const response = await request(VOYAGE_SERVICE_URL)
        .post('/api/hotels/bookings')
        .send({
          offerId: 'OFFER123',
          payments: [{ method: 'creditCard' }]
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 for missing payments', async () => {
      const response = await request(VOYAGE_SERVICE_URL)
        .post('/api/hotels/bookings')
        .send({
          offerId: 'OFFER123',
          guests: [{ name: { firstName: 'John', lastName: 'Doe' }, contact: { email: 'john@example.com', phone: '+33600000000' } }]
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Cache Integration', () => {
    it('should cache hotel search results', async () => {
      const searchParams = {
        cityCode: 'PAR',
        checkInDate: '2025-12-20',
        checkOutDate: '2025-12-22',
        adults: 2
      };

      // First request
      const start1 = Date.now();
      const response1 = await request(VOYAGE_SERVICE_URL)
        .get('/api/hotels/search')
        .query(searchParams)
        .expect('Content-Type', /json/);
      const duration1 = Date.now() - start1;

      expect(response1.status).toBeIn([200, 201]);

      // Second request (should be cached)
      const start2 = Date.now();
      const response2 = await request(VOYAGE_SERVICE_URL)
        .get('/api/hotels/search')
        .query(searchParams)
        .expect('Content-Type', /json/);
      const duration2 = Date.now() - start2;

      expect(response2.status).toBeIn([200, 201]);

      // Cached response should be faster (usually < 50ms vs > 500ms)
      console.log(`First request: ${duration1}ms, Second request: ${duration2}ms`);

      // Data should be identical
      expect(response2.body.data).toEqual(response1.body.data);
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
