# Cypress — Tests End-to-End

> **Tests E2E** — Validation du parcours utilisateur complet sur le web client DreamScape

## Configuration

La configuration Cypress se trouve dans `tools/setup/cypress.config.js`.

## Structure

```
cypress/
├── e2e/                           # (tests Cypress — voir tests/e2e/)
├── plugins/
│   └── kafka-consumer.js          # Plugin Cypress pour vérifier les événements Kafka
├── support/
│   ├── commands.js                # Commandes Cypress personnalisées
│   ├── e2e.js                     # Setup global des tests E2E
│   ├── cart-helpers.js            # Helpers panier & réservation
│   └── language-helpers.js        # Helpers i18n (FR/EN)
└── screenshots/                   # Screenshots automatiques en cas d'échec
```

Les fichiers de tests `.cy.js` se trouvent dans `tests/e2e/web-client/` :

| Fichier | Scénario testé |
|---------|----------------|
| `authentication.cy.js` | Login, register, logout, tokens |
| `cart-booking-flow.cy.js` | Panier → checkout → paiement (DR-505) |
| `cart-booking-kafka.cy.js` | Booking flow avec validation événements Kafka |
| `booking-management.cy.js` | Gestion des réservations (liste, annulation) |
| `recommendation-flow.cy.js` | Flux recommandations IA |
| `ai-recommendations.cy.js` | Interface recommandations |
| `gdpr-compliance.cy.js` | Consentements GDPR, export, suppression |
| `profile-settings.cy.js` | Modification profil, avatar, préférences |
| `language-switching.cy.js` | Switch FR/EN i18n |
| `vr-access.cy.js` | Accès expérience panorama VR |

## Commandes

```bash
# Depuis dreamscape-tests/

# Tests E2E — mode headless (CI)
npm run test:e2e

# Tests cart & booking flow
npm run test:e2e:cart
npm run test:e2e:cart:open       # Mode interactif (ouvre Cypress UI)

# Avec validation Kafka
npm run test:e2e:cart:kafka
npm run test:e2e:cart:kafka:open

# Tests spécifiques
npm run test:e2e:voyage          # Voyage E2E
npm run test:e2e:web             # Web client E2E
```

## Commandes personnalisées

Le fichier `support/commands.js` expose des commandes réutilisables :

```javascript
// Connexion rapide
cy.login('user@example.com', 'password')

// Créer un utilisateur de test
cy.registerTestUser()

// Vider le panier
cy.clearCart()

// Sélectionner la langue
cy.setLanguage('fr')
cy.setLanguage('en')
```

## Plugin Kafka

Le plugin `plugins/kafka-consumer.js` permet de vérifier que les événements Kafka sont bien publiés après une action :

```javascript
// Exemple dans un test
cy.task('consumeKafkaEvent', {
  topic: 'dreamscape.voyage.booking.created',
  timeout: 10000
}).then((event) => {
  expect(event.payload.userId).to.equal(testUserId)
})
```

## Prérequis

Pour lancer les tests E2E :
- Tous les services DreamScape doivent être démarrés (`make start`)
- PostgreSQL et Redis accessibles
- (Optionnel) Kafka pour les tests `cart:kafka`

```bash
# Depuis la racine du monorepo
make start      # Démarre tout
make health     # Vérifie que tout est UP
```

## Variables d'environnement

```env
CYPRESS_BASE_URL=http://localhost:5173
CYPRESS_API_URL=http://localhost:4000
```

## Screenshots

Les screenshots sont générés automatiquement en cas d'échec et stockés dans `cypress/screenshots/`. Ils sont utiles pour le debugging CI.

---

*Voir `dreamscape-tests/README.md` pour la documentation complète de la suite de tests.*
