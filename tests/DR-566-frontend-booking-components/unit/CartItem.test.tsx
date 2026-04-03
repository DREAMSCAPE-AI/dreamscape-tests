/**
 * DR-566 — US-TEST-029
 * Tests unitaires : CartItem (components/cart/CartItem)
 *
 * Scénarios couverts :
 * - Rendu item type FLIGHT : origin/destination, compagnie, boutons quantité
 * - Rendu item type HOTEL : nom, location, dates check-in/out
 * - Rendu item type ACTIVITY : nom, location, date
 * - Affichage prix (currency + price)
 * - Contrôles quantité : decrement (quantity > 1), increment
 * - Bouton Decrement désactivé quand quantity === 1
 * - Bouton Remove → onRemove(itemId)
 * - isLoading désactive les boutons
 *
 * @jest-environment jsdom
 * @ticket DR-566
 */

// ── Mocks ──────────────────────────────────────────────────────────────────
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));

jest.mock('lucide-react', () => {
  const icon = (name: string) => ({ className }: any) => <span data-testid={`icon-${name}`} className={className} />;
  return {
    Minus: icon('minus'),
    Plus: icon('plus'),
    Trash2: icon('trash'),
    Plane: icon('plane'),
    Hotel: icon('hotel'),
    MapPin: icon('mappin'),
  };
});

jest.mock('@/utils/airportCodes', () => ({
  getAirportInfo: (code: string) => {
    const map: Record<string, { city: string }> = {
      CDG: { city: 'Paris' },
      JFK: { city: 'New York' },
    };
    return map[code] || null;
  },
}));

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import CartItem from '@/components/cart/CartItem';
import type { CartItem as CartItemType } from '@/types/cart';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const flightItem: CartItemType = {
  id: 'item-flight',
  type: 'FLIGHT',
  price: 299,
  currency: 'EUR',
  quantity: 2,
  itemData: {
    origin: 'CDG',
    destination: 'JFK',
    departureDate: '2026-06-01T10:00:00Z',
    validatingAirlineCodes: ['AF'],
    flightNumber: '007',
  } as any,
};

const hotelItem: CartItemType = {
  id: 'item-hotel',
  type: 'HOTEL',
  price: 150,
  currency: 'EUR',
  quantity: 1,
  itemData: {
    name: 'Grand Hotel',
    location: 'Paris',
    checkInDate: '2026-06-01',
    checkOutDate: '2026-06-05',
  } as any,
};

const activityItem: CartItemType = {
  id: 'item-activity',
  type: 'ACTIVITY',
  price: 50,
  currency: 'EUR',
  quantity: 1,
  itemData: {
    name: 'Eiffel Tower Tour',
    location: { name: 'Paris' },
    date: '2026-06-03',
    duration: '2h',
  } as any,
};

// ─────────────────────────────────────────────────────────────────────────────

