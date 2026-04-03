/**
 * DR-565 — US-TEST-028
 * Tests unitaires : FlightsPage (pages/flights/index.tsx)
 *
 * Scénarios couverts :
 * - Rendu du titre via i18n
 * - Bouton back (navigate(-1))
 * - FlightBookingFlow rendu par défaut
 * - Toggle vers FlightPriceAnalysis au clic sur "price analysis"
 * - Retour vers FlightBookingFlow au second clic
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
  TrendingUp: () => <span data-testid="icon-trending-up" />,
}));

jest.mock('@/components/flights/FlightBookingFlow', () => ({
  __esModule: true,
  default: () => <div data-testid="flight-booking-flow">FlightBookingFlow</div>,
}));

jest.mock('@/components/flights/FlightPriceAnalysis', () => ({
  __esModule: true,
  default: () => <div data-testid="flight-price-analysis">FlightPriceAnalysis</div>,
}));

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import FlightsPage from '@/pages/flights/index';

// ─────────────────────────────────────────────────────────────────────────────

describe('FlightsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders page title via i18n key', () => {
    render(<FlightsPage />);
    expect(screen.getByText('page.title')).toBeInTheDocument();
  });

  it('renders FlightBookingFlow by default', () => {
    render(<FlightsPage />);
    expect(screen.getByTestId('flight-booking-flow')).toBeInTheDocument();
    expect(screen.queryByTestId('flight-price-analysis')).not.toBeInTheDocument();
  });

  it('clicking back button calls navigate(-1)', () => {
    render(<FlightsPage />);
    const backBtn = screen.getByRole('button', { name: /go back/i });
    fireEvent.click(backBtn);
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('clicking price analysis button shows FlightPriceAnalysis', () => {
    render(<FlightsPage />);
    const toggleBtn = screen.getByText('page.priceAnalysisButton');
    fireEvent.click(toggleBtn);
    expect(screen.getByTestId('flight-price-analysis')).toBeInTheDocument();
    expect(screen.queryByTestId('flight-booking-flow')).not.toBeInTheDocument();
  });

  it('clicking price analysis button twice returns to FlightBookingFlow', () => {
    render(<FlightsPage />);
    const toggleBtn = screen.getByText('page.priceAnalysisButton');
    fireEvent.click(toggleBtn);
    fireEvent.click(toggleBtn);
    expect(screen.getByTestId('flight-booking-flow')).toBeInTheDocument();
    expect(screen.queryByTestId('flight-price-analysis')).not.toBeInTheDocument();
  });
});
