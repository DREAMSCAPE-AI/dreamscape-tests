/**
 * Unit Tests for Flight Offer Mapper
 * Ticket: DR-132 - VOYAGE-001.3 : Mapping des réponses Flight API
 */

import { FlightOfferMapper } from '../../../dreamscape-services/voyage/src/mappers/FlightOfferMapper';
import { FlightOfferDTO } from '../../../dreamscape-services/voyage/src/dto/FlightOffer.dto';

describe('FlightOfferMapper', () => {
  describe('mapToDTO', () => {
    it('should map Amadeus offer to internal DTO correctly', () => {
      const amadeusOffer = {
        id: 'test-offer-123',
        source: 'GDS',
        instantTicketingRequired: true,
        nonHomogeneous: false,
        oneWay: false,
        lastTicketingDate: '2025-10-15',
        numberOfBookableSeats: 5,
        itineraries: [
          {
            duration: 'PT5H30M',
            segments: [
              {
                departure: {
                  iataCode: 'CDG',
                  terminal: '2E',
                  at: '2025-10-15T10:00:00'
                },
                arrival: {
                  iataCode: 'JFK',
                  terminal: '1',
                  at: '2025-10-15T12:30:00'
                },
                carrierCode: 'AF',
                number: '006',
                aircraft: { code: '77W' },
                duration: 'PT5H30M',
                id: 'seg-1',
                numberOfStops: 0,
                blacklistedInEU: false
              }
            ]
          }
        ],
        price: {
          currency: 'EUR',
          total: '850.50',
          base: '750.00',
          fees: [{ amount: '100.50', type: 'SUPPLIER' }],
          grandTotal: '850.50'
        },
        pricingOptions: {
          fareType: ['PUBLISHED'],
          includedCheckedBagsOnly: true
        },
        validatingAirlineCodes: ['AF'],
        travelerPricings: [
          {
            travelerId: '1',
            fareOption: 'STANDARD',
            travelerType: 'ADULT',
            price: {
              currency: 'EUR',
              total: '850.50',
              base: '750.00'
            },
            fareDetailsBySegment: [
              {
                segmentId: 'seg-1',
                cabin: 'ECONOMY',
                fareBasis: 'UOWVFR',
                class: 'U',
                includedCheckedBags: { quantity: 1 }
              }
            ]
          }
        ]
      };

      const result: FlightOfferDTO = FlightOfferMapper.mapToDTO(amadeusOffer);

      expect(result.id).toBe('test-offer-123');
      expect(result.source).toBe('GDS');
      expect(result.numberOfBookableSeats).toBe(5);
      expect(result.itineraries).toHaveLength(1);
      expect(result.itineraries[0].segments).toHaveLength(1);
      expect(result.itineraries[0].segments[0].departure.iataCode).toBe('CDG');
      expect(result.itineraries[0].segments[0].arrival.iataCode).toBe('JFK');
      expect(result.price.currency).toBe('EUR');
      expect(result.price.total).toBe('850.50');
    });

    it('should throw error for null offer', () => {
      expect(() => FlightOfferMapper.mapToDTO(null)).toThrow('Invalid Amadeus offer');
    });

    it('should throw error for undefined offer', () => {
      expect(() => FlightOfferMapper.mapToDTO(undefined)).toThrow('Invalid Amadeus offer');
    });

    it('should handle missing optional fields with defaults', () => {
      const minimalOffer = {
        id: 'min-123',
        source: 'GDS',
        lastTicketingDate: '2025-10-15',
        itineraries: [],
        price: {
          currency: 'USD',
          total: '100',
          base: '90',
          fees: [],
          grandTotal: '100'
        },
        travelerPricings: []
      };

      const result = FlightOfferMapper.mapToDTO(minimalOffer);

      expect(result.instantTicketingRequired).toBe(false);
      expect(result.nonHomogeneous).toBe(false);
      expect(result.oneWay).toBe(false);
      expect(result.numberOfBookableSeats).toBe(0);
      expect(result.validatingAirlineCodes).toEqual([]);
    });
  });

  describe('mapToDTOs', () => {
    it('should map multiple Amadeus offers', () => {
      const offers = [
        {
          id: 'offer-1',
          source: 'GDS',
          lastTicketingDate: '2025-10-15',
          itineraries: [],
          price: {
            currency: 'USD',
            total: '100',
            base: '90',
            fees: [],
            grandTotal: '100'
          },
          travelerPricings: []
        },
        {
          id: 'offer-2',
          source: 'GDS',
          lastTicketingDate: '2025-10-16',
          itineraries: [],
          price: {
            currency: 'EUR',
            total: '200',
            base: '180',
            fees: [],
            grandTotal: '200'
          },
          travelerPricings: []
        }
      ];

      const result = FlightOfferMapper.mapToDTOs(offers);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('offer-1');
      expect(result[1].id).toBe('offer-2');
    });

    it('should throw error for non-array input', () => {
      expect(() => FlightOfferMapper.mapToDTOs({} as any)).toThrow('expected an array');
    });
  });

  describe('mapToSimplified', () => {
    it('should create simplified flight offer', () => {
      const fullOffer: FlightOfferDTO = {
        id: 'test-123',
        source: 'GDS',
        instantTicketingRequired: false,
        nonHomogeneous: false,
        oneWay: false,
        lastTicketingDate: '2025-10-15',
        numberOfBookableSeats: 3,
        itineraries: [
          {
            duration: 'PT5H30M',
            segments: [
              {
                departure: {
                  iataCode: 'CDG',
                  terminal: '2E',
                  at: '2025-10-15T10:00:00'
                },
                arrival: {
                  iataCode: 'JFK',
                  terminal: '1',
                  at: '2025-10-15T15:30:00'
                },
                carrierCode: 'AF',
                number: '006',
                aircraft: { code: '77W' },
                duration: 'PT5H30M',
                id: 'seg-1',
                numberOfStops: 0,
                blacklistedInEU: false
              }
            ]
          }
        ],
        price: {
          currency: 'EUR',
          total: '850.50',
          base: '750.00',
          fees: [],
          grandTotal: '850.50'
        },
        pricingOptions: {
          fareType: ['PUBLISHED'],
          includedCheckedBagsOnly: true
        },
        validatingAirlineCodes: ['AF'],
        travelerPricings: [
          {
            travelerId: '1',
            fareOption: 'STANDARD',
            travelerType: 'ADULT',
            price: {
              currency: 'EUR',
              total: '850.50',
              base: '750.00'
            },
            fareDetailsBySegment: [
              {
                segmentId: 'seg-1',
                cabin: 'BUSINESS',
                fareBasis: 'JOWVFR',
                class: 'J',
                includedCheckedBags: { quantity: 2 }
              }
            ]
          }
        ]
      };

      const simplified = FlightOfferMapper.mapToSimplified(fullOffer);

      expect(simplified.id).toBe('test-123');
      expect(simplified.price.total).toBe(850.50);
      expect(simplified.price.currency).toBe('EUR');
      expect(simplified.duration).toBe('PT5H30M');
      expect(simplified.stops).toBe(0);
      expect(simplified.departure.airport).toBe('CDG');
      expect(simplified.departure.terminal).toBe('2E');
      expect(simplified.arrival.airport).toBe('JFK');
      expect(simplified.arrival.terminal).toBe('1');
      expect(simplified.airline.code).toBe('AF');
      expect(simplified.airline.name).toBe('Air France');
      expect(simplified.cabinClass).toBe('BUSINESS');
      expect(simplified.availableSeats).toBe(3);
      expect(simplified.baggageAllowance.checkedBags).toBe(2);
      expect(simplified.baggageAllowance.cabinBags).toBe(1);
    });

    it('should handle flight with multiple stops', () => {
      const offerWithStops: FlightOfferDTO = {
        id: 'multi-stop',
        source: 'GDS',
        instantTicketingRequired: false,
        nonHomogeneous: false,
        oneWay: false,
        lastTicketingDate: '2025-10-15',
        numberOfBookableSeats: 5,
        itineraries: [
          {
            duration: 'PT12H00M',
            segments: [
              {
                departure: { iataCode: 'CDG', at: '2025-10-15T10:00:00' },
                arrival: { iataCode: 'AMS', at: '2025-10-15T11:30:00' },
                carrierCode: 'KL',
                number: '1234',
                aircraft: { code: '738' },
                duration: 'PT1H30M',
                id: 'seg-1',
                numberOfStops: 1,
                blacklistedInEU: false
              },
              {
                departure: { iataCode: 'AMS', at: '2025-10-15T14:00:00' },
                arrival: { iataCode: 'JFK', at: '2025-10-15T17:00:00' },
                carrierCode: 'KL',
                number: '5678',
                aircraft: { code: '789' },
                duration: 'PT8H00M',
                id: 'seg-2',
                numberOfStops: 0,
                blacklistedInEU: false
              }
            ]
          }
        ],
        price: {
          currency: 'USD',
          total: '650.00',
          base: '600.00',
          fees: [],
          grandTotal: '650.00'
        },
        pricingOptions: { fareType: [], includedCheckedBagsOnly: false },
        validatingAirlineCodes: ['KL'],
        travelerPricings: [
          {
            travelerId: '1',
            fareOption: 'STANDARD',
            travelerType: 'ADULT',
            price: { currency: 'USD', total: '650.00', base: '600.00' },
            fareDetailsBySegment: [
              {
                segmentId: 'seg-1',
                cabin: 'ECONOMY',
                fareBasis: 'EOWVFR',
                class: 'E',
                includedCheckedBags: { quantity: 1 }
              }
            ]
          }
        ]
      };

      const simplified = FlightOfferMapper.mapToSimplified(offerWithStops);

      expect(simplified.stops).toBe(1); // Total stops across all segments
      expect(simplified.departure.airport).toBe('CDG');
      expect(simplified.arrival.airport).toBe('JFK');
      expect(simplified.airline.code).toBe('KL');
      expect(simplified.airline.name).toBe('KLM');
    });
  });

  describe('mapToSimplifiedList', () => {
    it('should simplify multiple offers', () => {
      const offers: FlightOfferDTO[] = [
        {
          id: '1',
          source: 'GDS',
          instantTicketingRequired: false,
          nonHomogeneous: false,
          oneWay: false,
          lastTicketingDate: '2025-10-15',
          numberOfBookableSeats: 3,
          itineraries: [
            {
              duration: 'PT5H',
              segments: [
                {
                  departure: { iataCode: 'CDG', at: '2025-10-15T10:00:00' },
                  arrival: { iataCode: 'JFK', at: '2025-10-15T15:00:00' },
                  carrierCode: 'AF',
                  number: '006',
                  aircraft: { code: '77W' },
                  duration: 'PT5H',
                  id: '1',
                  numberOfStops: 0,
                  blacklistedInEU: false
                }
              ]
            }
          ],
          price: { currency: 'EUR', total: '800', base: '700', fees: [], grandTotal: '800' },
          pricingOptions: { fareType: [], includedCheckedBagsOnly: false },
          validatingAirlineCodes: ['AF'],
          travelerPricings: []
        },
        {
          id: '2',
          source: 'GDS',
          instantTicketingRequired: false,
          nonHomogeneous: false,
          oneWay: false,
          lastTicketingDate: '2025-10-16',
          numberOfBookableSeats: 2,
          itineraries: [
            {
              duration: 'PT6H',
              segments: [
                {
                  departure: { iataCode: 'LHR', at: '2025-10-16T09:00:00' },
                  arrival: { iataCode: 'JFK', at: '2025-10-16T15:00:00' },
                  carrierCode: 'BA',
                  number: '117',
                  aircraft: { code: '787' },
                  duration: 'PT6H',
                  id: '2',
                  numberOfStops: 0,
                  blacklistedInEU: false
                }
              ]
            }
          ],
          price: { currency: 'GBP', total: '750', base: '650', fees: [], grandTotal: '750' },
          pricingOptions: { fareType: [], includedCheckedBagsOnly: false },
          validatingAirlineCodes: ['BA'],
          travelerPricings: []
        }
      ];

      const simplified = FlightOfferMapper.mapToSimplifiedList(offers);

      expect(simplified).toHaveLength(2);
      expect(simplified[0].id).toBe('1');
      expect(simplified[0].airline.code).toBe('AF');
      expect(simplified[1].id).toBe('2');
      expect(simplified[1].airline.code).toBe('BA');
    });
  });
});
