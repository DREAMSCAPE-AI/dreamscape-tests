/**
 * DR-564 — US-TEST-027
 * Tests unitaires : onboardingStore (store/onboardingStore)
 *
 * Scénarios couverts :
 * - État initial
 * - updateProfile : fusionne profile, marque hasUnsavedChanges
 * - skipOnboarding : set isSkipped = true
 * - clearError
 * - previousStep : décrémente ou reste à 0
 * - getIsFirstStep / getIsLastStep
 * - getOnboardingStatus : not_started, in_progress, completed (localStorage), skipped
 * - loadProfile : success (profile + progress), erreur
 * - getCompletionPercentage
 * - getAllRequiredStepsCompleted
 *
 * @jest-environment jsdom
 * @ticket DR-564
 */

// ── Mock onboardingService ─────────────────────────────────────────────────
const mockGetProfile = jest.fn();
const mockGetProgress = jest.fn();
const mockCreateProfile = jest.fn();
const mockUpdateStep = jest.fn();
const mockCompleteOnboarding = jest.fn();
const mockResetProfile = jest.fn();

jest.mock('@/services/user/OnboardingService', () => ({
  onboardingService: {
    getProfile: mockGetProfile,
    getProgress: mockGetProgress,
    createProfile: mockCreateProfile,
    updateStep: mockUpdateStep,
    completeOnboarding: mockCompleteOnboarding,
    resetProfile: mockResetProfile,
  },
}));

import useOnboardingStore from '@/store/onboardingStore';
import { ONBOARDING_STEPS } from '@/types/onboarding';

// ── Helpers ─────────────────────────────────────────────────────────────────

const initialStateOverride = {
  profile: {},
  progress: null,
  currentStepIndex: 0,
  isLoading: false,
  isSaving: false,
  error: null,
  hasUnsavedChanges: false,
  isSkipped: false,
};

function resetStore() {
  useOnboardingStore.setState(initialStateOverride);
}

// ─────────────────────────────────────────────────────────────────────────────

