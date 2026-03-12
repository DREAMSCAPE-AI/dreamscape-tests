/**
 * Auth Events Kafka Integration Tests
 * DR-374: Activation Kafka dans auth-service
 * DR-377: Tests d'intégration auth-events
 *
 * Tests de publication des événements d'authentification
 *
 * Prérequis:
 * - Kafka doit être démarré via docker-compose.kafka.yml
 * - auth-service doit être démarré
 */

/// <reference types="jest" />

import { Kafka, Producer, Consumer, Admin, EachMessagePayload } from 'kafkajs';
import axios from 'axios';

// Configuration
const KAFKA_CONFIG = {
  clientId: 'dreamscape-auth-tests',
  brokers: [process.env.KAFKA_BROKERS || 'localhost:9092'],
};

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';

// Topics d'authentification
const AUTH_TOPICS = {
  LOGIN: 'dreamscape.auth.login',
  LOGOUT: 'dreamscape.auth.logout',
  TOKEN_REFRESHED: 'dreamscape.auth.token.refreshed',
  PASSWORD_CHANGED: 'dreamscape.auth.password.changed',
  PASSWORD_RESET_REQUESTED: 'dreamscape.auth.password.reset.requested',
  ACCOUNT_LOCKED: 'dreamscape.auth.account.locked',
};

