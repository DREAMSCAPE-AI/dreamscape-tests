/**
 * DR-566 — US-TEST-029
 * Tests unitaires : CartButton (components/cart/CartButton)
 *
 * Scénarios couverts :
 * - Rendu bouton panier
 * - Badge absent quand itemCount = 0
 * - Badge présent avec chiffre quand itemCount > 0
 * - Badge affiche "99+" quand itemCount > 99
 * - Clic → toggleDrawer appelé
 * - aria-label change selon itemCount
 *
 * @jest-environment jsdom
 * @ticket DR-566
 */

// ── Mocks ──────────────────────────────────────────────────────────────────
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

jest.mock('lucide-react', () => ({
  ShoppingCart: () => <span data-testid="icon-cart" />,
}));

// Mock cartStore - prevents import.meta.env from service chain
const mockToggleDrawer = jest.fn();
let mockItemCount = 0;

jest.mock('@/store/cartStore', () => ({
  useCartStore: () => ({
    toggleDrawer: mockToggleDrawer,
    getItemCount: () => mockItemCount,
  }),
}));

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import CartButton from '@/components/cart/CartButton';

// ─────────────────────────────────────────────────────────────────────────────

describe('CartButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockItemCount = 0;
  });

  it('renders a button with the cart icon', () => {
    render(<CartButton />);
    expect(screen.getByRole('button')).toBeInTheDocument();
    expect(screen.getByTestId('icon-cart')).toBeInTheDocument();
  });

  it('has aria-label "Panier" when no items', () => {
    render(<CartButton />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Panier');
  });

  it('has aria-label with item count when items > 0', () => {
    mockItemCount = 3;
    render(<CartButton />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Panier, 3 articles');
  });

  it('uses singular "article" for itemCount = 1', () => {
    mockItemCount = 1;
    render(<CartButton />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Panier, 1 article');
  });

  it('does not show badge when itemCount is 0', () => {
    render(<CartButton />);
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('shows badge with count when itemCount > 0', () => {
    mockItemCount = 5;
    render(<CartButton />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('shows "99+" when itemCount > 99', () => {
    mockItemCount = 150;
    render(<CartButton />);
    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('shows exact count when itemCount is 99', () => {
    mockItemCount = 99;
    render(<CartButton />);
    expect(screen.getByText('99')).toBeInTheDocument();
  });

  it('calls toggleDrawer on click', () => {
    render(<CartButton />);
    fireEvent.click(screen.getByRole('button'));
    expect(mockToggleDrawer).toHaveBeenCalledTimes(1);
  });
});
