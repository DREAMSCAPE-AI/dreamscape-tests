# Kafka Event Testing Guide for Cart & Booking Flow

Guide complet pour tester les événements Kafka pendant le flow de réservation.

## Vue d'ensemble

Ce guide explique comment tester que les événements Kafka sont correctement publiés lors du processus de checkout et de confirmation de réservation.

### Événements testés

- **`booking.created`** - Publié lors de la création d'une réservation (checkout)
- **`booking.confirmed`** - Publié après confirmation du paiement
- **`booking.cancelled`** - Publié lors de l'annulation d'une réservation
- **`payment.completed`** - Consommé pour confirmer une réservation
- **`payment.failed`** - Consommé pour marquer une réservation comme échouée

## Architecture

```
┌─────────────────┐
│  Cypress Tests  │
└────────┬────────┘
         │ cy.task()
         ▼
┌─────────────────┐
│ Kafka Consumer  │◄────── booking.created
│  (Test Plugin)  │◄────── booking.confirmed
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Kafka Broker    │
│  (localhost)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Voyage Service  │──────► booking.created
│ (BookingService)│──────► booking.confirmed
└─────────────────┘
```

## Prérequis

### 1. Kafka en cours d'exécution

```bash
# Option 1: Docker Compose (recommandé)
cd dreamscape-infra/docker
docker-compose up -d kafka zookeeper

# Option 2: Kafka local
# Assurez-vous que Kafka tourne sur localhost:9092
```

### 2. Services requis

```bash
# Voyage service (avec Kafka activé)
cd dreamscape-services/voyage
PORT=3003 npm run dev

# Web client
cd dreamscape-frontend/web-client
npm run dev
```

### 3. Dépendances installées

```bash
cd dreamscape-tests
npm install
# kafkajs est déjà inclus dans package.json
```

## Fichiers créés

### 1. Kafka Consumer Plugin
**`cypress/plugins/kafka-consumer.js`**
- Consommateur Kafka pour les tests E2E
- Écoute les événements en temps réel
- Stocke les événements pour vérification
- API pour attendre des événements spécifiques

### 2. Cypress Configuration
**`cypress.config.js`**
- Intègre les tâches Kafka
- Démarre/arrête automatiquement le consumer
- Configuration des brokers Kafka

### 3. Tests Kafka
**`tests/e2e/web-client/cart-booking-kafka.cy.js`**
- Tests E2E complets avec vérification Kafka
- Assertions sur la structure des événements
- Tests multi-items
- Gestion d'erreurs Kafka

## Utilisation

### Lancer les tests Kafka

```bash
cd dreamscape-tests

# Tous les tests avec vérification Kafka
npx cypress run --spec "tests/e2e/web-client/cart-booking-kafka.cy.js"

# Mode interactif
npx cypress open
# Puis sélectionner cart-booking-kafka.cy.js
```

### Commandes Cypress disponibles

#### Démarrer le consumer Kafka
```javascript
cy.task('kafka:start').then((result) => {
  // result = { success: true, message: 'Kafka consumer started' }
});
```

#### Arrêter le consumer
```javascript
cy.task('kafka:stop').then((result) => {
  // Consumer stopped
});
```

#### Effacer les événements
```javascript
cy.task('kafka:clearEvents');
```

#### Attendre un événement spécifique
```javascript
cy.task('kafka:waitForEvent', {
  topic: 'booking.created',
  bookingId: 'booking-123',
  timeout: 5000
}).then((result) => {
  expect(result.success).to.be.true;
  expect(result.event.value.bookingId).to.equal('booking-123');
});
```

#### Récupérer les événements par topic
```javascript
cy.task('kafka:getEventsByTopic', 'booking.created').then((result) => {
  // result = { success: true, events: [...], count: 5 }
});
```

#### Récupérer le dernier événement
```javascript
cy.task('kafka:getLatestEvent', 'booking.created').then((result) => {
  // result = { success: true, event: {...} }
});
```

#### Récupérer tous les événements
```javascript
cy.task('kafka:getAllEvents').then((result) => {
  // result = { success: true, events: [...], counts: {...}, total: 10 }
});
```

## Exemples de tests

### Test 1: Vérifier que booking.created est publié

```javascript
it('should publish booking.created event', () => {
  // Add item to cart
  cy.request('POST', `${VOYAGE_SERVICE_URL}/api/v1/cart/${userId}/items`, itemData);

  // Checkout
  cy.request('POST', `${VOYAGE_SERVICE_URL}/api/v1/cart/${userId}/checkout`, {
    userId
  }).then((response) => {
    const bookingId = response.body.bookingId;

    // Wait for Kafka event
    cy.task('kafka:waitForEvent', {
      topic: 'booking.created',
      bookingId: bookingId,
      timeout: 5000
    }).then((result) => {
      expect(result.success).to.be.true;
      expect(result.event.value.bookingId).to.equal(bookingId);
      expect(result.event.value.userId).to.equal(userId);
      expect(result.event.value.status).to.equal('DRAFT');
    });
  });
});
```

### Test 2: Vérifier la structure de l'événement

