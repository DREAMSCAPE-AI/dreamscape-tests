/**
 * databaseService.test.ts — DR-538-US-TEST-024
 *
 * Unit tests for DatabaseService.
 * PrismaClient is mocked via __mocks__/db.ts.
 * databaseService is a singleton; isInitialized is reset in beforeEach.
 */

// ─── Imports ──────────────────────────────────────────────────────────────────

import databaseService from '../../../../dreamscape-services/payment/src/services/DatabaseService';
import { PaymentTransactionStatus } from '@dreamscape/db';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Access the mock PrismaClient instance held by the singleton. */
function getPrisma() {
  return (databaseService as any).prisma;
}

function resetService() {
  (databaseService as any).isInitialized = false;
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  resetService();
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ─── initialize() ─────────────────────────────────────────────────────────────

describe('initialize()', () => {
  it('calls $connect and sets isInitialized on first call', async () => {
    getPrisma().$connect.mockResolvedValueOnce(undefined);

    await databaseService.initialize();

    expect(getPrisma().$connect).toHaveBeenCalledTimes(1);
    expect((databaseService as any).isInitialized).toBe(true);
  });

  it('skips $connect and logs when already initialized', async () => {
    (databaseService as any).isInitialized = true;

    await databaseService.initialize();

    expect(getPrisma().$connect).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith('[DatabaseService] Already initialized');
  });

  it('rethrows and stays uninitialized when $connect throws', async () => {
    getPrisma().$connect.mockRejectedValueOnce(new Error('DB unreachable'));

    await expect(databaseService.initialize()).rejects.toThrow('DB unreachable');
    expect(console.error).toHaveBeenCalled();
    expect((databaseService as any).isInitialized).toBe(false);
  });
});

// ─── shutdown() ───────────────────────────────────────────────────────────────

describe('shutdown()', () => {
  it('calls $disconnect and clears isInitialized', async () => {
    (databaseService as any).isInitialized = true;
    getPrisma().$disconnect.mockResolvedValueOnce(undefined);

    await databaseService.shutdown();

    expect(getPrisma().$disconnect).toHaveBeenCalledTimes(1);
    expect((databaseService as any).isInitialized).toBe(false);
  });
});

// ─── isEventProcessed() ───────────────────────────────────────────────────────

describe('isEventProcessed()', () => {
  it('returns true when event record exists', async () => {
    getPrisma().processedWebhookEvent.findUnique.mockResolvedValueOnce({ eventId: 'evt_123' });

    const result = await databaseService.isEventProcessed('evt_123');

    expect(result).toBe(true);
    expect(getPrisma().processedWebhookEvent.findUnique).toHaveBeenCalledWith({
      where: { eventId: 'evt_123' },
    });
  });

  it('returns false when event record does not exist', async () => {
    getPrisma().processedWebhookEvent.findUnique.mockResolvedValueOnce(null);

    const result = await databaseService.isEventProcessed('evt_new');

    expect(result).toBe(false);
  });
});

// ─── markEventAsProcessed() ───────────────────────────────────────────────────

describe('markEventAsProcessed()', () => {
  it('creates the processed event record on success', async () => {
    getPrisma().processedWebhookEvent.create.mockResolvedValueOnce(undefined);

    await databaseService.markEventAsProcessed('evt_123', 'payment_intent.succeeded', { foo: 'bar' });

    expect(getPrisma().processedWebhookEvent.create).toHaveBeenCalledWith({
      data: {
        eventId: 'evt_123',
        eventType: 'payment_intent.succeeded',
        processed: true,
        payload: { foo: 'bar' },
      },
    });
  });

  it('uses empty object as payload when none is provided', async () => {
    getPrisma().processedWebhookEvent.create.mockResolvedValueOnce(undefined);

    await databaseService.markEventAsProcessed('evt_456', 'payment_intent.canceled');

    expect(getPrisma().processedWebhookEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ payload: {} }) })
    );
  });

  it('silently returns on P2002 (unique constraint / race condition)', async () => {
    const uniqueError = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
    getPrisma().processedWebhookEvent.create.mockRejectedValueOnce(uniqueError);

    await expect(
      databaseService.markEventAsProcessed('evt_dup', 'charge.refunded')
    ).resolves.toBeUndefined();

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('already marked as processed')
    );
  });

  it('rethrows on non-P2002 errors', async () => {
    getPrisma().processedWebhookEvent.create.mockRejectedValueOnce(new Error('Network error'));

    await expect(
      databaseService.markEventAsProcessed('evt_fail', 'payment_intent.succeeded')
    ).rejects.toThrow('Network error');
  });
});