describe('Auth Events Kafka Integration Tests - DR-374 / DR-377', () => {
  let kafka: Kafka;
  let admin: Admin;
  let consumer: Consumer;
  let isKafkaAvailable = false;
  let isAuthServiceAvailable = false;
  let receivedEvents: any[] = [];

  beforeAll(async () => {
    kafka = new Kafka(KAFKA_CONFIG);
    admin = kafka.admin();
    consumer = kafka.consumer({ groupId: 'auth-events-test-group-' + Date.now() });

    // Check Kafka availability
    try {
      await admin.connect();
      isKafkaAvailable = true;
      console.log('✅ Kafka connection established');
    } catch (error) {
      console.warn('⚠️ Kafka not available, skipping integration tests');
      console.warn('Start Kafka with: docker-compose -f docker-compose.kafka.yml up -d');
      return;
    }

    // Check auth-service availability
    try {
      const response = await axios.get(`${AUTH_SERVICE_URL}/health`, { timeout: 5000 });
      if (response.status === 200) {
        isAuthServiceAvailable = true;
        console.log('✅ Auth service is available');
      }
    } catch (error) {
      console.warn('⚠️ Auth service not available, skipping tests that require it');
      console.warn(`Start auth-service: cd dreamscape-services/auth && npm run dev`);
    }

    // Subscribe to all auth topics
    if (isKafkaAvailable) {
      await consumer.connect();
      await consumer.subscribe({
        topics: Object.values(AUTH_TOPICS),
        fromBeginning: false, // Only new messages
      });

      // Start consuming
      await consumer.run({
        eachMessage: async (payload: EachMessagePayload) => {
          const event = {
            topic: payload.topic,
            partition: payload.partition,
            offset: payload.message.offset,
            key: payload.message.key?.toString(),
            value: JSON.parse(payload.message.value!.toString()),
            timestamp: payload.message.timestamp,
          };
          receivedEvents.push(event);
          console.log(`📨 Received event from ${payload.topic}:`, event.value.eventType);
        },
      });
    }
  }, 30000);

  afterAll(async () => {
    if (isKafkaAvailable) {
      await consumer.disconnect();
      await admin.disconnect();
    }
  });

  beforeEach(() => {
    // Clear events before each test
    receivedEvents = [];
  });

  describe('Kafka Topics Existence', () => {
    it('should have auth topics created', async () => {
      if (!isKafkaAvailable) {
        console.log('⏭️ Skipping: Kafka not available');
        return;
      }

      const topics = await admin.listTopics();
      const authTopics = topics.filter(t => t.startsWith('dreamscape.auth.'));

      console.log(`Found ${authTopics.length} auth topics:`, authTopics);

      expect(authTopics).toContain(AUTH_TOPICS.LOGIN);
      expect(authTopics).toContain(AUTH_TOPICS.LOGOUT);
    });
  });

  describe('DR-376: Auth Events Publishing', () => {
    let testUser: { email: string; password: string; tokens: any; userId: string };

    beforeAll(async () => {
      if (!isAuthServiceAvailable) return;

      // Create a test user for auth events
      const uniqueEmail = `test-auth-kafka-${Date.now()}@dreamscape.com`;
      try {
        const registerResponse = await axios.post(`${AUTH_SERVICE_URL}/api/v1/auth/register`, {
          email: uniqueEmail,
          password: 'TestPass123!@#',
          firstName: 'Kafka',
          lastName: 'Test',
        });

        testUser = {
          email: uniqueEmail,
          password: 'TestPass123!@#',
          tokens: registerResponse.data.data.tokens,
          userId: registerResponse.data.data.user.id,
        };
        console.log(`✅ Test user created: ${testUser.userId}`);
      } catch (error: any) {
        console.warn('⚠️ Failed to create test user:', error.response?.data || error.message);
      }
    });

    it('should publish auth.login event on successful login', async () => {
      if (!isKafkaAvailable || !isAuthServiceAvailable || !testUser) {
        console.log('⏭️ Skipping: Kafka or Auth service not available');
        return;
      }

      // Perform login
      const loginResponse = await axios.post(`${AUTH_SERVICE_URL}/api/v1/auth/login`, {
        email: testUser.email,
        password: testUser.password,
      });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.data.success).toBe(true);

      // Wait for Kafka event (max 5 seconds)
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Check if login event was received
      const loginEvents = receivedEvents.filter(e => e.topic === AUTH_TOPICS.LOGIN);
      expect(loginEvents.length).toBeGreaterThan(0);

      const loginEvent = loginEvents[loginEvents.length - 1];
      expect(loginEvent.value).toMatchObject({
        eventType: 'auth.login',
        source: 'auth-service',
        payload: expect.objectContaining({
          userId: testUser.userId,
          email: testUser.email,
        }),
      });

      console.log('✅ auth.login event verified:', loginEvent.value.eventId);
    }, 15000);

    it('should publish auth.token.refreshed event on token refresh', async () => {
      if (!isKafkaAvailable || !isAuthServiceAvailable || !testUser) {
        console.log('⏭️ Skipping: Kafka or Auth service not available');
        return;
      }

      // Refresh token
      const refreshResponse = await axios.post(
        `${AUTH_SERVICE_URL}/api/v1/auth/refresh`,
        { refreshToken: testUser.tokens.refreshToken },
        {
          headers: {
            Cookie: `refreshToken=${testUser.tokens.refreshToken}`,
          },
        }
      );

      expect(refreshResponse.status).toBe(200);

      // Wait for Kafka event
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Check if token refresh event was received
      const refreshEvents = receivedEvents.filter(e => e.topic === AUTH_TOPICS.TOKEN_REFRESHED);
      expect(refreshEvents.length).toBeGreaterThan(0);

      const refreshEvent = refreshEvents[refreshEvents.length - 1];
      expect(refreshEvent.value).toMatchObject({
        eventType: 'auth.token.refreshed',
        source: 'auth-service',
        payload: expect.objectContaining({
          userId: testUser.userId,
        }),
      });

      console.log('✅ auth.token.refreshed event verified:', refreshEvent.value.eventId);
    }, 15000);

    it('should publish auth.password.changed event on password change', async () => {
      if (!isKafkaAvailable || !isAuthServiceAvailable || !testUser) {
        console.log('⏭️ Skipping: Kafka or Auth service not available');
        return;
      }

      // Change password
      const newPassword = 'NewTestPass456!@#';
      const changePasswordResponse = await axios.post(
        `${AUTH_SERVICE_URL}/api/v1/auth/change-password`,
        {
          currentPassword: testUser.password,
          newPassword: newPassword,
        },
        {
          headers: {
            Authorization: `Bearer ${testUser.tokens.accessToken}`,
          },
        }
      );

      expect(changePasswordResponse.status).toBe(200);

      // Wait for Kafka event
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Check if password changed event was received
      const passwordEvents = receivedEvents.filter(e => e.topic === AUTH_TOPICS.PASSWORD_CHANGED);
      expect(passwordEvents.length).toBeGreaterThan(0);

      const passwordEvent = passwordEvents[passwordEvents.length - 1];
      expect(passwordEvent.value).toMatchObject({
        eventType: 'auth.password.changed',
        source: 'auth-service',
        payload: expect.objectContaining({
          userId: testUser.userId,
        }),
      });

      console.log('✅ auth.password.changed event verified:', passwordEvent.value.eventId);

      // Update test user password for cleanup
      testUser.password = newPassword;
    }, 15000);

    it('should publish auth.logout event on logout', async () => {
      if (!isKafkaAvailable || !isAuthServiceAvailable || !testUser) {
        console.log('⏭️ Skipping: Kafka or Auth service not available');
        return;
      }

      // Login first to get fresh tokens
      const loginResponse = await axios.post(`${AUTH_SERVICE_URL}/api/v1/auth/login`, {
        email: testUser.email,
        password: testUser.password,
      });

      const freshTokens = loginResponse.data.data.tokens;

      // Clear events
      receivedEvents = [];

      // Perform logout
      const logoutResponse = await axios.post(
        `${AUTH_SERVICE_URL}/api/v1/auth/logout`,
        {},
        {
          headers: {
            Cookie: `refreshToken=${freshTokens.refreshToken}`,
            Authorization: `Bearer ${freshTokens.accessToken}`,
          },
        }
      );

      expect(logoutResponse.status).toBe(200);

      // Wait for Kafka event
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Check if logout event was received
      const logoutEvents = receivedEvents.filter(e => e.topic === AUTH_TOPICS.LOGOUT);
      expect(logoutEvents.length).toBeGreaterThan(0);

      const logoutEvent = logoutEvents[logoutEvents.length - 1];
      expect(logoutEvent.value).toMatchObject({
        eventType: 'auth.logout',
        source: 'auth-service',
        payload: expect.objectContaining({
          userId: testUser.userId,
        }),
      });

      console.log('✅ auth.logout event verified:', logoutEvent.value.eventId);
    }, 15000);
  });

  describe('Event Structure Validation', () => {
    it('should have valid event structure with required fields', async () => {
      if (!isKafkaAvailable || receivedEvents.length === 0) {
        console.log('⏭️ Skipping: No events received yet');
        return;
      }

      const sampleEvent = receivedEvents[0];

      // Validate event structure
      expect(sampleEvent.value).toHaveProperty('eventId');
      expect(sampleEvent.value).toHaveProperty('eventType');
      expect(sampleEvent.value).toHaveProperty('source');
      expect(sampleEvent.value).toHaveProperty('timestamp');
      expect(sampleEvent.value).toHaveProperty('payload');

      // Validate timestamp format
      const timestamp = new Date(sampleEvent.value.timestamp);
      expect(timestamp.getTime()).toBeGreaterThan(0);

      console.log('✅ Event structure is valid');
    });
  });
});