```javascript
it('should include all required fields in event', () => {
  // Create booking...

  cy.task('kafka:waitForEvent', {
    topic: 'booking.created',
    bookingId: bookingId,
    timeout: 5000
  }).then((result) => {
    const payload = result.event.value;

    // Verify required fields
    expect(payload).to.have.property('bookingId');
    expect(payload).to.have.property('bookingReference');
    expect(payload).to.have.property('userId');
    expect(payload).to.have.property('type'); // FLIGHT, HOTEL, etc.
    expect(payload).to.have.property('status');
    expect(payload).to.have.property('totalAmount');
    expect(payload).to.have.property('currency');
    expect(payload).to.have.property('items');
    expect(payload).to.have.property('paymentIntentId');
    expect(payload).to.have.property('createdAt');

    // Verify items array
    expect(payload.items).to.be.an('array');
    expect(payload.items).to.have.length.greaterThan(0);
  });
});
```

### Test 3: Vérifier plusieurs items dans l'événement

```javascript
it('should include all cart items in event', () => {
  // Add flight, hotel, and activity to cart
  cy.request('POST', `${VOYAGE_SERVICE_URL}/api/v1/cart/${userId}/items`, flightData);
  cy.request('POST', `${VOYAGE_SERVICE_URL}/api/v1/cart/${userId}/items`, hotelData);
  cy.request('POST', `${VOYAGE_SERVICE_URL}/api/v1/cart/${userId}/items`, activityData);

  // Checkout
  cy.request('POST', `${VOYAGE_SERVICE_URL}/api/v1/cart/${userId}/checkout`, { userId })
    .then((response) => {
      const bookingId = response.body.bookingId;

      cy.task('kafka:waitForEvent', {
        topic: 'booking.created',
        bookingId: bookingId,
        timeout: 5000
      }).then((result) => {
        const items = result.event.value.items;

        // Verify all 3 items present
        expect(items).to.have.length(3);

        const flight = items.find(i => i.type === 'FLIGHT');
        const hotel = items.find(i => i.type === 'HOTEL');
        const activity = items.find(i => i.type === 'ACTIVITY');

        expect(flight).to.exist;
        expect(hotel).to.exist;
        expect(activity).to.exist;
      });
    });
});
```

## Structure des événements

### booking.created

```json
{
  "bookingId": "clx123abc",
  "bookingReference": "BOOK-20251222-AB123",
  "userId": "user-123",
  "type": "PACKAGE",
  "status": "DRAFT",
  "totalAmount": 685.00,
  "currency": "EUR",
  "items": [
    {
      "type": "FLIGHT",
      "itemId": "flight-123",
      "quantity": 1,
      "price": 500.00,
      "currency": "EUR"
    },
    {
      "type": "HOTEL",
      "itemId": "hotel-456",
      "quantity": 1,
      "price": 150.00,
      "currency": "EUR"
    },
    {
      "type": "ACTIVITY",
      "itemId": "activity-789",
      "quantity": 1,
      "price": 35.00,
      "currency": "EUR"
    }
  ],
  "paymentIntentId": "pi_temp_1703252400_abc123",
  "createdAt": "2025-12-22T10:30:00.000Z"
}
```

### booking.confirmed

```json
{
  "bookingId": "clx123abc",
  "bookingReference": "BOOK-20251222-AB123",
  "userId": "user-123",
  "type": "PACKAGE",
  "totalAmount": 685.00,
  "currency": "EUR",
  "items": [ /* same as booking.created */ ],
  "confirmedAt": "2025-12-22T10:35:00.000Z"
}
```

## Implémentation Backend

### BookingService avec Kafka

```typescript
// dreamscape-services/voyage/src/services/BookingService.ts

import voyageKafkaService from './KafkaService';
import type { VoyageBookingCreatedPayload } from '@dreamscape/kafka';

async createBookingFromCart(data: CreateBookingFromCartDTO): Promise<BookingData> {
  // ... create booking in database

  // Publish Kafka event
  try {
    const kafkaPayload: VoyageBookingCreatedPayload = {
      bookingId: booking.id,
      bookingReference: reference,
      userId,
      type: bookingType,
      status: 'DRAFT',
      totalAmount: Number(booking.totalAmount),
      currency: booking.currency,
      items: cart.items.map(...),
      paymentIntentId,
      createdAt: booking.createdAt.toISOString(),
    };

    await voyageKafkaService.publishBookingCreated(kafkaPayload);
    console.log(`📨 Published booking.created event for ${reference}`);
  } catch (kafkaError) {
    // Log but don't fail booking creation
    console.error(`⚠️ Failed to publish event:`, kafkaError);
  }

  return booking;
}
```

## Dépannage

### Kafka Consumer ne démarre pas

```bash
# Vérifier que Kafka tourne
docker ps | grep kafka

# Vérifier les logs Kafka
docker logs dreamscape-kafka

# Vérifier le port
netstat -an | grep 9092
```

**Solution**: Redémarrer Kafka
```bash
docker-compose restart kafka
```

### Événements non reçus

**Symptômes**: Test timeout en attendant l'événement

**Vérifications**:
1. Kafka est-il démarré ?
2. Le service voyage est-il en cours d'exécution ?
3. Le topic `booking.created` existe-t-il ?