describe('CartItem', () => {
  const onUpdateQuantity = jest.fn();
  const onRemove = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  // ── FLIGHT ─────────────────────────────────────────────────────────────────
  describe('FLIGHT item', () => {
    it('renders origin and destination codes', () => {
      render(<CartItem item={flightItem} onUpdateQuantity={onUpdateQuantity} onRemove={onRemove} />);
      expect(screen.getByText('CDG')).toBeInTheDocument();
      expect(screen.getByText('JFK')).toBeInTheDocument();
    });

    it('renders city names from getAirportInfo', () => {
      render(<CartItem item={flightItem} onUpdateQuantity={onUpdateQuantity} onRemove={onRemove} />);
      expect(screen.getByText('Paris')).toBeInTheDocument();
      expect(screen.getByText('New York')).toBeInTheDocument();
    });

    it('renders price', () => {
      render(<CartItem item={flightItem} onUpdateQuantity={onUpdateQuantity} onRemove={onRemove} />);
      expect(screen.getByText(/EUR.*299|299.*EUR/)).toBeInTheDocument();
    });

    it('renders quantity', () => {
      render(<CartItem item={flightItem} onUpdateQuantity={onUpdateQuantity} onRemove={onRemove} />);
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  // ── HOTEL ──────────────────────────────────────────────────────────────────
  describe('HOTEL item', () => {
    it('renders hotel name and location', () => {
      render(<CartItem item={hotelItem} onUpdateQuantity={onUpdateQuantity} onRemove={onRemove} />);
      expect(screen.getByText('Grand Hotel')).toBeInTheDocument();
      expect(screen.getByText('Paris')).toBeInTheDocument();
    });

    it('renders check-in and check-out dates', () => {
      render(<CartItem item={hotelItem} onUpdateQuantity={onUpdateQuantity} onRemove={onRemove} />);
      // Dates are formatted, check they render (partial match)
      expect(screen.getByText(/juin|jun/i)).toBeInTheDocument();
    });
  });

  // ── ACTIVITY ───────────────────────────────────────────────────────────────
  describe('ACTIVITY item', () => {
    it('renders activity name', () => {
      render(<CartItem item={activityItem} onUpdateQuantity={onUpdateQuantity} onRemove={onRemove} />);
      expect(screen.getByText('Eiffel Tower Tour')).toBeInTheDocument();
    });

    it('renders activity location', () => {
      render(<CartItem item={activityItem} onUpdateQuantity={onUpdateQuantity} onRemove={onRemove} />);
      expect(screen.getByText('Paris')).toBeInTheDocument();
    });
  });

  // ── Quantity controls ──────────────────────────────────────────────────────
  describe('quantity controls', () => {
    it('increment calls onUpdateQuantity with quantity + 1', () => {
      render(<CartItem item={flightItem} onUpdateQuantity={onUpdateQuantity} onRemove={onRemove} />);
      fireEvent.click(screen.getByLabelText('Increase quantity'));
      expect(onUpdateQuantity).toHaveBeenCalledWith('item-flight', 3);
    });

    it('decrement calls onUpdateQuantity with quantity - 1 when quantity > 1', () => {
      render(<CartItem item={flightItem} onUpdateQuantity={onUpdateQuantity} onRemove={onRemove} />);
      fireEvent.click(screen.getByLabelText('Decrease quantity'));
      expect(onUpdateQuantity).toHaveBeenCalledWith('item-flight', 1);
    });

    it('decrement button is disabled when quantity === 1', () => {
      render(<CartItem item={hotelItem} onUpdateQuantity={onUpdateQuantity} onRemove={onRemove} />);
      const decrementBtn = screen.getByLabelText('Decrease quantity');
      expect(decrementBtn).toBeDisabled();
    });

    it('does not call onUpdateQuantity when decrement is clicked at quantity 1', () => {
      render(<CartItem item={hotelItem} onUpdateQuantity={onUpdateQuantity} onRemove={onRemove} />);
      fireEvent.click(screen.getByLabelText('Decrease quantity'));
      expect(onUpdateQuantity).not.toHaveBeenCalled();
    });
  });

  // ── Remove button ──────────────────────────────────────────────────────────
  describe('remove button', () => {
    it('calls onRemove with item id', () => {
      render(<CartItem item={flightItem} onUpdateQuantity={onUpdateQuantity} onRemove={onRemove} />);
      fireEvent.click(screen.getByLabelText('Remove item'));
      expect(onRemove).toHaveBeenCalledWith('item-flight');
    });
  });

  // ── isLoading ──────────────────────────────────────────────────────────────
  describe('isLoading', () => {
    it('disables all buttons when isLoading is true', () => {
      render(<CartItem item={flightItem} onUpdateQuantity={onUpdateQuantity} onRemove={onRemove} isLoading />);
      expect(screen.getByLabelText('Increase quantity')).toBeDisabled();
      expect(screen.getByLabelText('Remove item')).toBeDisabled();
    });
  });
});
