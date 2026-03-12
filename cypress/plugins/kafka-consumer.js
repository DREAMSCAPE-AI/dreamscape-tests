/**
 * Kafka Test Consumer for E2E Tests
 * Listens for Kafka events during test execution
 */

const { Kafka } = require('kafkajs');

class KafkaTestConsumer {
  constructor() {
    this.kafka = new Kafka({
      clientId: 'dreamscape-test-consumer',
      brokers: [process.env.KAFKA_BROKERS || 'localhost:9092'],
      retry: {
        initialRetryTime: 100,
        retries: 8
      }
    });

    this.consumer = null;
    this.events = [];
    this.isRunning = false;
    this.listeners = new Map(); // topic -> array of listeners
  }

  /**
   * Start the Kafka consumer
   */
  async start() {
    if (this.isRunning) {
      console.log('Kafka consumer already running');
      return;
    }

    try {
      this.consumer = this.kafka.consumer({
        groupId: `test-group-${Date.now()}`,
        sessionTimeout: 30000,
        heartbeatInterval: 3000
      });

      await this.consumer.connect();
      console.log('✓ Kafka test consumer connected');

      // Subscribe to booking-related topics
      await this.consumer.subscribe({
        topics: [
          'booking.created',
          'booking.updated',
          'booking.cancelled',
          'payment.succeeded',
          'payment.failed'
        ],
        fromBeginning: false // Only new messages during test
      });

      // Start consuming messages
      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          try {
            const event = {
              topic,
              partition,
              offset: message.offset,
              timestamp: message.timestamp,
              key: message.key ? message.key.toString() : null,
              value: JSON.parse(message.value.toString()),
              headers: message.headers
            };

            console.log(`Kafka event received: ${topic}`, event.value);

            // Store event
            this.events.push(event);

            // Notify listeners
            if (this.listeners.has(topic)) {
              const topicListeners = this.listeners.get(topic);
              topicListeners.forEach(listener => {
                try {
                  listener(event);
                } catch (err) {
                  console.error('Listener error:', err);
                }
              });
            }
          } catch (error) {
            console.error('Error processing Kafka message:', error);
          }
        }
      });

      this.isRunning = true;
      console.log('✓ Kafka consumer running and listening for events');
    } catch (error) {
      console.error('Failed to start Kafka consumer:', error.message);
      throw error;
    }
  }

  /**
   * Stop the Kafka consumer
   */
  async stop() {
    if (!this.isRunning || !this.consumer) {
      return;
    }

    try {
      await this.consumer.disconnect();
      this.isRunning = false;
      this.events = [];
      this.listeners.clear();
      console.log('✓ Kafka consumer stopped');
    } catch (error) {
      console.error('Error stopping Kafka consumer:', error);
    }
  }

  /**
   * Clear all stored events
   */
  clearEvents() {
    this.events = [];
    console.log('Kafka events cleared');
  }

  /**
   * Get all events for a specific topic
   * @param {string} topic - Topic name
   * @returns {array} Events for the topic
   */
  getEventsByTopic(topic) {
    return this.events.filter(event => event.topic === topic);
  }

  /**
   * Get the most recent event for a topic
   * @param {string} topic - Topic name
   * @returns {object|null} Most recent event or null
   */
  getLatestEvent(topic) {
    const topicEvents = this.getEventsByTopic(topic);
    return topicEvents.length > 0 ? topicEvents[topicEvents.length - 1] : null;
  }

  /**
   * Wait for a specific event to be received
   * @param {string} topic - Topic to listen on
   * @param {function} matchFn - Function to match the event (optional)
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<object>} The matched event
   */
  waitForEvent(topic, matchFn = null, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      // Check if event already exists
      const existingEvents = this.getEventsByTopic(topic);
      for (const event of existingEvents) {
        if (!matchFn || matchFn(event)) {
          resolve(event);
          return;
        }
      }

      // Set up listener for new events
      const listener = (event) => {
        if (!matchFn || matchFn(event)) {
          clearTimeout(timeoutId);
          this.removeListener(topic, listener);
          resolve(event);
        }
      };

      // Add listener
      this.addListener(topic, listener);

      // Set timeout
      const timeoutId = setTimeout(() => {
        this.removeListener(topic, listener);
        reject(new Error(
          `Timeout waiting for Kafka event on topic "${topic}" after ${timeout}ms. ` +
          `Received ${this.getEventsByTopic(topic).length} events on this topic.`
        ));
      }, timeout);
    });
  }

  /**
   * Add a listener for a specific topic
   * @param {string} topic - Topic name
   * @param {function} callback - Callback function
   */
  addListener(topic, callback) {
    if (!this.listeners.has(topic)) {
      this.listeners.set(topic, []);
    }
    this.listeners.get(topic).push(callback);
  }

  /**
   * Remove a listener
   * @param {string} topic - Topic name
   * @param {function} callback - Callback function to remove
   */
  removeListener(topic, callback) {
    if (this.listeners.has(topic)) {
      const listeners = this.listeners.get(topic);
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Wait for booking.created event with specific booking ID
   * @param {string} bookingId - Booking ID to match
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<object>} The booking event
   */
  async waitForBookingCreated(bookingId, timeout = 10000) {
    return this.waitForEvent(
      'booking.created',
      (event) => event.value.bookingId === bookingId,
      timeout
    );
  }

  /**
   * Wait for payment event with specific booking reference
   * @param {string} bookingReference - Booking reference to match
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<object>} The payment event
   */
  async waitForPaymentEvent(bookingReference, timeout = 10000) {
    return this.waitForEvent(
      'payment.succeeded',
      (event) => event.value.bookingReference === bookingReference,
      timeout
    );
  }

  /**
   * Get all events (for debugging)
   * @returns {array} All stored events
   */
  getAllEvents() {
    return this.events;
  }

  /**
   * Get event count by topic
   * @returns {object} Event counts by topic
   */
  getEventCounts() {
    const counts = {};
    this.events.forEach(event => {
      counts[event.topic] = (counts[event.topic] || 0) + 1;
    });
    return counts;
  }
}

