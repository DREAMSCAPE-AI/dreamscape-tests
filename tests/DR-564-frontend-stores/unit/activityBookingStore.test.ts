/**
 * DR-564 — US-TEST-027
 * Tests unitaires : activityBookingStore (store/activityBookingStore)
 *
 * Scénarios couverts :
 * - État initial (step SEARCH)
 * - Navigation : nextStep, previousStep, goToStep
 * - setSelectedActivity : extraire basePrice, step → DETAILS
 * - setNumberOfParticipants / setSelectedDate / setSelectedTime
 * - getTotalPrice = basePrice × numberOfParticipants
 * - addParticipant / updateParticipant / removeParticipant
 * - initializeParticipants
 * - canProceedToNextStep : par étape
 * - resetBooking
 *
 * @jest-environment jsdom
 * @ticket DR-564
 */

import {
  useActivityBookingStore,
  ActivityBookingStep,
  type ParticipantInfo,
  type ActivityContactInfo,
} from '@/store/activityBookingStore';

// ── Helpers ─────────────────────────────────────────────────────────────────

const initialStateOverride = {
  currentStep: ActivityBookingStep.SEARCH,
  selectedActivity: null,
  searchParams: null,
  numberOfParticipants: 1,
  selectedDate: '',
  selectedTime: undefined,
  participants: [],
  contactInfo: null,
  basePrice: 0,
  currency: 'USD',
  isLoading: false,
  error: null,
};

function resetStore() {
  useActivityBookingStore.setState(initialStateOverride);
}

const mockActivity = {
  id: 'act-1',
  name: 'Eiffel Tower Tour',
  price: { amount: 50, currency: 'EUR' },
};

const mockParticipant: ParticipantInfo = {
  id: 'participant-1',
  type: 'adult',
  title: 'Mr',
  firstName: 'Jean',
  lastName: 'Dupont',
};

const validContact: ActivityContactInfo = {
  email: 'jean@example.com',
  phone: '+33600000001',
};

// ─────────────────────────────────────────────────────────────────────────────

