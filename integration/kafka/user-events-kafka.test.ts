/**
 * User Events Kafka Integration Tests
 * DR-264: US-CORE-007 - Événements utilisateur
 *
 * Tests de vérification que les événements utilisateur sont correctement publiés sur Kafka
 * lors des opérations sur les profils et préférences utilisateur
 *
 * Prérequis:
 * - Kafka doit être démarré
 * - user-service doit être démarré
 * - auth-service doit être démarré (pour la création d'utilisateur de test)
 */

/// <reference types="jest" />

import { Kafka, Consumer } from 'kafkajs';
import request from 'supertest';

// Configuration
const KAFKA_CONFIG = {
  clientId: 'dreamscape-user-events-test',
  brokers: [process.env.KAFKA_BROKERS || 'localhost:9092'],
};

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3002';
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';

// Topics à tester
const KAFKA_TOPICS = {
  USER_CREATED: 'dreamscape.user.created',
  USER_UPDATED: 'dreamscape.user.updated',
  USER_PROFILE_UPDATED: 'dreamscape.user.profile.updated',
  USER_PREFERENCES_UPDATED: 'dreamscape.user.preferences.updated',
};

interface KafkaEvent<T = any> {
  eventId: string;
  eventType: string;
  timestamp: string;
  version: string;
  source: string;
  correlationId?: string;
  payload: T;
}

