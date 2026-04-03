/**
 * DR-566 — US-TEST-029
 * Tests unitaires : CartSummary (components/cart/CartSummary)
 *
 * Scénarios couverts :
 * - Rendu du prix total et nombre d'articles
 * - Bouton checkout appelle onCheckout
 * - Bouton désactivé quand isCheckingOut=true
 * - Timer affiché quand expiresAt est fourni
 * - Bouton "Extend" visible quand temps restant < 5 minutes
 * - Bouton "Extend" absent quand expiry > 5 min
 * - onExtendExpiry appelé au clic
 * - Pas de timer quand expiresAt=null
 *
 * @jest-environment jsdom
 * @ticket DR-566
 */

// ── Mocks ──────────────────────────────────────────────────────────────────
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));

jest.mock('lucide-react', () => ({
  ShoppingBag: () => <span data-testid="icon-bag" />,
  Clock: () => <span data-testid="icon-clock" />,
}));

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { CartSummary } from '@/components/cart/CartSummary';

// ─────────────────────────────────────────────────────────────────────────────

const defaultProps = {
  totalPrice: 299.99,
  currency: 'EUR',
  itemCount: 2,
  expiresAt: null,
  onCheckout: jest.fn(),
  onExtendExpiry: jest.fn(),
  isCheckingOut: false,
};

describe('CartSummary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  // ── Price & items ──────────────────────────────────────────────────────────
  it('renders total price', () => {
    render(<CartSummary {...defaultProps} />);
    // Price appears twice (items line + total line) — both are valid
    expect(screen.getAllByText(/299/).length).toBeGreaterThanOrEqual(1);
  });

  // ── Checkout button ────────────────────────────────────────────────────────
  it('calls onCheckout when checkout button clicked', () => {
    render(<CartSummary {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /checkout|proceder|commander/i }));
    expect(defaultProps.onCheckout).toHaveBeenCalled();
  });

  it('checkout button is disabled when isCheckingOut=true', () => {
    render(<CartSummary {...defaultProps} isCheckingOut={true} />);
    const btn = screen.getByRole('button', { name: /checkout|proceder|commander|processing/i });
    expect(btn).toBeDisabled();
  });

  // ── No expiry timer ────────────────────────────────────────────────────────
  it('does not show timer when expiresAt is null', () => {
    render(<CartSummary {...defaultProps} expiresAt={null} />);
    expect(screen.queryByTestId('icon-clock')).not.toBeInTheDocument();
  });

  // ── With expiry > 5 min ────────────────────────────────────────────────────
  it('shows timer when expiresAt is in the future', () => {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min
    render(<CartSummary {...defaultProps} expiresAt={expiresAt} />);
    expect(screen.getByTestId('icon-clock')).toBeInTheDocument();
    expect(screen.getByText(/Cart expires in/i)).toBeInTheDocument();
  });

  it('does not show Extend button when more than 5 minutes remain', () => {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    render(<CartSummary {...defaultProps} expiresAt={expiresAt} />);
    expect(screen.queryByText('Extend')).not.toBeInTheDocument();
  });

  // ── With expiry < 5 min ────────────────────────────────────────────────────
  it('shows Extend button when less than 5 minutes remain', () => {
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000).toISOString(); // 2 min
    render(<CartSummary {...defaultProps} expiresAt={expiresAt} />);
    expect(screen.getByText('Extend')).toBeInTheDocument();
  });

  it('calls onExtendExpiry when Extend clicked', () => {
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000).toISOString();
    render(<CartSummary {...defaultProps} expiresAt={expiresAt} />);
    fireEvent.click(screen.getByText('Extend'));
    expect(defaultProps.onExtendExpiry).toHaveBeenCalled();
  });

  // ── Expired ────────────────────────────────────────────────────────────────
  it('shows "Expired" when expiresAt is in the past', async () => {
    const expiresAt = new Date(Date.now() - 1000).toISOString(); // 1s ago
    await act(async () => {
      render(<CartSummary {...defaultProps} expiresAt={expiresAt} />);
    });
    // "Expired" is a text node inside "Cart expires in: Expired"
    expect(screen.getByText(/Expired/)).toBeInTheDocument();
  });
});
