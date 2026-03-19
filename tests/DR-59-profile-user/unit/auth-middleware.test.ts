import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

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
import { authenticateToken } from '../../../../dreamscape-services/user/src/middleware/auth';

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

    jest.clearAllMocks();

    process.env.JWT_SECRET = 'test-secret-key';

    // Default: token not blacklisted
    mockPrisma.tokenBlacklist.findUnique.mockResolvedValue(null);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('authenticateToken', () => {
    it('should authenticate valid token successfully', async () => {
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
      };

      const token = jwt.sign(
        { userId: mockUser.id, email: mockUser.email, type: 'access' },
        process.env.JWT_SECRET!
      );
      mockRequest.headers = { authorization: `Bearer ${token}` };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      await authenticateToken(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        select: { id: true, email: true },
      });
      expect(mockRequest.user).toEqual({ id: mockUser.id, email: mockUser.email });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject request without authorization header', async () => {
      mockRequest.headers = {};

      await authenticateToken(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(responseStatus).toHaveBeenCalledWith(401);
      expect(responseJson).toHaveBeenCalledWith({
        success: false,
        message: 'Access token required',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject request with invalid authorization format', async () => {
      mockRequest.headers = { authorization: 'InvalidFormat token' };

      await authenticateToken(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(responseStatus).toHaveBeenCalledWith(401);
      expect(responseJson).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid token',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject blacklisted token', async () => {
      const token = jwt.sign(
        { userId: 'test-user-id', email: 'test@example.com', type: 'access' },
        process.env.JWT_SECRET!
      );
      mockRequest.headers = { authorization: `Bearer ${token}` };

      mockPrisma.tokenBlacklist.findUnique.mockResolvedValue({ token });

      await authenticateToken(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(responseStatus).toHaveBeenCalledWith(401);
      expect(responseJson).toHaveBeenCalledWith({
        success: false,
        message: 'Token has been revoked',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject invalid JWT token', async () => {
      mockRequest.headers = { authorization: 'Bearer invalid-jwt-token' };

      await authenticateToken(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(responseStatus).toHaveBeenCalledWith(401);
      expect(responseJson).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid token',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject token when user not found', async () => {
      const token = jwt.sign(
        { userId: 'nonexistent-user', email: 'test@example.com', type: 'access' },
        process.env.JWT_SECRET!
      );
      mockRequest.headers = { authorization: `Bearer ${token}` };

      mockPrisma.user.findUnique.mockResolvedValue(null);

      await authenticateToken(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(responseStatus).toHaveBeenCalledWith(401);
      expect(responseJson).toHaveBeenCalledWith({
        success: false,
        message: 'User not found',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle expired JWT token', async () => {
      const expiredToken = jwt.sign(
        { userId: 'test-user-id', email: 'test@example.com', type: 'access' },
        process.env.JWT_SECRET!,
        { expiresIn: '-1h' }
      );
      mockRequest.headers = { authorization: `Bearer ${expiredToken}` };

      await authenticateToken(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(responseStatus).toHaveBeenCalledWith(401);
      expect(responseJson).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid token',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle tokenBlacklist Prisma errors gracefully', async () => {
      const token = jwt.sign(
        { userId: 'test-user-id', email: 'test@example.com', type: 'access' },
        process.env.JWT_SECRET!
      );
      mockRequest.headers = { authorization: `Bearer ${token}` };

      mockPrisma.tokenBlacklist.findUnique.mockRejectedValue(new Error('DB connection failed'));

      await authenticateToken(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(responseStatus).toHaveBeenCalledWith(500);
      expect(responseJson).toHaveBeenCalledWith({
        success: false,
        message: 'Internal server error',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle database connection errors', async () => {
      const token = jwt.sign(
        { userId: 'test-user-id', email: 'test@example.com', type: 'access' },
        process.env.JWT_SECRET!
      );
      mockRequest.headers = { authorization: `Bearer ${token}` };

      mockPrisma.user.findUnique.mockRejectedValue(new Error('Database connection failed'));

      await authenticateToken(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(responseStatus).toHaveBeenCalledWith(500);
      expect(responseJson).toHaveBeenCalledWith({
        success: false,
        message: 'Internal server error',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('token type validation', () => {
    it('should reject refresh token used as access token', async () => {
      const refreshToken = jwt.sign(
        { userId: 'test-user-id', email: 'test@example.com', type: 'refresh' },
        process.env.JWT_SECRET!
      );
      mockRequest.headers = { authorization: `Bearer ${refreshToken}` };

      await authenticateToken(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(responseStatus).toHaveBeenCalledWith(401);
      expect(responseJson).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid token type',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject token without type field', async () => {
      const tokenNoType = jwt.sign(
        { userId: 'test-user-id', email: 'test@example.com' },
        process.env.JWT_SECRET!
      );
      mockRequest.headers = { authorization: `Bearer ${tokenNoType}` };

      await authenticateToken(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(responseStatus).toHaveBeenCalledWith(401);
      expect(responseJson).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid token type',
      });
    });

    it('should handle blacklist check via Prisma not Redis', async () => {
      const token = jwt.sign(
        { userId: 'test-user-id', email: 'test@example.com', type: 'access' },
        process.env.JWT_SECRET!
      );
      mockRequest.headers = { authorization: `Bearer ${token}` };
      mockPrisma.tokenBlacklist.findUnique.mockResolvedValue({ token });

      await authenticateToken(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockPrisma.tokenBlacklist.findUnique).toHaveBeenCalledWith({ where: { token } });
      expect(responseStatus).toHaveBeenCalledWith(401);
    });

    it('should handle multiple sequential blacklist checks', async () => {
      const token = jwt.sign(
        { userId: 'test-user-id', email: 'test@example.com', type: 'access' },
        process.env.JWT_SECRET!
      );
      mockRequest.headers = { authorization: `Bearer ${token}` };

      // First request: not blacklisted
      mockPrisma.tokenBlacklist.findUnique.mockResolvedValueOnce(null);
      mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'test-user-id', email: 'test@example.com' });

      await authenticateToken(mockRequest as AuthRequest, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);

      jest.clearAllMocks();

      // Second request: token now blacklisted
      mockPrisma.tokenBlacklist.findUnique.mockResolvedValueOnce({ token });

      await authenticateToken(mockRequest as AuthRequest, mockResponse as Response, mockNext);
      expect(responseStatus).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should calculate correct TTL awareness via exp field in token', async () => {
      const exp = Math.floor(Date.now() / 1000) + 3600;
      const token = jwt.sign(
        { userId: 'test-user-id', email: 'test@example.com', type: 'access', exp },
        process.env.JWT_SECRET!
      );
      mockRequest.headers = { authorization: `Bearer ${token}` };
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'test-user-id', email: 'test@example.com' });

      await authenticateToken(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject truly expired token regardless of blacklist', async () => {
      const expiredToken = jwt.sign(
        { userId: 'test-user-id', email: 'test@example.com', type: 'access' },
        process.env.JWT_SECRET!,
        { expiresIn: '-1h' }
      );
      mockRequest.headers = { authorization: `Bearer ${expiredToken}` };

      await authenticateToken(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(responseStatus).toHaveBeenCalledWith(401);
      expect(responseJson).toHaveBeenCalledWith({ success: false, message: 'Invalid token' });
    });
  });

  describe('Token Validation Edge Cases', () => {
    it('should handle malformed JWT token structure', async () => {
      mockRequest.headers = { authorization: 'Bearer not.a.valid.jwt.structure.here' };

      await authenticateToken(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(responseStatus).toHaveBeenCalledWith(401);
      expect(responseJson).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid token',
      });
    });

    it('should handle JWT with invalid signature', async () => {
      const tokenWithWrongSignature = jwt.sign(
        { userId: 'test-user-id', email: 'test@example.com', type: 'access' },
        'wrong-secret-key'
      );
      mockRequest.headers = { authorization: `Bearer ${tokenWithWrongSignature}` };

      await authenticateToken(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(responseStatus).toHaveBeenCalledWith(401);
      expect(responseJson).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid token',
      });
    });

    it('should handle missing JWT_SECRET environment variable', async () => {
      delete process.env.JWT_SECRET;

      mockRequest.headers = { authorization: 'Bearer any-token' };

      await authenticateToken(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(responseStatus).toHaveBeenCalledWith(500);
      expect(responseJson).toHaveBeenCalledWith({
        success: false,
        message: 'JWT secret not configured',
      });

      process.env.JWT_SECRET = 'test-secret-key';
    });
  });

  describe('Security Features', () => {
    it('should prevent token reuse after blacklisting', async () => {
      const token = jwt.sign(
        { userId: 'test-user-id', email: 'test@example.com', type: 'access' },
        process.env.JWT_SECRET!
      );
      mockRequest.headers = { authorization: `Bearer ${token}` };

      // First request — valid
      mockPrisma.tokenBlacklist.findUnique.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'test-user-id', email: 'test@example.com' });

      await authenticateToken(mockRequest as AuthRequest, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();

      jest.clearAllMocks();

      // Second request — blacklisted
      mockPrisma.tokenBlacklist.findUnique.mockResolvedValue({ token });

      await authenticateToken(mockRequest as AuthRequest, mockResponse as Response, mockNext);
      expect(responseStatus).toHaveBeenCalledWith(401);
      expect(responseJson).toHaveBeenCalledWith({ success: false, message: 'Token has been revoked' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should validate token payload structure', async () => {
      const tokenWithMissingType = jwt.sign(
        { userId: 'test-user-id' },
        process.env.JWT_SECRET!
      );
      mockRequest.headers = { authorization: `Bearer ${tokenWithMissingType}` };

      await authenticateToken(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(responseStatus).toHaveBeenCalledWith(401);
      expect(responseJson).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid token type',
      });
    });
  });
});
