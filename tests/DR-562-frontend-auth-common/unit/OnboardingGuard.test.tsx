/**
 * DR-562 — US-TEST-025
 * Tests unitaires : OnboardingGuard (components/auth)
 *
 * Scénarios couverts :
 * - Chemin exempté → render children direct
 * - Non authentifié → Navigate vers /auth
 * - Onboarding non démarré / en cours → Navigate vers /onboarding
 * - Onboarding complété → render children
 * - Onboarding skippé → render children
 * - requireOnboarding=false → render children même si onboarding pas complété
 * - Loading state → affiche le spinner de vérification
 *
 * @jest-environment jsdom
 * @ticket DR-562
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockNavigate = jest.fn();
const mockUseLocation = jest.fn(() => ({ pathname: '/dashboard' }));

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => mockUseLocation(),
  Navigate: ({ to }: { to: string }) => (
    <div data-testid="navigate" data-to={to} />
  ),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
    i18n: { changeLanguage: jest.fn() },
  }),
}));

const mockInitializeOnboarding = jest.fn().mockResolvedValue(undefined);
const mockGetOnboardingStatus = jest.fn(() => 'completed' as const);
let mockIsLoadingOnboarding = false;

jest.mock('@/store/onboardingStore', () => ({
  __esModule: true,
  default: () => ({
    initializeOnboarding: mockInitializeOnboarding,
    getOnboardingStatus: mockGetOnboardingStatus,
    isLoading: mockIsLoadingOnboarding,
  }),
}));

let mockIsAuthenticated: boolean | null = true;
let mockUser: { id: string } | null = { id: 'user-1' };

jest.mock('@/services/auth/AuthService', () => ({
  useAuth: () => ({
    isAuthenticated: mockIsAuthenticated,
    user: mockUser,
  }),
}));

jest.mock('@/constants/routes', () => ({
  ONBOARDING_EXEMPT_ROUTES: ['/auth', '/onboarding', '/public'],
}));

// ── Import SUT after mocks ────────────────────────────────────────────────────
import OnboardingGuard from '../../../../dreamscape-frontend/web-client/src/components/auth/OnboardingGuard';

// ─────────────────────────────────────────────────────────────────────────────

const ChildComponent = () => <div data-testid="child">Protected Content</div>;

function renderGuard(props?: { requireOnboarding?: boolean }) {
  return render(
    <OnboardingGuard {...props}>
      <ChildComponent />
    </OnboardingGuard>
  );
}

describe('OnboardingGuard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAuthenticated = true;
    mockUser = { id: 'user-1' };
    mockIsLoadingOnboarding = false;
    mockGetOnboardingStatus.mockReturnValue('completed');
    mockUseLocation.mockReturnValue({ pathname: '/dashboard' });
  });

  describe('Exempt paths', () => {
    it('renders children when pathname is an exempt route (/auth)', () => {
      mockUseLocation.mockReturnValue({ pathname: '/auth' });
      renderGuard();
      expect(screen.getByTestId('child')).toBeInTheDocument();
    });

    it('renders children when pathname starts with /onboarding', () => {
      mockUseLocation.mockReturnValue({ pathname: '/onboarding/step-1' });
      renderGuard();
      expect(screen.getByTestId('child')).toBeInTheDocument();
    });

    it('renders children when pathname starts with /public', () => {
      mockUseLocation.mockReturnValue({ pathname: '/public/info' });
      renderGuard();
      expect(screen.getByTestId('child')).toBeInTheDocument();
    });
  });

  describe('Authentication check', () => {
    it('redirects to /auth when user is NOT authenticated', () => {
      mockIsAuthenticated = false;
      mockUser = null;
      renderGuard();
      const nav = screen.getByTestId('navigate');
      expect(nav).toHaveAttribute('data-to', '/auth');
    });

    it('renders children when user IS authenticated and onboarding completed', () => {
      mockIsAuthenticated = true;
      renderGuard();
      expect(screen.getByTestId('child')).toBeInTheDocument();
    });
  });

  describe('Loading state', () => {
    it('shows loading/verifying UI while isLoading is true', () => {
      mockIsLoadingOnboarding = true;
      // isAuthenticated = null means auth not yet checked
      mockIsAuthenticated = null as any;
      renderGuard();
      // The guard shows a spinner while loading (not children, not navigate)
      expect(screen.queryByTestId('child')).not.toBeInTheDocument();
      expect(screen.queryByTestId('navigate')).not.toBeInTheDocument();
    });
  });

  describe('Onboarding status', () => {
    it('redirects to /onboarding when status is "not_started"', () => {
      mockGetOnboardingStatus.mockReturnValue('not_started');
      renderGuard();
      const nav = screen.getByTestId('navigate');
      expect(nav).toHaveAttribute('data-to', '/onboarding');
    });

    it('redirects to /onboarding when status is "in_progress"', () => {
      mockGetOnboardingStatus.mockReturnValue('in_progress');
      renderGuard();
      const nav = screen.getByTestId('navigate');
      expect(nav).toHaveAttribute('data-to', '/onboarding');
    });

    it('renders children when status is "completed"', () => {
      mockGetOnboardingStatus.mockReturnValue('completed');
      renderGuard();
      expect(screen.getByTestId('child')).toBeInTheDocument();
    });

    it('renders children when status is "skipped"', () => {
      mockGetOnboardingStatus.mockReturnValue('skipped');
      renderGuard();
      expect(screen.getByTestId('child')).toBeInTheDocument();
    });
  });

  describe('requireOnboarding prop', () => {
    it('renders children when requireOnboarding=false even if onboarding not started', () => {
      mockGetOnboardingStatus.mockReturnValue('not_started');
      renderGuard({ requireOnboarding: false });
      expect(screen.getByTestId('child')).toBeInTheDocument();
    });
  });

  describe('initializeOnboarding side-effect', () => {
    it('calls initializeOnboarding when authenticated user is present', () => {
      renderGuard();
      // Effect fires asynchronously; the mock should have been scheduled
      expect(mockInitializeOnboarding).toHaveBeenCalled();
    });
  });
});
