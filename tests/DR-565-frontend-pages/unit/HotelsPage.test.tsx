/**
 * DR-565 — US-TEST-028
 * Tests unitaires : HotelsPage (pages/hotels/index.tsx)
 *
 * Scénarios couverts :
 * - Rendu du titre via i18n
 * - Bouton back (navigate(-1)) avec aria-label traduit
 * - HotelBookingFlow rendu
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

jest.mock('@/components/hotels/HotelBookingFlow', () => ({
  __esModule: true,
  default: () => <div data-testid="hotel-booking-flow">HotelBookingFlow</div>,
}));

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import HotelsPage from '@/pages/hotels/index';

// ─────────────────────────────────────────────────────────────────────────────

describe('HotelsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders page title', () => {
    render(<HotelsPage />);
    expect(screen.getByText('page.title')).toBeInTheDocument();
  });

  it('renders HotelBookingFlow', () => {
    render(<HotelsPage />);
    expect(screen.getByTestId('hotel-booking-flow')).toBeInTheDocument();
  });

  it('clicking back button calls navigate(-1)', () => {
    render(<HotelsPage />);
    const backBtn = screen.getByLabelText('page.ariaLabel.goBack');
    fireEvent.click(backBtn);
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });
});
