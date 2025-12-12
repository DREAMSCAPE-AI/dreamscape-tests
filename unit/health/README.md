# Health Check Tests - INFRA-013.1

Guide complet pour tester les endpoints de health check standardisés sur tous les services DreamScape.

## 📋 Critères d'Acceptation

- ✅ Endpoints `/health` sur tous les services (Auth, User, Voyage, AI, Gateway)
- ✅ Vérifications des dépendances (PostgreSQL, Redis)
- ✅ Format de réponse standardisé
- ✅ Tests automatisés (unitaires, intégration, serveurs réels)

## 🎯 Types de Tests

### 1️⃣ Tests Unitaires (avec mocks)

**Rapides et isolés** - Pas besoin de Docker ou serveurs

```bash
cd dreamscape-tests
npm run test:health:unit
```

**Ce qui est testé :**
- Logique du `HealthChecker`
- Fonctions helper (PostgreSQL, Redis checks)
- Format des réponses

### 2️⃣ Tests d'Intégration (avec vraie DB)

**Tests réalistes** - Nécessite Docker PostgreSQL + Redis

```bash
# Démarrer Docker
cd dreamscape-infra/docker
docker-compose -f docker-compose.bigpods.dev.yml up -d postgres redis

# Lancer les tests
cd ../../dreamscape-tests
npm run test:health:realdb
```

**Ce qui est testé :**
- Connexions réelles à PostgreSQL et Redis
- Timeouts et erreurs réseau
- Performance

### 3️⃣ Tests des Serveurs HTTP Réels

**Tests end-to-end complets** - Nécessite TOUS les services démarrés

## 🚀 Guide Rapide : Lancer TOUS les Tests

### Étape 1 : Démarrer l'Infrastructure Docker

```powershell
cd dreamscape-infra/docker
docker-compose -f docker-compose.bigpods.dev.yml up -d postgres redis

# Vérifier que les services sont healthy
docker ps --filter "name=dreamscape"
```

Vous devriez voir :
```
dreamscape-postgres   Up XX hours (healthy)
dreamscape-redis      Up XX hours (healthy)
```

### Étape 2 : Démarrer TOUS les Services HTTP

**Ouvrez 5 terminaux PowerShell séparés :**

```powershell
# Terminal 1 - Auth Service (Port 3001)
cd C:\Users\ladhe\Desktop\DREAMSCAPE-AI\dreamscape-services\auth
npm run dev

# Terminal 2 - User Service (Port 3002)
cd C:\Users\ladhe\Desktop\DREAMSCAPE-AI\dreamscape-services\user
npm run dev

# Terminal 3 - Voyage Service (Port 3003)
cd C:\Users\ladhe\Desktop\DREAMSCAPE-AI\dreamscape-services\voyage
npm run dev

# Terminal 4 - AI Service (Port 3004)
cd C:\Users\ladhe\Desktop\DREAMSCAPE-AI\dreamscape-services\ai
npm run dev

# Terminal 5 - Gateway (Port 3000)
cd C:\Users\ladhe\Desktop\DREAMSCAPE-AI\dreamscape-frontend\gateway
npm run dev
```

**Attendez que chaque service affiche :**
```
Server listening on port XXXX
```

### Étape 3 : Lancer les Tests

**Dans un 6ème terminal :**

```powershell
cd C:\Users\ladhe\Desktop\DREAMSCAPE-AI\dreamscape-tests

# Tests de tous les services
npx jest --config=jest.config.realdb.js integration/health/all-services-health-real.test.ts

# OU service par service
npx jest --config=jest.config.realdb.js integration/health/auth-health-real.test.ts
npx jest --config=jest.config.realdb.js integration/health/user-health-real.test.ts
npx jest --config=jest.config.realdb.js integration/health/voyage-health-real.test.ts
npx jest --config=jest.config.realdb.js integration/health/ai-health-real.test.ts
```

## 📊 Services et Ports

| Service | Port | Health Check | Metrics | Dépendances |
|---------|------|--------------|---------|-------------|
| **Gateway** | 3000 | `/health`, `/api/health` | `/metrics` | Auth, User, Voyage, AI |
| **Auth** | 3001 | `/health`, `/api/health` | `/metrics` | PostgreSQL, Redis |
| **User** | 3002 | `/health`, `/api/health` | `/metrics` | PostgreSQL |
| **Voyage** | 3003 | `/health`, `/api/health` | `/metrics` | PostgreSQL |
| **AI** | 3004 | `/health`, `/api/health` | `/metrics` | PostgreSQL |

## 📝 Commandes Disponibles

```bash
# Tests unitaires (rapides, avec mocks)
npm run test:health:unit

# Tests d'intégration (avec mocks)
npm run test:health:integration

# Tests avec vraie DB (PostgreSQL + Redis)
npm run test:health:realdb

# Tests avec vraie DB - Auth uniquement
npm run test:health:realdb:auth

# Tous les tests de health check
npm run test:health

# Avec coverage
npm run test:health:coverage

# Mode watch (développement)
npm run test:health:watch
```

## ✅ Résultats Attendus

Quand tous les services sont démarrés, vous devriez voir :

```
PASS integration/health/all-services-health-real.test.ts
  All Services - Health Check Tests - INFRA-013.1
    Auth Service (Port 3001)
      ✓ GET /health - should return 200 and healthy status
      ✓ GET /api/health - should return 200 and healthy status
      ✓ GET /health/live - should return 200 and alive status
      ✓ GET /health/ready - should return 200 and ready status
      ✓ GET /metrics - should return Prometheus metrics
    User Service (Port 3002)
      ✓ [5 tests passed]
    Voyage Service (Port 3003)
      ✓ [5 tests passed]
    AI Service (Port 3004)
      ✓ [5 tests passed]
    Gateway Service (Port 3000)
      ✓ [5 tests passed]

Test Suites: 1 passed, 1 total
Tests:       25 passed, 25 total
```

