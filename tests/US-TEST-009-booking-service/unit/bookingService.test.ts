/**
 * US-TEST-009 — Tests unitaires BookingService
 * Scénarios : création, confirmation, annulation, mise à jour, Kafka events
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// ── Mocks Prisma ──────────────────────────────────────────────────────────────
const mockBookingCreate   = jest.fn();
const mockBookingFindUniq = jest.fn();
const mockBookingUpdate   = jest.fn();
const mockBookingFindMany = jest.fn();

jest.mock('@/database/prisma', () => ({
  __esModule: true,
  default: {
    bookingData: {
      create:     mockBookingCreate,
      findUnique: mockBookingFindUniq,
      update:     mockBookingUpdate,
      findMany:   mockBookingFindMany,
    },
  },
}));

// ── Mocks CartService ─────────────────────────────────────────────────────────
const mockGetCart   = jest.fn();
const mockClearCart = jest.fn();

jest.mock('@/services/CartService', () => ({
  __esModule: true,
  default: {
    getCart:   mockGetCart,
    clearCart: mockClearCart,
  },
}));

// ── Mocks KafkaService ────────────────────────────────────────────────────────
const mockPublishBookingCreated   = jest.fn();
const mockPublishBookingConfirmed = jest.fn();
const mockPublishBookingCancelled = jest.fn();

jest.mock('@/services/KafkaService', () => ({
  __esModule: true,
  default: {
    publishBookingCreated:   mockPublishBookingCreated,
    publishBookingConfirmed: mockPublishBookingConfirmed,
    publishBookingCancelled: mockPublishBookingCancelled,
  },
}));

// ── Import après les mocks ────────────────────────────────────────────────────
import { BookingService } from '@/services/BookingService';

// ── Fixtures ───────────────────────────────────────────────────────────────────
const USER_ID    = 'user-abc-123';
const REFERENCE  = 'BOOK-20260402-XYZ01';
const PAYMENT_ID = 'pi_test_stripe_001';

const mockCart = {
  id:         'cart-001',
  userId:     USER_ID,
  totalPrice: 450,
  currency:   'EUR',
  items: [
    {
      type:     'FLIGHT',
      itemId:   'flight-001',
      itemData: { origin: 'CDG', destination: 'LHR' },
      quantity: 1,
      price:    450,
      currency: 'EUR',
    },
  ],
};

const mockBookingDraft = {
  id:              'booking-001',
  userId:          USER_ID,
  reference:       REFERENCE,
  status:          'DRAFT',
  type:            'FLIGHT',
  paymentIntentId: PAYMENT_ID,
  totalAmount:     450,
  currency:        'EUR',
  data:            { cartId: 'cart-001', items: [], metadata: {}, createdFrom: 'cart' },
  createdAt:       new Date('2026-04-02T10:00:00Z'),
  confirmedAt:     null,
  updatedAt:       new Date('2026-04-02T10:00:00Z'),
};

const mockBookingConfirmed = {
  ...mockBookingDraft,
  status:      'CONFIRMED',
  confirmedAt: new Date('2026-04-02T10:05:00Z'),
};

// ── Tests ──────────────────────────────────────────────────────────────────────
describe('BookingService — US-TEST-009', () => {
  let service: BookingService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BookingService();
  });

  // ── createBookingFromCart ─────────────────────────────────────────────────
  describe('createBookingFromCart', () => {
    it('should create a DRAFT booking from a valid cart and publish booking.created', async () => {
      mockGetCart.mockResolvedValue(mockCart as never);
      mockBookingCreate.mockResolvedValue(mockBookingDraft as never);
      mockPublishBookingCreated.mockResolvedValue(undefined as never);

      const result = await service.createBookingFromCart({
        userId:          USER_ID,
        paymentIntentId: PAYMENT_ID,
      });

      expect(mockGetCart).toHaveBeenCalledWith(USER_ID);
      expect(mockBookingCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId:          USER_ID,
          status:          'DRAFT',
          paymentIntentId: PAYMENT_ID,
          type:            'FLIGHT',
          currency:        'EUR',
        }),
      });
      expect(mockPublishBookingCreated).toHaveBeenCalledWith(
        expect.objectContaining({
          bookingId:   mockBookingDraft.id,
          userId:      USER_ID,
          bookingType: 'FLIGHT',
          status:      'pending',
        })
      );
      expect(result).toEqual(mockBookingDraft);
    });

    it('should determine type PACKAGE when cart has multiple items', async () => {
      const multiCart = {
        ...mockCart,
        items: [
          { ...mockCart.items[0] },
          { type: 'HOTEL', itemId: 'hotel-001', itemData: {}, quantity: 1, price: 200, currency: 'EUR' },
        ],
      };
      mockGetCart.mockResolvedValue(multiCart as never);
      mockBookingCreate.mockResolvedValue({ ...mockBookingDraft, type: 'PACKAGE' } as never);
      mockPublishBookingCreated.mockResolvedValue(undefined as never);

      await service.createBookingFromCart({ userId: USER_ID, paymentIntentId: PAYMENT_ID });

      expect(mockBookingCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ type: 'PACKAGE' }),
      });
    });

    it('should determine type HOTEL when cart has a single HOTEL item', async () => {
      const hotelCart = {
        ...mockCart,
        items: [{ type: 'HOTEL', itemId: 'hotel-001', itemData: {}, quantity: 1, price: 200, currency: 'EUR' }],
      };
      mockGetCart.mockResolvedValue(hotelCart as never);
      mockBookingCreate.mockResolvedValue({ ...mockBookingDraft, type: 'HOTEL' } as never);
      mockPublishBookingCreated.mockResolvedValue(undefined as never);

      await service.createBookingFromCart({ userId: USER_ID, paymentIntentId: PAYMENT_ID });

      expect(mockBookingCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ type: 'HOTEL' }),
      });
    });

    it('should determine type ACTIVITY when cart has a single ACTIVITY item', async () => {
      const activityCart = {
        ...mockCart,
        items: [{ type: 'ACTIVITY', itemId: 'act-001', itemData: {}, quantity: 1, price: 80, currency: 'EUR' }],
      };
      mockGetCart.mockResolvedValue(activityCart as never);
      mockBookingCreate.mockResolvedValue({ ...mockBookingDraft, type: 'ACTIVITY' } as never);
      mockPublishBookingCreated.mockResolvedValue(undefined as never);

      await service.createBookingFromCart({ userId: USER_ID, paymentIntentId: PAYMENT_ID });

      expect(mockBookingCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ type: 'ACTIVITY' }),
      });
    });

    it('should throw when cart is empty', async () => {
      mockGetCart.mockResolvedValue({ ...mockCart, items: [] } as never);

      await expect(
        service.createBookingFromCart({ userId: USER_ID, paymentIntentId: PAYMENT_ID })
      ).rejects.toThrow('Cart is empty or not found');

      expect(mockBookingCreate).not.toHaveBeenCalled();
    });

    it('should throw when cart is not found (null)', async () => {
      mockGetCart.mockResolvedValue(null as never);

      await expect(
        service.createBookingFromCart({ userId: USER_ID, paymentIntentId: PAYMENT_ID })
      ).rejects.toThrow('Cart is empty or not found');
    });

    it('should still create booking when Kafka publish fails (best-effort)', async () => {
      mockGetCart.mockResolvedValue(mockCart as never);
      mockBookingCreate.mockResolvedValue(mockBookingDraft as never);
      mockPublishBookingCreated.mockRejectedValue(new Error('Kafka down') as never);

      const result = await service.createBookingFromCart({
        userId:          USER_ID,
        paymentIntentId: PAYMENT_ID,
      });

      expect(result).toEqual(mockBookingDraft);
    });

    it('should pass optional metadata into booking data', async () => {
      mockGetCart.mockResolvedValue(mockCart as never);
      mockBookingCreate.mockResolvedValue(mockBookingDraft as never);
      mockPublishBookingCreated.mockResolvedValue(undefined as never);

      await service.createBookingFromCart({
        userId:          USER_ID,
        paymentIntentId: PAYMENT_ID,
        metadata:        { source: 'web' },
      });

      expect(mockBookingCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          data: expect.objectContaining({ metadata: { source: 'web' } }),
        }),
      });
    });
  });

  // ── confirmBooking ────────────────────────────────────────────────────────
  describe('confirmBooking', () => {
    it('should confirm a DRAFT booking and publish booking.confirmed + clear cart', async () => {
      mockBookingFindUniq.mockResolvedValue(mockBookingDraft as never);
      mockBookingUpdate.mockResolvedValue(mockBookingConfirmed as never);
      mockPublishBookingConfirmed.mockResolvedValue(undefined as never);
      mockClearCart.mockResolvedValue(undefined as never);

      const result = await service.confirmBooking(REFERENCE, USER_ID);

      expect(mockBookingFindUniq).toHaveBeenCalledWith({ where: { reference: REFERENCE } });
      expect(mockBookingUpdate).toHaveBeenCalledWith({
        where: { reference: REFERENCE },
        data: expect.objectContaining({ status: 'CONFIRMED' }),
      });
      expect(mockPublishBookingConfirmed).toHaveBeenCalledWith(
        expect.objectContaining({
          bookingId:          mockBookingConfirmed.id,
          userId:             USER_ID,
          confirmationNumber: REFERENCE,
        })
      );
      expect(mockClearCart).toHaveBeenCalledWith(USER_ID);
      expect(result).toEqual(mockBookingConfirmed);
    });

    it('should use fallback values when paymentIntentId and confirmedAt are null', async () => {
      mockBookingFindUniq.mockResolvedValue(mockBookingDraft as never);
      const confirmedNullFields = { ...mockBookingConfirmed, paymentIntentId: null, confirmedAt: null };
      mockBookingUpdate.mockResolvedValue(confirmedNullFields as never);
      mockPublishBookingConfirmed.mockResolvedValue(undefined as never);
      mockClearCart.mockResolvedValue(undefined as never);

      const result = await service.confirmBooking(REFERENCE, USER_ID);

      expect(mockPublishBookingConfirmed).toHaveBeenCalledWith(
        expect.objectContaining({ paymentId: '' })
      );
      expect(result.status).toBe('CONFIRMED');
    });

    it('should confirm a PENDING_PAYMENT booking', async () => {
      const pendingBooking = { ...mockBookingDraft, status: 'PENDING_PAYMENT' };
      mockBookingFindUniq.mockResolvedValue(pendingBooking as never);
      mockBookingUpdate.mockResolvedValue(mockBookingConfirmed as never);
      mockPublishBookingConfirmed.mockResolvedValue(undefined as never);
      mockClearCart.mockResolvedValue(undefined as never);

      const result = await service.confirmBooking(REFERENCE, USER_ID);
      expect(result.status).toBe('CONFIRMED');
    });

    it('should return booking as-is when already CONFIRMED (idempotency)', async () => {
      mockBookingFindUniq.mockResolvedValue(mockBookingConfirmed as never);

      const result = await service.confirmBooking(REFERENCE, USER_ID);

      expect(mockBookingUpdate).not.toHaveBeenCalled();
      expect(result).toEqual(mockBookingConfirmed);
    });

    it('should throw when booking not found', async () => {
      mockBookingFindUniq.mockResolvedValue(null as never);

      await expect(service.confirmBooking(REFERENCE, USER_ID)).rejects.toThrow(
        `Booking ${REFERENCE} not found`
      );
    });

    it('should throw when user is not the owner', async () => {
      mockBookingFindUniq.mockResolvedValue({ ...mockBookingDraft, userId: 'other-user' } as never);

      await expect(service.confirmBooking(REFERENCE, USER_ID)).rejects.toThrow(
        `User ${USER_ID} is not authorized`
      );
    });

    it('should throw when booking has an invalid status (e.g. CANCELLED)', async () => {
      mockBookingFindUniq.mockResolvedValue({ ...mockBookingDraft, status: 'CANCELLED' } as never);

      await expect(service.confirmBooking(REFERENCE, USER_ID)).rejects.toThrow(
        `Booking ${REFERENCE} cannot be confirmed`
      );
    });

    it('should not throw when clearCart fails after confirmation (best-effort)', async () => {
      mockBookingFindUniq.mockResolvedValue(mockBookingDraft as never);
      mockBookingUpdate.mockResolvedValue(mockBookingConfirmed as never);
      mockPublishBookingConfirmed.mockResolvedValue(undefined as never);
      mockClearCart.mockRejectedValue(new Error('Redis down') as never);

      const result = await service.confirmBooking(REFERENCE, USER_ID);
      expect(result).toEqual(mockBookingConfirmed);
    });

    it('should not throw when publishBookingConfirmed fails (best-effort)', async () => {
      mockBookingFindUniq.mockResolvedValue(mockBookingDraft as never);
      mockBookingUpdate.mockResolvedValue(mockBookingConfirmed as never);
      mockPublishBookingConfirmed.mockRejectedValue(new Error('Kafka down') as never);
      mockClearCart.mockResolvedValue(undefined as never);

      const result = await service.confirmBooking(REFERENCE, USER_ID);
      expect(result).toEqual(mockBookingConfirmed);
    });
  });

  // ── failBooking ───────────────────────────────────────────────────────────
  describe('failBooking', () => {
    it('should mark booking as FAILED with reason', async () => {
      const failedBooking = { ...mockBookingDraft, status: 'FAILED' };
      mockBookingFindUniq.mockResolvedValue(mockBookingDraft as never);
      mockBookingUpdate.mockResolvedValue(failedBooking as never);

      const result = await service.failBooking(REFERENCE, USER_ID, 'payment_declined');

      expect(mockBookingUpdate).toHaveBeenCalledWith({
        where: { reference: REFERENCE },
        data: expect.objectContaining({
          status: 'FAILED',
          data: expect.objectContaining({ failureReason: 'payment_declined' }),
        }),
      });
      expect(result.status).toBe('FAILED');
    });

    it('should return as-is when already FAILED (idempotency)', async () => {
      mockBookingFindUniq.mockResolvedValue({ ...mockBookingDraft, status: 'FAILED' } as never);

      const result = await service.failBooking(REFERENCE, USER_ID, 'duplicate');
      expect(mockBookingUpdate).not.toHaveBeenCalled();
      expect(result.status).toBe('FAILED');
    });

    it('should throw when booking not found', async () => {
      mockBookingFindUniq.mockResolvedValue(null as never);

      await expect(service.failBooking(REFERENCE, USER_ID, 'reason')).rejects.toThrow(
        `Booking ${REFERENCE} not found`
      );
    });

    it('should throw when user is not the owner', async () => {
      mockBookingFindUniq.mockResolvedValue({ ...mockBookingDraft, userId: 'other-user' } as never);

      await expect(service.failBooking(REFERENCE, USER_ID, 'reason')).rejects.toThrow(
        `User ${USER_ID} is not authorized`
      );
    });

    it('should NOT clear the cart on fail (user can retry payment)', async () => {
      const failedBooking = { ...mockBookingDraft, status: 'FAILED' };
      mockBookingFindUniq.mockResolvedValue(mockBookingDraft as never);
      mockBookingUpdate.mockResolvedValue(failedBooking as never);

      await service.failBooking(REFERENCE, USER_ID, 'payment_declined');
      expect(mockClearCart).not.toHaveBeenCalled();
    });
  });

  // ── cancelBooking ─────────────────────────────────────────────────────────
  describe('cancelBooking', () => {
    it('should cancel a booking with a reason', async () => {
      const cancelled = { ...mockBookingDraft, status: 'CANCELLED' };
      mockBookingFindUniq.mockResolvedValue(mockBookingDraft as never);
      mockBookingUpdate.mockResolvedValue(cancelled as never);

      const result = await service.cancelBooking(REFERENCE, USER_ID, 'Changed my mind');

      expect(mockBookingUpdate).toHaveBeenCalledWith({
        where: { reference: REFERENCE },
        data: expect.objectContaining({
          status: 'CANCELLED',
          data: expect.objectContaining({ cancellationReason: 'Changed my mind' }),
        }),
      });
      expect(result.status).toBe('CANCELLED');
    });

    it('should use default reason when none provided', async () => {
      const cancelled = { ...mockBookingDraft, status: 'CANCELLED' };
      mockBookingFindUniq.mockResolvedValue(mockBookingDraft as never);
      mockBookingUpdate.mockResolvedValue(cancelled as never);

      await service.cancelBooking(REFERENCE, USER_ID);

      expect(mockBookingUpdate).toHaveBeenCalledWith({
        where: { reference: REFERENCE },
        data: expect.objectContaining({
          data: expect.objectContaining({ cancellationReason: 'User cancelled' }),
        }),
      });
    });

    it('should return as-is when already CANCELLED (idempotency)', async () => {
      mockBookingFindUniq.mockResolvedValue({ ...mockBookingDraft, status: 'CANCELLED' } as never);

      const result = await service.cancelBooking(REFERENCE, USER_ID);
      expect(mockBookingUpdate).not.toHaveBeenCalled();
      expect(result.status).toBe('CANCELLED');
    });

    it('should throw when booking not found', async () => {
      mockBookingFindUniq.mockResolvedValue(null as never);

      await expect(service.cancelBooking(REFERENCE, USER_ID)).rejects.toThrow(
        `Booking ${REFERENCE} not found`
      );
    });

    it('should throw when user is not the owner', async () => {
      mockBookingFindUniq.mockResolvedValue({ ...mockBookingDraft, userId: 'intruder' } as never);

      await expect(service.cancelBooking(REFERENCE, USER_ID)).rejects.toThrow(
        `User ${USER_ID} is not authorized`
      );
    });
  });

  // ── getBooking ────────────────────────────────────────────────────────────
  describe('getBooking', () => {
    it('should return the booking when found', async () => {
      mockBookingFindUniq.mockResolvedValue(mockBookingDraft as never);

      const result = await service.getBooking(REFERENCE);
      expect(mockBookingFindUniq).toHaveBeenCalledWith({ where: { reference: REFERENCE } });
      expect(result).toEqual(mockBookingDraft);
    });

    it('should return null when not found', async () => {
      mockBookingFindUniq.mockResolvedValue(null as never);

      const result = await service.getBooking('BOOK-UNKNOWN');
      expect(result).toBeNull();
    });

    it('should propagate prisma errors', async () => {
      mockBookingFindUniq.mockRejectedValue(new Error('DB error') as never);

      await expect(service.getBooking(REFERENCE)).rejects.toThrow('DB error');
    });
  });

  // ── getUserBookings ───────────────────────────────────────────────────────
  describe('getUserBookings', () => {
    it('should return all bookings for a user without status filter', async () => {
      mockBookingFindMany.mockResolvedValue([mockBookingDraft] as never);

      const result = await service.getUserBookings(USER_ID);

      expect(mockBookingFindMany).toHaveBeenCalledWith({
        where: { userId: USER_ID },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(1);
    });

    it('should filter by status when provided', async () => {
      mockBookingFindMany.mockResolvedValue([mockBookingConfirmed] as never);

      await service.getUserBookings(USER_ID, 'CONFIRMED');

      expect(mockBookingFindMany).toHaveBeenCalledWith({
        where: { userId: USER_ID, status: 'CONFIRMED' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty array when user has no bookings', async () => {
      mockBookingFindMany.mockResolvedValue([] as never);

      const result = await service.getUserBookings(USER_ID);
      expect(result).toEqual([]);
    });

    it('should propagate prisma errors', async () => {
      mockBookingFindMany.mockRejectedValue(new Error('DB connection lost') as never);

      await expect(service.getUserBookings(USER_ID)).rejects.toThrow('DB connection lost');
    });
  });

  // ── updateBookingToPendingPayment ─────────────────────────────────────────
  describe('updateBookingToPendingPayment', () => {
    it('should update booking status to PENDING_PAYMENT', async () => {
      const pending = { ...mockBookingDraft, status: 'PENDING_PAYMENT' };
      mockBookingUpdate.mockResolvedValue(pending as never);

      const result = await service.updateBookingToPendingPayment(REFERENCE);

      expect(mockBookingUpdate).toHaveBeenCalledWith({
        where: { reference: REFERENCE },
        data: expect.objectContaining({ status: 'PENDING_PAYMENT' }),
      });
      expect(result.status).toBe('PENDING_PAYMENT');
    });

    it('should propagate error when booking not found', async () => {
      mockBookingUpdate.mockRejectedValue(new Error('Record not found') as never);

      await expect(service.updateBookingToPendingPayment('BOOK-GHOST')).rejects.toThrow();
    });
  });
});
