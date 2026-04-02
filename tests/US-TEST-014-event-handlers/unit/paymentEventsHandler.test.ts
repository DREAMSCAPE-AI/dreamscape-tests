/**
 * US-TEST-014 — Tests unitaires paymentEventsHandler
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// ── Mock BookingService ────────────────────────────────────────────────────────
const mockConfirmBooking = jest.fn();
const mockFailBooking    = jest.fn();

jest.mock('@/services/BookingService', () => ({
  __esModule: true,
  default: {
    confirmBooking: mockConfirmBooking,
    failBooking:    mockFailBooking,
  },
}));

// ── Mock KafkaService ──────────────────────────────────────────────────────────
const mockPublishBookingConfirmed = jest.fn();
const mockPublishBookingCancelled = jest.fn();

jest.mock('@/services/KafkaService', () => ({
  __esModule: true,
  default: {
    publishBookingConfirmed: mockPublishBookingConfirmed,
    publishBookingCancelled: mockPublishBookingCancelled,
  },
}));

// ── Mock prisma (imported by handler) ─────────────────────────────────────────
jest.mock('@/database/prisma', () => ({
  __esModule: true,
  default: {},
}));

// ── Mock @dreamscape/kafka ─────────────────────────────────────────────────────
jest.mock('@dreamscape/kafka', () => ({
  __esModule: true,
}));

// ── Import après les mocks ─────────────────────────────────────────────────────
import {
  handlePaymentCompleted,
  handlePaymentFailed,
} from '@/handlers/paymentEventsHandler';

// ── Fixtures ────────────────────────────────────────────────────────────────────
const BOOKING_ID = 'BOOK-20260402-ABC01';
const USER_ID    = 'user-pay-001';
const PAYMENT_ID = 'pi_stripe_001';

const mockConfirmedBooking = {
  id:          'booking-db-001',
  reference:   BOOKING_ID,
  userId:      USER_ID,
  status:      'CONFIRMED',
  confirmedAt: new Date('2026-04-02T10:05:00Z'),
  updatedAt:   new Date('2026-04-02T10:05:00Z'),
};

const mockFailedBooking = {
  id:        'booking-db-001',
  reference: BOOKING_ID,
  userId:    USER_ID,
  status:    'FAILED',
  updatedAt: new Date('2026-04-02T10:06:00Z'),
};

const makePaymentCompletedEvent = (overrides = {}) => ({
  metadata: {
    correlationId: 'corr-001',
    eventId:       'evt-001',
    timestamp:     new Date().toISOString(),
    source:        'payment-service',
    version:       '1',
  },
  payload: {
    paymentId:   PAYMENT_ID,
    bookingId:   BOOKING_ID,
    userId:      USER_ID,
    amount:      450,
    currency:    'EUR',
    completedAt: new Date().toISOString(),
    ...overrides,
  },
});

const makePaymentFailedEvent = (overrides = {}) => ({
  metadata: {
    correlationId: 'corr-002',
    eventId:       'evt-002',
    timestamp:     new Date().toISOString(),
    source:        'payment-service',
    version:       '1',
  },
  payload: {
    paymentId:    PAYMENT_ID,
    bookingId:    BOOKING_ID,
    userId:       USER_ID,
    errorCode:    'CARD_DECLINED',
    errorMessage: 'Your card was declined',
    failedAt:     new Date().toISOString(),
    ...overrides,
  },
});

// ── Tests ───────────────────────────────────────────────────────────────────────
describe('paymentEventsHandler — US-TEST-014', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── handlePaymentCompleted ───────────────────────────────────────────────
  describe('handlePaymentCompleted', () => {
    it('should confirm the booking and publish booking.confirmed', async () => {
      mockConfirmBooking.mockResolvedValue(mockConfirmedBooking as never);
      mockPublishBookingConfirmed.mockResolvedValue(undefined as never);

      await handlePaymentCompleted(makePaymentCompletedEvent() as any);

      expect(mockConfirmBooking).toHaveBeenCalledWith(BOOKING_ID, USER_ID);
      expect(mockPublishBookingConfirmed).toHaveBeenCalledWith(
        expect.objectContaining({
          bookingId:          BOOKING_ID,
          userId:             USER_ID,
          confirmationNumber: BOOKING_ID,
          paymentId:          PAYMENT_ID,
        }),
        'corr-001'
      );
    });

    it('should not throw when publishBookingConfirmed fails (best-effort)', async () => {
      mockConfirmBooking.mockResolvedValue(mockConfirmedBooking as never);
      mockPublishBookingConfirmed.mockRejectedValue(new Error('Kafka unavailable') as never);

      await expect(
        handlePaymentCompleted(makePaymentCompletedEvent() as any)
      ).resolves.toBeUndefined();
    });

    it('should re-throw when confirmBooking fails (triggers Kafka retry)', async () => {
      mockConfirmBooking.mockRejectedValue(new Error('Booking not found') as never);

      await expect(
        handlePaymentCompleted(makePaymentCompletedEvent() as any)
      ).rejects.toThrow('Booking not found');

      expect(mockPublishBookingConfirmed).not.toHaveBeenCalled();
    });

    it('should pass correlationId to publishBookingConfirmed', async () => {
      mockConfirmBooking.mockResolvedValue(mockConfirmedBooking as never);
      mockPublishBookingConfirmed.mockResolvedValue(undefined as never);

      const event = makePaymentCompletedEvent();
      event.metadata.correlationId = 'my-correlation-id';
      await handlePaymentCompleted(event as any);

      expect(mockPublishBookingConfirmed).toHaveBeenCalledWith(
        expect.any(Object),
        'my-correlation-id'
      );
    });
  });

  // ── handlePaymentFailed ──────────────────────────────────────────────────
  describe('handlePaymentFailed', () => {
    it('should fail the booking and publish booking.cancelled', async () => {
      mockFailBooking.mockResolvedValue(mockFailedBooking as never);
      mockPublishBookingCancelled.mockResolvedValue(undefined as never);

      await handlePaymentFailed(makePaymentFailedEvent() as any);

      const expectedReason = 'payment_failed: CARD_DECLINED - Your card was declined';
      expect(mockFailBooking).toHaveBeenCalledWith(BOOKING_ID, USER_ID, expectedReason);
      expect(mockPublishBookingCancelled).toHaveBeenCalledWith(
        expect.objectContaining({
          bookingId: BOOKING_ID,
          userId:    USER_ID,
          reason:    expectedReason,
        }),
        'corr-002'
      );
    });

    it('should build reason with UNKNOWN errorCode when not provided', async () => {
      mockFailBooking.mockResolvedValue(mockFailedBooking as never);
      mockPublishBookingCancelled.mockResolvedValue(undefined as never);

      await handlePaymentFailed(
        makePaymentFailedEvent({ errorCode: undefined, errorMessage: 'Generic error' }) as any
      );

      expect(mockFailBooking).toHaveBeenCalledWith(
        BOOKING_ID,
        USER_ID,
        expect.stringContaining('UNKNOWN')
      );
    });

    it('should not throw when publishBookingCancelled fails (best-effort)', async () => {
      mockFailBooking.mockResolvedValue(mockFailedBooking as never);
      mockPublishBookingCancelled.mockRejectedValue(new Error('Kafka down') as never);

      await expect(
        handlePaymentFailed(makePaymentFailedEvent() as any)
      ).resolves.toBeUndefined();
    });

    it('should re-throw when failBooking throws (triggers Kafka retry)', async () => {
      mockFailBooking.mockRejectedValue(new Error('DB error') as never);

      await expect(
        handlePaymentFailed(makePaymentFailedEvent() as any)
      ).rejects.toThrow('DB error');

      expect(mockPublishBookingCancelled).not.toHaveBeenCalled();
    });

    it('should NOT call confirmBooking on payment failure', async () => {
      mockFailBooking.mockResolvedValue(mockFailedBooking as never);
      mockPublishBookingCancelled.mockResolvedValue(undefined as never);

      await handlePaymentFailed(makePaymentFailedEvent() as any);

      expect(mockConfirmBooking).not.toHaveBeenCalled();
    });
  });
});
