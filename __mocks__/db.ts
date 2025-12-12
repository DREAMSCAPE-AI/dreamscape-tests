/**
 * Mock for @dreamscape/db package - INFRA-013.1
 *
 * This mock is used in tests to avoid requiring actual database connections.
 */

export const prisma = {
  $queryRaw: jest.fn(),
  $connect: jest.fn(),
  $disconnect: jest.fn(),
  $executeRaw: jest.fn(),
  $transaction: jest.fn(),
};

export default prisma;
