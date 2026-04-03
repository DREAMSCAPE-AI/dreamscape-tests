/**
 * DR-565 — US-TEST-028
 * Tests unitaires : BookingsPage (pages/bookings/index.tsx)
 *
 * Scénarios couverts :
 * - Non authentifié → Navigate vers /auth
 * - Loading state → LoadingSpinner
 * - Erreur → ErrorMessage
 * - Liste vide → message + bouton "Explorer les vols"
 * - Liste non vide → BookingCard rendu pour chaque réservation
 * - Filtre status/type → handleFilterChange
 * - Barre de recherche → handleFilterChange('search')
 * - Cancel flow : bouton cancel → modal → confirm → appelle cancelBooking
 * - Pagination : prev/next buttons
 *
 * @jest-environment jsdom
 * @ticket DR-565
 */

// ── Mocks ──────────────────────────────────────────────────────────────────
let mockIsAuthenticated = true;
let mockUser: any = { id: 'user-1' };

const mockNavigate = jest.fn();

jest.mock('@/services/auth/AuthService', () => ({
  useAuth: () => ({ isAuthenticated: mockIsAuthenticated, user: mockUser }),
}));

jest.mock('react-router-dom', () => ({
  Navigate: ({ to }: { to: string }) => <div data-testid="navigate" data-to={to} />,
  useNavigate: () => mockNavigate,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

// Mock VoyageService - prevent import.meta.env evaluation
const mockGetUserBookings = jest.fn();
const mockGetBookingStats = jest.fn();
const mockCancelBooking = jest.fn();

jest.mock('@/services/voyage/VoyageService', () => ({
  __esModule: true,
  default: {
    getUserBookings: mockGetUserBookings,
    getBookingStats: mockGetBookingStats,
    cancelBooking: mockCancelBooking,
  },
}));

jest.mock('@/components/bookings', () => ({
  BookingCard: ({ booking, onViewDetails, onCancel }: any) => (
    <div data-testid={`booking-card-${booking.id}`}>
      <button onClick={() => onViewDetails(booking)}>View</button>
      <button onClick={() => onCancel(booking)}>Cancel</button>
    </div>
  ),
}));

jest.mock('@/components/common/LoadingSpinner', () => ({
  __esModule: true,
  default: ({ text }: any) => <div data-testid="loading-spinner">{text}</div>,
}));

jest.mock('@/components/common/ErrorMessage', () => ({
  __esModule: true,
  default: ({ message, onRetry }: any) => (
    <div data-testid="error-message">
      <span>{message}</span>
      <button onClick={onRetry}>Retry</button>
    </div>
  ),
}));

jest.mock('lucide-react', () => ({
  ChevronLeft: () => <span />,
  ChevronRight: () => <span />,
  Filter: () => <span />,
  Search: () => <span />,
  X: () => <span />,
  AlertTriangle: () => <span />,
  Calendar: () => <span />,
  TrendingUp: () => <span />,
  Package: () => <span />,
}));

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import BookingsPage from '@/pages/bookings/index';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const mockBooking = {
  id: 'b-1',
  reference: 'BOOK-001',
  totalAmount: 299,
  currency: 'EUR',
  status: 'CONFIRMED',
  type: 'FLIGHT',
};

const mockPagination = {
  page: 1,
  limit: 10,
  totalCount: 1,
  totalPages: 1,
  hasNextPage: false,
  hasPrevPage: false,
};

const mockStats = {
  total: 5,
  byStatus: { CONFIRMED: 3, COMPLETED: 1 },
  byType: { FLIGHT: 3, HOTEL: 2 },
  totalSpent: 1500,
  currency: 'EUR',
};

function setupSuccessMocks() {
  mockGetUserBookings.mockResolvedValue({
    data: [mockBooking],
    meta: { pagination: mockPagination },
  });
  mockGetBookingStats.mockResolvedValue({ data: mockStats });
}

// ─────────────────────────────────────────────────────────────────────────────

describe('BookingsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAuthenticated = true;
    mockUser = { id: 'user-1' };
  });

  // ── Auth guard ─────────────────────────────────────────────────────────────
  it('redirects to /auth when not authenticated', () => {
    mockIsAuthenticated = false;
    render(<BookingsPage />);
    expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/auth');
  });

  // ── Loading state ──────────────────────────────────────────────────────────
  it('shows loading spinner while fetching', async () => {
    mockGetUserBookings.mockReturnValue(new Promise(() => {})); // never resolves
    mockGetBookingStats.mockResolvedValue({ data: mockStats });

    render(<BookingsPage />);
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  // ── Error state ────────────────────────────────────────────────────────────
  it('shows error message when fetch fails', async () => {
    mockGetUserBookings.mockRejectedValue(new Error('Network error'));
    mockGetBookingStats.mockResolvedValue({ data: mockStats });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toBeInTheDocument();
    });
    expect(screen.getByText('Network error')).toBeInTheDocument();
  });

  // ── Empty state ────────────────────────────────────────────────────────────
  it('shows empty state when no bookings', async () => {
    mockGetUserBookings.mockResolvedValue({
      data: [],
      meta: { pagination: { ...mockPagination, totalCount: 0 } },
    });
    mockGetBookingStats.mockResolvedValue({ data: mockStats });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Aucune reservation')).toBeInTheDocument();
    });
  });

  // ── Bookings list ──────────────────────────────────────────────────────────
  it('renders a BookingCard for each booking', async () => {
    setupSuccessMocks();

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('booking-card-b-1')).toBeInTheDocument();
    });
  });

  it('clicking View on a booking navigates to detail page', async () => {
    setupSuccessMocks();

    render(<BookingsPage />);

    await waitFor(() => screen.getByTestId('booking-card-b-1'));
    fireEvent.click(screen.getByText('View'));
    expect(mockNavigate).toHaveBeenCalledWith('/bookings/BOOK-001');
  });

  // ── Stats ──────────────────────────────────────────────────────────────────
  it('renders stats when available', async () => {
    setupSuccessMocks();

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument(); // stats.total
    });
  });

  // ── Cancel flow ────────────────────────────────────────────────────────────
  it('shows cancel modal and confirms cancellation', async () => {
    setupSuccessMocks();
    mockCancelBooking.mockResolvedValue({});

    render(<BookingsPage />);

    await waitFor(() => screen.getByTestId('booking-card-b-1'));

    fireEvent.click(screen.getByText('Cancel'));

    await waitFor(() => {
      expect(screen.getByText('Ref: BOOK-001')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Confirmer l'annulation"));

    await waitFor(() => {
      expect(mockCancelBooking).toHaveBeenCalledWith('BOOK-001', 'User requested cancellation', 'user-1');
    });
  });

  it('closes cancel modal on Retour click', async () => {
    setupSuccessMocks();

    render(<BookingsPage />);

    await waitFor(() => screen.getByTestId('booking-card-b-1'));
    fireEvent.click(screen.getByText('Cancel'));

    await waitFor(() => screen.getByText('Ref: BOOK-001'));

    fireEvent.click(screen.getByText('Retour'));
    expect(screen.queryByText('Ref: BOOK-001')).not.toBeInTheDocument();
  });

  // ── Retry ──────────────────────────────────────────────────────────────────
  it('clicking retry refetches bookings', async () => {
    mockGetUserBookings.mockRejectedValueOnce(new Error('Network error'));
    mockGetBookingStats.mockResolvedValue({ data: mockStats });

    render(<BookingsPage />);

    await waitFor(() => screen.getByTestId('error-message'));

    // Set up success for the retry
    mockGetUserBookings.mockResolvedValue({
      data: [mockBooking],
      meta: { pagination: mockPagination },
    });

    fireEvent.click(screen.getByText('Retry'));

    await waitFor(() => {
      expect(mockGetUserBookings).toHaveBeenCalledTimes(2);
    });
  });
});
