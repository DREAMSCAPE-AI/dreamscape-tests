/**
 * Mock for @config/redis singleton - DR-538-US-TEST-002
 */

export const mockRawClient = {
  keys: jest.fn(),
  del: jest.fn(),
  sAdd: jest.fn(),
  sRem: jest.fn(),
  sMembers: jest.fn(),
  sendCommand: jest.fn(),
};

const mockRedisClient = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  exists: jest.fn(),
  expire: jest.fn(),
  ttl: jest.fn(),
  isReady: jest.fn().mockReturnValue(true),
  getClient: jest.fn().mockReturnValue(mockRawClient),
  connect: jest.fn(),
  disconnect: jest.fn(),
};

export default mockRedisClient;
