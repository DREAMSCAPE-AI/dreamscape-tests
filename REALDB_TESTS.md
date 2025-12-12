# Tests Health Checks avec Vraie Base de Données

## 🎯 Objectif

Tester les health checks avec les **vraies connexions** PostgreSQL et Redis au lieu des mocks.

## 📦 Prérequis

- Docker installé et en cours d'exécution
- Docker Compose disponible
- Port 5432 (PostgreSQL) et 6379 (Redis) disponibles

## 🚀 Démarrage Rapide

### 1. Démarrer l'infrastructure Docker

```bash
# Depuis le dossier principal
cd dreamscape-infra/docker
docker-compose -f docker-compose.bigpods.dev.yml up -d postgres redis

# Vérifier que les services sont healthy
docker ps --filter "name=dreamscape"
```

Vous devriez voir:
```
dreamscape-postgres    healthy
dreamscape-redis       healthy
```

### 2. Lancer les tests avec vraie DB

```bash
cd dreamscape-tests

# Tous les tests d'intégration avec vraie DB
npm run test:health:realdb

# Juste les tests Auth (plus rapide pour tester)
npm run test:health:realdb:auth

# Mode verbose pour debug
npm run test:health:realdb:verbose
```

## 📊 Différence avec les tests existants

### Tests avec Mocks (ancienne version)
```typescript
// Mock Prisma
const mockPrisma = {
  $queryRaw: jest.fn().mockResolvedValue([{ health_check: 1 }]),
};

jest.mock('../../../dreamscape-services/auth/src/database/prisma', () => ({
  default: mockPrisma,
}));
```

**Avantages:**
- ✅ Rapides (pas de connexion réseau)
- ✅ Isolés (pas besoin de Docker)
- ✅ Contrôle total sur les erreurs

**Inconvénients:**
- ❌ Ne teste pas la vraie intégration
- ❌ Peut cacher des bugs réels

### Tests avec Vraie DB (nouvelle version)
```typescript
// NO MOCKS - Using real database connections
// PostgreSQL and Redis are started by jest.setup.realdb.ts

const response = await request(app).get('/health');
// Teste la vraie connexion à PostgreSQL et Redis
```

**Avantages:**
- ✅ Teste la vraie intégration
- ✅ Détecte les vrais problèmes (timeout, network, etc.)
- ✅ Plus proche de la production

**Inconvénients:**
- ⚠️ Plus lents (~5-10s de setup)
- ⚠️ Nécessite Docker running

## 🔧 Configuration

### Fichiers créés/modifiés

1. **jest.config.realdb.js** - Configuration Jest pour vraie DB
   - Pas de mock pour `@dreamscape/db`
   - Timeout plus long (30s)
   - Setup file spécifique

2. **jest.setup.realdb.ts** - Setup avant les tests
   - Démarre PostgreSQL et Redis via Docker
   - Attend que les services soient healthy
   - Configure les variables d'environnement

3. **integration/health/auth-health.test.ts** - Tests modifiés
   - Suppression des mocks
   - Tests avec vraies connexions
   - Timeouts adaptés

### Variables d'environnement (automatiques)

```bash
DATABASE_URL=postgresql://dev:dev123@localhost:5432/dreamscape_dev
REDIS_HOST=localhost
REDIS_PORT=6379
NODE_ENV=test
```

## 📝 Commandes disponibles

| Commande | Description |
|----------|-------------|
| `npm run test:health:realdb` | Tous les tests d'intégration avec vraie DB |
| `npm run test:health:realdb:auth` | Juste les tests Auth |
| `npm run test:health:realdb:verbose` | Mode verbose (debug) |
| `npm run test:health` | Tests avec mocks (ancienne version) |
| `npm run test:health:unit` | Tests unitaires (toujours avec mocks) |

## 🧪 Tests Disponibles

### ✅ Auth Service (auth-health.test.ts)
- [x] GET /health - Check complet avec vraie DB
- [x] GET /health/live - Liveness probe
- [x] GET /health/ready - Readiness probe avec vraie DB
- [x] Validation du format de réponse
- [x] Performance (temps de réponse)

### ⏳ User Service (user-health.test.ts)
- [ ] À migrer vers vraie DB

### ⏳ Voyage Service (voyage-health.test.ts)
- [ ] À migrer vers vraie DB

### ⏳ AI Service (ai-health.test.ts)
- [ ] À migrer vers vraie DB

### ⏳ Gateway (gateway-health.test.ts)
- [ ] À migrer vers vraie DB

## 🐛 Troubleshooting

### Erreur: "Docker is not installed or not running"
```bash
# Vérifier que Docker tourne
docker --version
docker ps
```

### Erreur: "Timeout waiting for services to be healthy"
```bash
# Vérifier les logs
docker logs dreamscape-postgres
docker logs dreamscape-redis

# Redémarrer les services
cd dreamscape-infra/docker
docker-compose -f docker-compose.bigpods.dev.yml down
docker-compose -f docker-compose.bigpods.dev.yml up -d postgres redis
```

### Erreur: "Connection refused"
```bash
# Vérifier que les ports sont bien exposés
docker ps --format "table {{.Names}}\t{{.Ports}}"

# Tester la connexion manuellement
docker exec dreamscape-postgres pg_isready -U dev -d dreamscape_dev
docker exec dreamscape-redis redis-cli ping
```

### Les tests sont très lents
C'est normal pour les tests avec vraie DB. Le setup prend ~10-20 secondes:
- 5-10s pour démarrer Docker
- 5-10s pour attendre que les services soient healthy

Pour des tests rapides pendant le développement, utilisez:
```bash
npm run test:health:unit  # Tests unitaires avec mocks
```

## 📈 Performance

### Tests avec Mocks
```
Time:        2.523 s
Setup:       ~0s
Tests:       44 tests
```

### Tests avec Vraie DB
```
Time:        ~15-20 s
Setup:       ~10-15s (démarrage Docker + health check)
Tests:       ~5s (10 tests Auth pour l'instant)
```

## ✅ Checklist avant le merge

- [x] jest.config.realdb.js créé
- [x] jest.setup.realdb.ts créé
- [x] auth-health.test.ts migré
- [x] Scripts npm ajoutés
- [x] Documentation créée
- [ ] user-health.test.ts migré
- [ ] voyage-health.test.ts migré
- [ ] ai-health.test.ts migré
- [ ] gateway-health.test.ts migré
- [ ] Tests CI/CD ajustés (si nécessaire)

## 🎓 Best Practices

### Quand utiliser les tests avec mocks?
- ✅ Tests unitaires (logique isolée)
- ✅ Développement rapide
- ✅ CI/CD (si pas de Docker)

### Quand utiliser les tests avec vraie DB?
- ✅ Tests d'intégration
- ✅ Validation avant production
- ✅ Tests de performance réels
- ✅ Debug de problèmes spécifiques DB

### Stratégie recommandée
1. **Développement** : Tests unitaires avec mocks (rapide)
2. **Avant commit** : Tests avec vraie DB (validation)
3. **CI/CD** : Les deux (coverage complet)

## 📞 Support

Pour toute question ou problème :
1. Vérifier les logs Docker
2. Consulter ce README
3. Tester manuellement les endpoints curl

---

**Créé pour:** INFRA-013.1 - Health Check Endpoints
**Date:** 2025-11-28
**Version:** 1.0.0
