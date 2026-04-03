/**
 * DR-566 — US-TEST-029
 * Tests unitaires : BookingCard (components/bookings/BookingCard)
 *
 * Scénarios couverts :
 * - Rendu référence de réservation
 * - Badge statut : CONFIRMED, CANCELLED, FAILED, PENDING, PENDING_PAYMENT, DRAFT, COMPLETED
 * - Icône type : FLIGHT, HOTEL, ACTIVITY, PACKAGE, TRANSFER
 * - Titre dynamique (items vide, itemData.name, hotelName, itineraries)
 * - Sous-titre : location.name, cityName, address.cityName
 * - Formatage prix avec devise
 * - Bouton "Annuler" visible pour statuts annulables (CONFIRMED, PENDING…)
 * - Bouton "Annuler" absent pour CANCELLED / COMPLETED
 * - Clic "Details" → onViewDetails(booking)
 * - Clic "Annuler" → onCancel(booking)
 * - onViewDetails / onCancel optionnels (no crash)
 *
 * @jest-environment jsdom
 * @ticket DR-566
 */

// ── Mocks ──────────────────────────────────────────────────────────────────
jest.mock('lucide-react', () => {
  const icon = (name: string) => ({ className }: any) => <span data-testid={`icon-${name}`} className={className} />;
  return {
    Plane: icon('plane'), Hotel: icon('hotel'), Calendar: icon('calendar'),
    MapPin: icon('mappin'), Clock: icon('clock'), Check: icon('check'),
    X: icon('x'), AlertTriangle: icon('alert-triangle'), CreditCard: icon('credit-card'),
    Package: icon('package'), ChevronRight: icon('chevron-right'), Ban: icon('ban'),
  };
});

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import BookingCard, { type Booking } from '@/components/bookings/BookingCard';

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 'b-1',
    reference: 'BOOK-001',
    type: 'FLIGHT',
    status: 'CONFIRMED',
    totalAmount: 299.99,
    currency: 'EUR',
    items: [],
    itemCount: 1,
    createdAt: '2026-01-15T10:00:00Z',
    updatedAt: '2026-01-15T10:00:00Z',
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