**Debug**:
```javascript
// Voir tous les événements reçus
cy.task('kafka:getAllEvents').then((result) => {
  console.log('All events:', result.events);
  console.log('Counts by topic:', result.counts);
});
```

### Consumer Group déjà utilisé

**Erreur**: `Group coordinator not available`

**Solution**: Utiliser un group ID unique
```javascript
// cypress/plugins/kafka-consumer.js
groupId: `test-group-${Date.now()}` // Already implemented
```

### Timeout trop court

Si les événements arrivent mais après le timeout:

```javascript
// Augmenter le timeout
cy.task('kafka:waitForEvent', {
  topic: 'booking.created',
  bookingId: bookingId,
  timeout: 10000 // 10 secondes au lieu de 5
});
```

## Configuration avancée

### Changer le broker Kafka

Dans `cypress.config.js`:
```javascript
env: {
  KAFKA_BROKERS: 'kafka.example.com:9092'
}
```

### Topics personnalisés

Modifier `cypress/plugins/kafka-consumer.js`:
```javascript
await this.consumer.subscribe({
  topics: [
    'booking.created',
    'booking.updated',
    'booking.cancelled',
    'custom.topic.here'  // Add custom topics
  ],
  fromBeginning: false
});
```

### Filtrer les événements

```javascript
// Wait for event with custom filter
cy.task('kafka:waitForEvent', {
  topic: 'booking.created',
  timeout: 5000
}).then((result) => {
  // Custom validation
  const event = result.event.value;
  if (event.totalAmount < 100) {
    throw new Error('Amount too low');
  }
});
```

## Métriques et Monitoring

### Compter les événements par topic

```javascript
cy.task('kafka:getAllEvents').then((result) => {
  console.log('Event counts:', result.counts);
  // { 'booking.created': 5, 'booking.confirmed': 3 }
});
```

### Vérifier la latence

```javascript
const startTime = Date.now();

cy.request('POST', `${VOYAGE_SERVICE_URL}/api/v1/cart/${userId}/checkout`, {
  userId
}).then((response) => {
  cy.task('kafka:waitForEvent', {
    topic: 'booking.created',
    bookingId: response.body.bookingId,
    timeout: 5000
  }).then((result) => {
    const latency = Date.now() - startTime;
    console.log(`Event latency: ${latency}ms`);
    expect(latency).to.be.lessThan(1000); // Should be under 1 second
  });
});
```

## Bonnes pratiques

### 1. Nettoyer les événements entre les tests

```javascript
beforeEach(() => {
  cy.task('kafka:clearEvents');
});
```

### 2. Utiliser des timeouts raisonnables

```javascript
// Trop court
timeout: 1000  // ❌ Risque de faux négatifs

// Recommandé
timeout: 5000  // ✅ Balance entre rapidité et fiabilité

// Trop long
timeout: 30000 // ❌ Ralentit les tests
```

### 3. Tester les cas d'erreur

```javascript
it('should handle Kafka unavailability', () => {
  // Booking should still be created even if Kafka fails
  cy.request('POST', checkoutUrl).then((response) => {
    expect(response.status).to.equal(200);
    // Kafka event is best-effort, not critical
  });
});
```

### 4. Vérifier la structure ET les données

```javascript
// Structure only ❌
expect(payload).to.have.property('bookingId');

// Structure + data validation ✅
expect(payload).to.have.property('bookingId');
expect(payload.bookingId).to.match(/^clx[a-z0-9]+$/);
expect(payload.bookingId).to.equal(expectedBookingId);
```

## Intégration CI/CD

### GitHub Actions

```yaml
name: Cart E2E Tests with Kafka

on: [push, pull_request]

jobs:
  e2e-kafka:
    runs-on: ubuntu-latest

    services:
      zookeeper:
        image: confluentinc/cp-zookeeper:latest
        env:
          ZOOKEEPER_CLIENT_PORT: 2181

      kafka:
        image: confluentinc/cp-kafka:latest
        env:
          KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
          KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092

    steps:
      - uses: actions/checkout@v3

      - name: Start services
        run: |
          docker-compose up -d postgres redis
          cd dreamscape-services/voyage && npm run dev &
          cd dreamscape-frontend/web-client && npm run dev &
          sleep 10

      - name: Run Kafka E2E tests
        run: |
          cd dreamscape-tests
          npx cypress run --spec "tests/e2e/web-client/cart-booking-kafka.cy.js"
```

## Ressources

- [KafkaJS Documentation](https://kafka.js.org/)
- [Cypress Custom Tasks](https://docs.cypress.io/api/commands/task)
- [Kafka Testing Best Practices](https://kafka.apache.org/documentation/#testing)
- [DreamScape Kafka Architecture](../dreamscape-services/docs/KAFKA-ARCHITECTURE.md)

## Support

Pour des questions ou problèmes:
1. Vérifier les logs du consumer Kafka: Console Cypress
2. Vérifier les logs du voyage service: Terminal du service
3. Vérifier les logs Kafka: `docker logs dreamscape-kafka`
4. Ouvrir une issue sur GitHub avec les logs
