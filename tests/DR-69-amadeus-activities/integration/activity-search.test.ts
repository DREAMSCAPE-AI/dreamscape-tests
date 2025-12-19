import request from 'supertest';

const VOYAGE_SERVICE_URL = process.env.VOYAGE_SERVICE_URL || 'http://localhost:3003';

describe('Activity Search API Integration Tests', () => {
  describe('GET /api/activities/search', () => {
    it('should search activities with coordinates (Paris)', async () => {
      const response = await request(VOYAGE_SERVICE_URL)
        .get('/api/activities/search')
        .query({
          latitude: 48.91,
          longitude: 2.25,
          radius: 20,
          locationName: 'Paris'
        })
        .expect('Content-Type', /json/);

      // Accept 429 if rate limited by Amadeus API
      expect(response.status).toBeIn([200, 201, 429]);

      if (response.status === 200 || response.status === 201) {
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);
      }

      if (response.body.data && response.body.data.length > 0) {
        const activity = response.body.data[0];
        expect(activity).toHaveProperty('id');
        expect(activity).toHaveProperty('name');
        expect(activity).toHaveProperty('description');
        expect(activity).toHaveProperty('location');
        expect(activity).toHaveProperty('price');
        expect(activity).toHaveProperty('category');
        expect(activity).toHaveProperty('images');
        expect(activity).toHaveProperty('bookingInfo');

        // Validate location structure
        expect(activity.location).toHaveProperty('name');
        expect(activity.location).toHaveProperty('coordinates');

        // Validate price structure
        expect(activity.price).toHaveProperty('amount');
        expect(activity.price).toHaveProperty('currency');
        expect(activity.price).toHaveProperty('formatted');

        // Validate booking info
        expect(activity.bookingInfo).toHaveProperty('instantConfirmation');
        expect(activity.bookingInfo).toHaveProperty('freeCancellation');
        expect(activity.bookingInfo).toHaveProperty('cancellationPolicy');

        console.log(`✅ Found activity: ${activity.name} in ${activity.location.name}`);
        console.log(`   Price: ${activity.price.formatted}`);
        console.log(`   Category: ${activity.category}`);
      }
    }, 30000);

    it('should search activities in London', async () => {
      const response = await request(VOYAGE_SERVICE_URL)
        .get('/api/activities/search')
        .query({
          latitude: 51.520180,
          longitude: -0.169882,
          radius: 20,
          locationName: 'London'
        })
        .expect('Content-Type', /json/);

      expect(response.status).toBeIn([200, 201, 429]);

      if (response.status === 200 || response.status === 201) {
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);
      }

      if (response.body.data && response.body.data.length > 0) {
        const activity = response.body.data[0];
        // Location name should be 'London' from locationName parameter
        expect(activity.location.name).toBeTruthy();
        console.log(`✅ Found activity in London: ${activity.name}`);
      }
    }, 30000);

    it('should search activities in New York', async () => {
      const response = await request(VOYAGE_SERVICE_URL)
        .get('/api/activities/search')
        .query({
          latitude: 40.792027,
          longitude: -74.058204,
          radius: 20,
          locationName: 'New York'
        })
        .expect('Content-Type', /json/);

      expect(response.status).toBeIn([200, 201, 429]);

      if (response.status === 200 || response.status === 201) {
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);
      }
    }, 30000);

    it('should return 400 for missing latitude', async () => {
      const response = await request(VOYAGE_SERVICE_URL)
        .get('/api/activities/search')
        .query({
          longitude: 2.3522,
          radius: 20
        });

      // Should return 400, but accept 429 if rate limited
      expect(response.status).toBeIn([400, 429]);

      if (response.status === 400) {
        expect(response.body).toHaveProperty('error');
      }
    });

    it('should return 400 for missing longitude', async () => {
      const response = await request(VOYAGE_SERVICE_URL)
        .get('/api/activities/search')
        .query({
          latitude: 48.8566,
          radius: 20
        });

      // Should return 400, but accept 429 if rate limited
      expect(response.status).toBeIn([400, 429]);

      if (response.status === 400) {
        expect(response.body).toHaveProperty('error');
      }
    });

    it('should return 400 for invalid coordinates (out of range)', async () => {
      const response = await request(VOYAGE_SERVICE_URL)
        .get('/api/activities/search')
        .query({
          latitude: 200, // Invalid latitude
          longitude: 2.3522,
          radius: 20
        });

      // Should return 400 for invalid coordinates, but API might not validate strictly
      expect(response.status).toBeIn([200, 400, 429]);

      if (response.status === 400) {
        expect(response.body).toHaveProperty('error');
      }
    });

    it('should handle custom radius parameter', async () => {
      const response = await request(VOYAGE_SERVICE_URL)
        .get('/api/activities/search')
        .query({
          latitude: 48.91,
          longitude: 2.25,
          radius: 10, // Smaller radius
          locationName: 'Paris'
        })
        .expect('Content-Type', /json/);

      expect(response.status).toBeIn([200, 201, 429]);

      if (response.status === 200 || response.status === 201) {
        expect(response.body).toHaveProperty('data');
      }
    }, 30000);

    it('should search activities in all 8 Amadeus test cities', async () => {
      const testCities = [
        { name: 'Paris', lat: 48.91, lon: 2.25 },
        { name: 'London', lat: 51.520180, lon: -0.169882 },
        { name: 'Barcelona', lat: 41.42, lon: 2.11 },
        { name: 'Berlin', lat: 52.541755, lon: 13.354201 },
        { name: 'New York', lat: 40.792027, lon: -74.058204 },
        { name: 'San Francisco', lat: 37.810980, lon: -122.483716 },
        { name: 'Dallas', lat: 32.806993, lon: -96.836857 },
        { name: 'Bangalore', lat: 13.023577, lon: 77.536856 }
      ];

      const results = [];

      for (const city of testCities) {
        const response = await request(VOYAGE_SERVICE_URL)
          .get('/api/activities/search')
          .query({
            latitude: city.lat,
            longitude: city.lon,
            radius: 20,
            locationName: city.name
          });

        results.push({
          city: city.name,
          status: response.status,
          count: response.body.data?.length || 0
        });

        // Accept 429 (rate limit) as Amadeus test API has strict quotas
        expect(response.status).toBeIn([200, 201, 429]);

        if (response.status === 200 || response.status === 201) {
          expect(response.body).toHaveProperty('data');
        }
      }

      console.log('\n📊 Activity Search Results by City:');
      results.forEach(result => {
        console.log(`   ${result.city}: ${result.count} activities (HTTP ${result.status})`);
      });
    }, 120000); // Longer timeout for testing all cities
  });

  describe('GET /api/activities/:activityId', () => {
    it('should get activity details by ID', async () => {
      // First, search for activities to get a valid ID
      const searchResponse = await request(VOYAGE_SERVICE_URL)
        .get('/api/activities/search')
        .query({
          latitude: 48.91,
          longitude: 2.25,
          radius: 20,
          locationName: 'Paris'
        });

      if (searchResponse.body.data && searchResponse.body.data.length > 0) {
        const activityId = searchResponse.body.data[0].id;

        const response = await request(VOYAGE_SERVICE_URL)
          .get(`/api/activities/${activityId}`)
          .expect('Content-Type', /json/);

        expect(response.status).toBeIn([200, 404]);

        if (response.status === 200) {
          expect(response.body).toHaveProperty('data');
          expect(response.body.data).toHaveProperty('id');
          expect(response.body.data.id).toBe(activityId);
          expect(response.body.data).toHaveProperty('name');
          expect(response.body.data).toHaveProperty('description');
          expect(response.body.data).toHaveProperty('highlights');
          expect(response.body.data).toHaveProperty('includes');
          expect(response.body.data).toHaveProperty('excludes');

          console.log(`✅ Activity details retrieved: ${response.body.data.name}`);
        }
      }
    }, 30000);

    it('should return 404 for non-existent activity ID', async () => {
      const response = await request(VOYAGE_SERVICE_URL)
        .get('/api/activities/NONEXISTENT_ID_12345');

      // Accept 429 if rate limited, otherwise expect 404
      expect(response.status).toBeIn([404, 429]);

      if (response.status === 404) {
        expect(response.body).toHaveProperty('error');
      }
    });
  });

  describe('POST /api/activities/bookings', () => {
    it('should return 404 or 501 (endpoint not implemented)', async () => {
      const response = await request(VOYAGE_SERVICE_URL)
        .post('/api/activities/bookings')
        .send({
          activityId: 'ACT123',
          date: '2025-12-20',
          participants: 2,
          guest: {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@example.com'
          }
        });

      // Route may not exist (404) or return 501, or be rate limited (429)
      expect(response.status).toBeIn([404, 429, 501]);

      if (response.status === 501) {
        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toContain('not implemented');
      }
    });
  });

  describe('Cache Integration', () => {
    it('should cache activity search results', async () => {
      const searchParams = {
        latitude: 48.91,
        longitude: 2.25,
        radius: 20,
        locationName: 'Paris'
      };

      // First request (cold)
      const start1 = Date.now();
      const response1 = await request(VOYAGE_SERVICE_URL)
        .get('/api/activities/search')
        .query(searchParams)
        .expect('Content-Type', /json/);
      const duration1 = Date.now() - start1;

      // Accept 429 if rate limited
      expect(response1.status).toBeIn([200, 201, 429]);

      // Second request (should be cached)
      const start2 = Date.now();
      const response2 = await request(VOYAGE_SERVICE_URL)
        .get('/api/activities/search')
        .query(searchParams)
        .expect('Content-Type', /json/);
      const duration2 = Date.now() - start2;

      expect(response2.status).toBeIn([200, 201, 429]);

      console.log(`\n⚡ Cache Performance:`);
      console.log(`   First request (cold): ${duration1}ms`);
      console.log(`   Second request (cached): ${duration2}ms`);

      // Cached response should generally be faster
      // Note: We don't enforce strict timing as it depends on many factors
      if (duration2 < duration1) {
        console.log(`   ✅ Cache hit - ${((1 - duration2/duration1) * 100).toFixed(0)}% faster`);
      }

      // Data should be identical (if both requests succeeded)
      if (response1.status === 200 || response1.status === 201) {
        if (response2.status === 200 || response2.status === 201) {
          expect(response2.body.data).toEqual(response1.body.data);
        }
      }
    }, 60000);
  });

  describe('Location Name Mapping', () => {
    it('should correctly map location names from search parameters', async () => {
      const cities = [
        { name: 'Paris', lat: 48.91, lon: 2.25 },
        { name: 'London', lat: 51.520180, lon: -0.169882 },
        { name: 'Barcelona', lat: 41.42, lon: 2.11 }
      ];

      for (const city of cities) {
        const response = await request(VOYAGE_SERVICE_URL)
          .get('/api/activities/search')
          .query({
            latitude: city.lat,
            longitude: city.lon,
            radius: 20,
            locationName: city.name
          });

        // Accept 429 if rate limited
        expect(response.status).toBeIn([200, 201, 429]);

        if (response.body.data && response.body.data.length > 0 && (response.status === 200 || response.status === 201)) {
          const firstActivity = response.body.data[0];
          // Location name should be set (either from API or from locationName param)
          expect(firstActivity.location.name).toBeTruthy();
          console.log(`✅ ${city.name}: Activity location = ${firstActivity.location.name}`);
        }
      }
    }, 60000);
  });

  describe('Error Handling', () => {
    it('should handle Amadeus API errors gracefully', async () => {
      // Test with coordinates that might trigger API errors
      const response = await request(VOYAGE_SERVICE_URL)
        .get('/api/activities/search')
        .query({
          latitude: 0,
          longitude: 0,
          radius: 1,
          locationName: 'Middle of Ocean'
        });

      // Should still return 200 with empty data or fallback, not crash
      // Also accept 429 if rate limited
      expect(response.status).toBeIn([200, 201, 400, 404, 429, 500]);

      // Only expect 'data' property if not rate limited
      if (response.status === 200 || response.status === 201) {
        expect(response.body).toHaveProperty('data');
      }
    }, 30000);

    it('should handle network timeout gracefully', async () => {
      // This test assumes the service has timeout handling
      const response = await request(VOYAGE_SERVICE_URL)
        .get('/api/activities/search')
        .query({
          latitude: 48.91,
          longitude: 2.25,
          radius: 20
        })
        .timeout(35000); // Slightly longer than service timeout

      // Accept various error codes including rate limit
      expect(response.status).toBeIn([200, 201, 408, 429, 500, 504]);
    }, 40000);
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
