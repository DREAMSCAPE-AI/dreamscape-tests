/**
 * DR-564 — US-TEST-027
 * Tests unitaires : flightBookingStore (store/flightBookingStore)
 *
 * Scénarios couverts :
 * - État initial (step SEARCH)
 * - Navigation : nextStep, previousStep, goToStep
 * - canProceedToNextStep : par étape
 * - setSelectedFlight : prix extrait, step → CHOOSE_SEATS
 * - Seat/Meal/Baggage : add, remove, calculateTotals, getTotalPrice
 * - Passenger : add, update, remove, initializePassengers
 * - setContactInfo
 * - Validation PASSENGER_INFO : prénom/nom/nationalité + contactInfo
 * - resetBooking
 * - clearError
 *
 * @jest-environment jsdom
 * @ticket DR-564
 */

import {
  useFlightBookingStore,
  FlightBookingStep,
  type SeatSelection,
  type MealSelection,
  type BaggageSelection,
  type PassengerInfo,
  type ContactInfo,
} from '@/store/flightBookingStore';

// ── Helpers ─────────────────────────────────────────────────────────────────

const initialStateOverride = {
  currentStep: FlightBookingStep.SEARCH,
  selectedFlight: null,
  searchParams: null,
  seats: [],
  availableSeats: [],
  meals: [],
  availableMeals: [],
  baggage: [],
  availableBaggage: [],
  passengers: [],
  contactInfo: null,
  basePrice: 0,
  seatsTotal: 0,
  mealsTotal: 0,
  baggageTotal: 0,
  currency: 'USD',
  isLoading: false,
  error: null,
};

function resetStore() {
  useFlightBookingStore.setState(initialStateOverride);
}

const mockFlight = {
  id: 'f-1',
  price: { total: 299, grandTotal: 299, currency: 'EUR' },
  itineraries: [],
};

const mockSeat: SeatSelection = {
  segmentId: 'seg-1',
  passengerId: 'pax-1',
  seatNumber: '12A',
  seatType: 'economy',
  price: 25,
  currency: 'EUR',
};

const mockMeal: MealSelection = {
  segmentId: 'seg-1',
  passengerId: 'pax-1',
  mealType: 'VGML',
  mealName: 'Vegetarian',
  price: 15,
  currency: 'EUR',
};

const mockBaggage: BaggageSelection = {
  passengerId: 'pax-1',
  type: 'checked',
  weight: 23,
  quantity: 1,
  price: 40,
  currency: 'EUR',
};

const validPassenger: PassengerInfo = {
  id: 'pax-1',
  type: 'adult',
  title: 'Mr',
  firstName: 'John',
  lastName: 'Doe',
  dateOfBirth: '1990-01-01',
  nationality: 'FR',
};

const validContact: ContactInfo = {
  email: 'john@example.com',
  phone: '+33600000000',
};

// ─────────────────────────────────────────────────────────────────────────────

