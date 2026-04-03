# Tests d'intégration

> **Integration Tests** — Validation des APIs REST, événements Kafka et health checks de tous les services DreamScape

## Structure

```
integration/
├── api/
│   ├── auth/
│   │   ├── auth.integration.test.ts     # Tests API Auth Service
│   │   ├── setup.js                     # Setup DB/services avant tests
│   │   └── teardown.js                  # Cleanup après tests
│   └── user/
│       ├── user.integration.test.ts     # Tests API User Service
│       ├── gdpr.integration.test.ts     # Tests API GDPR
│       ├── setup.js
│       └── teardown.js
├── health/
│   ├── auth-health.test.ts              # Health check Auth (port 3001)
│   ├── user-health.test.ts              # Health check User (port 3002)
│   ├── voyage-health.test.ts           # Health check Voyage (port 3003)
│   ├── gateway-health.test.ts          # Health check Gateway (port 4000)
│   └── ai-health.test.ts               # Health check AI (port 3005)
└── kafka/
    ├── kafka-integration.test.ts        # Tests Kafka généraux
    ├── auth-events-kafka.test.ts        # Événements auth
    ├── user-events-kafka.test.ts        # Événements user
    ├── payment-events-kafka.test.ts     # Événements paiement
    ├── voyage-events-kafka.test.ts      # Événements voyage
    ├── gdpr-events-kafka.test.ts        # Événements GDPR
    ├── ai-consumers-kafka.test.ts       # Consommateurs IA
    ├── saga-pattern-booking.test.ts     # Saga Pattern réservation/paiement
    ├── jest.config.kafka.js
    └── tsconfig.json
```

Dossier supplémentaire :
```
monitoring/
└── kafka-monitoring-validation.test.ts  # Validation monitoring Kafka
```

## Commandes

```bash
# Depuis dreamscape-tests/

# Tous les tests d'intégration
npm run test:integration

# Par service
npm run test:integration:auth     # API Auth
npm run test:integration:user     # API User
npm run test:integration:kafka    # Événements Kafka

# Health checks (requiert vraie DB)
npm run test:health:realdb
npm run test:health:realdb:auth
npm run test:health:realdb:user
npm run test:health:realdb:voyage
npm run test:health:realdb:ai
npm run test:health:realdb:gateway
```

## Patterns de test

### Tests API (supertest)

```typescript
import request from 'supertest'

const makeRequest = (method: 'get' | 'post' | 'put' | 'delete', path: string) =>
  request('http://localhost:3001')
    [method](path)
    .set('x-test-rate-limit', 'true')  // Bypass rate limiting en test

describe('Auth Service — /api/v1/auth', () => {
  let authToken: string
  let testUserId: string

  beforeEach(async () => {
    // Enregistrer un utilisateur de test via auth-service
    const res = await makeRequest('post', '/api/v1/auth/register')
      .send({ email: 'test@example.com', password: 'Test123!' })
    authToken = res.body.data.accessToken
    testUserId = res.body.data.user.id
  })

  afterEach(async () => {
    // Cleanup
  })

  it('should login successfully', async () => {
    const res = await makeRequest('post', '/api/v1/auth/login')
      .send({ email: 'test@example.com', password: 'Test123!' })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.accessToken).toBeDefined()
  })
})
```

### Tests Kafka

```typescript
import { KafkaConsumer } from '@dreamscape/kafka'

describe('Payment Events Kafka', () => {
  it('should publish payment.completed event', async () => {
    const consumer = new KafkaConsumer('dreamscape.payment.completed')
    await consumer.subscribe()

    // Déclencher un paiement
    await triggerPayment(bookingId)

    // Attendre l'événement
    const event = await consumer.waitForEvent(10000)
    expect(event.payload.bookingId).toBe(bookingId)
    expect(event.payload.status).toBe('completed')

    await consumer.disconnect()
  })
})
```

### Tests Saga Pattern

```typescript
// saga-pattern-booking.test.ts
// Teste le flux complet : booking → payment → confirmation/annulation

it('should confirm booking when payment succeeds', async () => {
  // 1. Créer une réservation
  const booking = await createBooking(cartId)
  expect(booking.status).toBe('PENDING')

  // 2. Simuler un paiement réussi
  await simulatePaymentCompleted(booking.id)

  // 3. Vérifier que voyage-service a confirmé la réservation
  await waitFor(async () => {
    const updated = await getBooking(booking.id)
    return updated.status === 'CONFIRMED'
  }, { timeout: 5000 })
})
```

## Headers requis

| Header | Valeur | Rôle |
|--------|--------|------|
| `x-test-rate-limit` | `true` | Bypass du rate limiting Redis |
| `Authorization` | `Bearer <token>` | Authentification JWT |
| `Content-Type` | `application/json` | Body JSON |

## Configuration Jest

Chaque sous-dossier peut avoir sa propre config Jest :

- `tools/setup/jest.config.integration.js` — Config intégration générale
- `integration/kafka/jest.config.kafka.js` — Config spécifique Kafka (timeout plus long)

```javascript
// jest.config.kafka.js
module.exports = {
  testTimeout: 30000,  // 30s pour les tests Kafka
  preset: 'ts-jest',
  testEnvironment: 'node',
}
```

## Prérequis

Pour lancer les tests d'intégration :
- **PostgreSQL** : démarré et accessible
- **Redis** : démarré (certains tests peuvent passer sans)
- **Services DreamScape** : auth-service (3001), user-service (3002), etc.
- **Kafka** : requis uniquement pour `test:integration:kafka`

```bash
# Démarrer l'infrastructure minimale
make db       # PostgreSQL + Redis
make services # Tous les services backend
```

## Cleanup

Les tests créent des données de test et les nettoient via `afterEach`/`afterAll`. En cas d'échec, nettoyer manuellement via Prisma Studio :

```bash
cd dreamscape-services/db && npm run db:studio
```

---

*Voir `dreamscape-tests/README.md` pour la documentation complète de la suite de tests.*
