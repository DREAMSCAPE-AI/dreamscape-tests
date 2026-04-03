/**
 * Mock for @dreamscape/db package - INFRA-013.1
 *
 * This mock is used in tests to avoid requiring actual database connections.
 */

// Prisma enum used by payment service
export const PaymentTransactionStatus = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED',
  CANCELED: 'CANCELED',
  REFUNDED: 'REFUNDED',
} as const;

// Mock PrismaClient class (used by DatabaseService)
export class PrismaClient {
  paymentTransaction = {
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
  };
  processedWebhookEvent = {
    create: jest.fn(),
    findUnique: jest.fn(),
  };
  $connect = jest.fn();
  $disconnect = jest.fn();
  $queryRaw = jest.fn();
}

export const prisma = {
  $queryRaw: jest.fn(),
  $connect: jest.fn(),
  $disconnect: jest.fn(),
  $executeRaw: jest.fn(),
  $transaction: jest.fn(),

  // Auth service models - DR-538
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn(),
  },
  session: {
    create: jest.fn(),
    findFirst: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  },
  tokenBlacklist: {
    create: jest.fn(),
    findUnique: jest.fn(),
  },
};

export default prisma;
