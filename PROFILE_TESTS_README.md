# Profile Tests Documentation

Ce document décrit les tests créés pour les fonctionnalités de profil utilisateur implémentées dans le projet DreamScape.

## Structure des Tests

```
dreamscape-tests/
├── tests/
│   ├── unit-tests/
│   │   └── user-service/
│   │       └── profile.test.js          # Tests unitaires pour les routes de profil
│   ├── integration/
│   │   └── profile-integration.test.js  # Tests d'intégration complets
│   ├── e2e/
│   │   └── web-client/
│   │       └── profile-settings.cy.js   # Tests Cypress end-to-end
│   └── simple-test.test.js              # Test de validation de la config
├── jest.config.js                       # Configuration Jest
├── jest.setup.js                        # Setup global pour les tests
└── PROFILE_TESTS_README.md              # Cette documentation
```

## Types de Tests Créés

### 1. Tests Unitaires (`profile.test.js`)

**Objectif**: Tester les routes API du service user isolément avec des mocks.

**Fonctionnalités testées**:
- GET `/api/v1/users/profile` - Récupération du profil utilisateur
- PUT `/api/v1/users/profile` - Mise à jour du profil utilisateur
- Gestion des erreurs (utilisateur non trouvé, contraintes uniques)
- Mise à jour partielle vs complète
- Validation des données

**Commande**:
```bash
cd dreamscape-tests
npm run test:unit
# ou spécifiquement pour le user service
npm run test:coverage:user
```

### 2. Tests d'Intégration (`profile-integration.test.js`)

**Objectif**: Tester le workflow complet avec authentification et services réels.

**Scénarios testés**:
- Workflow complet: inscription → authentification → récupération profil → mise à jour → vérification
- Mises à jour partielles et complètes
- Changement d'username spécifique
- Gestion des erreurs d'authentification
- Validation d'unicité des emails
- Gestion des cas limites (données malformées, chaînes très longues)
- Tests de concurrence

**Commande**:
```bash
cd dreamscape-tests
npm run test:integration
```

### 3. Tests End-to-End (`profile-settings.cy.js`)

**Objectif**: Tester l'expérience utilisateur complète via l'interface web.

**Parcours testés**:
- Connexion utilisateur
- Navigation vers les paramètres
- Changement d'username via l'interface
- Vérification du toast de succès
- Persistance des changements
- Gestion des erreurs réseau
- Validation des champs requis
- Chargement correct des données de profil

**Commande**:
```bash
cd dreamscape-tests
npm run test:e2e:web
# ou pour ouvrir l'interface Cypress
npx cypress open
```

## Configuration Requise

### Variables d'Environnement

Créez un fichier `.env` dans `dreamscape-tests/`:
```env
# Services URLs
AUTH_SERVICE_URL=http://localhost:3001
USER_SERVICE_URL=http://localhost:3003
WEB_CLIENT_URL=http://localhost:5173

# JWT Secrets
JWT_SECRET=your-jwt-secret
JWT_REFRESH_SECRET=your-jwt-refresh-secret

# Database
DATABASE_URL=mongodb://localhost:27017/dreamscape-test
```

### Services Requis

Pour les tests d'intégration et e2e, assurez-vous que ces services sont démarrés:

1. **Service Auth** (port 3001)
2. **Service User** (port 3003)
3. **Frontend Web** (port 5173)
4. **MongoDB** (port 27017)

## Commandes de Test

### Tests Simples (Validation Config)
```bash
npm run test:working
```

### Tests Unitaires Seulement
```bash
npm run test:unit
```

### Tests d'Intégration
```bash
npm run test:integration
```

### Tests E2E
```bash
# Tous les tests e2e
npm run test:e2e

# Seulement web client
npm run test:e2e:web

# Interface interactive
npx cypress open
```

### Coverage Complet
```bash
# Coverage pour le service user
npm run test:coverage:user

# Coverage tous services
npm run test:coverage:all-services
```

## Scénarios de Test Spécifiques

### Test de Changement d'Username

Le test principal demandé teste le scénario suivant:
1. L'utilisateur se connecte
2. Navigate vers les paramètres
3. Change son username
4. Sauvegarde les modifications
5. Vérifie le toast de succès
6. Confirme que le changement persiste

### Cas d'Erreur Testés

- **Authentification**: Token invalide/expiré
- **Validation**: Champs requis manquants
- **Unicité**: Email/username déjà existants
- **Réseau**: Erreurs de connectivité
- **Concurrence**: Mises à jour simultanées
- **Données**: Formats invalides, chaînes trop longues

## Données de Test

Les tests utilisent des données de test isolées:
- Utilisateurs de test avec préfixe `test` ou `integration.test`
- Base de données de test séparée
- Tokens JWT avec durée courte pour les tests

## Maintenance

### Ajouter de Nouveaux Tests

1. **Tests Unitaires**: Ajoutez dans `tests/unit-tests/user-service/`
2. **Tests d'Intégration**: Ajoutez dans `tests/integration/`
3. **Tests E2E**: Ajoutez dans `tests/e2e/web-client/`

### Debugging

- Utilisez `console.log` dans les tests (configuré pour être visible)
- Pour Cypress: utilisez l'interface interactive avec `npx cypress open`
- Vérifiez les logs des services dans les terminaux respectifs

### CI/CD

Les tests sont configurés pour fonctionner en CI avec:
```bash
npm run ci  # Setup + tous les tests + génération de rapports
```

## Rapport et Métriques

Les tests génèrent des rapports de coverage et de résultats dans:
- `reports/coverage/` - Rapports de couverture de code
- `reports/test-results/` - Résultats détaillés des tests
- `reports/e2e/` - Screenshots et vidéos des tests Cypress

## Support

Pour tout problème avec les tests:
1. Vérifiez que tous les services requis sont démarrés
2. Confirmez les variables d'environnement
3. Consultez les logs détaillés avec `npm run test -- --verbose`
4. Pour les tests e2e, utilisez l'interface Cypress pour le debugging