// Create singleton instance
let kafkaConsumerInstance = null;

/**
 * Get or create Kafka consumer instance
 * @returns {KafkaTestConsumer} Kafka consumer instance
 */
function getKafkaConsumer() {
  if (!kafkaConsumerInstance) {
    kafkaConsumerInstance = new KafkaTestConsumer();
  }
  return kafkaConsumerInstance;
}

/**
 * Cypress plugin tasks for Kafka event verification
 */
const kafkaTasks = {
  /**
   * Start Kafka consumer
   */
  'kafka:start': async () => {
    try {
      const consumer = getKafkaConsumer();
      await consumer.start();
      return { success: true, message: 'Kafka consumer started' };
    } catch (error) {
      console.error('Failed to start Kafka consumer:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Stop Kafka consumer
   */
  'kafka:stop': async () => {
    try {
      const consumer = getKafkaConsumer();
      await consumer.stop();
      kafkaConsumerInstance = null;
      return { success: true, message: 'Kafka consumer stopped' };
    } catch (error) {
      console.error('Failed to stop Kafka consumer:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Clear all stored events
   */
  'kafka:clearEvents': () => {
    const consumer = getKafkaConsumer();
    consumer.clearEvents();
    return { success: true, message: 'Events cleared' };
  },

  /**
   * Wait for a specific event
   * @param {object} options - { topic, matchFn, timeout }
   */
  'kafka:waitForEvent': async ({ topic, bookingId, bookingReference, timeout = 10000 }) => {
    try {
      const consumer = getKafkaConsumer();

      let event;
      if (topic === 'booking.created' && bookingId) {
        event = await consumer.waitForBookingCreated(bookingId, timeout);
      } else if (topic === 'payment.succeeded' && bookingReference) {
        event = await consumer.waitForPaymentEvent(bookingReference, timeout);
      } else {
        event = await consumer.waitForEvent(topic, null, timeout);
      }

      return { success: true, event };
    } catch (error) {
      console.error('Error waiting for Kafka event:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get events by topic
   * @param {string} topic - Topic name
   */
  'kafka:getEventsByTopic': (topic) => {
    const consumer = getKafkaConsumer();
    const events = consumer.getEventsByTopic(topic);
    return { success: true, events, count: events.length };
  },

  /**
   * Get latest event for topic
   * @param {string} topic - Topic name
   */
  'kafka:getLatestEvent': (topic) => {
    const consumer = getKafkaConsumer();
    const event = consumer.getLatestEvent(topic);
    return { success: true, event };
  },

  /**
   * Get all events (for debugging)
   */
  'kafka:getAllEvents': () => {
    const consumer = getKafkaConsumer();
    const events = consumer.getAllEvents();
    const counts = consumer.getEventCounts();
    return { success: true, events, counts, total: events.length };
  }
};

module.exports = {
  KafkaTestConsumer,
  getKafkaConsumer,
  kafkaTasks
};
