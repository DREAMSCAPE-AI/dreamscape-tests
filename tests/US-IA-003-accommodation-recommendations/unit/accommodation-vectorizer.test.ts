/**
 * Accommodation Vectorizer Service - Unit Tests
 *
 * Tests the vectorization of accommodation features into 8D vectors.
 *
 * @ticket US-IA-003.1
 */

import { AccommodationVectorizerService } from '@ai/accommodations/services/accommodation-vectorizer.service';
import {
  AccommodationFeatures,
  AccommodationCategory,
  AmenityCategory,
  LocationType,
} from '@ai/accommodations/types/accommodation-vector.types';

describe('AccommodationVectorizerService', () => {
  let service: AccommodationVectorizerService;

  beforeEach(() => {
    service = new AccommodationVectorizerService();
  });

  describe('vectorize', () => {
    it('should vectorize a basic accommodation into an 8D vector', () => {
      // Arrange
      const accommodation: AccommodationFeatures = {
        hotelId: 'TEST001',
        name: 'Test Beach Resort',
        chainCode: 'TEST',
        location: {
          latitude: 43.7,
          longitude: 7.25,
          address: 'Nice, France',
          cityCode: 'NCE',
          locationType: LocationType.BEACH,
          distanceToCenter: 5.2,
        },
        category: AccommodationCategory.RESORT,
        starRating: 4,
        price: {
          amount: 150,
          currency: 'EUR',
          perNight: true,
        },
        ratings: {
          overall: 8.5,
          numberOfReviews: 250,
        },
        amenities: [
          AmenityCategory.POOL,
          AmenityCategory.AIR_CONDITIONING,
          AmenityCategory.RESTAURANT,
          AmenityCategory.GYM,
          AmenityCategory.SPA,
        ],
      };

      // Act
      const vector = service.vectorize(accommodation);

      // Assert
      expect(vector).toHaveLength(8);
      expect(vector.every((val) => val >= 0 && val <= 1)).toBe(true);

      // Verify specific dimensions
      expect(vector[0]).toBeGreaterThan(0); // Climate (has pool + AC)
      expect(vector[1]).toBeLessThan(0.5); // Culture vs Nature (beach = nature-oriented)
      expect(vector[3]).toBeGreaterThan(0); // Activity level (has gym + spa)
      expect(vector[6]).toBeGreaterThan(0); // Gastronomy (has restaurant)
      expect(vector[7]).toBeGreaterThan(0); // Popularity (good ratings)
    });

    it('should handle accommodations with minimal information', () => {
      // Arrange
      const minimalAccommodation: AccommodationFeatures = {
        hotelId: 'MIN001',
        name: 'Budget Hotel',
        location: {
          latitude: 48.8566,
          longitude: 2.3522,
          address: 'Paris, France',
          cityCode: 'PAR',
          locationType: LocationType.CITY_CENTER,
        },
        category: AccommodationCategory.BUDGET_HOTEL,
        starRating: 2,
        price: {
          amount: 50,
          currency: 'EUR',
          perNight: true,
        },
        amenities: [],
      };

      // Act
      const vector = service.vectorize(minimalAccommodation);

      // Assert
      expect(vector).toHaveLength(8);
      expect(vector.every((val) => val >= 0 && val <= 1)).toBe(true);

      // Should have low scores for most amenity-based dimensions
      expect(vector[0]).toBe(0); // Climate (no amenities)
      expect(vector[3]).toBe(0); // Activity level (no amenities)
      expect(vector[6]).toBe(0); // Gastronomy (no amenities)
    });
  });

  describe('batchVectorize', () => {
    it('should vectorize multiple accommodations and return metadata', () => {
      // Arrange
      const accommodations: AccommodationFeatures[] = [
        {
          hotelId: 'HOTEL1',
          name: 'Hotel 1',
          location: {
            latitude: 43.7,
            longitude: 7.25,
            address: 'Nice, France',
            cityCode: 'NCE',
            locationType: LocationType.CITY_CENTER,
          },
          category: AccommodationCategory.HOTEL,
          starRating: 3,
          price: {
            amount: 100,
            currency: 'EUR',
            perNight: true,
          },
          amenities: [AmenityCategory.WIFI, AmenityCategory.RESTAURANT],
        },
        {
          hotelId: 'HOTEL2',
          name: 'Hotel 2',
          location: {
            latitude: 43.7,
            longitude: 7.25,
            address: 'Nice, France',
            cityCode: 'NCE',
            locationType: LocationType.BEACH,
          },
          category: AccommodationCategory.RESORT,
          starRating: 5,
          price: {
            amount: 300,
            currency: 'EUR',
            perNight: true,
          },
          amenities: [
            AmenityCategory.POOL,
            AmenityCategory.SPA,
            AmenityCategory.FINE_DINING,
          ],
        },
        {
          hotelId: 'HOTEL3',
          name: 'Hotel 3',
          location: {
            latitude: 43.7,
            longitude: 7.25,
            address: 'Nice, France',
            cityCode: 'NCE',
            locationType: LocationType.SUBURBAN,
          },
          category: AccommodationCategory.BUDGET_HOTEL,
          starRating: 2,
          price: {
            amount: 60,
            currency: 'EUR',
            perNight: true,
          },
          amenities: [AmenityCategory.WIFI],
        },
      ];

      // Act
      const result = service.batchVectorize(accommodations);

      // Assert
      expect(result.vectors.size).toBe(3);
      expect(result.itemsProcessed).toBe(3);
      expect(result.processingTime).toBeGreaterThanOrEqual(0);

      // Verify all hotels are vectorized
      expect(result.vectors.has('HOTEL1')).toBe(true);
      expect(result.vectors.has('HOTEL2')).toBe(true);
      expect(result.vectors.has('HOTEL3')).toBe(true);

      // Verify vectors are valid
      const vector1 = result.vectors.get('HOTEL1');
      expect(vector1).toHaveLength(8);
      expect(vector1?.every((val) => val >= 0 && val <= 1)).toBe(true);

      // No errors expected
      expect(result.errors).toBeUndefined();
    });

    it('should calculate dynamic market average for budget dimension', () => {
      // Arrange
      const accommodations: AccommodationFeatures[] = [
        {
          hotelId: 'CHEAP',
          name: 'Budget Hotel',
          location: {
            latitude: 0,
            longitude: 0,
            address: 'Test',
            cityCode: 'TST',
            locationType: LocationType.CITY_CENTER,
          },
          category: AccommodationCategory.BUDGET_HOTEL,
          starRating: 2,
          price: { amount: 50, currency: 'EUR', perNight: true },
          amenities: [],
        },
        {
          hotelId: 'EXPENSIVE',
          name: 'Luxury Hotel',
          location: {
            latitude: 0,
            longitude: 0,
            address: 'Test',
            cityCode: 'TST',
            locationType: LocationType.CITY_CENTER,
          },
          category: AccommodationCategory.LUXURY_HOTEL,
          starRating: 5,
          price: { amount: 450, currency: 'EUR', perNight: true },
          amenities: [],
        },
      ];

      // Act
      const result = service.batchVectorize(accommodations);

      // Assert
      const cheapVector = result.vectors.get('CHEAP');
      const expensiveVector = result.vectors.get('EXPENSIVE');

      expect(cheapVector).toBeDefined();
      expect(expensiveVector).toBeDefined();

      // Budget dimension (index 2) should be lower for cheap hotel
      expect(cheapVector![2]).toBeLessThan(expensiveVector![2]);

      // Market average should be (50 + 450) / 2 = 250
      // Cheap hotel (50) is 0.2x average → should be in budget range (< 0.3)
      // Expensive hotel (450) is 1.8x average → should be in upscale range (> 0.7)
      expect(cheapVector![2]).toBeLessThan(0.3);
      expect(expensiveVector![2]).toBeGreaterThan(0.7);
    });
  });
});