// ─── createTransaction() ──────────────────────────────────────────────────────

describe('createTransaction()', () => {
  const txData = {
    paymentIntentId: 'pi_001',
    bookingId: 'b-001',
    bookingReference: 'REF-001',
    userId: 'u-001',
    amount: 50000,
    currency: 'EUR',
  };

  it('calls paymentTransaction.create with PENDING status', async () => {
    getPrisma().paymentTransaction.create.mockResolvedValueOnce(undefined);

    await databaseService.createTransaction(txData);

    expect(getPrisma().paymentTransaction.create).toHaveBeenCalledWith({
      data: {
        ...txData,
        status: PaymentTransactionStatus.PENDING,
        metadata: {},
      },
    });
  });

  it('includes metadata when provided', async () => {
    getPrisma().paymentTransaction.create.mockResolvedValueOnce(undefined);
    const withMeta = { ...txData, metadata: { source: 'web' } };

    await databaseService.createTransaction(withMeta);

    expect(getPrisma().paymentTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ metadata: { source: 'web' } }) })
    );
  });

  it('rethrows when create fails', async () => {
    getPrisma().paymentTransaction.create.mockRejectedValueOnce(new Error('DB error'));

    await expect(databaseService.createTransaction(txData)).rejects.toThrow('DB error');
    expect(console.error).toHaveBeenCalled();
  });
});

// ─── updateTransaction() ──────────────────────────────────────────────────────

describe('updateTransaction()', () => {
  it('calls paymentTransaction.update with correct where clause and data', async () => {
    getPrisma().paymentTransaction.update.mockResolvedValueOnce(undefined);
    const updates = { status: PaymentTransactionStatus.SUCCEEDED, confirmedAt: new Date() };

    await databaseService.updateTransaction('pi_001', updates);

    expect(getPrisma().paymentTransaction.update).toHaveBeenCalledWith({
      where: { paymentIntentId: 'pi_001' },
      data: updates,
    });
  });

  it('rethrows when update fails', async () => {
    getPrisma().paymentTransaction.update.mockRejectedValueOnce(new Error('Not found'));

    await expect(
      databaseService.updateTransaction('pi_bad', { status: PaymentTransactionStatus.FAILED })
    ).rejects.toThrow('Not found');
    expect(console.error).toHaveBeenCalled();
  });
});

// ─── getTransactionByPaymentIntent() ─────────────────────────────────────────

describe('getTransactionByPaymentIntent()', () => {
  it('returns the transaction record when found', async () => {
    const record = { paymentIntentId: 'pi_001', amount: 50000 };
    getPrisma().paymentTransaction.findUnique.mockResolvedValueOnce(record);

    const result = await databaseService.getTransactionByPaymentIntent('pi_001');

    expect(result).toEqual(record);
    expect(getPrisma().paymentTransaction.findUnique).toHaveBeenCalledWith({
      where: { paymentIntentId: 'pi_001' },
    });
  });

  it('returns null when no record exists', async () => {
    getPrisma().paymentTransaction.findUnique.mockResolvedValueOnce(null);

    const result = await databaseService.getTransactionByPaymentIntent('pi_missing');

    expect(result).toBeNull();
  });
});

// ─── getTransactionsByBooking() ───────────────────────────────────────────────

