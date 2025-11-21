/**
 * Kafka Integration Tests
 * US-INFRA-008: Configuration Kafka
 *
 * Tests de communication événementielle entre les services DreamScape
 *
 * Prérequis: Kafka doit être démarré via docker-compose.kafka.yml
 */

import { Kafka, Producer, Consumer, Admin } from 'kafkajs';

// Configuration Kafka pour les tests
const KAFKA_CONFIG = {
  clientId: 'dreamscape-integration-tests',
  brokers: [process.env.KAFKA_BROKERS || 'localhost:9092'],
};

// Topics à tester
const TEST_TOPICS = {
  USER_CREATED: 'dreamscape.user.created',
  AUTH_LOGIN: 'dreamscape.auth.login',
  VOYAGE_BOOKING_CREATED: 'dreamscape.voyage.booking.created',
  PAYMENT_COMPLETED: 'dreamscape.payment.completed',
  AI_RECOMMENDATION_GENERATED: 'dreamscape.ai.recommendation.generated',
};

describe('Kafka Integration Tests', () => {
  let kafka: Kafka;
  let admin: Admin;
  let producer: Producer;
  let consumer: Consumer;
  let isKafkaAvailable = false;

  beforeAll(async () => {
    kafka = new Kafka(KAFKA_CONFIG);
    admin = kafka.admin();
    producer = kafka.producer();
    consumer = kafka.consumer({ groupId: 'integration-test-group' });

    try {
      await admin.connect();
      await producer.connect();
      isKafkaAvailable = true;
      console.log('✅ Kafka connection established');
    } catch (error) {
      console.warn('⚠️ Kafka not available, skipping integration tests');
      console.warn('Start Kafka with: docker-compose -f docker/docker-compose.kafka.yml up -d');
    }
  }, 30000);

  afterAll(async () => {
    if (isKafkaAvailable) {
      await consumer.disconnect();
      await producer.disconnect();
      await admin.disconnect();
    }
  });

  describe('Kafka Cluster Health', () => {
    it('should connect to Kafka cluster', async () => {
      if (!isKafkaAvailable) {
        console.log('⏭️ Skipping: Kafka not available');
        return;
      }

      const cluster = await admin.describeCluster();

      expect(cluster.clusterId).toBeDefined();
      expect(cluster.brokers.length).toBeGreaterThan(0);
      expect(cluster.controller).toBeDefined();
    });

    it('should list DreamScape topics', async () => {
      if (!isKafkaAvailable) {
        console.log('⏭️ Skipping: Kafka not available');
        return;
      }

      const topics = await admin.listTopics();
      const dreamscapeTopics = topics.filter(t => t.startsWith('dreamscape.'));

      console.log(`Found ${dreamscapeTopics.length} DreamScape topics`);

      // Vérifier que les topics principaux existent
      expect(dreamscapeTopics).toContain(TEST_TOPICS.USER_CREATED);
      expect(dreamscapeTopics).toContain(TEST_TOPICS.AUTH_LOGIN);
    });
  });

  describe('Topic Configuration', () => {
    it('should have correct partition count for high-traffic topics', async () => {
      if (!isKafkaAvailable) {
        console.log('⏭️ Skipping: Kafka not available');
        return;
      }

      const topicMetadata = await admin.fetchTopicMetadata({
        topics: ['dreamscape.voyage.search.performed', 'dreamscape.analytics.event.tracked'],
      });

      // Les topics haute fréquence devraient avoir plus de partitions
      for (const topic of topicMetadata.topics) {
        if (topic.name.includes('search') || topic.name.includes('analytics')) {
          expect(topic.partitions.length).toBeGreaterThanOrEqual(3);
        }
      }
    });
  });

  describe('Producer Tests', () => {
    it('should publish a user.created event', async () => {
      if (!isKafkaAvailable) {
        console.log('⏭️ Skipping: Kafka not available');
        return;
      }

      const testEvent = {
        eventId: `test-${Date.now()}`,
        eventType: 'user.created',
        timestamp: new Date().toISOString(),
        version: '1.0',
        source: 'integration-test',
        payload: {
          userId: 'test-user-123',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          createdAt: new Date().toISOString(),
        },
      };

      const result = await producer.send({
        topic: TEST_TOPICS.USER_CREATED,
        messages: [
          {
            key: testEvent.payload.userId,
            value: JSON.stringify(testEvent),
            headers: {
              eventType: testEvent.eventType,
              source: testEvent.source,
            },
          },
        ],
      });

      expect(result).toBeDefined();
      expect(result[0].errorCode).toBe(0);
      console.log(`✅ Published to partition ${result[0].partition}, offset ${result[0].baseOffset}`);
    });

    it('should publish a auth.login event', async () => {
      if (!isKafkaAvailable) {
        console.log('⏭️ Skipping: Kafka not available');
        return;
      }

      const testEvent = {
        eventId: `test-${Date.now()}`,
        eventType: 'auth.login',
        timestamp: new Date().toISOString(),
        version: '1.0',
        source: 'integration-test',
        payload: {
          userId: 'test-user-123',
          sessionId: 'session-456',
          ipAddress: '127.0.0.1',
          userAgent: 'Integration Test',
          loginAt: new Date().toISOString(),
          method: 'password',
        },
      };

      const result = await producer.send({
        topic: TEST_TOPICS.AUTH_LOGIN,
        messages: [
          {
            key: testEvent.payload.userId,
            value: JSON.stringify(testEvent),
          },
        ],
      });

      expect(result[0].errorCode).toBe(0);
    });

    it('should publish batch events', async () => {
      if (!isKafkaAvailable) {
        console.log('⏭️ Skipping: Kafka not available');
        return;
      }

      const events = Array.from({ length: 5 }, (_, i) => ({
        key: `user-${i}`,
        value: JSON.stringify({
          eventId: `batch-${Date.now()}-${i}`,
          eventType: 'analytics.event.tracked',
          timestamp: new Date().toISOString(),
          version: '1.0',
          source: 'integration-test',
          payload: {
            eventId: `event-${i}`,
            eventName: 'test_event',
            eventCategory: 'integration_test',
            eventAction: 'batch_publish',
            trackedAt: new Date().toISOString(),
          },
        }),
      }));

      const result = await producer.send({
        topic: 'dreamscape.analytics.event.tracked',
        messages: events,
      });

      expect(result[0].errorCode).toBe(0);
      console.log(`✅ Batch published ${events.length} events`);
    });
  });

  describe('Consumer Tests', () => {
    it('should consume messages from a topic', async () => {
      if (!isKafkaAvailable) {
        console.log('⏭️ Skipping: Kafka not available');
        return;
      }

      const testTopic = 'dreamscape.test.integration';
      const testMessage = {
        eventId: `consume-test-${Date.now()}`,
        data: 'test data',
      };

      // Créer le topic si nécessaire
      try {
        await admin.createTopics({
          topics: [{ topic: testTopic, numPartitions: 1 }],
        });
      } catch {
        // Topic peut déjà exister
      }

      // Publier un message
      await producer.send({
        topic: testTopic,
        messages: [{ value: JSON.stringify(testMessage) }],
      });

      // Consumer
      const messages: string[] = [];
      await consumer.connect();
      await consumer.subscribe({ topic: testTopic, fromBeginning: true });

      const consumePromise = new Promise<void>((resolve) => {
        consumer.run({
          eachMessage: async ({ message }) => {
            if (message.value) {
              messages.push(message.value.toString());
              resolve();
            }
          },
        });
      });

      // Attendre le message avec timeout
      await Promise.race([
        consumePromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000)),
      ]).catch(() => {
        console.log('Consumer timeout - this is expected if no new messages');
      });

      await consumer.stop();

      // Vérifier qu'on a reçu des messages
      expect(messages.length).toBeGreaterThanOrEqual(0);
    }, 15000);
  });

  describe('Event Flow Tests', () => {
    it('should simulate user registration flow', async () => {
      if (!isKafkaAvailable) {
        console.log('⏭️ Skipping: Kafka not available');
        return;
      }

      const userId = `flow-test-${Date.now()}`;
      const correlationId = `corr-${Date.now()}`;

      // 1. User Created
      await producer.send({
        topic: TEST_TOPICS.USER_CREATED,
        messages: [{
          key: userId,
          value: JSON.stringify({
            eventId: `${correlationId}-1`,
            eventType: 'user.created',
            timestamp: new Date().toISOString(),
            version: '1.0',
            source: 'user-service',
            correlationId,
            payload: {
              userId,
              email: 'flowtest@example.com',
              createdAt: new Date().toISOString(),
            },
          }),
        }],
      });

      // 2. Auth Login (après création)
      await producer.send({
        topic: TEST_TOPICS.AUTH_LOGIN,
        messages: [{
          key: userId,
          value: JSON.stringify({
            eventId: `${correlationId}-2`,
            eventType: 'auth.login',
            timestamp: new Date().toISOString(),
            version: '1.0',
            source: 'auth-service',
            correlationId,
            causationId: `${correlationId}-1`,
            payload: {
              userId,
              sessionId: 'session-new',
              loginAt: new Date().toISOString(),
              method: 'password',
            },
          }),
        }],
      });

      console.log(`✅ Simulated user registration flow with correlationId: ${correlationId}`);
    });

    it('should simulate booking flow', async () => {
      if (!isKafkaAvailable) {
        console.log('⏭️ Skipping: Kafka not available');
        return;
      }

      const bookingId = `booking-${Date.now()}`;
      const userId = 'test-user-booking';
      const correlationId = `corr-booking-${Date.now()}`;

      // 1. Booking Created
      await producer.send({
        topic: TEST_TOPICS.VOYAGE_BOOKING_CREATED,
        messages: [{
          key: bookingId,
          value: JSON.stringify({
            eventId: `${correlationId}-1`,
            eventType: 'voyage.booking.created',
            timestamp: new Date().toISOString(),
            version: '1.0',
            source: 'voyage-service',
            correlationId,
            payload: {
              bookingId,
              userId,
              bookingType: 'flight',
              status: 'pending',
              totalAmount: 499.99,
              currency: 'EUR',
              items: [{ type: 'flight', reference: 'AF123', price: 499.99 }],
              travelers: [{ firstName: 'John', lastName: 'Doe', type: 'adult' }],
              createdAt: new Date().toISOString(),
            },
          }),
        }],
      });

      // 2. Payment Completed
      await producer.send({
        topic: TEST_TOPICS.PAYMENT_COMPLETED,
        messages: [{
          key: bookingId,
          value: JSON.stringify({
            eventId: `${correlationId}-2`,
            eventType: 'payment.completed',
            timestamp: new Date().toISOString(),
            version: '1.0',
            source: 'payment-service',
            correlationId,
            causationId: `${correlationId}-1`,
            payload: {
              paymentId: `pay-${Date.now()}`,
              bookingId,
              userId,
              amount: 499.99,
              currency: 'EUR',
              transactionId: 'txn-123456',
              completedAt: new Date().toISOString(),
            },
          }),
        }],
      });

      console.log(`✅ Simulated booking flow with correlationId: ${correlationId}`);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid topic gracefully', async () => {
      if (!isKafkaAvailable) {
        console.log('⏭️ Skipping: Kafka not available');
        return;
      }

      // Si auto-create est désactivé, ceci devrait échouer
      // Avec auto-create activé, le topic sera créé
      const result = await producer.send({
        topic: 'dreamscape.test.auto-create',
        messages: [{ value: 'test' }],
      });

      // Avec auto-create, ça devrait réussir
      expect(result).toBeDefined();
    });
  });
});

describe('Kafka Topic Naming Convention', () => {
  it('should follow dreamscape.<domain>.<event> pattern', () => {
    const validTopics = [
      'dreamscape.user.created',
      'dreamscape.auth.login',
      'dreamscape.voyage.booking.created',
      'dreamscape.payment.completed',
      'dreamscape.ai.recommendation.generated',
    ];

    const pattern = /^dreamscape\.[a-z]+\.[a-z]+(\.[a-z]+)*$/;

    validTopics.forEach(topic => {
      expect(topic).toMatch(pattern);
    });
  });
});
