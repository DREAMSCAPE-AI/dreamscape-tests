/**
 * GDPR Events Kafka Integration Tests
 * Tests GDPR-related event publishing to Kafka
 *
 * Tests de publication des événements GDPR (consentement, export, suppression)
 *
 * Prérequis:
 * - Kafka doit être démarré via docker-compose.kafka.yml
 * - auth-service doit être démarré
 * - user-service doit être démarré
 */

/// <reference types="jest" />

import { Kafka, Producer, Consumer, Admin, EachMessagePayload } from 'kafkajs';
import axios from 'axios';

// Configuration
const KAFKA_CONFIG = {
  clientId: 'dreamscape-gdpr-tests',
  brokers: [process.env.KAFKA_BROKERS || 'localhost:9092'],
};

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3002';
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';

// Topics GDPR
const GDPR_TOPICS = {
  CONSENT_UPDATED: 'dreamscape.user.consent.updated',
  EXPORT_REQUESTED: 'dreamscape.gdpr.export.requested',
  DELETION_REQUESTED: 'dreamscape.gdpr.deletion.requested',
};

describe('GDPR Events Kafka Integration Tests', () => {
  let kafka: Kafka;
  let admin: Admin;
  let consumer: Consumer;
  let isKafkaAvailable = false;
  let isUserServiceAvailable = false;
  let isAuthServiceAvailable = false;
  let receivedEvents: any[] = [];

  beforeAll(async () => {
    kafka = new Kafka(KAFKA_CONFIG);
    admin = kafka.admin();
    consumer = kafka.consumer({ groupId: 'gdpr-events-test-group-' + Date.now() });

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

    // Check user-service availability
    try {
      const response = await axios.get(`${USER_SERVICE_URL}/health`, { timeout: 5000 });
      if (response.status === 200) {
        isUserServiceAvailable = true;
        console.log('✅ User service is available');
      }
    } catch (error) {
      console.warn('⚠️ User service not available, skipping tests that require it');
      console.warn(`Start user-service: cd dreamscape-services/user && npm run dev`);
    }

    // Subscribe to all GDPR topics
    if (isKafkaAvailable) {
      await consumer.connect();
      await consumer.subscribe({
        topics: Object.values(GDPR_TOPICS),
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
    it('should have GDPR topics created', async () => {
      if (!isKafkaAvailable) {
        console.log('⏭️ Skipping: Kafka not available');
        return;
      }

      const topics = await admin.listTopics();
      const gdprTopics = topics.filter(t =>
        t.startsWith('dreamscape.user.consent.') ||
        t.startsWith('dreamscape.gdpr.')
      );

      console.log(`Found ${gdprTopics.length} GDPR topics:`, gdprTopics);

      expect(gdprTopics).toContain(GDPR_TOPICS.CONSENT_UPDATED);
      expect(gdprTopics).toContain(GDPR_TOPICS.EXPORT_REQUESTED);
      expect(gdprTopics).toContain(GDPR_TOPICS.DELETION_REQUESTED);
    });
  });

  describe('GDPR Events Publishing', () => {
    let testUser: { email: string; password: string; tokens: any; userId: string };

    beforeAll(async () => {
      if (!isAuthServiceAvailable) return;

      // Create a test user for GDPR events
      const uniqueEmail = `test-gdpr-kafka-${Date.now()}@dreamscape.com`;
      try {
        const registerResponse = await axios.post(`${AUTH_SERVICE_URL}/api/v1/auth/register`, {
          email: uniqueEmail,
          password: 'TestPass123!@#',
          firstName: 'GDPR',
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

    describe('Consent Events', () => {
      it('should publish user.consent.updated event when consent is updated', async () => {
        if (!isKafkaAvailable || !isUserServiceAvailable || !testUser) {
          console.log('⏭️ Skipping: Kafka or User service not available');
          return;
        }

        // Update consent
        const consentResponse = await axios.put(
          `${USER_SERVICE_URL}/api/v1/users/gdpr/consent`,
          {
            analytics: true,
            marketing: false,
            functional: true,
            preferences: true,
          },
          {
            headers: {
              Authorization: `Bearer ${testUser.tokens.accessToken}`,
              'x-test-rate-limit': 'true',
            },
          }
        );

        expect(consentResponse.status).toBe(200);
        expect(consentResponse.data.success).toBe(true);

        // Wait for Kafka event (max 5 seconds)
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Check if consent updated event was received
        const consentEvents = receivedEvents.filter(e => e.topic === GDPR_TOPICS.CONSENT_UPDATED);
        expect(consentEvents.length).toBeGreaterThan(0);

        const consentEvent = consentEvents[consentEvents.length - 1];
        expect(consentEvent.value).toMatchObject({
          eventType: 'user.consent.updated',
          source: 'user-service',
          payload: expect.objectContaining({
            userId: testUser.userId,
            analytics: true,
            marketing: false,
            functional: true,
            preferences: true,
          }),
        });

        console.log('✅ user.consent.updated event verified:', consentEvent.value.eventId);
      }, 15000);

      it('should include timestamp in consent event', async () => {
        if (!isKafkaAvailable || !isUserServiceAvailable || !testUser) {
          console.log('⏭️ Skipping: Kafka or User service not available');
          return;
        }

        // Update consent again
        await axios.put(
          `${USER_SERVICE_URL}/api/v1/users/gdpr/consent`,
          {
            analytics: false,
            marketing: true,
            functional: true,
            preferences: false,
          },
          {
            headers: {
              Authorization: `Bearer ${testUser.tokens.accessToken}`,
              'x-test-rate-limit': 'true',
            },
          }
        );

        // Wait for Kafka event
        await new Promise(resolve => setTimeout(resolve, 5000));

        const consentEvents = receivedEvents.filter(e => e.topic === GDPR_TOPICS.CONSENT_UPDATED);
        expect(consentEvents.length).toBeGreaterThan(0);

        const consentEvent = consentEvents[consentEvents.length - 1];
        expect(consentEvent.value).toHaveProperty('timestamp');

        const timestamp = new Date(consentEvent.value.timestamp);
        expect(timestamp.getTime()).toBeGreaterThan(0);

        console.log('✅ Consent event timestamp is valid');
      }, 15000);
    });

    describe('GDPR Request Events', () => {
      it('should publish gdpr.export.requested event when data export is requested', async () => {
        if (!isKafkaAvailable || !isUserServiceAvailable || !testUser) {
          console.log('⏭️ Skipping: Kafka or User service not available');
          return;
        }

        // Request data export
        const exportResponse = await axios.post(
          `${USER_SERVICE_URL}/api/v1/users/gdpr/data-export`,
          {},
          {
            headers: {
              Authorization: `Bearer ${testUser.tokens.accessToken}`,
              'x-test-rate-limit': 'true',
            },
          }
        );

        expect(exportResponse.status).toBe(200);
        expect(exportResponse.data.success).toBe(true);
        expect(exportResponse.data.data).toHaveProperty('requestId');

        const requestId = exportResponse.data.data.requestId;

        // Wait for Kafka event (max 5 seconds)
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Check if export requested event was received
        const exportEvents = receivedEvents.filter(e => e.topic === GDPR_TOPICS.EXPORT_REQUESTED);
        expect(exportEvents.length).toBeGreaterThan(0);

        const exportEvent = exportEvents[exportEvents.length - 1];
        expect(exportEvent.value).toMatchObject({
          eventType: 'gdpr.export.requested',
          source: 'user-service',
          payload: expect.objectContaining({
            requestId: requestId,
            userId: testUser.userId,
          }),
        });

        console.log('✅ gdpr.export.requested event verified:', exportEvent.value.eventId);
      }, 15000);

      it('should publish gdpr.deletion.requested event when data deletion is requested', async () => {
        if (!isKafkaAvailable || !isUserServiceAvailable || !testUser) {
          console.log('⏭️ Skipping: Kafka or User service not available');
          return;
        }

        // Request data deletion
        const deletionResponse = await axios.post(
          `${USER_SERVICE_URL}/api/v1/users/gdpr/data-deletion`,
          {
            reason: 'Testing GDPR deletion event',
          },
          {
            headers: {
              Authorization: `Bearer ${testUser.tokens.accessToken}`,
              'x-test-rate-limit': 'true',
            },
          }
        );

        expect(deletionResponse.status).toBe(200);
        expect(deletionResponse.data.success).toBe(true);
        expect(deletionResponse.data.data).toHaveProperty('requestId');

        const requestId = deletionResponse.data.data.requestId;

        // Wait for Kafka event (max 5 seconds)
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Check if deletion requested event was received
        const deletionEvents = receivedEvents.filter(e => e.topic === GDPR_TOPICS.DELETION_REQUESTED);
        expect(deletionEvents.length).toBeGreaterThan(0);

        const deletionEvent = deletionEvents[deletionEvents.length - 1];
        expect(deletionEvent.value).toMatchObject({
          eventType: 'gdpr.deletion.requested',
          source: 'user-service',
          payload: expect.objectContaining({
            requestId: requestId,
            userId: testUser.userId,
            reason: 'Testing GDPR deletion event',
          }),
        });

        console.log('✅ gdpr.deletion.requested event verified:', deletionEvent.value.eventId);
      }, 15000);

      it('should allow deletion request without reason', async () => {
        if (!isKafkaAvailable || !isUserServiceAvailable || !testUser) {
          console.log('⏭️ Skipping: Kafka or User service not available');
          return;
        }

        // Request data deletion without reason
        const deletionResponse = await axios.post(
          `${USER_SERVICE_URL}/api/v1/users/gdpr/data-deletion`,
          {},
          {
            headers: {
              Authorization: `Bearer ${testUser.tokens.accessToken}`,
              'x-test-rate-limit': 'true',
            },
          }
        );

        expect(deletionResponse.status).toBe(200);

        // Wait for Kafka event
        await new Promise(resolve => setTimeout(resolve, 5000));

        const deletionEvents = receivedEvents.filter(e => e.topic === GDPR_TOPICS.DELETION_REQUESTED);
        expect(deletionEvents.length).toBeGreaterThan(0);

        const deletionEvent = deletionEvents[deletionEvents.length - 1];
        expect(deletionEvent.value.payload).toHaveProperty('userId', testUser.userId);

        console.log('✅ Deletion request without reason accepted');
      }, 15000);
    });
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

      // Validate eventId format (should be UUID)
      expect(sampleEvent.value.eventId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );

      // Validate source
      expect(sampleEvent.value.source).toBe('user-service');

      // Validate timestamp format
      const timestamp = new Date(sampleEvent.value.timestamp);
      expect(timestamp.getTime()).toBeGreaterThan(0);

      console.log('✅ Event structure is valid');
    });

    it('should have proper payload structure for consent events', async () => {
      if (!isKafkaAvailable || receivedEvents.length === 0) {
        console.log('⏭️ Skipping: No events received yet');
        return;
      }

      const consentEvents = receivedEvents.filter(e => e.topic === GDPR_TOPICS.CONSENT_UPDATED);

      if (consentEvents.length === 0) {
        console.log('⏭️ No consent events received yet');
        return;
      }

      const consentEvent = consentEvents[0];

      expect(consentEvent.value.payload).toHaveProperty('userId');
      expect(consentEvent.value.payload).toHaveProperty('analytics');
      expect(consentEvent.value.payload).toHaveProperty('marketing');
      expect(consentEvent.value.payload).toHaveProperty('functional');
      expect(consentEvent.value.payload).toHaveProperty('preferences');

      expect(typeof consentEvent.value.payload.analytics).toBe('boolean');
      expect(typeof consentEvent.value.payload.marketing).toBe('boolean');
      expect(typeof consentEvent.value.payload.functional).toBe('boolean');
      expect(typeof consentEvent.value.payload.preferences).toBe('boolean');

      console.log('✅ Consent event payload structure is valid');
    });

    it('should have proper payload structure for export request events', async () => {
      if (!isKafkaAvailable || receivedEvents.length === 0) {
        console.log('⏭️ Skipping: No events received yet');
        return;
      }

      const exportEvents = receivedEvents.filter(e => e.topic === GDPR_TOPICS.EXPORT_REQUESTED);

      if (exportEvents.length === 0) {
        console.log('⏭️ No export events received yet');
        return;
      }

      const exportEvent = exportEvents[0];

      expect(exportEvent.value.payload).toHaveProperty('requestId');
      expect(exportEvent.value.payload).toHaveProperty('userId');

      // requestId should be UUID format
      expect(exportEvent.value.payload.requestId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );

      console.log('✅ Export request event payload structure is valid');
    });

    it('should have proper payload structure for deletion request events', async () => {
      if (!isKafkaAvailable || receivedEvents.length === 0) {
        console.log('⏭️ Skipping: No events received yet');
        return;
      }

      const deletionEvents = receivedEvents.filter(e => e.topic === GDPR_TOPICS.DELETION_REQUESTED);

      if (deletionEvents.length === 0) {
        console.log('⏭️ No deletion events received yet');
        return;
      }

      const deletionEvent = deletionEvents[0];

      expect(deletionEvent.value.payload).toHaveProperty('requestId');
      expect(deletionEvent.value.payload).toHaveProperty('userId');

      // requestId should be UUID format
      expect(deletionEvent.value.payload.requestId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );

      console.log('✅ Deletion request event payload structure is valid');
    });
  });
});