## 🔧 Troubleshooting

### ❌ Erreur : `AggregateError` ou `ECONNREFUSED`

**Cause :** Le service n'est pas démarré

**Solution :**
```powershell
# Vérifier quels ports sont en écoute
netstat -ano | findstr ":3000 :3001 :3002 :3003 :3004"

# Démarrer le service manquant
cd dreamscape-services/[service-name]
npm run dev
```

### ❌ Erreur : `Cannot find package '@/services'` (Service AI)

**Cause :** Dossier `services` manquant dans le service AI

**Solution :** Le fichier `AmadeusService.ts` provisoire a été créé. Si l'erreur persiste :

```powershell
cd dreamscape-services/ai
# Vérifier que le fichier existe
dir src\services\AmadeusService.ts

# Redémarrer le service
npm run dev
```

### ❌ Erreur : `Docker is not running`

**Solution :**
```powershell
# Démarrer Docker Desktop
# Puis relancer
docker ps
```

### ❌ Erreur : `Timeout waiting for services`

**Solution :**
```powershell
# Vérifier les logs Docker
docker logs dreamscape-postgres
docker logs dreamscape-redis

# Redémarrer si nécessaire
cd dreamscape-infra/docker
docker-compose -f docker-compose.bigpods.dev.yml down
docker-compose -f docker-compose.bigpods.dev.yml up -d postgres redis
```

### ⚠️ Tests passent mais service non démarré

**Cause :** Vous utilisez les tests avec mocks au lieu des tests réels

**Solution :** Utilisez la bonne configuration :
```bash
# ❌ Mauvais (mocks)
npm run test:health:integration

# ✅ Correct (serveurs réels)
npx jest --config=jest.config.realdb.js integration/health/*-real.test.ts
```

## 🧪 Tester Manuellement les Endpoints

Avant de lancer les tests automatisés, vous pouvez tester manuellement :

```powershell
# Gateway
curl http://localhost:3000/health
curl http://localhost:3000/api/health
curl http://localhost:3000/metrics

# Auth
curl http://localhost:3001/health
curl http://localhost:3001/api/health
curl http://localhost:3001/metrics

# User
curl http://localhost:3002/health
curl http://localhost:3002/api/health
curl http://localhost:3002/metrics

# Voyage
curl http://localhost:3003/health
curl http://localhost:3003/api/health
curl http://localhost:3003/metrics

# AI
curl http://localhost:3004/health
curl http://localhost:3004/api/health
curl http://localhost:3004/metrics
```

**Réponse attendue :**
```json
{
  "status": "healthy",
  "service": "auth-service",
  "timestamp": "2025-12-12T...",
  "version": "1.0.0",
  "checks": {
    "postgresql": { "status": "healthy", "responseTime": 5 },
    "redis": { "status": "healthy", "responseTime": 2 }
  }
}
```

## 📁 Structure des Tests

```
dreamscape-tests/
├── unit/health/                           # Tests unitaires
│   ├── HealthChecker.test.ts             # Tests du HealthChecker
│   ├── checks.test.ts                    # Tests des helpers
│   └── README.md                         # Ce fichier
├── integration/health/                    # Tests d'intégration
│   ├── auth-health-real.test.ts          # Tests Auth (serveur réel)
│   ├── user-health-real.test.ts          # Tests User (serveur réel)
│   ├── voyage-health-real.test.ts        # Tests Voyage (serveur réel)
│   ├── ai-health-real.test.ts            # Tests AI (serveur réel)
│   └── all-services-health-real.test.ts  # Tests de tous les services
├── jest.config.health.js                  # Config Jest (mocks)
├── jest.config.realdb.js                  # Config Jest (vraie DB + serveurs)
├── jest.setup.health.ts                   # Setup (mocks)
└── jest.setup.realdb.ts                   # Setup (Docker auto-start)
```

## 📈 Performance Requirements

Les tests vérifient automatiquement les temps de réponse :

| Endpoint | Max Response Time |
|----------|------------------|
| `/health` | 2 secondes |
| `/health/live` | 100 ms |
| `/health/ready` | 500 ms |

## 🎓 Stratégie de Test Recommandée

### Pendant le Développement
```bash
# Tests rapides avec mocks
npm run test:health:unit
```

### Avant un Commit
```bash
# Tests avec vraie DB
npm run test:health:realdb
```

### Avant un Merge/Déploiement
```bash
# 1. Démarrer tous les services
# 2. Tests end-to-end complets
npx jest --config=jest.config.realdb.js integration/health/all-services-health-real.test.ts
```

## 🔗 Documentation Associée

- [INFRA-013 Implementation Guide](../../../docs/INFRA-013-IMPLEMENTATION-COMPLETE.md)
- [Tests avec Vraie DB](../../REALDB_TESTS.md)
- [Tests Serveurs Réels](../../../REAL-SERVER-TESTING.md)
- [Jira Ticket](https://jira.company.com/browse/DR-311) - INFRA-013.1

## 📞 Support

**Problèmes courants résolus :**
- ✅ Service AI avec erreur `@/services` → Fichier provisoire créé
- ✅ Script PowerShell avec erreur de guillemets → Corrigé
- ✅ Tests échouent car services non démarrés → Guide détaillé ajouté

**Pour d'autres questions :**
1. Vérifier ce README
2. Consulter les logs des services
3. Vérifier que Docker tourne
4. Tester manuellement avec `curl`

---

**Créé pour :** Ticket INFRA-013.1 - Endpoints de health check standardisés
**Dernière mise à jour :** 2025-12-12
**Story Points :** 3
**Statut :** ✅ 20/25 tests passent (AI service à corriger)
