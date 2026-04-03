/**
 * DR-565 — US-TEST-028
 * Tests unitaires : CheckoutPage (pages/checkout/index.tsx)
 *
 * Scénarios couverts :
 * - Non authentifié → error message + redirection vers /auth
 * - Pas de checkout data → "No checkout data found" + navigate(-1)
 * - Publishable key manquante → "Invalid payment configuration"
 * - Données valides → "Booking Summary" + référence affiché
 * - Bouton "Return to Cart" → navigate(-1)
 *
 * @jest-environment jsdom
 * @ticket DR-565
 */

// ── Mocks ──────────────────────────────────────────────────────────────────
let mockIsAuthenticated = true;
// Use a stable object reference to prevent infinite re-renders (location is a useEffect dep)
const mockLocationObject: { state: any } = { state: {} };
const mockNavigate = jest.fn();

jest.mock('@/services/auth/AuthService', () => ({
  useAuth: () => ({ isAuthenticated: mockIsAuthenticated }),
}));

jest.mock('react-router-dom', () => ({
  useLocation: () => mockLocationObject,
  useNavigate: () => mockNavigate,
}));

jest.mock('@/utils/airportCodes', () => ({
  getAirportInfo: () => null,
}));

// Stripe mocks
jest.mock('@stripe/stripe-js', () => ({
  loadStripe: jest.fn().mockResolvedValue({}),
}));

jest.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: any) => <div data-testid="stripe-elements">{children}</div>,
}));

jest.mock('@/pages/checkout/StripeCheckoutForm', () => ({
  __esModule: true,
  default: () => <div data-testid="stripe-checkout-form" />,
}));

// Silence setTimeout
jest.useFakeTimers();

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import CheckoutPage from '@/pages/checkout/index';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const validCheckoutData = {
  bookingReference: 'BOOK-001',
  bookingId: 'bid-1',
  totalAmount: 299,
  currency: 'EUR',
  items: [
    { type: 'FLIGHT', itemId: 'f1', itemData: {}, quantity: 1, price: 299, currency: 'EUR' },
  ],
  payment: {
    clientSecret: 'pi_secret_xxx',
    publishableKey: 'pk_test_xxx',
    paymentIntentId: 'pi_xxx',
    amount: 29900,
    currency: 'EUR',
  },
};

// ─────────────────────────────────────────────────────────────────────────────

describe('CheckoutPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAuthenticated = true;
    mockLocationObject.state = {};
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  it('shows error and schedules redirect when not authenticated', async () => {
    mockIsAuthenticated = false;

    render(<CheckoutPage />);

    await waitFor(() => {
      expect(screen.getByText(/Please log in/i)).toBeInTheDocument();
    });

    jest.runAllTimers();
    expect(mockNavigate).toHaveBeenCalledWith('/auth', expect.objectContaining({ state: { from: '/checkout' } }));
  });

  it('shows "No checkout data found" when no state', async () => {
    mockLocationObject.state = {};

    render(<CheckoutPage />);

    await waitFor(() => {
      expect(screen.getByText(/No checkout data found/i)).toBeInTheDocument();
    });

    jest.runAllTimers();
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('shows "Invalid payment configuration" when publishableKey is missing', async () => {
    mockLocationObject.state = {
      checkoutData: {
        ...validCheckoutData,
        payment: { ...validCheckoutData.payment, publishableKey: null },
      },
    };

    render(<CheckoutPage />);

    await waitFor(() => {
      expect(screen.getByText(/Invalid payment configuration/i)).toBeInTheDocument();
    });
  });

  it('renders Booking Summary with reference for valid checkout data', async () => {
    mockLocationObject.state = { checkoutData: validCheckoutData };

    render(<CheckoutPage />);

    await waitFor(() => {
      expect(screen.getByText('Booking Summary')).toBeInTheDocument();
      expect(screen.getByText(/BOOK-001/)).toBeInTheDocument();
    });
  });

  it('renders Stripe Elements for valid checkout data', async () => {
    mockLocationObject.state = { checkoutData: validCheckoutData };

    render(<CheckoutPage />);

    await waitFor(() => {
      expect(screen.getByTestId('stripe-elements')).toBeInTheDocument();
    });
  });

  it('clicking Return to Cart calls navigate(-1)', async () => {
    // No checkout data to show the error state with the Return button
    mockLocationObject.state = {};

    render(<CheckoutPage />);

    await waitFor(() => expect(screen.getByText('Return to Cart')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Return to Cart'));
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });
});
