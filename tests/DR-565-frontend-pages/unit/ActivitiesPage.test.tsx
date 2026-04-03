/**
 * DR-565 — US-TEST-028
 * Tests unitaires : ActivitiesPage (pages/activities/index.tsx)
 *
 * Scénarios couverts :
 * - Rendu du titre via i18n
 * - Bouton back (navigate(-1))
 * - ActivityBookingFlow rendu
 *
 * @jest-environment jsdom
 * @ticket DR-565
 */

// ── Mocks ──────────────────────────────────────────────────────────────────
const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'fr' },
  }),
}));

jest.mock('lucide-react', () => ({
  ArrowLeft: () => <span data-testid="icon-arrow-left" />,
}));

jest.mock('@/components/activities/ActivityBookingFlow', () => ({
  __esModule: true,
  default: () => <div data-testid="activity-booking-flow">ActivityBookingFlow</div>,
}));

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ActivitiesPage from '@/pages/activities/index';

// ─────────────────────────────────────────────────────────────────────────────

describe('ActivitiesPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders page title', () => {
    render(<ActivitiesPage />);
    expect(screen.getByText('page.title')).toBeInTheDocument();
  });

  it('renders ActivityBookingFlow', () => {
    render(<ActivitiesPage />);
    expect(screen.getByTestId('activity-booking-flow')).toBeInTheDocument();
  });

  it('clicking back button calls navigate(-1)', () => {
    render(<ActivitiesPage />);
    const backBtn = screen.getByLabelText('page.ariaLabel.goBack');
    fireEvent.click(backBtn);
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });
});
