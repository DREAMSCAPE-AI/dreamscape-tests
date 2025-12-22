# DreamScape Tests

Tests d'intégration pour les services DreamScape avec vraie base de données PostgreSQL + Redis.

## 🚀 Quick Start

### Prérequis
- Docker Desktop installé et démarré
- Node.js 18+

### Lancer les tests

```bash
# Installer les dépendances
npm install

# Lancer tous les tests de health checks
npm run test:health:realdb
```

Docker démarrera automatiquement PostgreSQL et Redis avant les tests.

## 📋 Commandes Disponibles

### Tests Health Checks (INFRA-013.1)

```bash
# Tous les tests avec vraie DB (58 tests)
npm run test:health:realdb

# Tests d'un service spécifique
npm run test:health:realdb:auth     # Auth service uniquement
npm run test:health:realdb:user     # User service uniquement
npm run test:health:realdb:voyage   # Voyage service uniquement
npm run test:health:realdb:ai       # AI service uniquement
npm run test:health:realdb:gateway  # Gateway service uniquement

# Mode verbose (pour debug)
npm run test:health:realdb:verbose
```

### Tests E2E - Cart & Booking Flow (DR-505)

```bash
# Run all cart and booking E2E tests
npm run test:e2e:cart

# Run with interactive UI
npm run test:e2e:cart:open

# Run all E2E tests (voyage + web + cart)
npm run test:e2e
```

**Quick Start:** See [CART_TESTS_QUICKSTART.md](./CART_TESTS_QUICKSTART.md)
**Full Documentation:** See [CART_BOOKING_TESTS.md](./CART_BOOKING_TESTS.md)

### Tests Unitaires (avec mocks)

```bash
# Tous les tests unitaires
npm test

# Tests unitaires d'un service
npm test -- auth-health.test.ts
```

## ✅ Résultats Attendus

```
Test Suites: 5 passed, 5 total
Tests:       58 passed, 58 total
Time:        ~14s
```

**Par service:**
- Auth: 11/11 tests ✅
- User: 18/18 tests ✅
- Voyage: 10/10 tests ✅
- AI: 10/10 tests ✅
- Gateway: 10/10 tests ✅

## 🐳 Docker

Les conteneurs Docker sont gérés automatiquement par les tests.

### Vérifier que Docker tourne

```bash
docker ps
```

Vous devriez voir:
- `dreamscape-postgres` (Running)
- `dreamscape-redis` (Running)

### Arrêter les conteneurs (après les tests)

```bash
cd ../dreamscape-infra/docker
docker-compose -f docker-compose.bigpods.dev.yml down
```

## 🔧 Troubleshooting

### "Docker not running"
```bash
# Démarrer Docker Desktop
# Windows: Ouvrir Docker Desktop
# Mac: Ouvrir Docker.app
# Linux: sudo systemctl start docker
```

### "Port 5432 already in use"
```bash
# Un PostgreSQL local tourne, l'arrêter temporairement
# Windows: services.msc → Arrêter PostgreSQL
# Mac/Linux: brew services stop postgresql
```

### "Redis connection failed"
```bash
# Vérifier que Redis tourne
docker ps | grep redis

# Redémarrer Redis si nécessaire
cd ../dreamscape-infra/docker
docker-compose -f docker-compose.bigpods.dev.yml restart redis
```

### Tests qui échouent

```bash
# Mode verbose pour voir les détails
npm run test:health:realdb:verbose

# Nettoyer et recommencer
docker-compose -f ../dreamscape-infra/docker/docker-compose.bigpods.dev.yml down
npm run test:health:realdb
```

## 📁 Structure

```
dreamscape-tests/
├── integration/
│   └── health/              # Tests d'intégration health checks
│       ├── auth-health.test.ts
│       ├── user-health.test.ts
│       ├── voyage-health.test.ts
│       ├── ai-health.test.ts
│       └── gateway-health.test.ts
├── jest.config.realdb.js    # Config Jest pour vraie DB
├── jest.setup.realdb.ts     # Setup Docker automatique
└── package.json
```

## 📚 Documentation Complète

### Database & Health Tests
- **[REALDB_MIGRATION_SUMMARY.md](./REALDB_MIGRATION_SUMMARY.md)** - Résumé de la migration vers vraie DB
- **[REALDB_TESTS.md](./REALDB_TESTS.md)** - Guide détaillé des tests avec vraie DB
- **[HEALTH_CHECK_TEST_REPORT.md](./HEALTH_CHECK_TEST_REPORT.md)** - Rapport des tests health checks

### E2E Tests
- **[CART_BOOKING_TESTS.md](./CART_BOOKING_TESTS.md)** - Complete cart and booking flow E2E tests (DR-505)
- **[CART_TESTS_QUICKSTART.md](./CART_TESTS_QUICKSTART.md)** - Quick start guide for cart tests

### Other Tests
- **[PROFILE_TESTS_README.md](./PROFILE_TESTS_README.md)** - Profile user tests (DR-59)
- **[KAFKA-TESTING-GUIDE.md](./KAFKA-TESTING-GUIDE.md)** - Kafka testing guide

## 🎯 Endpoints Testés

Chaque service teste 3 endpoints:

### `/health` - Health Check Complet
- Status: 200 (healthy), 206 (degraded), 503 (unhealthy)
- Vérifie: PostgreSQL, Redis, services downstream
- Inclut: metadata, response time, uptime

### `/health/live` - Liveness Probe
- Status: 200 (alive)
- Vérifie: Le service répond
- Utilisé par: Kubernetes liveness probe

### `/health/ready` - Readiness Probe
- Status: 200 (ready), 503 (not ready)
- Vérifie: Dépendances critiques (DB)
- Utilisé par: Kubernetes readiness probe

## 👥 Pour l'Équipe

### Avant de commit
```bash
# Vérifier que tous les tests passent
npm run test:health:realdb

# Attendu: 58/58 tests passed ✅
```

### Ajouter de nouveaux tests

1. Créer le fichier dans `integration/health/`
2. Importer les routes du service
3. Utiliser `jest.setup.realdb.ts` (Docker auto-start)
4. Tester avec vraie DB (pas de mocks!)

Exemple:
```typescript
import request from 'supertest';
import express from 'express';
import healthRoutes from '../../../dreamscape-services/mon-service/src/routes/health';

const app = express();
app.use('/health', healthRoutes);

describe('Mon Service Health', () => {
  it('should return 200', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
  });
});
```

## 🚦 CI/CD

Ces tests tournent automatiquement sur:
- Pull Requests vers `main`
- Commits sur branches de feature
- Pipeline de déploiement

Status: ✅ **58/58 tests passing (100%)**

**Dernière mise à jour:** 2025-12-03
**Status:** ✅ Production Ready - 100% tests passing