describe('User Events Kafka Integration Tests - DR-264', () => {
  let kafka: Kafka;
  let consumer: Consumer;
  let isKafkaAvailable = false;
  let testUser: any;
  let accessToken: string;
  let receivedEvents: KafkaEvent[] = [];

  beforeAll(async () => {
    // Initialize Kafka consumer
    kafka = new Kafka(KAFKA_CONFIG);
    consumer = kafka.consumer({ groupId: 'user-events-test-group' });

    try {
      await consumer.connect();
      await consumer.subscribe({
        topics: Object.values(KAFKA_TOPICS),
        fromBeginning: false, // Only new messages
      });

      // Start consuming messages
      consumer.run({
        eachMessage: async ({ topic, message }) => {
          if (message.value) {
            const event = JSON.parse(message.value.toString());
            receivedEvents.push(event);
            console.log(`📨 Received event: ${event.eventType} on topic ${topic}`);
          }
        },
      });

      isKafkaAvailable = true;
      console.log('✅ Kafka consumer connected and subscribed');
    } catch (error) {
      console.warn('⚠️ Kafka not available, skipping tests');
      console.warn('Start Kafka with: docker-compose -f docker/docker-compose.kafka.yml up -d');
    }

    // Create test user via auth service
    if (isKafkaAvailable) {
      try {
        const registrationData = {
          email: `kafka-test-${Date.now()}@test.com`,
          password: 'KafkaTest123!',
          firstName: 'Kafka',
          lastName: 'Tester',
        };

        const registerResponse = await request(AUTH_SERVICE_URL)
          .post('/api/v1/auth/register')
          .send(registrationData)
          .expect(201);

        testUser = registerResponse.body.data.user;
        accessToken = registerResponse.body.data.tokens.accessToken;
        console.log(`✅ Test user created: ${testUser.id}`);
      } catch (error) {
        console.error('Failed to create test user:', error);
        isKafkaAvailable = false;
      }
    }
  }, 30000);

  afterAll(async () => {
    if (isKafkaAvailable) {
      await consumer.disconnect();
      console.log('✅ Kafka consumer disconnected');
    }
  });

  beforeEach(() => {
    // Clear received events before each test
    receivedEvents = [];
  });

  describe('DR-265: UserProfileUpdated Event', () => {
    it('should publish UserProfileUpdated event when creating a profile', async () => {
      if (!isKafkaAvailable) {
        console.log('⏭️ Skipping: Kafka not available');
        return;
      }

      const profileData = {
        userId: testUser.id,
        firstName: 'Updated',
        lastName: 'Name',
        phone: '+33612345678',
        dateOfBirth: '1990-01-01',
      };

      // Create profile via API
      const response = await request(USER_SERVICE_URL)
        .post(`/api/v1/users/profile/${testUser.id}`)
        .send(profileData)
        .expect(201);

      expect(response.body).toBeDefined();

      // Wait for Kafka event to be consumed
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Find the UserProfileUpdated event
      const profileEvent = receivedEvents.find(
        e => e.eventType === 'user.profile.updated' && e.payload.userId === testUser.id
      );

      expect(profileEvent).toBeDefined();
      expect(profileEvent?.source).toBe('user-service');
      expect(profileEvent?.payload.userId).toBe(testUser.id);
      expect(profileEvent?.payload.profile).toBeDefined();
      expect(profileEvent?.payload.profile.firstName).toBe(profileData.firstName);
      expect(profileEvent?.payload.profile.lastName).toBe(profileData.lastName);
      expect(profileEvent?.payload.profile.phone).toBe(profileData.phone);
      expect(profileEvent?.payload.updatedAt).toBeDefined();
      expect(profileEvent?.timestamp).toBeDefined();
      expect(profileEvent?.eventId).toBeDefined();

      console.log('✅ UserProfileUpdated event validated');
    }, 15000);

    it('should publish UserProfileUpdated event when uploading avatar', async () => {
      if (!isKafkaAvailable) {
        console.log('⏭️ Skipping: Kafka not available');
        return;
      }

      // First create a profile
      await request(USER_SERVICE_URL)
        .post(`/api/v1/users/profile/${testUser.id}`)
        .send({
          userId: testUser.id,
          firstName: 'Test',
          lastName: 'User',
        });

      // Clear events
      receivedEvents = [];

      // Upload avatar
      const testImageBuffer = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
      ]);

      await request(USER_SERVICE_URL)
        .post(`/api/v1/users/profile/${testUser.id}/avatar`)
        .attach('avatar', testImageBuffer, 'test-avatar.png')
        .expect(200);

      // Wait for Kafka event
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Find the UserProfileUpdated event for avatar
      const avatarEvent = receivedEvents.find(
        e => e.eventType === 'user.profile.updated' &&
             e.payload.userId === testUser.id &&
             e.payload.profile?.avatar
      );

      expect(avatarEvent).toBeDefined();
      expect(avatarEvent?.payload.profile.avatar).toContain('/uploads/avatars/');

      console.log('✅ UserProfileUpdated event for avatar validated');
    }, 15000);
  });

  describe('DR-266: UserPreferencesUpdated Event', () => {
    it('should publish UserPreferencesUpdated event when updating preferences', async () => {
      if (!isKafkaAvailable) {
        console.log('⏭️ Skipping: Kafka not available');
        return;
      }

      const preferencesData = {
        preferences: {
          language: 'fr',
          currency: 'EUR',
          timezone: 'Europe/Paris',
        },
        notifications: {
          dealAlerts: true,
          tripReminders: false,
          priceAlerts: true,
        },
      };

      // Update profile with preferences
      await request(USER_SERVICE_URL)
        .put('/api/v1/users/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(preferencesData)
        .expect(200);

      // Wait for Kafka event
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Find the UserPreferencesUpdated event
      const prefsEvent = receivedEvents.find(
        e => e.eventType === 'user.preferences.updated' && e.payload.userId === testUser.id
      );

      expect(prefsEvent).toBeDefined();
      expect(prefsEvent?.source).toBe('user-service');
      expect(prefsEvent?.payload.userId).toBe(testUser.id);
      expect(prefsEvent?.payload.preferences).toBeDefined();
      expect(prefsEvent?.payload.preferences.language).toBe('fr');
      expect(prefsEvent?.payload.preferences.currency).toBe('EUR');
      expect(prefsEvent?.payload.updatedAt).toBeDefined();

      console.log('✅ UserPreferencesUpdated event validated');
    }, 15000);
  });

  describe('DR-265: UserUpdated Event', () => {
    it('should publish UserUpdated event when updating basic user info', async () => {
      if (!isKafkaAvailable) {
        console.log('⏭️ Skipping: Kafka not available');
        return;
      }

      const updateData = {
        profile: {
          name: 'New Username',
          email: testUser.email,
        },
      };

      // Update basic user info
      await request(USER_SERVICE_URL)
        .put('/api/v1/users/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(200);

      // Wait for Kafka event
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Find the UserUpdated event
      const updateEvent = receivedEvents.find(
        e => e.eventType === 'user.updated' && e.payload.userId === testUser.id
      );

      expect(updateEvent).toBeDefined();
      expect(updateEvent?.source).toBe('user-service');
      expect(updateEvent?.payload.userId).toBe(testUser.id);
      expect(updateEvent?.payload.changes).toBeDefined();
      expect(updateEvent?.payload.updatedAt).toBeDefined();

      console.log('✅ UserUpdated event validated');
    }, 15000);
  });

  describe('Event Structure Validation', () => {
    it('should have valid event structure for all user events', async () => {
      if (!isKafkaAvailable) {
        console.log('⏭️ Skipping: Kafka not available');
        return;
      }

      // Trigger multiple events
      await request(USER_SERVICE_URL)
        .post(`/api/v1/users/profile/${testUser.id}`)
        .send({
          userId: testUser.id,
          firstName: 'Structure',
          lastName: 'Test',
        });

      await new Promise(resolve => setTimeout(resolve, 2000));

      // Validate structure of all received events
      receivedEvents.forEach(event => {
        // Base event structure
        expect(event.eventId).toBeDefined();
        expect(event.eventType).toBeDefined();
        expect(event.timestamp).toBeDefined();
        expect(event.version).toBeDefined();
        expect(event.source).toBe('user-service');
        expect(event.payload).toBeDefined();

        // Timestamp should be valid ISO 8601
        expect(new Date(event.timestamp).toISOString()).toBe(event.timestamp);

        // Event ID should be unique
        expect(event.eventId).toMatch(/^[a-f0-9-]{36}$/);
      });

      console.log(`✅ Validated structure of ${receivedEvents.length} events`);
    }, 15000);
  });

  describe('Kafka Topics Configuration', () => {
    it('should verify user event topics exist', async () => {
      if (!isKafkaAvailable) {
        console.log('⏭️ Skipping: Kafka not available');
        return;
      }

      const admin = kafka.admin();
      await admin.connect();

      const topics = await admin.listTopics();

      expect(topics).toContain(KAFKA_TOPICS.USER_CREATED);
      expect(topics).toContain(KAFKA_TOPICS.USER_UPDATED);
      expect(topics).toContain(KAFKA_TOPICS.USER_PROFILE_UPDATED);
      expect(topics).toContain(KAFKA_TOPICS.USER_PREFERENCES_UPDATED);

      await admin.disconnect();
      console.log('✅ All user event topics exist');
    });
  });
});
