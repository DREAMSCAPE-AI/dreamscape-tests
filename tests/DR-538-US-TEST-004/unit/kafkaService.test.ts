/**
 * kafkaService.test.ts — DR-538-US-TEST-004
 *
 * Unit tests for AuthKafkaService.
 * - @dreamscape/kafka is fully mocked (no real Kafka broker required)
 * - authKafkaService is a singleton; state is reset in beforeEach
 */

// ─── Module mocks (hoisted before imports by ts-jest) ─────────────────────────

jest.mock('@dreamscape/kafka', () => ({
  getKafkaClient: jest.fn(),
  createEvent: jest.fn(),
  KAFKA_TOPICS: {
    AUTH_LOGIN: 'dreamscape.auth.login',
    AUTH_LOGOUT: 'dreamscape.auth.logout',
    AUTH_TOKEN_REFRESHED: 'dreamscape.auth.token.refreshed',
    AUTH_PASSWORD_CHANGED: 'dreamscape.auth.password.changed',
    AUTH_PASSWORD_RESET_REQUESTED: 'dreamscape.auth.password.reset.requested',
    AUTH_ACCOUNT_LOCKED: 'dreamscape.auth.account.locked',
    USER_CREATED: 'dreamscape.user.created',
  },
  CONSUMER_GROUPS: {
    AUTH_SERVICE: 'dreamscape-auth-service-group',
  },
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import { getKafkaClient, createEvent, KAFKA_TOPICS, CONSUMER_GROUPS } from '@dreamscape/kafka';
import authKafkaService from '../../../../dreamscape-services/auth/src/services/KafkaService';

const mockGetKafkaClient = getKafkaClient as jest.MockedFunction<typeof getKafkaClient>;
const mockCreateEvent = createEvent as jest.MockedFunction<typeof createEvent>;

// ─── Shared mock objects ───────────────────────────────────────────────────────

// Mock KafkaClient instance returned by getKafkaClient()
const mockClient = {
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  publish: jest.fn().mockResolvedValue(undefined),
  subscribe: jest.fn().mockResolvedValue(undefined),
  healthCheck: jest.fn().mockResolvedValue({ healthy: true, details: { connected: true } }),
};

// Canonical mock event returned by createEvent()
const mockEvent = {
  eventId: 'mock-event-id',
  eventType: 'mock.event',
  timestamp: '2024-01-01T00:00:00.000Z',
  version: '1.0.0',
  source: 'auth-service',
  payload: {},
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Reset singleton state so each test starts with an uninitialized service. */
function resetService() {
  (authKafkaService as any).client = null;
  (authKafkaService as any).isInitialized = false;
}

/** Inject the mock client directly, bypassing initialize(). */
function injectClient() {
  (authKafkaService as any).client = mockClient;
  (authKafkaService as any).isInitialized = true;
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  mockGetKafkaClient.mockReturnValue(mockClient as any);
  mockCreateEvent.mockReturnValue(mockEvent as any);
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  resetService();
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ─── initialize() ─────────────────────────────────────────────────────────────

describe('initialize()', () => {
  it('calls getKafkaClient and connects on first call', async () => {
    await authKafkaService.initialize();

    expect(mockGetKafkaClient).toHaveBeenCalledWith('auth-service');
    expect(mockClient.connect).toHaveBeenCalledTimes(1);
    expect((authKafkaService as any).isInitialized).toBe(true);
  });

  it('skips re-initialization when already initialized', async () => {
    await authKafkaService.initialize();
    await authKafkaService.initialize(); // second call

    expect(mockClient.connect).toHaveBeenCalledTimes(1);
    expect(console.log).toHaveBeenCalledWith('[AuthKafkaService] Already initialized');
  });

  it('rethrows when client.connect() throws', async () => {
    const connectError = new Error('Broker unreachable');
    mockClient.connect.mockRejectedValueOnce(connectError);

    await expect(authKafkaService.initialize()).rejects.toThrow('Broker unreachable');
    expect(console.error).toHaveBeenCalled();
    expect((authKafkaService as any).isInitialized).toBe(false);
  });
});

// ─── shutdown() ───────────────────────────────────────────────────────────────

describe('shutdown()', () => {
  it('disconnects the client when initialized', async () => {
    injectClient();

    await authKafkaService.shutdown();

    expect(mockClient.disconnect).toHaveBeenCalledTimes(1);
    expect((authKafkaService as any).isInitialized).toBe(false);
  });

  it('does nothing when client is not set', async () => {
    await authKafkaService.shutdown(); // client is null

    expect(mockClient.disconnect).not.toHaveBeenCalled();
  });
});

// ─── publishLogin() ───────────────────────────────────────────────────────────

describe('publishLogin()', () => {
  const loginPayload = {
    userId: 'u1',
    sessionId: 'sess-abc',
    ipAddress: '127.0.0.1',
    userAgent: 'jest-test',
    loginAt: '2024-01-01T00:00:00.000Z',
    method: 'password' as const,
  };

  it('skips publish and warns when client is not initialized', async () => {
    await authKafkaService.publishLogin(loginPayload);

    expect(console.warn).toHaveBeenCalledWith(
      '[AuthKafkaService] Client not initialized, skipping publish'
    );
    expect(mockClient.publish).not.toHaveBeenCalled();
  });

  it('creates event with correct type and publishes to AUTH_LOGIN topic', async () => {
    injectClient();

    await authKafkaService.publishLogin(loginPayload);

    expect(mockCreateEvent).toHaveBeenCalledWith(
      'auth.login',
      'auth-service',
      loginPayload,
      { correlationId: undefined }
    );
    expect(mockClient.publish).toHaveBeenCalledWith(
      KAFKA_TOPICS.AUTH_LOGIN,
      mockEvent,
      loginPayload.userId
    );
  });

  it('forwards correlationId to createEvent when provided', async () => {
    injectClient();

    await authKafkaService.publishLogin(loginPayload, 'corr-123');

    expect(mockCreateEvent).toHaveBeenCalledWith(
      'auth.login',
      'auth-service',
      loginPayload,
      { correlationId: 'corr-123' }
    );
  });
});

// ─── publishLogout() ──────────────────────────────────────────────────────────

describe('publishLogout()', () => {
  const logoutPayload = {
    userId: 'u1',
    sessionId: 'sess-abc',
    logoutAt: '2024-01-01T00:00:00.000Z',
    reason: 'user_initiated' as const,
  };

  it('skips publish and warns when client is not initialized', async () => {
    await authKafkaService.publishLogout(logoutPayload);

    expect(console.warn).toHaveBeenCalledWith(
      '[AuthKafkaService] Client not initialized, skipping publish'
    );
    expect(mockClient.publish).not.toHaveBeenCalled();
  });

  it('creates event with correct type and publishes to AUTH_LOGOUT topic', async () => {
    injectClient();

    await authKafkaService.publishLogout(logoutPayload);

    expect(mockCreateEvent).toHaveBeenCalledWith(
      'auth.logout',
      'auth-service',
      logoutPayload,
      { correlationId: undefined }
    );
    expect(mockClient.publish).toHaveBeenCalledWith(
      KAFKA_TOPICS.AUTH_LOGOUT,
      mockEvent,
      logoutPayload.userId
    );
  });
});

// ─── publishTokenRefreshed() ──────────────────────────────────────────────────

describe('publishTokenRefreshed()', () => {
  const payload = {
    userId: 'u1',
    sessionId: 'sess-abc',
    refreshedAt: '2024-01-01T00:00:00.000Z',
    expiresAt: '2024-01-01T01:00:00.000Z',
  };

  it('skips publish and warns when client is not initialized', async () => {
    await authKafkaService.publishTokenRefreshed(payload);

    expect(console.warn).toHaveBeenCalled();
    expect(mockClient.publish).not.toHaveBeenCalled();
  });

  it('publishes to AUTH_TOKEN_REFRESHED topic with correct event type', async () => {
    injectClient();

    await authKafkaService.publishTokenRefreshed(payload);

    expect(mockCreateEvent).toHaveBeenCalledWith(
      'auth.token.refreshed',
      'auth-service',
      payload,
      { correlationId: undefined }
    );
    expect(mockClient.publish).toHaveBeenCalledWith(
      KAFKA_TOPICS.AUTH_TOKEN_REFRESHED,
      mockEvent,
      payload.userId
    );
  });
});

// ─── publishPasswordChanged() ─────────────────────────────────────────────────

describe('publishPasswordChanged()', () => {
  const payload = {
    userId: 'u1',
    changedAt: '2024-01-01T00:00:00.000Z',
    method: 'user_initiated' as const,
  };

  it('skips publish and warns when client is not initialized', async () => {
    await authKafkaService.publishPasswordChanged(payload);

    expect(console.warn).toHaveBeenCalled();
    expect(mockClient.publish).not.toHaveBeenCalled();
  });

  it('publishes to AUTH_PASSWORD_CHANGED topic with correct event type', async () => {
    injectClient();

    await authKafkaService.publishPasswordChanged(payload);

    expect(mockCreateEvent).toHaveBeenCalledWith(
      'auth.password.changed',
      'auth-service',
      payload,
      { correlationId: undefined }
    );
    expect(mockClient.publish).toHaveBeenCalledWith(
      KAFKA_TOPICS.AUTH_PASSWORD_CHANGED,
      mockEvent,
      payload.userId
    );
  });
});

// ─── publishPasswordResetRequested() ─────────────────────────────────────────

describe('publishPasswordResetRequested()', () => {
  const payload = {
    userId: 'u1',
    email: 'user@test.com',
    requestedAt: '2024-01-01T00:00:00.000Z',
    expiresAt: '2024-01-01T01:00:00.000Z',
    resetToken: 'reset-token-xyz',
  };

  it('skips publish and warns when client is not initialized', async () => {
    await authKafkaService.publishPasswordResetRequested(payload);

    expect(console.warn).toHaveBeenCalled();
    expect(mockClient.publish).not.toHaveBeenCalled();
  });

  it('publishes to AUTH_PASSWORD_RESET_REQUESTED topic', async () => {
    injectClient();

    await authKafkaService.publishPasswordResetRequested(payload);

    expect(mockCreateEvent).toHaveBeenCalledWith(
      'auth.password.reset.requested',
      'auth-service',
      payload,
      { correlationId: undefined }
    );
    expect(mockClient.publish).toHaveBeenCalledWith(
      KAFKA_TOPICS.AUTH_PASSWORD_RESET_REQUESTED,
      mockEvent,
      payload.userId
    );
  });
});

// ─── publishAccountLocked() ───────────────────────────────────────────────────

describe('publishAccountLocked()', () => {
  const payload = {
    userId: 'u1',
    lockedAt: '2024-01-01T00:00:00.000Z',
    reason: 'too_many_attempts' as const,
    unlockAt: '2024-01-01T01:00:00.000Z',
  };

  it('skips publish and warns when client is not initialized', async () => {
    await authKafkaService.publishAccountLocked(payload);

    expect(console.warn).toHaveBeenCalledWith(
      '[AuthKafkaService] Client not initialized, skipping publish'
    );
    expect(mockClient.publish).not.toHaveBeenCalled();
  });

  it('publishes to AUTH_ACCOUNT_LOCKED topic with correct event type', async () => {
    injectClient();

    await authKafkaService.publishAccountLocked(payload);

    expect(mockCreateEvent).toHaveBeenCalledWith(
      'auth.account.locked',
      'auth-service',
      payload,
      { correlationId: undefined }
    );
    expect(mockClient.publish).toHaveBeenCalledWith(
      KAFKA_TOPICS.AUTH_ACCOUNT_LOCKED,
      mockEvent,
      payload.userId
    );
  });
});

// ─── subscribeToUserEvents() ──────────────────────────────────────────────────

describe('subscribeToUserEvents()', () => {
  it('warns and returns when client is not initialized', async () => {
    const handler = jest.fn();

    await authKafkaService.subscribeToUserEvents({ onUserCreated: handler });

    expect(console.warn).toHaveBeenCalledWith(
      '[AuthKafkaService] Client not initialized, cannot subscribe'
    );
    expect(mockClient.subscribe).not.toHaveBeenCalled();
  });

  it('subscribes to USER_CREATED topic when onUserCreated handler is provided', async () => {
    injectClient();
    const handler = jest.fn();

    await authKafkaService.subscribeToUserEvents({ onUserCreated: handler });

    expect(mockClient.subscribe).toHaveBeenCalledWith(
      CONSUMER_GROUPS.AUTH_SERVICE,
      [{ topic: KAFKA_TOPICS.USER_CREATED, handler }]
    );
  });

  it('does not call subscribe when no handlers are provided', async () => {
    injectClient();

    await authKafkaService.subscribeToUserEvents({});

    expect(mockClient.subscribe).not.toHaveBeenCalled();
  });
});

// ─── healthCheck() ────────────────────────────────────────────────────────────

describe('healthCheck()', () => {
  it('returns unhealthy status when client is not initialized', async () => {
    const result = await authKafkaService.healthCheck();

    expect(result).toEqual({
      healthy: false,
      details: { error: 'Client not initialized' },
    });
  });

  it('delegates to client.healthCheck() when initialized', async () => {
    injectClient();
    mockClient.healthCheck.mockResolvedValueOnce({
      healthy: true,
      details: { connected: true, broker: 'localhost:9092' },
    });

    const result = await authKafkaService.healthCheck();

    expect(mockClient.healthCheck).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ healthy: true, details: { connected: true, broker: 'localhost:9092' } });
  });
});