describe('getTransactionsByBooking()', () => {
  it('returns all transactions for a booking ordered by createdAt desc', async () => {
    const records = [{ paymentIntentId: 'pi_001' }, { paymentIntentId: 'pi_002' }];
    getPrisma().paymentTransaction.findMany.mockResolvedValueOnce(records);

    const result = await databaseService.getTransactionsByBooking('b-001');

    expect(result).toEqual(records);
    expect(getPrisma().paymentTransaction.findMany).toHaveBeenCalledWith({
      where: { bookingId: 'b-001' },
      orderBy: { createdAt: 'desc' },
    });
  });
});

// ─── getTransactionsByUser() ──────────────────────────────────────────────────

describe('getTransactionsByUser()', () => {
  it('returns all transactions for a user ordered by createdAt desc', async () => {
    const records = [{ paymentIntentId: 'pi_001' }];
    getPrisma().paymentTransaction.findMany.mockResolvedValueOnce(records);

    const result = await databaseService.getTransactionsByUser('u-001');

    expect(result).toEqual(records);
    expect(getPrisma().paymentTransaction.findMany).toHaveBeenCalledWith({
      where: { userId: 'u-001' },
      orderBy: { createdAt: 'desc' },
    });
  });
});

// ─── healthCheck() ────────────────────────────────────────────────────────────

// ─── constructor log config ───────────────────────────────────────────────────

describe('constructor log config', () => {
  it('passes development log levels when NODE_ENV is development', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    let capturedLog: any;
    jest.isolateModules(() => {
      jest.doMock('@dreamscape/db', () => ({
        PaymentTransactionStatus: {
          PENDING: 'PENDING', PROCESSING: 'PROCESSING', SUCCEEDED: 'SUCCEEDED',
          FAILED: 'FAILED', CANCELED: 'CANCELED', REFUNDED: 'REFUNDED',
        },
        PrismaClient: jest.fn().mockImplementation(function (config: any) {
          capturedLog = config?.log;
          return {
            paymentTransaction: { create: jest.fn(), update: jest.fn(), findUnique: jest.fn(), findMany: jest.fn() },
            processedWebhookEvent: { create: jest.fn(), findUnique: jest.fn() },
            $connect: jest.fn(),
            $disconnect: jest.fn(),
            $queryRaw: jest.fn(),
          };
        }),
      }));
      require('../../../../dreamscape-services/payment/src/services/DatabaseService');
    });

    process.env.NODE_ENV = originalEnv;
    expect(capturedLog).toEqual(['query', 'error', 'warn']);
  });
});

// ─── healthCheck() ────────────────────────────────────────────────────────────

describe('healthCheck()', () => {
  it('returns unhealthy when not initialized', async () => {
    const result = await databaseService.healthCheck();

    expect(result).toEqual({
      healthy: false,
      details: { error: 'Database not initialized' },
    });
  });

  it('returns healthy when initialized and $queryRaw resolves', async () => {
    (databaseService as any).isInitialized = true;
    getPrisma().$queryRaw.mockResolvedValueOnce([{ '?column?': 1 }]);

    const result = await databaseService.healthCheck();

    expect(result).toEqual({ healthy: true, details: { connected: true } });
  });

  it('returns unhealthy with error message when $queryRaw throws an Error', async () => {
    (databaseService as any).isInitialized = true;
    getPrisma().$queryRaw.mockRejectedValueOnce(new Error('Connection lost'));

    const result = await databaseService.healthCheck();

    expect(result).toEqual({
      healthy: false,
      details: { error: 'Connection lost' },
    });
  });

  it('returns unhealthy with "Unknown error" when $queryRaw throws a non-Error', async () => {
    (databaseService as any).isInitialized = true;
    getPrisma().$queryRaw.mockRejectedValueOnce('plain string error');

    const result = await databaseService.healthCheck();

    expect(result).toEqual({
      healthy: false,
      details: { error: 'Unknown error' },
    });
  });
});
