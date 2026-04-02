/**
 * DR-538 - US-TEST-001
 * Unit tests for AuthService: login, register, refresh, password reset, logout
 * Coverage target: ≥ 80% on AuthService.ts
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { prisma } from '@dreamscape/db';
import { AuthService } from '../../../../dreamscape-services/auth/src/services/AuthService';

// ─── Mock external dependencies ───────────────────────────────────────────────

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
  verify: jest.fn(),
  decode: jest.fn(),
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

// ─── Typed mock references ─────────────────────────────────────────────────────

const mockJwt = jwt as jest.Mocked<typeof jwt>;
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
const mockPrisma = prisma as any;

// ─── Test data factory ─────────────────────────────────────────────────────────

const makeUser = (overrides: Record<string, any> = {}) => ({
  id: 'user-123',
  email: 'test@example.com',
  username: 'testuser',
  firstName: 'Test',
  lastName: 'User',
  isVerified: false,
  role: 'USER' as const,
  onboardingCompleted: false,
  onboardingCompletedAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  ...overrides,
});

const makeSession = (overrides: Record<string, any> = {}) => ({
  id: 'session-456',
  token: 'refresh-token-abc',
  userId: 'user-123',
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  user: { id: 'user-123', email: 'test@example.com' },
  ...overrides,
});

// ─── Default mock setup ────────────────────────────────────────────────────────

beforeEach(() => {
  process.env.JWT_SECRET = 'test-jwt-secret';
  process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret';

  // generateTokenPair defaults (called internally by signup, login, refreshToken)
  (mockJwt.sign as jest.Mock).mockReturnValue('mock-token');
  mockPrisma.session.create.mockResolvedValue({ id: 'session-123' });
  (mockBcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
});

// ══════════════════════════════════════════════════════════════════════════════
// SIGNUP
// ══════════════════════════════════════════════════════════════════════════════

describe('AuthService.signup', () => {
  it('creates a user and returns tokens when email is new', async () => {
    const created = makeUser({ email: 'new@example.com' });
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue(created);

    const result = await AuthService.signup({
      email: 'new@example.com',
      password: 'Password123!',
      firstName: 'Test',
      lastName: 'User',
    });

    expect(result.success).toBe(true);
    expect(result.message).toBe('Account created successfully');
    expect(result.data?.user).toEqual(created);
    expect(result.data?.tokens).toBeDefined();
    expect(mockBcrypt.hash).toHaveBeenCalledWith('Password123!', 12);
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'new@example.com' },
    });
  });

  it('returns error when email already exists (findUnique hit)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(makeUser());

    const result = await AuthService.signup({ email: 'test@example.com', password: 'Password123!' });

    expect(result.success).toBe(false);
    expect(result.message).toBe('Email already exists');
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });

  it('handles Prisma P2002 unique constraint error as duplicate email', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const p2002 = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
    mockPrisma.user.create.mockRejectedValue(p2002);

    const result = await AuthService.signup({ email: 'test@example.com', password: 'Password123!' });

    expect(result.success).toBe(false);
    expect(result.message).toBe('Email already exists');
  });

  it('returns a generic error on unexpected database failure', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockRejectedValue(new Error('DB connection lost'));

    const result = await AuthService.signup({ email: 'test@example.com', password: 'Password123!' });

    expect(result.success).toBe(false);
    expect(result.message).toBe('Failed to create account. Please try again.');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// LOGIN
// ══════════════════════════════════════════════════════════════════════════════

describe('AuthService.login', () => {
  it('returns tokens on valid credentials', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ ...makeUser(), password: 'hashed' });
    (mockBcrypt.compare as jest.Mock).mockResolvedValue(true);

    const result = await AuthService.login({ email: 'test@example.com', password: 'Password123!' });

    expect(result.success).toBe(true);
    expect(result.message).toBe('Login successful');
    expect(result.data?.tokens).toBeDefined();
  });

  it('does not expose the hashed password in the response', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ ...makeUser(), password: 'hashed' });
    (mockBcrypt.compare as jest.Mock).mockResolvedValue(true);

    const result = await AuthService.login({ email: 'test@example.com', password: 'Password123!' });

    expect((result.data?.user as any)?.password).toBeUndefined();
  });

  it('returns error when user does not exist', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const result = await AuthService.login({ email: 'ghost@example.com', password: 'Password123!' });

    expect(result.success).toBe(false);
    expect(result.message).toBe('Invalid email or password');
    expect(mockBcrypt.compare).not.toHaveBeenCalled();
  });

  it('returns error when password is incorrect', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ ...makeUser(), password: 'hashed' });
    (mockBcrypt.compare as jest.Mock).mockResolvedValue(false);

    const result = await AuthService.login({ email: 'test@example.com', password: 'WrongPass!' });

    expect(result.success).toBe(false);
    expect(result.message).toBe('Invalid email or password');
  });

  it('stores a 30-day session when rememberMe is true', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ ...makeUser(), password: 'hashed' });
    (mockBcrypt.compare as jest.Mock).mockResolvedValue(true);

    await AuthService.login({ email: 'test@example.com', password: 'Password123!', rememberMe: true });

    const sessionArgs = mockPrisma.session.create.mock.calls[0][0].data;
    expect(sessionArgs.expiresAt.getTime()).toBeGreaterThan(Date.now() + 29 * 24 * 60 * 60 * 1000);
  });

  it('returns error when database throws unexpectedly', async () => {
    mockPrisma.user.findUnique.mockRejectedValue(new Error('DB timeout'));

    const result = await AuthService.login({ email: 'test@example.com', password: 'Password123!' });

    expect(result.success).toBe(false);
    expect(result.message).toBe('Login failed. Please try again.');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// REFRESH TOKEN
// ══════════════════════════════════════════════════════════════════════════════

describe('AuthService.refreshToken', () => {
  const validDecoded = { userId: 'user-123', email: 'test@example.com', type: 'refresh' };

  it('returns new tokens when refresh token and session are valid', async () => {
    (mockJwt.verify as jest.Mock).mockReturnValue(validDecoded);
    mockPrisma.session.count.mockResolvedValue(1);
    mockPrisma.session.findFirst.mockResolvedValue(makeSession());
    mockPrisma.session.delete.mockResolvedValue({});

    const result = await AuthService.refreshToken('refresh-token-abc');

    expect(result.success).toBe(true);
    expect(result.message).toBe('Tokens refreshed successfully');
    expect(result.data?.tokens).toBeDefined();
    expect(mockPrisma.session.delete).toHaveBeenCalledWith({ where: { id: 'session-456' } });
  });

  it('fails when JWT verification throws (expired token)', async () => {
    (mockJwt.verify as jest.Mock).mockImplementation(() => { throw new Error('jwt expired'); });

    const result = await AuthService.refreshToken('expired-refresh-token');

    expect(result.success).toBe(false);
    expect(result.message).toBe('Failed to refresh token');
  });

  it("fails when token type is not 'refresh'", async () => {
    (mockJwt.verify as jest.Mock).mockReturnValue({ ...validDecoded, type: 'access' });

    const result = await AuthService.refreshToken('access-token-used-as-refresh');

    expect(result.success).toBe(false);
    expect(result.message).toBe('Invalid token type');
  });

  it('fails when JWT_REFRESH_SECRET and JWT_SECRET are both missing', async () => {
    delete process.env.JWT_REFRESH_SECRET;
    delete process.env.JWT_SECRET;

    const result = await AuthService.refreshToken('any-token');

    expect(result.success).toBe(false);
    expect(result.message).toBe('Failed to refresh token');
  });

  it('fails when session is not found in database', async () => {
    (mockJwt.verify as jest.Mock).mockReturnValue(validDecoded);
    mockPrisma.session.count.mockResolvedValue(0);
    mockPrisma.session.findFirst.mockResolvedValue(null);

    const result = await AuthService.refreshToken('orphaned-refresh-token');

    expect(result.success).toBe(false);
    expect(result.message).toBe('Invalid or expired refresh token');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// LOGOUT
// ══════════════════════════════════════════════════════════════════════════════

describe('AuthService.logout', () => {
  it('deletes the session by refresh token and returns success', async () => {
    mockPrisma.session.deleteMany.mockResolvedValue({ count: 1 });

    const result = await AuthService.logout('refresh-token-abc');

    expect(result.success).toBe(true);
    expect(result.message).toBe('Logged out successfully');
    expect(mockPrisma.session.deleteMany).toHaveBeenCalledWith({ where: { token: 'refresh-token-abc' } });
  });

  it('blacklists the access token when provided', async () => {
    mockPrisma.session.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.tokenBlacklist.create.mockResolvedValue({});
    (mockJwt.decode as jest.Mock).mockReturnValue({
      userId: 'user-123',
      exp: Math.floor(Date.now() / 1000) + 900,
    });

    const result = await AuthService.logout('refresh-token-abc', 'access-token-xyz');

    expect(result.success).toBe(true);
    expect(mockJwt.decode).toHaveBeenCalledWith('access-token-xyz');
    expect(mockPrisma.tokenBlacklist.create).toHaveBeenCalled();
  });

  it('succeeds without an access token (no blacklist call)', async () => {
    mockPrisma.session.deleteMany.mockResolvedValue({ count: 1 });

    const result = await AuthService.logout('refresh-token-abc');

    expect(result.success).toBe(true);
    expect(mockJwt.decode).not.toHaveBeenCalled();
    expect(mockPrisma.tokenBlacklist.create).not.toHaveBeenCalled();
  });

  it('returns error when session deletion throws', async () => {
    mockPrisma.session.deleteMany.mockRejectedValue(new Error('DB error'));

    const result = await AuthService.logout('refresh-token-abc');

    expect(result.success).toBe(false);
    expect(result.message).toBe('Logout failed');
  });

  it('skips blacklisting when second jwt.decode (inside addTokenToBlacklist) returns null', async () => {
    mockPrisma.session.deleteMany.mockResolvedValue({ count: 1 });
    (mockJwt.decode as jest.Mock)
      .mockReturnValueOnce({ userId: 'user-123' }) // first call: in logout()
      .mockReturnValueOnce(null);                  // second call: inside addTokenToBlacklist()

    const result = await AuthService.logout('refresh-token-abc', 'access-token-xyz');

    expect(result.success).toBe(true);
    expect(mockPrisma.tokenBlacklist.create).not.toHaveBeenCalled();
  });

  it('still succeeds when tokenBlacklist.create throws (error silently swallowed)', async () => {
    mockPrisma.session.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.tokenBlacklist.create.mockRejectedValue(new Error('DB error'));
    (mockJwt.decode as jest.Mock).mockReturnValue({
      userId: 'user-123',
      exp: Math.floor(Date.now() / 1000) + 900,
    });

    const result = await AuthService.logout('refresh-token-abc', 'access-token-xyz');

    expect(result.success).toBe(true);
  });

  it('skips blacklisting when jwt.decode returns object without userId', async () => {
    mockPrisma.session.deleteMany.mockResolvedValue({ count: 1 });
    (mockJwt.decode as jest.Mock).mockReturnValue({ exp: 1234 }); // no userId

    const result = await AuthService.logout('refresh-token-abc', 'access-token-xyz');

    expect(result.success).toBe(true);
    expect(mockPrisma.tokenBlacklist.create).not.toHaveBeenCalled();
  });

  it('skips tokenBlacklist.create when access token has no exp claim', async () => {
    mockPrisma.session.deleteMany.mockResolvedValue({ count: 1 });
    (mockJwt.decode as jest.Mock).mockReturnValue({ userId: 'user-123' }); // no exp

    const result = await AuthService.logout('refresh-token-abc', 'access-token-xyz');

    expect(result.success).toBe(true);
    expect(mockPrisma.tokenBlacklist.create).not.toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// LOGOUT ALL DEVICES
// ══════════════════════════════════════════════════════════════════════════════

describe('AuthService.logoutAllDevices', () => {
  it('deletes all sessions for the user', async () => {
    mockPrisma.session.deleteMany.mockResolvedValue({ count: 3 });

    const result = await AuthService.logoutAllDevices('user-123');

    expect(result.success).toBe(true);
    expect(result.message).toBe('Logged out from all devices successfully');
    expect(mockPrisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-123' } });
  });

  it('blacklists current access token when provided', async () => {
    mockPrisma.session.deleteMany.mockResolvedValue({ count: 2 });
    mockPrisma.tokenBlacklist.create.mockResolvedValue({});
    (mockJwt.decode as jest.Mock).mockReturnValue({
      userId: 'user-123',
      exp: Math.floor(Date.now() / 1000) + 900,
    });

    const result = await AuthService.logoutAllDevices('user-123', 'current-access-token');

    expect(result.success).toBe(true);
    expect(mockPrisma.tokenBlacklist.create).toHaveBeenCalled();
  });

  it('returns error when session deletion throws', async () => {
    mockPrisma.session.deleteMany.mockRejectedValue(new Error('DB error'));

    const result = await AuthService.logoutAllDevices('user-123');

    expect(result.success).toBe(false);
    expect(result.message).toBe('Failed to logout from all devices');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// GET USER PROFILE
// ══════════════════════════════════════════════════════════════════════════════

describe('AuthService.getUserProfile', () => {
  it('returns the user profile when found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(makeUser());

    const result = await AuthService.getUserProfile('user-123');

    expect(result.success).toBe(true);
    expect(result.message).toBe('Profile retrieved successfully');
    expect(result.data?.user).toEqual(makeUser());
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-123' } })
    );
  });

  it('returns error when user is not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const result = await AuthService.getUserProfile('nonexistent-id');

    expect(result.success).toBe(false);
    expect(result.message).toBe('User not found');
  });

  it('returns error on database failure', async () => {
    mockPrisma.user.findUnique.mockRejectedValue(new Error('DB error'));

    const result = await AuthService.getUserProfile('user-123');

    expect(result.success).toBe(false);
    expect(result.message).toBe('Failed to retrieve profile');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// UPDATE PROFILE
// ══════════════════════════════════════════════════════════════════════════════

describe('AuthService.updateProfile', () => {
  it('updates and returns the user profile', async () => {
    const updated = makeUser({ firstName: 'Updated' });
    mockPrisma.user.update.mockResolvedValue(updated);

    const result = await AuthService.updateProfile('user-123', { firstName: 'Updated' });

    expect(result.success).toBe(true);
    expect(result.message).toBe('Profile updated successfully');
    expect(result.data?.user.firstName).toBe('Updated');
  });

  it('returns error on unique constraint violation (email/username taken)', async () => {
    mockPrisma.user.update.mockRejectedValue(new Error('Unique constraint failed on email'));

    const result = await AuthService.updateProfile('user-123', { email: 'taken@example.com' });

    expect(result.success).toBe(false);
    expect(result.message).toBe('Email or username already exists');
  });

  it('returns generic error on unexpected failure', async () => {
    mockPrisma.user.update.mockRejectedValue(new Error('Connection reset'));

    const result = await AuthService.updateProfile('user-123', { firstName: 'Test' });

    expect(result.success).toBe(false);
    expect(result.message).toBe('Failed to update profile');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// CHANGE PASSWORD
// ══════════════════════════════════════════════════════════════════════════════

describe('AuthService.changePassword', () => {
  it('changes password and logs out all devices on success', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-123', password: 'old-hashed' });
    (mockBcrypt.compare as jest.Mock).mockResolvedValue(true);
    mockPrisma.user.update.mockResolvedValue({});
    mockPrisma.session.deleteMany.mockResolvedValue({ count: 2 });

    const result = await AuthService.changePassword('user-123', 'OldPass123!', 'NewPass456!');

    expect(result.success).toBe(true);
    expect(result.message).toBe('Password changed successfully');
    expect(mockBcrypt.hash).toHaveBeenCalledWith('NewPass456!', 12);
    expect(mockPrisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-123' } });
  });

  it('returns error when user is not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const result = await AuthService.changePassword('ghost-id', 'OldPass123!', 'NewPass456!');

    expect(result.success).toBe(false);
    expect(result.message).toBe('User not found');
  });

  it('returns error when current password is incorrect', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-123', password: 'hashed' });
    (mockBcrypt.compare as jest.Mock).mockResolvedValue(false);

    const result = await AuthService.changePassword('user-123', 'WrongPass!', 'NewPass456!');

    expect(result.success).toBe(false);
    expect(result.message).toBe('Current password is incorrect');
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it('returns error on database failure', async () => {
    mockPrisma.user.findUnique.mockRejectedValue(new Error('DB error'));

    const result = await AuthService.changePassword('user-123', 'OldPass123!', 'NewPass456!');

    expect(result.success).toBe(false);
    expect(result.message).toBe('Failed to change password');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// VERIFY TOKEN
// ══════════════════════════════════════════════════════════════════════════════

describe('AuthService.verifyToken', () => {
  it('returns userId and email for a valid access token', async () => {
    mockPrisma.tokenBlacklist.findUnique.mockResolvedValue(null);
    (mockJwt.verify as jest.Mock).mockReturnValue({
      userId: 'user-123',
      email: 'test@example.com',
      type: 'access',
    });

    const result = await AuthService.verifyToken('valid-access-token');

    expect(result).toEqual({ userId: 'user-123', email: 'test@example.com' });
  });

  it('returns null for a blacklisted token (skips jwt.verify)', async () => {
    mockPrisma.tokenBlacklist.findUnique.mockResolvedValue({ token: 'blacklisted' });

    const result = await AuthService.verifyToken('blacklisted-token');

    expect(result).toBeNull();
    expect(mockJwt.verify).not.toHaveBeenCalled();
  });

  it('returns null when token type is not "access"', async () => {
    mockPrisma.tokenBlacklist.findUnique.mockResolvedValue(null);
    (mockJwt.verify as jest.Mock).mockReturnValue({ userId: 'user-123', email: 'test@example.com', type: 'refresh' });

    const result = await AuthService.verifyToken('refresh-token-used-as-access');

    expect(result).toBeNull();
  });

  it('returns null when jwt.verify throws (expired or tampered token)', async () => {
    mockPrisma.tokenBlacklist.findUnique.mockResolvedValue(null);
    (mockJwt.verify as jest.Mock).mockImplementation(() => { throw new Error('jwt expired'); });

    const result = await AuthService.verifyToken('expired-token');

    expect(result).toBeNull();
  });

  it('returns null when blacklist check throws (degrades gracefully)', async () => {
    mockPrisma.tokenBlacklist.findUnique.mockRejectedValue(new Error('DB error'));

    const result = await AuthService.verifyToken('some-token');

    expect(result).toBeNull();
  });

  it('returns null when JWT_SECRET is not configured', async () => {
    delete process.env.JWT_SECRET;
    mockPrisma.tokenBlacklist.findUnique.mockResolvedValue(null);

    const result = await AuthService.verifyToken('any-token');

    expect(result).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// GENERATE TOKEN PAIR — retry on P2002 session collision
// ══════════════════════════════════════════════════════════════════════════════

describe('AuthService — generateTokenPair P2002 retry', () => {
  it('retries token generation when session.create raises a P2002 collision', async () => {
    const p2002 = Object.assign(new Error('Duplicate refresh token'), { code: 'P2002' });
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue(makeUser());
    mockPrisma.session.create
      .mockRejectedValueOnce(p2002)
      .mockResolvedValue({ id: 'session-retry' });

    const result = await AuthService.signup({ email: 'new@example.com', password: 'Password123!' });

    expect(result.success).toBe(true);
    expect(mockPrisma.session.create).toHaveBeenCalledTimes(2);
  });

  it('propagates non-P2002 session errors (line 498 re-throw)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue(makeUser());
    mockPrisma.session.create.mockRejectedValue(new Error('DB connection refused'));

    const result = await AuthService.signup({ email: 'new@example.com', password: 'Password123!' });

    // generateTokenPair re-throws, caught by signup → generic error
    expect(result.success).toBe(false);
    expect(result.message).toBe('Failed to create account. Please try again.');
  });

  it('throws when JWT_SECRET is not configured (line 448)', async () => {
    delete process.env.JWT_SECRET;
    delete process.env.JWT_REFRESH_SECRET;
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue(makeUser());

    const result = await AuthService.signup({ email: 'new@example.com', password: 'Password123!' });

    // generateTokenPair throws JWT_SECRET error, caught by signup
    expect(result.success).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// RESET TEST DATA
// ══════════════════════════════════════════════════════════════════════════════

describe('AuthService.resetTestData', () => {
  it('deletes all sessions and test users', async () => {
    mockPrisma.session.deleteMany.mockResolvedValue({ count: 5 });
    mockPrisma.user.deleteMany.mockResolvedValue({ count: 3 });

    const result = await AuthService.resetTestData();

    expect(result.success).toBe(true);
    expect(mockPrisma.session.deleteMany).toHaveBeenCalledWith({});
    expect(mockPrisma.user.deleteMany).toHaveBeenCalledWith({
      where: { email: { contains: 'test' } },
    });
  });
});
