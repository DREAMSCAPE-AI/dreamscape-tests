import { ActivityMapper } from '../../../../dreamscape-services/voyage/src/mappers/ActivityMapper';

describe('ActivityMapper', () => {
  describe('mapAmadeusToSimplified', () => {
    it('should map basic Amadeus activity response to simplified format', () => {
      const amadeusResponse = [
        {
          id: 'ACT123',
          name: 'Eiffel Tower Skip-the-Line Tour',
          shortDescription: 'Visit the iconic Eiffel Tower',
          description: 'Experience the Eiffel Tower with priority access and expert guide',
          geoCode: {
            latitude: 48.8584,
            longitude: 2.2945,
            address: 'Champ de Mars, Paris'
          },
          rating: 4.8,
          price: {
            amount: '45.00',
            currencyCode: 'EUR'
          },
          pictures: [
            { url: 'https://example.com/eiffel1.jpg' },
            { url: 'https://example.com/eiffel2.jpg' }
          ],
          type: 'TOUR',
          duration: '2 hours',
          maximumNumberOfPeople: 15
        }
      ];

      const result = ActivityMapper.mapAmadeusToSimplified(amadeusResponse);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('ACT123');
      expect(result[0].name).toBe('Eiffel Tower Skip-the-Line Tour');
      expect(result[0].description).toBe('Experience the Eiffel Tower with priority access and expert guide');
      expect(result[0].location.coordinates.latitude).toBe(48.8584);
      expect(result[0].location.coordinates.longitude).toBe(2.2945);
      expect(result[0].rating).toBe(4.8);
      expect(result[0].price.amount).toBe(45);
      expect(result[0].price.currency).toBe('EUR');
      expect(result[0].images).toEqual([
        'https://example.com/eiffel1.jpg',
        'https://example.com/eiffel2.jpg'
      ]);
      expect(result[0].category).toBe('TOUR');
      expect(result[0].duration).toBe('2 hours');
      expect(result[0].groupSize).toBe('Up to 15 people');
    });

    it('should use searchLocationName when activity lacks location name', () => {
      const amadeusResponse = [
        {
          id: 'ACT456',
          name: 'City Walking Tour',
          geoCode: {
            latitude: 51.5074,
            longitude: -0.1278
          },
          price: {
            amount: '25.00',
            currencyCode: 'GBP'
          }
        }
      ];

      const result = ActivityMapper.mapAmadeusToSimplified(amadeusResponse, 'London');

      expect(result[0].location.name).toBe('London');
    });

    it('should detect city from coordinates when no location name provided', () => {
      const amadeusResponse = [
        {
          id: 'ACT789',
          name: 'Museum Tour',
          geoCode: {
            latitude: 48.8566,
            longitude: 2.3522
          },
          price: {
            amount: '30.00',
            currencyCode: 'EUR'
          }
        }
      ];

      const result = ActivityMapper.mapAmadeusToSimplified(amadeusResponse);

      expect(result[0].location.name).toBe('Paris');
    });

    it('should handle missing optional fields gracefully', () => {
      const amadeusResponse = [
        {
          id: 'ACT_MINIMAL',
          name: 'Basic Activity',
          geoCode: {}
        }
      ];

      const result = ActivityMapper.mapAmadeusToSimplified(amadeusResponse);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('ACT_MINIMAL');
      expect(result[0].name).toBe('Basic Activity');
      expect(result[0].price.amount).toBe(0);
      expect(result[0].rating).toBeGreaterThanOrEqual(4.0);
      expect(result[0].rating).toBeLessThanOrEqual(5.0);
      expect(result[0].reviewCount).toBeGreaterThanOrEqual(50);
      expect(result[0].duration).toBe('2-3 hours');
      expect(result[0].groupSize).toBe('Up to 20 people');
    });

    it('should map category correctly from activity type', () => {
      const categories = [
        { type: 'SIGHTSEEING', expected: 'SIGHTSEEING' },
        { type: 'MUSEUM', expected: 'MUSEUM' },
        { type: 'FOOD', expected: 'FOOD_AND_DRINK' },
        { type: 'ADVENTURE', expected: 'ADVENTURE' },
        { type: 'UNKNOWN', expected: 'TOUR' } // Default fallback
      ];

      categories.forEach(({ type, expected }) => {
        const amadeusResponse = [{
          id: 'TEST',
          name: 'Test Activity',
          type: type,
          geoCode: {},
          price: {}
        }];

        const result = ActivityMapper.mapAmadeusToSimplified(amadeusResponse);
        expect(result[0].category).toBe(expected);
      });
    });

    it('should extract tags based on category', () => {
      const amadeusResponse = [{
        id: 'TOUR123',
        name: 'Historical Tour',
        type: 'TOUR',
        geoCode: {},
        price: {}
      }];

      const result = ActivityMapper.mapAmadeusToSimplified(amadeusResponse);

      expect(result[0].tags).toEqual(['Expert Guide', 'Small Group', 'Historical']);
    });

    it('should format price with correct currency symbol', () => {
      const currencies = [
        { code: 'USD', symbol: '$' },
        { code: 'EUR', symbol: '€' },
        { code: 'GBP', symbol: '£' },
        { code: 'JPY', symbol: '¥' }
      ];

      currencies.forEach(({ code, symbol }) => {
        const amadeusResponse = [{
          id: 'PRICE_TEST',
          name: 'Test Activity',
          geoCode: {},
          price: {
            amount: '100.00',
            currencyCode: code
          }
        }];

        const result = ActivityMapper.mapAmadeusToSimplified(amadeusResponse);
        expect(result[0].price.formatted).toBe(`${symbol}100.00`);
      });
    });

    it('should extract highlights from activity', () => {
      const amadeusResponse = [{
        id: 'HIGHLIGHT_TEST',
        name: 'Test Activity',
        highlights: ['Amazing views', 'Expert guide', 'Small group'],
        geoCode: {},
        price: {}
      }];

      const result = ActivityMapper.mapAmadeusToSimplified(amadeusResponse);

      expect(result[0].highlights).toEqual(['Amazing views', 'Expert guide', 'Small group']);
    });

    it('should extract included/excluded services', () => {
      const amadeusResponse = [{
        id: 'SERVICES_TEST',
        name: 'Test Activity',
        includedServices: ['Guide', 'Equipment'],
        excludedServices: ['Food', 'Transport'],
        geoCode: {},
        price: {}
      }];

      const result = ActivityMapper.mapAmadeusToSimplified(amadeusResponse);

      expect(result[0].includes).toEqual(['Guide', 'Equipment']);
      expect(result[0].excludes).toEqual(['Food', 'Transport']);
    });

    it('should set booking info with default values', () => {
      const amadeusResponse = [{
        id: 'BOOKING_TEST',
        name: 'Test Activity',
        geoCode: {},
        price: {}
      }];

      const result = ActivityMapper.mapAmadeusToSimplified(amadeusResponse);

      expect(result[0].bookingInfo).toEqual({
        instantConfirmation: true,
        freeCancellation: false,
        cancellationPolicy: 'Free cancellation up to 24 hours before',
        voucherInfo: 'Mobile voucher accepted'
      });
    });

    it('should detect free cancellation from policy', () => {
      const amadeusResponse = [{
        id: 'CANCEL_TEST',
        name: 'Test Activity',
        cancellationPolicy: 'free cancellation available',  // Must be lowercase to match .includes('free')
        geoCode: {},
        price: {}
      }];

      const result = ActivityMapper.mapAmadeusToSimplified(amadeusResponse);

      expect(result[0].bookingInfo.freeCancellation).toBe(true);
    });

    it('should handle empty array input', () => {
      const result = ActivityMapper.mapAmadeusToSimplified([]);
      expect(result).toEqual([]);
    });

    it('should parse duration from durationRange', () => {
      const amadeusResponse = [{
        id: 'DURATION_TEST',
        name: 'Test Activity',
        durationRange: {
          min: 2,
          max: 4
        },
        geoCode: {},
        price: {}
      }];

      const result = ActivityMapper.mapAmadeusToSimplified(amadeusResponse);

      expect(result[0].duration).toBe('2-4 hours');
    });

    it('should extract meeting point information', () => {
      const amadeusResponse = [{
        id: 'MEETING_TEST',
        name: 'Test Activity',
        meetingPoint: 'Main entrance of the museum',
        geoCode: {},
        price: {}
      }];

      const result = ActivityMapper.mapAmadeusToSimplified(amadeusResponse);

      expect(result[0].meetingPoint).toBe('Main entrance of the museum');
    });

    it('should extract language information', () => {
      const amadeusResponse = [{
        id: 'LANG_TEST',
        name: 'Test Activity',
        languages: ['English', 'French', 'Spanish'],
        geoCode: {},
        price: {}
      }];

      const result = ActivityMapper.mapAmadeusToSimplified(amadeusResponse);

      expect(result[0].languages).toEqual(['English', 'French', 'Spanish']);
    });

    it('should extract difficulty level', () => {
      const amadeusResponse = [{
        id: 'DIFF_TEST',
        name: 'Test Activity',
        difficulty: 'Easy',
        geoCode: {},
        price: {}
      }];

      const result = ActivityMapper.mapAmadeusToSimplified(amadeusResponse);

      expect(result[0].difficulty).toBe('Easy');
    });

    it('should extract age restriction', () => {
      const amadeusResponse = [{
        id: 'AGE_TEST',
        name: 'Test Activity',
        minimumAge: 12,
        geoCode: {},
        price: {}
      }];

      const result = ActivityMapper.mapAmadeusToSimplified(amadeusResponse);

      expect(result[0].ageRestriction).toBe('Minimum age: 12 years');
    });
  });

  describe('mapSingleActivity', () => {
    it('should map a single activity correctly', () => {
      const activity = {
        id: 'SINGLE_TEST',
        name: 'Single Activity Test',
        description: 'Test description',
        geoCode: {
          latitude: 40.7128,
          longitude: -74.0060
        },
        price: {
          amount: '50.00',
          currencyCode: 'USD'
        }
      };

      const result = ActivityMapper.mapSingleActivity(activity, 'New York');

      expect(result.id).toBe('SINGLE_TEST');
      expect(result.name).toBe('Single Activity Test');
      expect(result.location.name).toBe('New York');
      expect(result.price.amount).toBe(50);
    });
  });
});