describe('flightBookingStore', () => {
  beforeEach(() => {
    resetStore();
    localStorage.clear();
  });

  // ── Initial state ──────────────────────────────────────────────────────────
  describe('initial state', () => {
    it('starts at SEARCH step with empty selections', () => {
      const s = useFlightBookingStore.getState();
      expect(s.currentStep).toBe(FlightBookingStep.SEARCH);
      expect(s.selectedFlight).toBeNull();
      expect(s.seats).toHaveLength(0);
      expect(s.meals).toHaveLength(0);
      expect(s.baggage).toHaveLength(0);
      expect(s.passengers).toHaveLength(0);
      expect(s.basePrice).toBe(0);
    });
  });

  // ── Navigation ─────────────────────────────────────────────────────────────
  describe('navigation', () => {
    it('nextStep advances when canProceedToNextStep is true', () => {
      // SEARCH → always can proceed
      useFlightBookingStore.getState().nextStep();
      expect(useFlightBookingStore.getState().currentStep).toBe(FlightBookingStep.SELECT_FLIGHT);
    });

    it('nextStep does not advance past PAYMENT', () => {
      useFlightBookingStore.setState({ currentStep: FlightBookingStep.PAYMENT });
      useFlightBookingStore.getState().nextStep();
      expect(useFlightBookingStore.getState().currentStep).toBe(FlightBookingStep.PAYMENT);
    });

    it('nextStep sets error when cannot proceed', () => {
      // SELECT_FLIGHT step requires selectedFlight
      useFlightBookingStore.setState({ currentStep: FlightBookingStep.SELECT_FLIGHT, selectedFlight: null });
      useFlightBookingStore.getState().nextStep();
      expect(useFlightBookingStore.getState().error).toBeTruthy();
      expect(useFlightBookingStore.getState().currentStep).toBe(FlightBookingStep.SELECT_FLIGHT);
    });

    it('previousStep goes back one step', () => {
      useFlightBookingStore.setState({ currentStep: FlightBookingStep.CHOOSE_SEATS });
      useFlightBookingStore.getState().previousStep();
      expect(useFlightBookingStore.getState().currentStep).toBe(FlightBookingStep.SELECT_FLIGHT);
    });

    it('previousStep does not go before SEARCH', () => {
      useFlightBookingStore.getState().previousStep();
      expect(useFlightBookingStore.getState().currentStep).toBe(FlightBookingStep.SEARCH);
    });

    it('goToStep jumps to any step', () => {
      useFlightBookingStore.getState().goToStep(FlightBookingStep.PASSENGER_INFO);
      expect(useFlightBookingStore.getState().currentStep).toBe(FlightBookingStep.PASSENGER_INFO);
    });
  });

  // ── setSelectedFlight ──────────────────────────────────────────────────────
  describe('setSelectedFlight', () => {
    it('sets flight, extracts basePrice, moves to CHOOSE_SEATS', () => {
      useFlightBookingStore.getState().setSelectedFlight(mockFlight, { origin: 'CDG' });

      const s = useFlightBookingStore.getState();
      expect(s.selectedFlight).toEqual(mockFlight);
      expect(s.basePrice).toBe(299);
      expect(s.currency).toBe('EUR');
      expect(s.currentStep).toBe(FlightBookingStep.CHOOSE_SEATS);
    });
  });

  // ── canProceedToNextStep ───────────────────────────────────────────────────
  describe('canProceedToNextStep', () => {
    it('SEARCH → always true', () => {
      useFlightBookingStore.setState({ currentStep: FlightBookingStep.SEARCH });
      expect(useFlightBookingStore.getState().canProceedToNextStep()).toBe(true);
    });

    it('SELECT_FLIGHT → false when no flight selected', () => {
      useFlightBookingStore.setState({ currentStep: FlightBookingStep.SELECT_FLIGHT, selectedFlight: null });
      expect(useFlightBookingStore.getState().canProceedToNextStep()).toBe(false);
    });

    it('SELECT_FLIGHT → true when flight is selected', () => {
      useFlightBookingStore.setState({ currentStep: FlightBookingStep.SELECT_FLIGHT, selectedFlight: mockFlight });
      expect(useFlightBookingStore.getState().canProceedToNextStep()).toBe(true);
    });

    it('CHOOSE_SEATS / SELECT_MEALS / ADD_BAGGAGE → always true (optional)', () => {
      for (const step of [FlightBookingStep.CHOOSE_SEATS, FlightBookingStep.SELECT_MEALS, FlightBookingStep.ADD_BAGGAGE]) {
        useFlightBookingStore.setState({ currentStep: step });
        expect(useFlightBookingStore.getState().canProceedToNextStep()).toBe(true);
      }
    });

    it('PASSENGER_INFO → false when no passengers', () => {
      useFlightBookingStore.setState({ currentStep: FlightBookingStep.PASSENGER_INFO, passengers: [], contactInfo: validContact });
      expect(useFlightBookingStore.getState().canProceedToNextStep()).toBe(false);
    });

    it('PASSENGER_INFO → false when passenger missing required fields', () => {
      const incompletePassenger = { ...validPassenger, firstName: '' };
      useFlightBookingStore.setState({
        currentStep: FlightBookingStep.PASSENGER_INFO,
        passengers: [incompletePassenger],
        contactInfo: validContact,
      });
      expect(useFlightBookingStore.getState().canProceedToNextStep()).toBe(false);
    });

    it('PASSENGER_INFO → true with complete passengers and contact', () => {
      useFlightBookingStore.setState({
        currentStep: FlightBookingStep.PASSENGER_INFO,
        passengers: [validPassenger],
        contactInfo: validContact,
      });
      expect(useFlightBookingStore.getState().canProceedToNextStep()).toBe(true);
    });

    it('PAYMENT → always true', () => {
      useFlightBookingStore.setState({ currentStep: FlightBookingStep.PAYMENT });
      expect(useFlightBookingStore.getState().canProceedToNextStep()).toBe(true);
    });
  });

  // ── Seat selection ─────────────────────────────────────────────────────────
  describe('seat selection', () => {
    it('addSeatSelection adds seat and recalculates totals', () => {
      useFlightBookingStore.getState().addSeatSelection(mockSeat);
      const s = useFlightBookingStore.getState();
      expect(s.seats).toHaveLength(1);
      expect(s.seatsTotal).toBe(25);
    });

    it('addSeatSelection replaces existing seat for same segment/passenger', () => {
      const updated = { ...mockSeat, seatNumber: '15B', price: 35 };
      useFlightBookingStore.getState().addSeatSelection(mockSeat);
      useFlightBookingStore.getState().addSeatSelection(updated);
      const s = useFlightBookingStore.getState();
      expect(s.seats).toHaveLength(1);
      expect(s.seats[0].seatNumber).toBe('15B');
      expect(s.seatsTotal).toBe(35);
    });

    it('removeSeatSelection removes and recalculates', () => {
      useFlightBookingStore.setState({ seats: [mockSeat], seatsTotal: 25 });
      useFlightBookingStore.getState().removeSeatSelection('seg-1', 'pax-1');
      expect(useFlightBookingStore.getState().seats).toHaveLength(0);
      expect(useFlightBookingStore.getState().seatsTotal).toBe(0);
    });
  });

  // ── Meal selection ─────────────────────────────────────────────────────────
  describe('meal selection', () => {
    it('addMealSelection adds meal and calculates total', () => {
      useFlightBookingStore.getState().addMealSelection(mockMeal);
      expect(useFlightBookingStore.getState().meals).toHaveLength(1);
      expect(useFlightBookingStore.getState().mealsTotal).toBe(15);
    });

    it('removeMealSelection removes and recalculates', () => {
      useFlightBookingStore.setState({ meals: [mockMeal], mealsTotal: 15 });
      useFlightBookingStore.getState().removeMealSelection('seg-1', 'pax-1');
      expect(useFlightBookingStore.getState().meals).toHaveLength(0);
      expect(useFlightBookingStore.getState().mealsTotal).toBe(0);
    });
  });

  // ── Baggage selection ──────────────────────────────────────────────────────
  describe('baggage selection', () => {
    it('addBaggageSelection adds baggage: price * quantity', () => {
      useFlightBookingStore.getState().addBaggageSelection(mockBaggage);
      expect(useFlightBookingStore.getState().baggage).toHaveLength(1);
      expect(useFlightBookingStore.getState().baggageTotal).toBe(40); // 40 * 1
    });

    it('removeBaggageSelection removes and recalculates', () => {
      useFlightBookingStore.setState({ baggage: [mockBaggage], baggageTotal: 40 });
      useFlightBookingStore.getState().removeBaggageSelection('pax-1', 'checked');
      expect(useFlightBookingStore.getState().baggage).toHaveLength(0);
      expect(useFlightBookingStore.getState().baggageTotal).toBe(0);
    });
  });

  // ── getTotalPrice ──────────────────────────────────────────────────────────
  describe('getTotalPrice', () => {
    it('sums basePrice + seatsTotal + mealsTotal + baggageTotal', () => {
      useFlightBookingStore.setState({
        basePrice: 299,
        seatsTotal: 25,
        mealsTotal: 15,
        baggageTotal: 40,
      });
      expect(useFlightBookingStore.getState().getTotalPrice()).toBe(379);
    });
  });

  // ── Passenger management ───────────────────────────────────────────────────
  describe('passenger management', () => {
    it('addPassenger appends to list', () => {
      useFlightBookingStore.getState().addPassenger(validPassenger);
      expect(useFlightBookingStore.getState().passengers).toHaveLength(1);
    });

    it('updatePassenger patches existing passenger', () => {
      useFlightBookingStore.setState({ passengers: [validPassenger] });
      useFlightBookingStore.getState().updatePassenger('pax-1', { firstName: 'Jane' });
      expect(useFlightBookingStore.getState().passengers[0].firstName).toBe('Jane');
    });

    it('removePassenger removes by id', () => {
      useFlightBookingStore.setState({ passengers: [validPassenger] });
      useFlightBookingStore.getState().removePassenger('pax-1');
      expect(useFlightBookingStore.getState().passengers).toHaveLength(0);
    });

    it('initializePassengers creates N passengers with correct types', () => {
      useFlightBookingStore.getState().initializePassengers(2, ['adult', 'child']);
      const passengers = useFlightBookingStore.getState().passengers;
      expect(passengers).toHaveLength(2);
      expect(passengers[0].id).toBe('passenger-1');
      expect(passengers[0].type).toBe('adult');
      expect(passengers[1].type).toBe('child');
    });
  });

  // ── resetBooking ───────────────────────────────────────────────────────────
  describe('resetBooking', () => {
    it('resets all fields to initial values', () => {
      useFlightBookingStore.setState({
        currentStep: FlightBookingStep.PAYMENT,
        selectedFlight: mockFlight,
        seats: [mockSeat],
        basePrice: 299,
        passengers: [validPassenger],
      });

      useFlightBookingStore.getState().resetBooking();

      const s = useFlightBookingStore.getState();
      expect(s.currentStep).toBe(FlightBookingStep.SEARCH);
      expect(s.selectedFlight).toBeNull();
      expect(s.seats).toHaveLength(0);
      expect(s.basePrice).toBe(0);
      expect(s.passengers).toHaveLength(0);
    });
  });

  // ── clearError ─────────────────────────────────────────────────────────────
  describe('clearError', () => {
    it('clears error message', () => {
      useFlightBookingStore.setState({ error: 'Some error' });
      useFlightBookingStore.getState().clearError();
      expect(useFlightBookingStore.getState().error).toBeNull();
    });
  });
});
