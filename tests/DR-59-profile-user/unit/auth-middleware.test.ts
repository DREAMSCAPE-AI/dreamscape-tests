import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock Redis client
const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  exists: jest.fn(),
};

jest.mock('redis', () => ({
  createClient: jest.fn(() => mockRedis),
}));

// Mock Prisma client
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
  },
  tokenBlacklist: {
    create: jest.fn(),
    findUnique: jest.fn(),
  },
};

jest.mock('@dreamscape/db', () => ({
  prisma: mockPrisma,
}));

// Import after mocking
import { authenticateToken, blacklistToken } from '../../../dreamscape-services/user/src/middleware/auth';

// Extend Request type for testing
interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

describe('Enhanced Auth Middleware', () => {
  let mockRequest: Partial<AuthRequest>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let responseJson: jest.Mock;
  let responseStatus: jest.Mock;

  beforeEach(() => {
    responseJson = jest.fn().mockReturnThis();
    responseStatus = jest.fn().mockReturnThis();

    mockResponse = {
      json: responseJson,
      status: responseStatus,
    };

    mockRequest = {
      headers: {},
    };

    mockNext = jest.fn();

    // Reset all mocks
    jest.clearAllMocks();

    // Set default environment
    process.env.JWT_SECRET = 'test-secret-key';
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('authenticateToken', () => {
    it('should authenticate valid token successfully', async () => {
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        username: 'testuser',
      };

      const token = jwt.sign({ userId: mockUser.id, email: mockUser.email }, process.env.JWT_SECRET!);
      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      mockRedis.get.mockResolvedValue(null); // Token not blacklisted
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      await authenticateToken(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        select: {
          id: true,
          email: true,
          username: true,
        },
      });
      expect(mockRequest.user).toEqual({
        id: mockUser.id,
        email: mockUser.email,
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject request without authorization header', async () => {
      mockRequest.headers = {};

      await authenticateToken(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(responseStatus).toHaveBeenCalledWith(401);
      expect(responseJson).toHaveBeenCalledWith({
        error: 'Access token required',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject request with invalid authorization format', async () => {
      mockRequest.headers = {
        authorization: 'InvalidFormat token',
      };

      await authenticateToken(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(responseStatus).toHaveBeenCalledWith(401);
      expect(responseJson).toHaveBeenCalledWith({
        error: 'Invalid token format',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject blacklisted token', async () => {
      const token = jwt.sign({ userId: 'test-user-id', email: 'test@example.com' }, process.env.JWT_SECRET!);
      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      mockRedis.get.mockResolvedValue('blacklisted'); // Token is blacklisted

      await authenticateToken(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(responseStatus).toHaveBeenCalledWith(401);
      expect(responseJson).toHaveBeenCalledWith({
        error: 'Token has been revoked',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject invalid JWT token', async () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid-jwt-token',
      };

      await authenticateToken(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(responseStatus).toHaveBeenCalledWith(401);
      expect(responseJson).toHaveBeenCalledWith({
        error: 'Invalid token',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject token when user not found', async () => {
      const token = jwt.sign({ userId: 'nonexistent-user', email: 'test@example.com' }, process.env.JWT_SECRET!);
      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      mockRedis.get.mockResolvedValue(null); // Token not blacklisted
      mockPrisma.user.findUnique.mockResolvedValue(null); // User not found

      await authenticateToken(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(responseStatus).toHaveBeenCalledWith(401);
      expect(responseJson).toHaveBeenCalledWith({
        error: 'User not found',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle expired JWT token', async () => {
      const expiredToken = jwt.sign(
        { userId: 'test-user-id', email: 'test@example.com' },
        process.env.JWT_SECRET!,
        { expiresIn: '-1h' } // Expired 1 hour ago
      );
      mockRequest.headers = {
        authorization: `Bearer ${expiredToken}`,
      };

      await authenticateToken(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(responseStatus).toHaveBeenCalledWith(401);
      expect(responseJson).toHaveBeenCalledWith({
        error: 'Invalid token',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle Redis connection errors gracefully', async () => {
      const token = jwt.sign({ userId: 'test-user-id', email: 'test@example.com' }, process.env.JWT_SECRET!);
      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));

      await authenticateToken(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(responseStatus).toHaveBeenCalledWith(500);
      expect(responseJson).toHaveBeenCalledWith({
        error: 'Internal server error',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle database connection errors', async () => {
      const token = jwt.sign({ userId: 'test-user-id', email: 'test@example.com' }, process.env.JWT_SECRET!);
      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      mockRedis.get.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockRejectedValue(new Error('Database connection failed'));

      await authenticateToken(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(responseStatus).toHaveBeenCalledWith(500);
      expect(responseJson).toHaveBeenCalledWith({
        error: 'Internal server error',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('blacklistToken', () => {
    it('should blacklist token successfully', async () => {
      const token = 'valid-jwt-token';
      const decodedToken = { userId: 'test-user-id', exp: Math.floor(Date.now() / 1000) + 3600 };

      jest.spyOn(jwt, 'decode').mockReturnValue(decodedToken as any);
      mockRedis.set.mockResolvedValue('OK');
      mockPrisma.tokenBlacklist.create.mockResolvedValue({
        id: 'blacklist-id',
        token,
        userId: decodedToken.userId,
        expiresAt: new Date(decodedToken.exp * 1000),
      });

      const result = await blacklistToken(token);

      expect(mockRedis.set).toHaveBeenCalledWith(
        `blacklist:${token}`,
        'true',
        'EX',
        expect.any(Number)
      );
      expect(mockPrisma.tokenBlacklist.create).toHaveBeenCalledWith({
        data: {
          token,
          userId: decodedToken.userId,
          expiresAt: new Date(decodedToken.exp * 1000),
        },
      });
      expect(result).toBe(true);
    });

    it('should handle invalid token during blacklisting', async () => {
      const invalidToken = 'invalid-token';

      jest.spyOn(jwt, 'decode').mockReturnValue(null);

      const result = await blacklistToken(invalidToken);

      expect(result).toBe(false);
      expect(mockRedis.set).not.toHaveBeenCalled();
      expect(mockPrisma.tokenBlacklist.create).not.toHaveBeenCalled();
    });

    it('should handle Redis errors during blacklisting', async () => {
      const token = 'valid-jwt-token';
      const decodedToken = { userId: 'test-user-id', exp: Math.floor(Date.now() / 1000) + 3600 };

      jest.spyOn(jwt, 'decode').mockReturnValue(decodedToken as any);
      mockRedis.set.mockRejectedValue(new Error('Redis error'));

      const result = await blacklistToken(token);

      expect(result).toBe(false);
      expect(mockPrisma.tokenBlacklist.create).not.toHaveBeenCalled();
    });

    it('should handle database errors during blacklisting', async () => {
      const token = 'valid-jwt-token';
      const decodedToken = { userId: 'test-user-id', exp: Math.floor(Date.now() / 1000) + 3600 };

      jest.spyOn(jwt, 'decode').mockReturnValue(decodedToken as any);
      mockRedis.set.mockResolvedValue('OK');
      mockPrisma.tokenBlacklist.create.mockRejectedValue(new Error('Database error'));

      const result = await blacklistToken(token);

      expect(result).toBe(false);
    });

    it('should calculate correct TTL for token expiration', async () => {
      const token = 'valid-jwt-token';
      const expTime = Math.floor(Date.now() / 1000) + 7200; // 2 hours from now
      const decodedToken = { userId: 'test-user-id', exp: expTime };

      jest.spyOn(jwt, 'decode').mockReturnValue(decodedToken as any);
      mockRedis.set.mockResolvedValue('OK');
      mockPrisma.tokenBlacklist.create.mockResolvedValue({} as any);

      await blacklistToken(token);

      const expectedTtl = expTime - Math.floor(Date.now() / 1000);
      expect(mockRedis.set).toHaveBeenCalledWith(
        `blacklist:${token}`,
        'true',
        'EX',
        expect.any(Number)
      );

      // Verify TTL is approximately correct (within 10 seconds tolerance)
      const actualTtl = (mockRedis.set as jest.Mock).mock.calls[0][3];
      expect(Math.abs(actualTtl - expectedTtl)).toBeLessThan(10);
    });

    it('should handle expired token during blacklisting', async () => {
      const token = 'expired-jwt-token';
      const expiredTime = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      const decodedToken = { userId: 'test-user-id', exp: expiredTime };

      jest.spyOn(jwt, 'decode').mockReturnValue(decodedToken as any);

      const result = await blacklistToken(token);

      expect(result).toBe(false);
      expect(mockRedis.set).not.toHaveBeenCalled();
      expect(mockPrisma.tokenBlacklist.create).not.toHaveBeenCalled();
    });
  });

  describe('Token Validation Edge Cases', () => {
    it('should handle malformed JWT token structure', async () => {
      mockRequest.headers = {
        authorization: 'Bearer not.a.valid.jwt.structure.here',
      };

      await authenticateToken(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(responseStatus).toHaveBeenCalledWith(401);
      expect(responseJson).toHaveBeenCalledWith({
        error: 'Invalid token',
      });
    });

    it('should handle JWT with invalid signature', async () => {
      const tokenWithWrongSignature = jwt.sign(
        { userId: 'test-user-id', email: 'test@example.com' },
        'wrong-secret-key'
      );
      mockRequest.headers = {
        authorization: `Bearer ${tokenWithWrongSignature}`,
      };

      await authenticateToken(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(responseStatus).toHaveBeenCalledWith(401);
      expect(responseJson).toHaveBeenCalledWith({
        error: 'Invalid token',
      });
    });

    it('should handle missing JWT_SECRET environment variable', async () => {
      delete process.env.JWT_SECRET;

      const token = 'any-token';
      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      await authenticateToken(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(responseStatus).toHaveBeenCalledWith(500);
      expect(responseJson).toHaveBeenCalledWith({
        error: 'Internal server error',
      });

      // Restore for other tests
      process.env.JWT_SECRET = 'test-secret-key';
    });
  });

  describe('Security Features', () => {
    it('should prevent token reuse after blacklisting', async () => {
      const token = jwt.sign({ userId: 'test-user-id', email: 'test@example.com' }, process.env.JWT_SECRET!);

      // First request should work
      mockRequest.headers = { authorization: `Bearer ${token}` };
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'test-user-id',
        email: 'test@example.com',
        username: 'testuser',
      });

      await authenticateToken(mockRequest as AuthRequest, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();

      // Reset mocks
      jest.clearAllMocks();

      // Blacklist the token
      mockRedis.get.mockResolvedValue('blacklisted');

      // Second request should fail
      await authenticateToken(mockRequest as AuthRequest, mockResponse as Response, mockNext);
      expect(responseStatus).toHaveBeenCalledWith(401);
      expect(responseJson).toHaveBeenCalledWith({
        error: 'Token has been revoked',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should validate token payload structure', async () => {
      const tokenWithMissingFields = jwt.sign({ userId: 'test-user-id' }, process.env.JWT_SECRET!); // Missing email
      mockRequest.headers = {
        authorization: `Bearer ${tokenWithMissingFields}`,
      };

      mockRedis.get.mockResolvedValue(null);

      await authenticateToken(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(responseStatus).toHaveBeenCalledWith(401);
      expect(responseJson).toHaveBeenCalledWith({
        error: 'Invalid token',
      });
    });
  });
});