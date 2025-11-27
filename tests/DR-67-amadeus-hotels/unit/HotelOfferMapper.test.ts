import { HotelOfferMapper } from '../../../../../dreamscape-services/voyage/src/mappers/HotelOfferMapper';
import { HotelOfferDTO, SimplifiedHotelOfferDTO } from '../../../../../dreamscape-services/voyage/src/dto/HotelOffer.dto';

describe('HotelOfferMapper', () => {
  describe('mapToDTO', () => {
    it('should map basic Amadeus hotel response to DTO', () => {
      const amadeusResponse = {
        type: 'hotel-offer',
        hotel: {
          type: 'hotel',
          hotelId: 'HOTEL123',
          name: 'Test Hotel',
          chainCode: 'MARRIOTT',
          cityCode: 'PAR',
          latitude: 48.8566,
          longitude: 2.3522,
          amenities: ['WIFI', 'POOL', 'PARKING']
        },
        available: true,
        offers: [
          {
            id: 'OFFER123',
            checkInDate: '2025-12-01',
            checkOutDate: '2025-12-03',
            room: {
              type: 'DELUXE',
              typeEstimated: {
                beds: 2,
                bedType: 'DOUBLE'
              }
            },
            guests: {
              adults: 2
            },
            price: {
              currency: 'EUR',
              total: '300.00',
              base: '250.00'
            }
          }
        ]
      };

      const result = HotelOfferMapper.mapToDTO(amadeusResponse);

      expect(result).toBeDefined();
      expect(result.type).toBe('hotel-offer');
      expect(result.hotel.hotelId).toBe('HOTEL123');
      expect(result.hotel.name).toBe('Test Hotel');
      expect(result.hotel.latitude).toBe(48.8566);
      expect(result.hotel.longitude).toBe(2.3522);
      expect(result.hotel.amenities).toEqual(['WIFI', 'POOL', 'PARKING']);
      expect(result.offers).toHaveLength(1);
      expect(result.offers[0].id).toBe('OFFER123');
      expect(result.offers[0].price.currency).toBe('EUR');
      expect(result.offers[0].price.total).toBe('300.00');
    });

    it('should handle missing optional fields gracefully', () => {
      const amadeusResponse = {
        hotel: {
          hotelId: 'HOTEL456',
          name: 'Basic Hotel'
        },
        offers: [
          {
            id: 'OFFER456',
            checkInDate: '2025-12-01',
            checkOutDate: '2025-12-02',
            room: {
              type: 'STANDARD'
            },
            guests: {},
            price: {
              currency: 'USD'
            }
          }
        ]
      };

      const result = HotelOfferMapper.mapToDTO(amadeusResponse);

      expect(result).toBeDefined();
      expect(result.hotel.hotelId).toBe('HOTEL456');
      expect(result.hotel.name).toBe('Basic Hotel');
      expect(result.hotel.chainCode).toBeUndefined();
      expect(result.hotel.amenities).toEqual([]);
      expect(result.offers[0].guests.adults).toBe(1); // Default value
    });
  });

  describe('mapToDTOs', () => {
    it('should map array of Amadeus hotels to DTOs', () => {
      const amadeusHotels = [
        {
          hotel: { hotelId: 'H1', name: 'Hotel 1' },
          offers: [{ id: 'O1', checkInDate: '2025-12-01', checkOutDate: '2025-12-02', room: { type: 'STANDARD' }, guests: { adults: 1 }, price: { currency: 'EUR', total: '100' } }]
        },
        {
          hotel: { hotelId: 'H2', name: 'Hotel 2' },
          offers: [{ id: 'O2', checkInDate: '2025-12-01', checkOutDate: '2025-12-02', room: { type: 'DELUXE' }, guests: { adults: 2 }, price: { currency: 'EUR', total: '200' } }]
        }
      ];

      const result = HotelOfferMapper.mapToDTOs(amadeusHotels);

      expect(result).toHaveLength(2);
      expect(result[0].hotel.hotelId).toBe('H1');
      expect(result[1].hotel.hotelId).toBe('H2');
    });

    it('should return empty array for invalid input', () => {
      expect(HotelOfferMapper.mapToDTOs(null as any)).toEqual([]);
      expect(HotelOfferMapper.mapToDTOs(undefined as any)).toEqual([]);
      expect(HotelOfferMapper.mapToDTOs('invalid' as any)).toEqual([]);
    });
  });

  describe('mapToSimplified', () => {
    it('should convert DTO to simplified format', () => {
      const dto: HotelOfferDTO = {
        type: 'hotel-offer',
        hotel: {
          type: 'hotel',
          hotelId: 'HOTEL789',
          name: 'Luxury Hotel',
          cityCode: 'NYC',
          latitude: 40.7128,
          longitude: -74.0060,
          address: {
            lines: ['123 Main St'],
            cityName: 'New York',
            countryCode: 'US',
            postalCode: '10001'
          },
          amenities: ['WIFI', 'POOL', 'GYM'],
          media: [
            { uri: 'https://example.com/image1.jpg', category: 'EXTERIOR' },
            { uri: 'https://example.com/image2.jpg', category: 'ROOM' }
          ],
          ratings: {
            overall: 4.5,
            numberOfReviews: 120
          },
          chainCode: 'HILTON',
          contact: {
            phone: '+1234567890',
            email: 'info@hotel.com'
          }
        },
        available: true,
        offers: [
          {
            id: 'OFFER789',
            checkInDate: '2025-12-10',
            checkOutDate: '2025-12-12',
            room: {
              type: 'SUITE',
              typeEstimated: {
                beds: 2,
                bedType: 'KING'
              },
              description: {
                text: 'Spacious suite with city view'
              }
            },
            guests: {
              adults: 2
            },
            price: {
              currency: 'USD',
              total: '500.00',
              base: '400.00'
            },
            policies: {
              cancellations: [
                {
                  type: 'FULL_REFUND',
                  deadline: '2025-12-08T00:00:00'
                }
              ]
            }
          }
        ]
      };

      const result = HotelOfferMapper.mapToSimplified(dto);

      expect(result).toBeDefined();
      expect(result.id).toBe('OFFER789');
      expect(result.hotelId).toBe('HOTEL789');
      expect(result.name).toBe('Luxury Hotel');
      expect(result.cityCode).toBe('NYC');
      expect(result.location.latitude).toBe(40.7128);
      expect(result.location.longitude).toBe(-74.0060);
      expect(result.address.street).toBe('123 Main St');
      expect(result.address.city).toBe('New York');
      expect(result.address.country).toBe('US');
      expect(result.rating).toBe(4.5);
      expect(result.reviewCount).toBe(120);
      expect(result.nights).toBe(2);
      expect(result.price.amount).toBe(500);
      expect(result.price.currency).toBe('USD');
      expect(result.price.perNight).toBe(250);
      expect(result.price.base).toBe(400);
      expect(result.price.taxes).toBe(100);
      expect(result.room.type).toBe('SUITE');
      expect(result.room.beds).toBe(2);
      expect(result.room.bedType).toBe('KING');
      expect(result.room.guests).toBe(2);
      expect(result.amenities).toEqual(['WIFI', 'POOL', 'GYM']);
      expect(result.images).toEqual([
        'https://example.com/image1.jpg',
        'https://example.com/image2.jpg'
      ]);
      expect(result.cancellation.freeCancellation).toBe(true);
      expect(result.chainCode).toBe('HILTON');
      expect(result.contact).toEqual({
        phone: '+1234567890',
        email: 'info@hotel.com'
      });
    });

    it('should calculate nights correctly', () => {
      const dto: HotelOfferDTO = {
        type: 'hotel-offer',
        hotel: {
          type: 'hotel',
          hotelId: 'H1',
          name: 'Test Hotel'
        },
        available: true,
        offers: [
          {
            id: 'O1',
            checkInDate: '2025-12-01',
            checkOutDate: '2025-12-05',
            room: { type: 'STANDARD' },
            guests: { adults: 1 },
            price: {
              currency: 'EUR',
              total: '400.00'
            }
          }
        ]
      };

      const result = HotelOfferMapper.mapToSimplified(dto);

      expect(result.nights).toBe(4);
      expect(result.price.perNight).toBe(100);
    });

    it('should detect free cancellation policies', () => {
      const dtoWithFreeCancellation: HotelOfferDTO = {
        type: 'hotel-offer',
        hotel: { type: 'hotel', hotelId: 'H1', name: 'Hotel' },
        available: true,
        offers: [{
          id: 'O1',
          checkInDate: '2025-12-01',
          checkOutDate: '2025-12-02',
          room: { type: 'STANDARD' },
          guests: { adults: 1 },
          price: { currency: 'EUR', total: '100' },
          policies: {
            cancellations: [{
              type: 'FULL_REFUND',
              deadline: '2025-11-30T00:00:00'
            }]
          }
        }]
      };

      const result1 = HotelOfferMapper.mapToSimplified(dtoWithFreeCancellation);
      expect(result1.cancellation.freeCancellation).toBe(true);

      const dtoWithPenalty: HotelOfferDTO = {
        type: 'hotel-offer',
        hotel: { type: 'hotel', hotelId: 'H2', name: 'Hotel 2' },
        available: true,
        offers: [{
          id: 'O2',
          checkInDate: '2025-12-01',
          checkOutDate: '2025-12-02',
          room: { type: 'STANDARD' },
          guests: { adults: 1 },
          price: { currency: 'EUR', total: '100' },
          policies: {
            cancellations: [{
              type: 'PARTIAL_REFUND',
              amount: '50.00',
              deadline: '2025-11-30T00:00:00'
            }]
          }
        }]
      };

      const result2 = HotelOfferMapper.mapToSimplified(dtoWithPenalty);
      expect(result2.cancellation.freeCancellation).toBe(false);
      expect(result2.cancellation.penalty).toBe(50);
    });
  });

  describe('mapToSimplifiedList', () => {
    it('should map array of DTOs to simplified format', () => {
      const dtos: HotelOfferDTO[] = [
        {
          type: 'hotel-offer',
          hotel: { type: 'hotel', hotelId: 'H1', name: 'Hotel 1' },
          available: true,
          offers: [{
            id: 'O1',
            checkInDate: '2025-12-01',
            checkOutDate: '2025-12-02',
            room: { type: 'STANDARD' },
            guests: { adults: 1 },
            price: { currency: 'EUR', total: '100' }
          }]
        },
        {
          type: 'hotel-offer',
          hotel: { type: 'hotel', hotelId: 'H2', name: 'Hotel 2' },
          available: true,
          offers: [{
            id: 'O2',
            checkInDate: '2025-12-01',
            checkOutDate: '2025-12-03',
            room: { type: 'DELUXE' },
            guests: { adults: 2 },
            price: { currency: 'EUR', total: '200' }
          }]
        }
      ];

      const result = HotelOfferMapper.mapToSimplifiedList(dtos);

      expect(result).toHaveLength(2);
      expect(result[0].hotelId).toBe('H1');
      expect(result[1].hotelId).toBe('H2');
      expect(result[0].nights).toBe(1);
      expect(result[1].nights).toBe(2);
    });

    it('should handle empty array and invalid input', () => {
      expect(HotelOfferMapper.mapToSimplifiedList([])).toEqual([]);
      expect(HotelOfferMapper.mapToSimplifiedList(null as any)).toEqual([]);
      expect(HotelOfferMapper.mapToSimplifiedList(undefined as any)).toEqual([]);
    });
  });

  describe('mapAmadeusToSimplified', () => {
    it('should map directly from Amadeus to simplified format', () => {
      const amadeusHotels = [
        {
          hotel: {
            hotelId: 'DIRECT1',
            name: 'Direct Hotel',
            latitude: 48.8566,
            longitude: 2.3522,
            amenities: ['WIFI']
          },
          offers: [{
            id: 'DIRECT_OFFER1',
            checkInDate: '2025-12-01',
            checkOutDate: '2025-12-02',
            room: { type: 'STANDARD' },
            guests: { adults: 1 },
            price: {
              currency: 'EUR',
              total: '150.00'
            }
          }]
        }
      ];

      const result = HotelOfferMapper.mapAmadeusToSimplified(amadeusHotels);

      expect(result).toHaveLength(1);
      expect(result[0].hotelId).toBe('DIRECT1');
      expect(result[0].name).toBe('Direct Hotel');
      expect(result[0].price.amount).toBe(150);
    });
  });
});