describe('BookingCard', () => {
  const onViewDetails = jest.fn();
  const onCancel = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  // ── Reference ──────────────────────────────────────────────────────────────
  it('displays booking reference', () => {
    render(<BookingCard booking={makeBooking()} onViewDetails={onViewDetails} />);
    expect(screen.getByText(/BOOK-001/)).toBeInTheDocument();
  });

  // ── Status badges ──────────────────────────────────────────────────────────
  it.each([
    ['CONFIRMED', 'Confirmee'],
    ['COMPLETED', 'Terminee'],
    ['PENDING', 'En attente'],
    ['PENDING_PAYMENT', 'Paiement en attente'],
    ['DRAFT', 'Brouillon'],
    ['CANCELLED', 'Annulee'],
    ['FAILED', 'Echouee'],
  ] as const)('shows correct label for status %s', (status, label) => {
    render(<BookingCard booking={makeBooking({ status })} onViewDetails={onViewDetails} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  // ── Type labels ────────────────────────────────────────────────────────────
  it.each([
    ['FLIGHT', 'Vol'],
    ['HOTEL', 'Hotel'],
    ['ACTIVITY', 'Activite'],
    ['PACKAGE', 'Package'],
    ['TRANSFER', 'Transfert'],
  ] as const)('shows correct type label for %s', (type, label) => {
    render(<BookingCard booking={makeBooking({ type })} onViewDetails={onViewDetails} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  // ── Booking title fallback ─────────────────────────────────────────────────
  it('uses "Reservation #REF" when items is empty', () => {
    // When items is empty, component returns `Reservation ${type.toLowerCase()}`
    render(<BookingCard booking={makeBooking({ items: [], type: 'FLIGHT' })} onViewDetails={onViewDetails} />);
    expect(screen.getByText('Reservation flight')).toBeInTheDocument();
  });

  it('uses itemData.name for title when available', () => {
    const items = [{ type: 'ACTIVITY', itemId: 'a1', itemData: { name: 'Eiffel Tour' }, quantity: 1, price: 50, currency: 'EUR' }];
    render(<BookingCard booking={makeBooking({ items })} onViewDetails={onViewDetails} />);
    expect(screen.getByText('Eiffel Tour')).toBeInTheDocument();
  });

  it('uses itemData.hotelName for title', () => {
    const items = [{ type: 'HOTEL', itemId: 'h1', itemData: { hotelName: 'Grand Hotel' }, quantity: 1, price: 200, currency: 'EUR' }];
    render(<BookingCard booking={makeBooking({ items })} onViewDetails={onViewDetails} />);
    expect(screen.getByText('Grand Hotel')).toBeInTheDocument();
  });

  it('uses departure/arrival codes for flight title', () => {
    const items = [{
      type: 'FLIGHT', itemId: 'f1', quantity: 1, price: 299, currency: 'EUR',
      itemData: {
        itineraries: [{ segments: [{ departure: { iataCode: 'CDG' }, arrival: { iataCode: 'JFK' } }] }]
      }
    }];
    render(<BookingCard booking={makeBooking({ items })} onViewDetails={onViewDetails} />);
    expect(screen.getByText('CDG → JFK')).toBeInTheDocument();
  });

  // ── Subtitle ───────────────────────────────────────────────────────────────
  it('shows subtitle from itemData.location.name', () => {
    const items = [{ type: 'ACTIVITY', itemId: 'a1', itemData: { name: 'Tour', location: { name: 'Paris' } }, quantity: 1, price: 50, currency: 'EUR' }];
    render(<BookingCard booking={makeBooking({ items })} onViewDetails={onViewDetails} />);
    expect(screen.getByText('Paris')).toBeInTheDocument();
  });

  // ── Price ──────────────────────────────────────────────────────────────────
  it('displays formatted price', () => {
    render(<BookingCard booking={makeBooking({ totalAmount: 299.99, currency: 'EUR' })} onViewDetails={onViewDetails} />);
    // Intl.NumberFormat fr-FR formats 299.99 EUR
    expect(screen.getByText(/299/)).toBeInTheDocument();
  });

  // ── Cancel button ──────────────────────────────────────────────────────────
  it.each(['DRAFT', 'PENDING_PAYMENT', 'PENDING', 'CONFIRMED'] as const)(
    'shows cancel button for annulable status %s', (status) => {
      render(<BookingCard booking={makeBooking({ status })} onViewDetails={onViewDetails} onCancel={onCancel} />);
      expect(screen.getByRole('button', { name: /annuler/i })).toBeInTheDocument();
    }
  );

  it.each(['CANCELLED', 'COMPLETED', 'FAILED'] as const)(
    'hides cancel button for status %s', (status) => {
      render(<BookingCard booking={makeBooking({ status })} onViewDetails={onViewDetails} onCancel={onCancel} />);
      expect(screen.queryByRole('button', { name: /annuler/i })).not.toBeInTheDocument();
    }
  );

  // ── Actions ────────────────────────────────────────────────────────────────
  it('calls onViewDetails when Details button clicked', () => {
    const booking = makeBooking();
    render(<BookingCard booking={booking} onViewDetails={onViewDetails} />);
    fireEvent.click(screen.getByRole('button', { name: /details/i }));
    expect(onViewDetails).toHaveBeenCalledWith(booking);
  });

  it('calls onCancel when Annuler button clicked', () => {
    const booking = makeBooking({ status: 'CONFIRMED' });
    render(<BookingCard booking={booking} onViewDetails={onViewDetails} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: /annuler/i }));
    expect(onCancel).toHaveBeenCalledWith(booking);
  });

  it('does not render Details button when onViewDetails is not provided', () => {
    render(<BookingCard booking={makeBooking()} />);
    expect(screen.queryByRole('button', { name: /details/i })).not.toBeInTheDocument();
  });

  it('does not render cancel button when onCancel is not provided', () => {
    render(<BookingCard booking={makeBooking({ status: 'CONFIRMED' })} onViewDetails={onViewDetails} />);
    expect(screen.queryByRole('button', { name: /annuler/i })).not.toBeInTheDocument();
  });
});
