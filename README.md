# 🧪 Dreamscape Tests

Suite de tests complète pour l'architecture microservices Dreamscape. Couvre les tests unitaires, d'intégration, E2E, et de performance pour tous les services.

## 📋 Table des matières

- [Quick Start](#-quick-start)
- [Tests IA (US-IA-001 & US-IA-002)](#-tests-ia-us-ia-001--us-ia-002)
- [Commandes disponibles](#-commandes-disponibles)
- [Structure des tests](#-structure-des-tests)
- [Ajouter de nouveaux tests](#-ajouter-de-nouveaux-tests)
- [Configuration](#️-configuration)
- [Troubleshooting](#-troubleshooting)

## 🚀 Quick Start

### Prérequis

- Docker Desktop installé et démarré
- Node.js 18+
- Services Dreamscape en cours d'exécution (pour tests d'intégration)

### Installation

```bash
# Installer les dépendances
npm install
```

### Lancer les tests

```bash
# Tests de santé avec vraie DB (58 tests)
npm run test:health:realdb

# Tests IA (37 tests)
npm test -- --testPathPattern="US-IA"

# Tous les tests E2E
npm run test:e2e
```

Docker démarrera automatiquement PostgreSQL et Redis avant les tests d'intégration.

## 🧠 Tests IA (US-IA-001 & US-IA-002)

### ✅ Statut actuel : **100% de réussite !**

| Suite | Tests | Statut | Description |
|-------|-------|--------|-------------|
| **US-IA-001** | 13/13 ✅ | **PASS** | Système de recommandations de base |
| **US-IA-002** | 24/24 ✅ | **PASS** | Système de cold start |
| **TOTAL IA** | **37/37** ✅ | **PASS** | Tous les tests IA passent |

### US-IA-001 : Basic Recommendations System

**Objectif** : Valider le système de recommandations de base (vectorisation, scoring, explainability)

**Tests couverts** :
- ✅ Disponibilité `ScoringService` et `VectorizationService`
- ✅ Export de `VECTOR_DIMENSIONS` (8D)
- ✅ Algorithme de similarité cosinus (angle entre vecteurs)
- ✅ Algorithme de similarité euclidienne (distance normalisée)
- ✅ Algorithme hybride (70% cosine + 30% euclidean)
- ✅ Génération de raisons de matching (explainability)
- ✅ Calcul de score de confiance

**Fichier** : [`tests/US-IA-001-basic-recommendations/unit/recommendation-core.test.ts`](tests/US-IA-001-basic-recommendations/unit/recommendation-core.test.ts)

**Exécuter** :
```bash
npm test -- --testPathPattern="US-IA-001"
```

**Détails techniques** :
- Vecteurs 8D : Climate, Culture/Nature, Budget, Activity, Group, Urban/Rural, Gastronomy, Popularity
- Similarité cosinus : mesure l'angle entre vecteurs (valeur entre 0 et 1)
- Similarité euclidienne : mesure la distance normalisée
- Scoring hybride : combinaison pondérée pour meilleure précision

### US-IA-002 : Cold Start Management System

**Objectif** : Valider le système de gestion du cold start (nouveaux utilisateurs sans historique)

**Tests couverts** :
- ✅ Disponibilité `ColdStartService` et `SegmentEngineService`
- ✅ Définition des 4 stratégies cold start :
  - `POPULARITY_ONLY` : Pure popularité (pas de personnalisation)
  - `HYBRID_SEGMENT` : Popularité + matching par segment
  - `HYBRID_PREFERENCES` : Popularité + similarité vectorielle
  - `ADAPTIVE` : Choix automatique de la meilleure stratégie
- ✅ Définition des 8 segments utilisateur :
  - `BUDGET_BACKPACKER`, `FAMILY_EXPLORER`, `LUXURY_TRAVELER`
  - `ADVENTURE_SEEKER`, `CULTURAL_ENTHUSIAST`, `ROMANTIC_COUPLE`
  - `BUSINESS_LEISURE`, `SENIOR_COMFORT`
- ✅ Service de popularité (`PopularityService`)
- ✅ Conversion segment → vecteur (`SegmentToVectorService`)
- ✅ Conversion onboarding → vecteur enrichi (`OnboardingToVectorService`)

**Fichier** : [`tests/US-IA-002-cold-start/unit/cold-start-core.test.ts`](tests/US-IA-002-cold-start/unit/cold-start-core.test.ts)

**Exécuter** :
```bash
npm test -- --testPathPattern="US-IA-002"
```

**Détails techniques** :
- Segmentation automatique basée sur règles et scoring
- Blending adaptatif : mélange segment + préférences selon la confiance
- Stratégie adaptive : choisit automatiquement selon les données disponibles
- Cache Redis pour optimiser les performances des recommandations populaires

### Exécuter tous les tests IA

```bash
# Tous les tests IA (US-IA-001 + US-IA-002)
npm test -- --testPathPattern="US-IA"

# Mode verbose pour debug
npm test -- --testPathPattern="US-IA" --verbose

# Avec coverage
npm run test:coverage:ai
```

### Anatomie d'un test IA

```typescript
describe('IA-001: Basic Recommendations System', () => {
  describe('Cosine Similarity Algorithm', () => {
    it('should calculate similarity for identical vectors as 1.0', async () => {
      // Import du service
      const { ScoringService } = await import('@ai/services/ScoringService');
      const service = new ScoringService();

      // Vecteurs identiques
      const vector1 = [0.5, 0.8, 0.3, 0.7, 0.2, 0.9, 0.4, 0.6];
      const vector2 = [0.5, 0.8, 0.3, 0.7, 0.2, 0.9, 0.4, 0.6];

      // Calcul de similarité
      const similarity = service.cosineSimilarity(vector1, vector2);

      // Assertion : vecteurs identiques = similarité de 1.0
      expect(similarity).toBeCloseTo(1.0, 2);
    });
  });
});
```

## 📋 Commandes disponibles

### Tests Health Checks (INFRA-013.1)

```bash
# Tous les tests health avec vraie DB (58 tests)
npm run test:health:realdb

# Tests d'un service spécifique
npm run test:health:realdb:auth     # Auth service
npm run test:health:realdb:user     # User service
npm run test:health:realdb:voyage   # Voyage service
npm run test:health:realdb:ai       # AI service
npm run test:health:realdb:gateway  # Gateway service

# Mode verbose (debug)
npm run test:health:realdb:verbose
```

### Tests E2E - Cart & Booking Flow (DR-505)

```bash
# Tous les tests cart & booking E2E
npm run test:e2e:cart

# Mode interactif (ouvre Cypress UI)
npm run test:e2e:cart:open

# Tests avec Kafka
npm run test:e2e:cart:kafka
npm run test:e2e:cart:kafka:open
```

### Tests par profil (DR-59)

```bash
# Tous les tests du profil DR-59
npm run test:dr59

# Tests simples uniquement
npm run test:dr59:simple

# Tests unitaires
npm run test:dr59:unit

# Tests d'intégration
npm run test:dr59:integration

# Avec coverage
npm run test:dr59:coverage
```

### Tests Amadeus Activities (DR-69)

```bash
# Tous les tests DR-69
npm run test:dr69

# Par type
npm run test:dr69:unit         # Unitaires
npm run test:dr69:integration  # Intégration
npm run test:dr69:e2e          # End-to-end

# Avec coverage
npm run test:dr69:coverage
```

### Tests généraux

```bash
# Tous les tests
npm test

# Tests unitaires
npm run test:unit

# Tests d'intégration
npm run test:integration
npm run test:integration:auth
npm run test:integration:user
npm run test:integration:kafka

# Tests E2E
npm run test:e2e
npm run test:e2e:voyage
npm run test:e2e:web

# Coverage
npm run test:coverage
npm run test:coverage:all-services

# Mode watch (développement)
npm test -- --watch
```

## 🏗️ Structure des tests

```
tests/
├── US-IA-001-basic-recommendations/    # ✅ Système de recommandations (13 tests)
│   └── unit/
│       └── recommendation-core.test.ts
│
├── US-IA-002-cold-start/               # ✅ Cold start (24 tests)
│   └── unit/
│       └── cold-start-core.test.ts
│
├── DR-59-profile-user/                 # Profil utilisateur
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── DR-69-amadeus-activities/           # Intégration Amadeus
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── integration/                        # Tests d'intégration
│   ├── api/
│   │   ├── auth/
│   │   └── user/
│   ├── kafka/
│   └── health/
│
├── e2e/                               # Tests E2E (Cypress)
│   └── web-client/
│       ├── cart-booking-flow.cy.js
│       └── cart-booking-kafka.cy.js
│
└── mocks/                             # Services mockés
    └── services/
        └── mock-server.js

tools/
├── setup/                             # Configuration
│   ├── jest.config.js
│   ├── jest.config.coverage.js
│   ├── jest.config.health.js
│   ├── jest.config.realdb.js
│   ├── jest.config.integration.js
│   └── cypress.config.js
├── reporting/                         # Génération rapports
└── scripts/                           # Scripts utilitaires
```

## ➕ Ajouter de nouveaux tests

### 1. Créer la structure

```bash
# Créer le dossier du ticket
mkdir -p tests/US-IA-003-real-time/unit
mkdir -p tests/US-IA-003-real-time/integration
```

### 2. Créer le fichier de test

```typescript
// tests/US-IA-003-real-time/unit/realtime-core.test.ts

/**
 * Real-time Recommendations Tests
 *
 * @ticket US-IA-003
 */

describe('IA-003: Real-time Recommendations', () => {
  describe('Core Components', () => {
    it('should have RealtimeService available', async () => {
      const { RealtimeService } = await import('@ai/recommendations/realtime.service');
      expect(RealtimeService).toBeDefined();

      const service = new RealtimeService();
      expect(service).toBeInstanceOf(RealtimeService);
    });
  });
});
```

### 3. Exécuter

```bash
npm test -- --testPathPattern="US-IA-003"
```

### 4. Ajouter script npm (optionnel)

Dans `package.json` :
```json
{
  "scripts": {
    "test:ia003": "jest --testPathPattern=\"US-IA-003\""
  }
}
```

## ⚙️ Configuration

### Jest Configuration

Le fichier principal `jest.config.js` :

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts', '**/*.spec.ts'],

  // Mappage des modules
  moduleNameMapper: {
    '^@dreamscape/db$': '<rootDir>/../dreamscape-services/db/index.ts',
    '^@ai/(.*)$': '<rootDir>/../dreamscape-services/ai/src/$1',
    '^@/(.*)$': '<rootDir>/../dreamscape-services/voyage/src/$1',
  },

  // Transformation TypeScript
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        module: 'commonjs',
        paths: {
          '@dreamscape/db': ['../dreamscape-services/db/index.ts'],
          '@ai/*': ['../dreamscape-services/ai/src/*'],
        },
      },
    }],
  },
};
```

### Configurations spécifiques

- `jest.config.js` : Par défaut (unitaires)
- `jest.config.coverage.js` : Avec coverage
- `jest.config.health.js` : Health checks
- `jest.config.realdb.js` : Tests avec vraie DB
- `jest.config.integration.js` : Tests d'intégration

### Variables d'environnement

Créer `.env.test` si nécessaire :

```env
# Database
DATABASE_URL="postgresql://..."

# Redis
REDIS_URL="redis://localhost:6379"

# Services URLs
AUTH_SERVICE_URL="http://localhost:3001"
USER_SERVICE_URL="http://localhost:3002"
AI_SERVICE_URL="http://localhost:3003"
```

## 🔧 Troubleshooting

### Erreur : "Cannot find module @dreamscape/db"

**Solution** :
```bash
npm install
npm list @dreamscape/db  # Vérifier installation
```

Vérifier les paths dans `jest.config.js` :
```javascript
moduleNameMapper: {
  '^@dreamscape/db$': '<rootDir>/../dreamscape-services/db/index.ts'
}
```

### Erreur : "Cannot find module @ai/..."

**Solution** : Vérifier que les paths sont corrects dans `jest.config.js` :

```javascript
moduleNameMapper: {
  '^@ai/(.*)$': '<rootDir>/../dreamscape-services/ai/src/$1'
},
transform: {
  '^.+\\.ts$': ['ts-jest', {
    tsconfig: {
      paths: {
        '@ai/*': ['../dreamscape-services/ai/src/*']
      }
    }
  }]
}
```

### Tests qui timeout

**Cause** : Connexions non fermées (Prisma, Redis)

**Solution** :
```typescript
afterAll(async () => {
  await prisma.$disconnect();
  await redis.quit();
});
```

Ou augmenter timeout :
```typescript
it('slow test', async () => {
  // ...
}, 10000); // 10 secondes
```

### Erreur : "Worker process has failed to exit gracefully"

**Cause** : Connexions actives non fermées

**Solution** : Ajouter cleanup :
```typescript
afterAll(async () => {
  await prisma.$disconnect();
  await redis.quit();
});
```

### Tests qui échouent avec erreurs TypeScript

**Solution** :
```bash
# Voir toutes les erreurs TypeScript
npx tsc --noEmit

# Vérifier configuration ts-jest
npm list ts-jest
```

### Tests flaky (échouent aléatoirement)

**Causes** :
- Dates non mockées
- Timers non mockés
- Ordre d'exécution non déterministe

**Solutions** :
```typescript
// Mocker dates
jest.useFakeTimers();
jest.setSystemTime(new Date('2024-01-01'));

// Isoler tests
beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
});
```

## 📚 Conventions

### Nommage

- Tests unitaires : `*.test.ts` ou `*.spec.ts`
- Tests intégration : `*.integration.test.ts`
- Tests E2E : `*.cy.js` (Cypress)

### Structure AAA (Arrange, Act, Assert)

```typescript
it('should calculate correctly', () => {
  // Arrange : Préparer
  const input = { value: 10 };

  // Act : Exécuter
  const result = service.calculate(input);

  // Assert : Vérifier
  expect(result).toBe(20);
});
```

### Messages de commit

```bash
# Ajout
git commit -m "test(ia): add US-IA-003 realtime tests"

# Correction
git commit -m "fix(test): correct similarity assertion"

# Amélioration
git commit -m "refactor(test): improve test coverage"
```

### Best practices

#### ✅ DO
- Tester les cas limites (null, undefined, [], extrêmes)
- Tests isolés et indépendants
- Noms descriptifs
- Cleanup des ressources
- Mock services externes

#### ❌ DON'T
- Tests dépendants de l'ordre
- Tests flaky (dates, random, timers non mockés)
- Tests trop larges (un test = une assertion)
- Oublier le cleanup
- Tester l'implémentation au lieu du comportement

## 📊 Coverage

```bash
# Coverage global
npm run test:coverage

# Coverage par service
npm run test:coverage:ai
npm run test:coverage:auth
npm run test:coverage:user

# Ouvrir rapport HTML
open coverage/index.html
```

## 📚 Ressources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [ts-jest](https://kulshekhar.github.io/ts-jest/)
- [Cypress Documentation](https://docs.cypress.io/)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)

## 🤝 Contribution

### Review checklist

Avant de soumettre une PR avec tests :

- [ ] Tous les tests passent localement
- [ ] Coverage maintenu ou amélioré
- [ ] Tests isolés (pas de dépendances)
- [ ] Cleanup implémenté (afterEach, afterAll)
- [ ] Noms de tests descriptifs
- [ ] README mis à jour si nouveau type de test

## 📞 Support

- Issues GitHub : Créer une issue sur le repo
- Slack : `#team-qa` pour questions QA
- Documentation : `docs/testing-guide.md`

---

**Version** : 1.0.0
**Dernière mise à jour** : 2026-02-06
**Mainteneur** : Équipe Dreamscape QA
