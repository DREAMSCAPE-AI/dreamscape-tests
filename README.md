# Bienvenue dans le Dépôt dreamscape-tests

## À propos

Le dépôt `dreamscape-tests` regroupe tous les tests automatisés et les outils de qualité pour le projet DreamScape, notre plateforme innovante de voyage qui combine l'intelligence artificielle contextuelle et la réalité virtuelle pour offrir des expériences de voyage personnalisées.

Ce référentiel est une composante essentielle de notre stratégie de qualité, garantissant que tous les modules et services de DreamScape fonctionnent correctement ensemble, malgré notre architecture en microservices et notre rythme de développement particulier (2 jours par semaine).

## Structure du Dépôt

```
dreamscape-tests/
├── integration/              # Tests d'intégration entre les services
│   ├── api/                  # Tests d'API entre les différents services
│   ├── e2e/                  # Tests end-to-end des parcours utilisateurs
│   └── contract/             # Tests de contrats entre les services
├── performance/              # Tests de performance et de charge
│   ├── api/                  # Tests de performance des API
│   ├── frontend/             # Tests de performance de l'interface
│   └── vr/                   # Tests de performance des expériences VR
├── security/                 # Tests de sécurité
│   ├── penetration/          # Tests de pénétration
│   ├── static-analysis/      # Analyse statique de sécurité
│   └── compliance/           # Tests de conformité (RGPD, etc.)
├── accessibility/            # Tests d'accessibilité (WCAG)
├── mocks/                    # Serveurs et données simulées pour les tests
│   ├── services/             # Mock des services externes
│   ├── amadeus/              # Mock d'Amadeus API
│   └── data/                 # Jeux de données pour les tests
├── tools/                    # Outils et scripts pour les tests
│   ├── setup/                # Scripts de configuration d'environnement
│   ├── reporting/            # Génération de rapports de tests
│   └── ci/                   # Scripts d'intégration continue
└── docs/                     # Documentation des tests
```

## Philosophie de Tests

Notre approche de tests s'articule autour de plusieurs principes clés :

1. **Tests pyramidaux** : Nous suivons une pyramide de tests avec une large base de tests unitaires (dans chaque service), des tests d'intégration pour valider les interactions, et des tests E2E ciblés pour les parcours critiques.

2. **Tests d'intégration renforcés** : En raison de notre architecture microservices, nous mettons un accent particulier sur les tests d'intégration pour garantir que les services communiquent correctement.

3. **Automatisation complète** : Tous les tests sont automatisés et intégrés dans notre pipeline CI/CD pour une exécution régulière.

4. **Développement piloté par les tests (TDD)** : Nous encourageons l'écriture des tests avant le code pour les fonctionnalités critiques.

5. **Tests de non-régression** : Chaque correctif est accompagné d'un test pour éviter la réapparition du problème.

## Installation et Configuration

### Prérequis

- Node.js (v16+)
- Docker et Docker Compose
- Accès au registre privé GitHub Packages de DreamScape

### Installation

```bash
# Cloner le dépôt
git clone git@github.com:dreamscape/dreamscape-tests.git
cd dreamscape-tests

# Installer les dépendances
npm install

# Configurer l'environnement
npm run setup
```

### Configuration des Variables d'Environnement

Créez un fichier `.env` à la racine du projet en vous basant sur le modèle `.env.example` :

```
# Environnement (dev, staging, prod)
ENV=dev

# URLs des services (par défaut: services locaux)
AUTH_SERVICE_URL=http://localhost:3001
USER_SERVICE_URL=http://localhost:3002
VOYAGE_SERVICE_URL=http://localhost:3003
AI_SERVICE_URL=http://localhost:3004
PANORAMA_SERVICE_URL=http://localhost:3005

# Informations d'authentification pour les tests
TEST_USER_EMAIL=test@dreamscape.com
TEST_USER_PASSWORD=*********

# Configuration CI/CD
CI_TIMEOUT=300000
```

## Exécution des Tests

### Tests d'Intégration

```bash
# Tous les tests d'intégration
npm run test:integration

# Tests d'API uniquement
npm run test:integration:api

# Tests E2E uniquement
npm run test:integration:e2e

# Tests de contrats uniquement
npm run test:integration:contract
```

### Tests de Performance

```bash
# Tous les tests de performance
npm run test:performance

# Tests de performance des API
npm run test:performance:api

# Tests de performance du frontend
npm run test:performance:frontend

# Tests de performance VR
npm run test:performance:vr
```

### Tests de Sécurité

```bash
# Tous les tests de sécurité
npm run test:security

# Tests de pénétration
npm run test:security:penetration

# Analyse statique de sécurité
npm run test:security:static
```

### Tests d'Accessibilité

```bash
npm run test:accessibility
```

## Environnements de Test

Nous avons plusieurs environnements disponibles pour les tests :

1. **Local** : Utilise les services installés localement ou des mocks
2. **Dev** : Connecté aux services de l'environnement de développement
3. **Staging** : Environnement de préproduction pour les tests finaux
4. **Production** : Tests de smoke uniquement sur l'environnement de production

Pour spécifier l'environnement :

```bash
# Exécuter sur l'environnement de développement
ENV=dev npm run test:integration

# Exécuter sur l'environnement de staging
ENV=staging npm run test:integration
```

## Mocks et Données de Test

Pour faciliter les tests locaux, nous fournissons des mocks pour tous les services :

```bash
# Démarrer tous les services mockés
npm run start:mocks

# Démarrer uniquement le mock d'Amadeus
npm run start:mocks:amadeus
```

## Intégration Continue

Ce dépôt est intégré à notre pipeline CI/CD pour exécuter automatiquement les tests :

- Les tests d'intégration sont exécutés à chaque Pull Request
- Les tests de performance sont exécutés quotidiennement
- Les tests de sécurité sont exécutés hebdomadairement
- Les tests d'accessibilité sont exécutés à chaque modification de l'interface utilisateur

## Rapports et Monitoring

Les rapports de tests sont générés automatiquement et disponibles :

- Dans la section Actions de GitHub
- Sur notre tableau de bord Grafana (pour les tendances de performance)
- Dans SonarQube pour la qualité et la couverture de code

## Contribution

### Ajouter un Nouveau Test

1. Identifiez la catégorie appropriée pour votre test
2. Créez un nouveau fichier de test en suivant les conventions de nommage
3. Assurez-vous que votre test est indépendant et peut être exécuté seul
4. Mettez à jour la documentation si nécessaire

### Bonnes Pratiques

- Chaque test doit avoir un objectif clair et documenté
- Évitez les dépendances entre les tests
- Assurez-vous que les tests sont déterministes (pas de résultats aléatoires)
- Nettoyez toujours les données créées par vos tests
- Utilisez des tags pour catégoriser les tests (`@smoke`, `@critical`, etc.)

## Spécificités pour notre Rythme de Développement

Comme notre équipe travaille 2 jours par semaine sur le projet, nous avons mis en place des stratégies spécifiques :

- **Tests automatisés complets** pour détecter rapidement les problèmes
- **Documentation détaillée** pour faciliter la reprise du travail
- **Environnements éphémères** pour chaque branche de fonctionnalité
- **Notification d'échecs de tests** par email et Slack pour réagir rapidement

## Contact

Pour toute question concernant les tests ou ce dépôt, contactez :

- **QA Lead**: [Nom du QA Lead]
- **Tech Lead**: [Nom du Tech Lead]
- **Slack**: #dreamscape-tests

---

Dernière mise à jour : 20 mai 2025