describe('activityBookingStore', () => {
  beforeEach(() => {
    resetStore();
    localStorage.clear();
  });

  // ── Initial state ──────────────────────────────────────────────────────────
  describe('initial state', () => {
    it('starts at SEARCH with 1 participant and basePrice 0', () => {
      const s = useActivityBookingStore.getState();
      expect(s.currentStep).toBe(ActivityBookingStep.SEARCH);
      expect(s.selectedActivity).toBeNull();
      expect(s.numberOfParticipants).toBe(1);
      expect(s.basePrice).toBe(0);
      expect(s.participants).toHaveLength(0);
    });
  });

  // ── Navigation ─────────────────────────────────────────────────────────────
  describe('navigation', () => {
    it('nextStep from SEARCH advances', () => {
      useActivityBookingStore.getState().nextStep();
      expect(useActivityBookingStore.getState().currentStep).toBe(ActivityBookingStep.SELECT_ACTIVITY);
    });

    it('nextStep does not advance past PAYMENT', () => {
      useActivityBookingStore.setState({ currentStep: ActivityBookingStep.PAYMENT });
      useActivityBookingStore.getState().nextStep();
      expect(useActivityBookingStore.getState().currentStep).toBe(ActivityBookingStep.PAYMENT);
    });

    it('nextStep sets error when cannot proceed', () => {
      useActivityBookingStore.setState({ currentStep: ActivityBookingStep.SELECT_ACTIVITY, selectedActivity: null });
      useActivityBookingStore.getState().nextStep();
      expect(useActivityBookingStore.getState().error).toBeTruthy();
      expect(useActivityBookingStore.getState().currentStep).toBe(ActivityBookingStep.SELECT_ACTIVITY);
    });

    it('previousStep goes back', () => {
      useActivityBookingStore.setState({ currentStep: ActivityBookingStep.DETAILS });
      useActivityBookingStore.getState().previousStep();
      expect(useActivityBookingStore.getState().currentStep).toBe(ActivityBookingStep.SELECT_ACTIVITY);
    });

    it('previousStep does not go before SEARCH', () => {
      useActivityBookingStore.getState().previousStep();
      expect(useActivityBookingStore.getState().currentStep).toBe(ActivityBookingStep.SEARCH);
    });

    it('goToStep jumps directly', () => {
      useActivityBookingStore.getState().goToStep(ActivityBookingStep.PAYMENT);
      expect(useActivityBookingStore.getState().currentStep).toBe(ActivityBookingStep.PAYMENT);
    });
  });

  // ── setSelectedActivity ────────────────────────────────────────────────────
  describe('setSelectedActivity', () => {
    it('sets activity, extracts basePrice, moves to DETAILS', () => {
      useActivityBookingStore.getState().setSelectedActivity(mockActivity, { latitude: 48.85 });

      const s = useActivityBookingStore.getState();
      expect(s.selectedActivity).toEqual(mockActivity);
      expect(s.basePrice).toBe(50);
      expect(s.currency).toBe('EUR');
      expect(s.currentStep).toBe(ActivityBookingStep.DETAILS);
    });

    it('defaults to basePrice 0 when no price', () => {
      useActivityBookingStore.getState().setSelectedActivity({ id: 'act-no-price' });
      expect(useActivityBookingStore.getState().basePrice).toBe(0);
    });
  });

  // ── Participant count & date ───────────────────────────────────────────────
  describe('setNumberOfParticipants', () => {
    it('updates participant count', () => {
      useActivityBookingStore.getState().setNumberOfParticipants(3);
      expect(useActivityBookingStore.getState().numberOfParticipants).toBe(3);
    });
  });

  describe('setSelectedDate', () => {
    it('updates selected date', () => {
      useActivityBookingStore.getState().setSelectedDate('2026-07-14');
      expect(useActivityBookingStore.getState().selectedDate).toBe('2026-07-14');
    });
  });

  describe('setSelectedTime', () => {
    it('updates selected time', () => {
      useActivityBookingStore.getState().setSelectedTime('10:00');
      expect(useActivityBookingStore.getState().selectedTime).toBe('10:00');
    });
  });

  // ── getTotalPrice ──────────────────────────────────────────────────────────
  describe('getTotalPrice', () => {
    it('returns basePrice × numberOfParticipants', () => {
      useActivityBookingStore.setState({ basePrice: 50, numberOfParticipants: 3 });
      expect(useActivityBookingStore.getState().getTotalPrice()).toBe(150);
    });

    it('returns 0 when basePrice is 0', () => {
      expect(useActivityBookingStore.getState().getTotalPrice()).toBe(0);
    });
  });

  // ── Participant management ─────────────────────────────────────────────────
  describe('participant management', () => {
    it('addParticipant appends', () => {
      useActivityBookingStore.getState().addParticipant(mockParticipant);
      expect(useActivityBookingStore.getState().participants).toHaveLength(1);
    });

    it('updateParticipant patches', () => {
      useActivityBookingStore.setState({ participants: [mockParticipant] });
      useActivityBookingStore.getState().updateParticipant('participant-1', { firstName: 'Marie' });
      expect(useActivityBookingStore.getState().participants[0].firstName).toBe('Marie');
    });

    it('removeParticipant removes by id', () => {
      useActivityBookingStore.setState({ participants: [mockParticipant] });
      useActivityBookingStore.getState().removeParticipant('participant-1');
      expect(useActivityBookingStore.getState().participants).toHaveLength(0);
    });

    it('initializeParticipants creates N entries', () => {
      useActivityBookingStore.getState().initializeParticipants(2, ['adult', 'child']);
      const participants = useActivityBookingStore.getState().participants;
      expect(participants).toHaveLength(2);
      expect(participants[0].id).toBe('participant-1');
      expect(participants[1].type).toBe('child');
    });
  });

  // ── canProceedToNextStep ───────────────────────────────────────────────────
  describe('canProceedToNextStep', () => {
    it('SEARCH → true', () => {
      expect(useActivityBookingStore.getState().canProceedToNextStep()).toBe(true);
    });

    it('SELECT_ACTIVITY → false when no activity', () => {
      useActivityBookingStore.setState({ currentStep: ActivityBookingStep.SELECT_ACTIVITY, selectedActivity: null });
      expect(useActivityBookingStore.getState().canProceedToNextStep()).toBe(false);
    });

    it('SELECT_ACTIVITY → true when activity selected', () => {
      useActivityBookingStore.setState({ currentStep: ActivityBookingStep.SELECT_ACTIVITY, selectedActivity: mockActivity });
      expect(useActivityBookingStore.getState().canProceedToNextStep()).toBe(true);
    });

    it('DETAILS → false when no date', () => {
      useActivityBookingStore.setState({
        currentStep: ActivityBookingStep.DETAILS,
        selectedDate: '',
        participants: [mockParticipant],
        contactInfo: validContact,
      });
      expect(useActivityBookingStore.getState().canProceedToNextStep()).toBe(false);
    });

    it('DETAILS → false when no participants', () => {
      useActivityBookingStore.setState({
        currentStep: ActivityBookingStep.DETAILS,
        selectedDate: '2026-07-14',
        participants: [],
        contactInfo: validContact,
      });
      expect(useActivityBookingStore.getState().canProceedToNextStep()).toBe(false);
    });

    it('DETAILS → true with date, complete participant and contact', () => {
      useActivityBookingStore.setState({
        currentStep: ActivityBookingStep.DETAILS,
        selectedDate: '2026-07-14',
        participants: [mockParticipant],
        contactInfo: validContact,
      });
      expect(useActivityBookingStore.getState().canProceedToNextStep()).toBe(true);
    });

    it('PAYMENT → true', () => {
      useActivityBookingStore.setState({ currentStep: ActivityBookingStep.PAYMENT });
      expect(useActivityBookingStore.getState().canProceedToNextStep()).toBe(true);
    });
  });

  // ── resetBooking ───────────────────────────────────────────────────────────
  describe('resetBooking', () => {
    it('resets all fields', () => {
      useActivityBookingStore.setState({
        currentStep: ActivityBookingStep.PAYMENT,
        selectedActivity: mockActivity,
        participants: [mockParticipant],
        basePrice: 50,
        numberOfParticipants: 3,
      });

      useActivityBookingStore.getState().resetBooking();

      const s = useActivityBookingStore.getState();
      expect(s.currentStep).toBe(ActivityBookingStep.SEARCH);
      expect(s.selectedActivity).toBeNull();
      expect(s.participants).toHaveLength(0);
      expect(s.basePrice).toBe(0);
      expect(s.numberOfParticipants).toBe(1);
    });
  });

  // ── clearError ─────────────────────────────────────────────────────────────
  describe('clearError', () => {
    it('sets error to null', () => {
      useActivityBookingStore.setState({ error: 'Oops' });
      useActivityBookingStore.getState().clearError();
      expect(useActivityBookingStore.getState().error).toBeNull();
    });
  });
});