describe('onboardingStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
    localStorage.clear();
  });

  // ── Initial state ──────────────────────────────────────────────────────────
  describe('initial state', () => {
    it('starts at step 0 with empty profile', () => {
      const s = useOnboardingStore.getState();
      expect(s.profile).toEqual({});
      expect(s.progress).toBeNull();
      expect(s.currentStepIndex).toBe(0);
      expect(s.isSkipped).toBe(false);
      expect(s.hasUnsavedChanges).toBe(false);
    });
  });

  // ── updateProfile ──────────────────────────────────────────────────────────
  describe('updateProfile', () => {
    it('merges updates into profile', () => {
      useOnboardingStore.getState().updateProfile({ travelTypes: ['adventure', 'city'] });

      const s = useOnboardingStore.getState();
      expect(s.profile.travelTypes).toEqual(['adventure', 'city']);
      expect(s.hasUnsavedChanges).toBe(true);
    });

    it('preserves existing profile fields', () => {
      useOnboardingStore.setState({ profile: { travelStyle: 'BACKPACKER' } });
      useOnboardingStore.getState().updateProfile({ activityLevel: 'HIGH' });

      const s = useOnboardingStore.getState();
      expect(s.profile.travelStyle).toBe('BACKPACKER');
      expect(s.profile.activityLevel).toBe('HIGH');
    });

    it('clears error on update', () => {
      useOnboardingStore.setState({ error: 'Some error' });
      useOnboardingStore.getState().updateProfile({ travelStyle: 'LUXURY' });
      expect(useOnboardingStore.getState().error).toBeNull();
    });
  });

  // ── skipOnboarding ─────────────────────────────────────────────────────────
  describe('skipOnboarding', () => {
    it('sets isSkipped to true and clears unsaved changes', () => {
      useOnboardingStore.setState({ hasUnsavedChanges: true });
      useOnboardingStore.getState().skipOnboarding();

      const s = useOnboardingStore.getState();
      expect(s.isSkipped).toBe(true);
      expect(s.hasUnsavedChanges).toBe(false);
    });
  });

  // ── clearError ─────────────────────────────────────────────────────────────
  describe('clearError', () => {
    it('sets error to null', () => {
      useOnboardingStore.setState({ error: 'Error message' });
      useOnboardingStore.getState().clearError();
      expect(useOnboardingStore.getState().error).toBeNull();
    });
  });

  // ── previousStep ──────────────────────────────────────────────────────────
  describe('previousStep', () => {
    it('decrements currentStepIndex when not at first step', () => {
      useOnboardingStore.setState({ currentStepIndex: 3 });
      useOnboardingStore.getState().previousStep();
      expect(useOnboardingStore.getState().currentStepIndex).toBe(2);
    });

    it('does not go below 0 (stays at first step)', () => {
      useOnboardingStore.getState().previousStep();
      expect(useOnboardingStore.getState().currentStepIndex).toBe(0);
    });
  });

  // ── getIsFirstStep / getIsLastStep ─────────────────────────────────────────
  describe('getIsFirstStep / getIsLastStep', () => {
    it('getIsFirstStep returns true at index 0', () => {
      expect(useOnboardingStore.getState().getIsFirstStep()).toBe(true);
    });

    it('getIsFirstStep returns false at index > 0', () => {
      useOnboardingStore.setState({ currentStepIndex: 2 });
      expect(useOnboardingStore.getState().getIsFirstStep()).toBe(false);
    });

    it('getIsLastStep returns true at last step', () => {
      useOnboardingStore.setState({ currentStepIndex: ONBOARDING_STEPS.length - 1 });
      expect(useOnboardingStore.getState().getIsLastStep()).toBe(true);
    });

    it('getIsLastStep returns false before last step', () => {
      useOnboardingStore.setState({ currentStepIndex: 0 });
      expect(useOnboardingStore.getState().getIsLastStep()).toBe(false);
    });
  });

  // ── getOnboardingStatus ────────────────────────────────────────────────────
  describe('getOnboardingStatus', () => {
    it('returns not_started when no progress or profile', () => {
      expect(useOnboardingStore.getState().getOnboardingStatus()).toBe('not_started');
    });

    it('returns skipped when isSkipped is true', () => {
      useOnboardingStore.setState({ isSkipped: true });
      expect(useOnboardingStore.getState().getOnboardingStatus()).toBe('skipped');
    });

    it('returns completed when profile.isComplete is true', () => {
      useOnboardingStore.setState({ profile: { isComplete: true } });
      expect(useOnboardingStore.getState().getOnboardingStatus()).toBe('completed');
    });

    it('returns completed when progress.progressPercentage is 100', () => {
      useOnboardingStore.setState({
        progress: { totalSteps: 8, completedSteps: [], currentStep: '', progressPercentage: 100 },
      });
      expect(useOnboardingStore.getState().getOnboardingStatus()).toBe('completed');
    });

    it('returns completed when auth-storage has onboardingCompleted=true', () => {
      const authStorage = { state: { user: { onboardingCompleted: true } } };
      localStorage.setItem('auth-storage', JSON.stringify(authStorage));
      expect(useOnboardingStore.getState().getOnboardingStatus()).toBe('completed');
    });

    it('returns in_progress when some steps are completed', () => {
      useOnboardingStore.setState({
        progress: {
          totalSteps: 8,
          completedSteps: ['destinations', 'budget'],
          currentStep: 'travel_types',
          progressPercentage: 25,
        },
      });
      expect(useOnboardingStore.getState().getOnboardingStatus()).toBe('in_progress');
    });
  });

  // ── getCompletionPercentage ────────────────────────────────────────────────
  describe('getCompletionPercentage', () => {
    it('returns 0 when no progress', () => {
      expect(useOnboardingStore.getState().getCompletionPercentage()).toBe(0);
    });

    it('returns progressPercentage from progress', () => {
      useOnboardingStore.setState({
        progress: { totalSteps: 8, completedSteps: ['destinations'], currentStep: 'budget', progressPercentage: 50 },
      });
      expect(useOnboardingStore.getState().getCompletionPercentage()).toBe(50);
    });
  });

  // ── loadProfile ────────────────────────────────────────────────────────────
  describe('loadProfile', () => {
    it('sets profile and progress on success', async () => {
      const profileData = {
        success: true,
        data: {
          stepData: { travelTypes: ['city'], travelStyle: 'LUXURY' },
          isCompleted: false,
        },
      };
      const progressData = {
        success: true,
        data: {
          totalSteps: 8,
          completedSteps: ['destinations'],
          currentStep: 'budget',
          progressPercentage: 12,
        },
      };

      mockGetProfile.mockResolvedValue(profileData);
      mockGetProgress.mockResolvedValue(progressData);

      await useOnboardingStore.getState().loadProfile();

      const s = useOnboardingStore.getState();
      expect(s.profile).toEqual({ travelTypes: ['city'], travelStyle: 'LUXURY' });
      expect(s.progress?.progressPercentage).toBe(12);
      expect(s.isLoading).toBe(false);
    });

    it('sets error when both responses fail', async () => {
      mockGetProfile.mockResolvedValue({ success: false, error: 'Not found' });
      mockGetProgress.mockResolvedValue({ success: false, error: 'Not found' });

      await useOnboardingStore.getState().loadProfile();

      expect(useOnboardingStore.getState().error).toBeTruthy();
      expect(useOnboardingStore.getState().isLoading).toBe(false);
    });
  });

  // ── getCurrentStep ─────────────────────────────────────────────────────────
  describe('getCurrentStep', () => {
    it('returns first step at index 0', () => {
      const step = useOnboardingStore.getState().getCurrentStep();
      expect(step).toEqual(ONBOARDING_STEPS[0]);
    });

    it('returns correct step for given index', () => {
      useOnboardingStore.setState({ currentStepIndex: 2 });
      const step = useOnboardingStore.getState().getCurrentStep();
      expect(step).toEqual(ONBOARDING_STEPS[2]);
    });
  });
});
