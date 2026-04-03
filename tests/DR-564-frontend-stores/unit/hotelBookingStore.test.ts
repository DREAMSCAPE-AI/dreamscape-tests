/**
 * DR-564 — US-TEST-027
 * Tests unitaires : hotelBookingStore (store/hotelBookingStore)
 *
 * Scénarios couverts :
 * - État initial (step SEARCH)
 * - Navigation : nextStep (avec validation), previousStep, goToStep
 * - setSelectedHotel : prix extrait, step → HOTEL_DETAILS, calcul des nuits
 * - calculateNumberOfNights : 2026-06-01 → 2026-06-05 = 4 nuits
 * - addRoomSelection / updateRoomSelection / removeRoomSelection
 * - calculateTotals : roomsTotal + 15% taxesAndFees
 * - getTotalPrice = roomsTotal + taxesAndFees
 * - addGuest / updateGuest / removeGuest / initializeGuests
 * - canProceedToNextStep : par étape
 * - resetBooking
 *
 * @jest-environment jsdom
 * @ticket DR-564
 */

import {
  useHotelBookingStore,
  HotelBookingStep,
  type RoomSelection,
  type GuestInfo,
  type HotelContactInfo,
} from '@/store/hotelBookingStore';

// ── Helpers ─────────────────────────────────────────────────────────────────

const initialStateOverride = {
  currentStep: HotelBookingStep.SEARCH,
  selectedHotel: null,
  searchParams: null,
  rooms: [],
  checkInDate: '',
  checkOutDate: '',
  numberOfNights: 0,
  guests: [],
  contactInfo: null,
  basePrice: 0,
  roomsTotal: 0,
  taxesAndFees: 0,
  currency: 'USD',
  isLoading: false,
  error: null,
};

function resetStore() {
  useHotelBookingStore.setState(initialStateOverride);
}

const mockHotel = {
  hotelId: 'H1',
  name: 'Grand Hotel Paris',
  price: { total: 200, currency: 'EUR' },
};

const mockRoom: RoomSelection = {
  roomId: 'room-1',
  roomType: 'STANDARD',
  roomName: 'Standard Double',
  bedType: 'DOUBLE',
  quantity: 1,
  guests: { adults: 2, children: 0 },
  price: 150,
  currency: 'EUR',
};

const primaryGuest: GuestInfo = {
  id: 'guest-primary',
  type: 'primary',
  title: 'Mr',
  firstName: 'Alice',
  lastName: 'Martin',
};

const validContact: HotelContactInfo = {
  email: 'alice@example.com',
  phone: '+33700000000',
};

// ─────────────────────────────────────────────────────────────────────────────

describe('hotelBookingStore', () => {
  beforeEach(() => {
    resetStore();
    localStorage.clear();
  });

  // ── Initial state ──────────────────────────────────────────────────────────
  describe('initial state', () => {
    it('starts at SEARCH with empty data', () => {
      const s = useHotelBookingStore.getState();
      expect(s.currentStep).toBe(HotelBookingStep.SEARCH);
      expect(s.selectedHotel).toBeNull();
      expect(s.rooms).toHaveLength(0);
      expect(s.numberOfNights).toBe(0);
      expect(s.basePrice).toBe(0);
    });
  });

  // ── Navigation ─────────────────────────────────────────────────────────────
  describe('navigation', () => {
    it('nextStep from SEARCH advances to SELECT_HOTEL', () => {
      useHotelBookingStore.getState().nextStep();
      expect(useHotelBookingStore.getState().currentStep).toBe(HotelBookingStep.SELECT_HOTEL);
    });

    it('nextStep does not advance past PAYMENT', () => {
      useHotelBookingStore.setState({ currentStep: HotelBookingStep.PAYMENT });
      useHotelBookingStore.getState().nextStep();
      expect(useHotelBookingStore.getState().currentStep).toBe(HotelBookingStep.PAYMENT);
    });

    it('nextStep sets error when cannot proceed', () => {
      // SELECT_HOTEL requires selectedHotel
      useHotelBookingStore.setState({ currentStep: HotelBookingStep.SELECT_HOTEL, selectedHotel: null });
      useHotelBookingStore.getState().nextStep();
      expect(useHotelBookingStore.getState().error).toBeTruthy();
    });

    it('previousStep goes back one step', () => {
      useHotelBookingStore.setState({ currentStep: HotelBookingStep.HOTEL_DETAILS });
      useHotelBookingStore.getState().previousStep();
      expect(useHotelBookingStore.getState().currentStep).toBe(HotelBookingStep.SELECT_HOTEL);
    });

    it('previousStep does not go before SEARCH', () => {
      useHotelBookingStore.getState().previousStep();
      expect(useHotelBookingStore.getState().currentStep).toBe(HotelBookingStep.SEARCH);
    });

    it('goToStep jumps directly', () => {
      useHotelBookingStore.getState().goToStep(HotelBookingStep.PASSENGER_INFO);
      expect(useHotelBookingStore.getState().currentStep).toBe(HotelBookingStep.PASSENGER_INFO);
    });
  });

  // ── setSelectedHotel ───────────────────────────────────────────────────────
  describe('setSelectedHotel', () => {
    it('sets hotel, extracts price, advances to HOTEL_DETAILS', () => {
      const searchParams = { checkInDate: '2026-06-01', checkOutDate: '2026-06-05' };
      useHotelBookingStore.getState().setSelectedHotel(mockHotel, searchParams);

      const s = useHotelBookingStore.getState();
      expect(s.selectedHotel).toEqual(mockHotel);
      expect(s.basePrice).toBe(200);
      expect(s.currency).toBe('EUR');
      expect(s.currentStep).toBe(HotelBookingStep.HOTEL_DETAILS);
      expect(s.checkInDate).toBe('2026-06-01');
      expect(s.checkOutDate).toBe('2026-06-05');
    });
  });

  // ── calculateNumberOfNights ────────────────────────────────────────────────
  describe('calculateNumberOfNights', () => {
    it('computes correct number of nights', () => {
      useHotelBookingStore.setState({
        checkInDate: '2026-06-01',
        checkOutDate: '2026-06-05',
      });
      useHotelBookingStore.getState().calculateNumberOfNights();
      expect(useHotelBookingStore.getState().numberOfNights).toBe(4);
    });

    it('sets 0 nights when dates are missing', () => {
      useHotelBookingStore.setState({ checkInDate: '', checkOutDate: '' });
      useHotelBookingStore.getState().calculateNumberOfNights();
      expect(useHotelBookingStore.getState().numberOfNights).toBe(0);
    });

    it('setCheckInDate / setCheckOutDate trigger recalculation', () => {
      useHotelBookingStore.getState().setCheckInDate('2026-07-01');
      useHotelBookingStore.getState().setCheckOutDate('2026-07-03');
      expect(useHotelBookingStore.getState().numberOfNights).toBe(2);
    });
  });

  // ── Room selection ─────────────────────────────────────────────────────────
  describe('room selection', () => {
    it('addRoomSelection appends room and recalculates', () => {
      useHotelBookingStore.setState({ numberOfNights: 4 });
      useHotelBookingStore.getState().addRoomSelection(mockRoom);
      const s = useHotelBookingStore.getState();
      expect(s.rooms).toHaveLength(1);
      // roomsTotal = 150 * 1 * 4 = 600
      expect(s.roomsTotal).toBe(600);
      // taxesAndFees = 600 * 0.15 = 90
      expect(s.taxesAndFees).toBe(90);
    });

    it('updateRoomSelection patches room and recalculates', () => {
      useHotelBookingStore.setState({ rooms: [mockRoom], numberOfNights: 2 });
      useHotelBookingStore.getState().updateRoomSelection('room-1', { quantity: 2 });
      const s = useHotelBookingStore.getState();
      expect(s.rooms[0].quantity).toBe(2);
      // roomsTotal = 150 * 2 * 2 = 600
      expect(s.roomsTotal).toBe(600);
    });

    it('removeRoomSelection removes and recalculates', () => {
      useHotelBookingStore.setState({ rooms: [mockRoom], numberOfNights: 4, roomsTotal: 600, taxesAndFees: 90 });
      useHotelBookingStore.getState().removeRoomSelection('room-1');
      const s = useHotelBookingStore.getState();
      expect(s.rooms).toHaveLength(0);
      expect(s.roomsTotal).toBe(0);
    });
  });

  // ── getTotalPrice ──────────────────────────────────────────────────────────
  describe('getTotalPrice', () => {
    it('returns roomsTotal + taxesAndFees', () => {
      useHotelBookingStore.setState({ roomsTotal: 600, taxesAndFees: 90 });
      expect(useHotelBookingStore.getState().getTotalPrice()).toBe(690);
    });

    it('15% tax rate is correct', () => {
      useHotelBookingStore.setState({ numberOfNights: 1 });
      useHotelBookingStore.getState().addRoomSelection({ ...mockRoom, price: 100 });
      const s = useHotelBookingStore.getState();
      expect(s.roomsTotal).toBe(100);
      expect(s.taxesAndFees).toBeCloseTo(15, 5);
      expect(s.getTotalPrice()).toBeCloseTo(115, 5);
    });
  });

  // ── Guest management ───────────────────────────────────────────────────────
  describe('guest management', () => {
    it('addGuest appends', () => {
      useHotelBookingStore.getState().addGuest(primaryGuest);
      expect(useHotelBookingStore.getState().guests).toHaveLength(1);
    });

    it('updateGuest patches fields', () => {
      useHotelBookingStore.setState({ guests: [primaryGuest] });
      useHotelBookingStore.getState().updateGuest('guest-primary', { firstName: 'Bob' });
      expect(useHotelBookingStore.getState().guests[0].firstName).toBe('Bob');
    });

    it('removeGuest removes by id', () => {
      useHotelBookingStore.setState({ guests: [primaryGuest] });
      useHotelBookingStore.getState().removeGuest('guest-primary');
      expect(useHotelBookingStore.getState().guests).toHaveLength(0);
    });

    it('initializeGuests creates primary guest when true', () => {
      useHotelBookingStore.getState().initializeGuests(true);
      const guests = useHotelBookingStore.getState().guests;
      expect(guests).toHaveLength(1);
      expect(guests[0].id).toBe('guest-primary');
      expect(guests[0].type).toBe('primary');
    });
  });

  // ── canProceedToNextStep ───────────────────────────────────────────────────
  describe('canProceedToNextStep', () => {
    it('SEARCH → true', () => {
      expect(useHotelBookingStore.getState().canProceedToNextStep()).toBe(true);
    });

    it('SELECT_HOTEL → false when no hotel', () => {
      useHotelBookingStore.setState({ currentStep: HotelBookingStep.SELECT_HOTEL, selectedHotel: null });
      expect(useHotelBookingStore.getState().canProceedToNextStep()).toBe(false);
    });

    it('SELECT_HOTEL → true when hotel selected', () => {
      useHotelBookingStore.setState({ currentStep: HotelBookingStep.SELECT_HOTEL, selectedHotel: mockHotel });
      expect(useHotelBookingStore.getState().canProceedToNextStep()).toBe(true);
    });

    it('HOTEL_DETAILS → false when no rooms or no dates', () => {
      useHotelBookingStore.setState({
        currentStep: HotelBookingStep.HOTEL_DETAILS,
        rooms: [],
        checkInDate: '',
        checkOutDate: '',
      });
      expect(useHotelBookingStore.getState().canProceedToNextStep()).toBe(false);
    });

    it('HOTEL_DETAILS → true with room and dates', () => {
      useHotelBookingStore.setState({
        currentStep: HotelBookingStep.HOTEL_DETAILS,
        rooms: [mockRoom],
        checkInDate: '2026-06-01',
        checkOutDate: '2026-06-05',
      });
      expect(useHotelBookingStore.getState().canProceedToNextStep()).toBe(true);
    });

    it('PASSENGER_INFO → true with complete guest and contact', () => {
      useHotelBookingStore.setState({
        currentStep: HotelBookingStep.PASSENGER_INFO,
        guests: [primaryGuest],
        contactInfo: validContact,
      });
      expect(useHotelBookingStore.getState().canProceedToNextStep()).toBe(true);
    });
  });

  // ── resetBooking ───────────────────────────────────────────────────────────
  describe('resetBooking', () => {
    it('resets all state to initial values', () => {
      useHotelBookingStore.setState({
        currentStep: HotelBookingStep.PAYMENT,
        selectedHotel: mockHotel,
        rooms: [mockRoom],
        basePrice: 200,
        roomsTotal: 600,
      });

      useHotelBookingStore.getState().resetBooking();

      const s = useHotelBookingStore.getState();
      expect(s.currentStep).toBe(HotelBookingStep.SEARCH);
      expect(s.selectedHotel).toBeNull();
      expect(s.rooms).toHaveLength(0);
      expect(s.basePrice).toBe(0);
      expect(s.roomsTotal).toBe(0);
    });
  });
});
