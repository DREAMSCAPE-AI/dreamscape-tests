# DR-69: Tests pour Intégration API Amadeus Activités

## Vue d'ensemble

Ce dossier contient tous les tests pour le ticket **DR-69 - Intégration API Amadeus Tours and Activities**.

**Ticket Jira:** https://epitech-team-t7wc668a.atlassian.net/browse/DR-69

## Structure des tests

```
DR-69-amadeus-activities/
├── unit/
│   └── ActivityMapper.test.ts          # Tests unitaires du mapper
├── integration/
│   └── activity-search.test.ts         # Tests d'intégration API
├── e2e/
│   └── activity-booking-workflow.test.ts    # Tests e2e workflow complet
└── README.md                            # Ce fichier
```

## Tests Unitaires

### ActivityMapper.test.ts

Tests pour la transformation des données Amadeus vers nos DTOs :

- **mapAmadeusToSimplified()** - Transformation Amadeus API → Simplified DTO
  - Mapping des champs basiques (id, name, description)
  - Gestion des coordonnées et localisation
  - Mapping de prix avec symboles de devises
  - Extraction des catégories d'activités
  - Gestion des images
  - Extraction des highlights, includes/excludes
  - Information de réservation et annulation

- **mapSingleActivity()** - Transformation d'une activité unique
  - Priorité de localisation (locationName, city, destination, searchLocationName)
  - Détection automatique de ville à partir des coordonnées
  - Parsing de durée, groupe, rating
  - Extraction de tags basés sur catégorie

- **Location Name Priority** - Hiérarchie de fallback
  1. activity.locationName
  2. activity.city
  3. activity.destination
  4. searchLocationName (paramètre de recherche)
  5. Reverse geocoding via coordonnées
  6. Fallback vers coordonnées brutes

- **Category Mapping** - Mapping des types d'activités
  - SIGHTSEEING, TOUR, MUSEUM, ATTRACTION
  - ENTERTAINMENT, ADVENTURE, CULTURAL
  - FOOD_AND_DRINK, NATURE, WELLNESS
  - Fallback: TOUR (par défaut)

**Exécuter les tests unitaires:**
```bash
npm run test:unit
# ou
npm test tests/DR-69-amadeus-activities/unit/
```

## Tests d'Intégration

### activity-search.test.ts

Tests de l'API REST Voyage Service (endpoints `/api/activities/*`) :

#### GET /api/activities/search
- ✅ Recherche avec coordonnées + locationName
- ✅ Recherche dans les 8 villes test Amadeus
  - Paris (48.91, 2.25)
  - London (51.520180, -0.169882)
  - Barcelona (41.42, 2.11)
  - Berlin (52.541755, 13.354201)
  - New York (40.792027, -74.058204)
  - San Francisco (37.810980, -122.483716)
  - Dallas (32.806993, -96.836857)
  - Bangalore (13.023577, 77.536856)
- ✅ Validation paramètres (400 errors)
- ✅ Paramètre radius personnalisable
- ✅ Mapping correct des noms de localisation

#### GET /api/activities/:activityId
- ✅ Récupération détails d'une activité
- ✅ Gestion 404 si activité non trouvée
- ✅ Structure complète (highlights, includes, excludes)

#### POST /api/activities/bookings
- ✅ Retourne 501 Not Implemented (future feature)

#### Cache Integration
- ✅ Vérification cache des recherches
- ✅ Performance cache hit vs miss
- ✅ Données identiques entre requêtes cachées

#### Location Name Mapping
- ✅ Vérification mapping correct des villes
- ✅ Test sur Paris, London, Barcelona
- ✅ Confirmation que location.name est bien défini

#### Error Handling
- ✅ Gestion erreurs API Amadeus
- ✅ Gestion timeout réseau
- ✅ Coordonnées invalides (hors limites)

**Variables d'environnement:**
```bash
VOYAGE_SERVICE_URL=http://localhost:3003  # URL du service voyage
```

**Exécuter les tests d'intégration:**
```bash
# Démarrer le service voyage d'abord
npm run test:integration
# ou
npm test tests/DR-69-amadeus-activities/integration/
```

## Tests E2E

### activity-booking-workflow.test.ts

Tests du workflow complet de réservation d'activité :

#### Complete Booking Workflow
1. ✅ Recherche d'activités (Step 1)
2. ✅ Récupération des détails (Step 2)
3. ✅ Vérification disponibilité (Step 3)
4. ✅ Vérification info réservation (Step 4)
5. ✅ Création réservation (Step 5 - 501 Not Implemented)

#### Multi-City Activity Search
- ✅ Recherche dans Paris, London, New York
- ✅ Comparaison des résultats par ville
- ✅ Vérification qu'au moins une ville retourne des résultats

#### Activity Filtering and Sorting
- ✅ Filtrage par catégorie (TOUR, MUSEUM, SIGHTSEEING)
- ✅ Filtrage par gamme de prix (minPrice, maxPrice)

#### Booking Validation Tests
- ✅ Rejet sans activityId
- ✅ Rejet sans informations invité
- ✅ Rejet sans date
- ✅ Rejet avec format de date invalide
- ✅ Rejet avec email invalide

#### Performance and Cache Tests
- ✅ Comparaison performance cold vs cached
- ✅ Vérification amélioration avec cache

**Exécuter les tests e2e:**
```bash
npm run test:e2e
# ou
npm test tests/DR-69-amadeus-activities/e2e/
```

## Configuration

### Prerequisites

1. **Services requis:**
   - Voyage Service (port 3003)
   - Amadeus Test API credentials

2. **Credentials Amadeus:**
   ```bash
   AMADEUS_CLIENT_ID=your_client_id
   AMADEUS_CLIENT_SECRET=your_client_secret
   AMADEUS_BASE_URL=https://test.api.amadeus.com
   ```

3. **Installation dépendances:**
   ```bash
   npm install
   ```

### Exécution des tests

```bash
# Tous les tests DR-69
npm test tests/DR-69-amadeus-activities/

# Tests unitaires seulement
npm test tests/DR-69-amadeus-activities/unit/

# Tests d'intégration seulement
npm test tests/DR-69-amadeus-activities/integration/

# Tests e2e seulement
npm test tests/DR-69-amadeus-activities/e2e/

# Avec coverage
npm run test:coverage -- tests/DR-69-amadeus-activities/

# Mode watch
npm test -- --watch tests/DR-69-amadeus-activities/
```

## Résultats attendus

### Coverage Targets
- **Unit tests:** > 90%
- **Integration tests:** > 80%
- **E2E tests:** > 70%

### Performance Targets
- **Activity search (cold):** < 3000ms
- **Activity search (cached):** < 50ms
- **Activity details:** < 1000ms

## Structure des DTOs

### SimplifiedActivityDTO (frontend)
```typescript
{
  id: string;
  name: string;
  description: string;
  shortDescription: string;
  location: {
    name: string;           // Ville (Paris, London, etc.)
    address: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  rating: number;
  reviewCount: number;
  duration: string;          // "2-3 hours"
  groupSize: string;         // "Up to 20 people"
  price: {
    amount: number;
    currency: string;
    formatted: string;       // "$45.00", "€50.00"
  };
  images: string[];
  category: string;          // TOUR, MUSEUM, SIGHTSEEING, etc.
  tags: string[];
  highlights: string[];
  includes: string[];
  excludes: string[];
  meetingPoint: string;
  languages: string[];
  difficulty: string;
  ageRestriction: string;
  availability: {
    available: boolean;
    nextAvailable: string;
    schedule: string[];
  };
  bookingInfo: {
    instantConfirmation: boolean;
    freeCancellation: boolean;
    cancellationPolicy: string;
    voucherInfo: string;
  };
}
```

## Amadeus Test API Supported Cities

L'API Test d'Amadeus supporte **8 villes** pour les activités :

| Ville | Latitude | Longitude | Résultats attendus |
|-------|----------|-----------|-------------------|
| Paris | 48.91 | 2.25 | ~895 activités |
| London | 51.520180 | -0.169882 | Données test |
| Barcelona | 41.42 | 2.11 | Données test |
| Berlin | 52.541755 | 13.354201 | Données test |
| New York | 40.792027 | -74.058204 | Données test |
| San Francisco | 37.810980 | -122.483716 | Données test |
| Dallas | 32.806993 | -96.836857 | Données test |
| Bangalore | 13.023577 | 77.536856 | Données test |

**Important:** Utiliser les coordonnées exactes de la documentation Amadeus pour obtenir les résultats test.

## Troubleshooting

### Tests échouent avec "Connection refused"
- Vérifiez que le Voyage Service est démarré (`npm run dev`)
- Vérifiez VOYAGE_SERVICE_URL dans `.env`

### Tests échouent avec "Amadeus API error"
- Vérifiez les credentials Amadeus (CLIENT_ID, CLIENT_SECRET)
- Vérifiez les quotas API Amadeus
- Utilisez le mode test Amadeus (pas production)

### Location name = "Unknown Location"
- Vérifiez que le paramètre `locationName` est passé dans la requête
- Vérifiez que les coordonnées matchent une ville test Amadeus
- Vérifiez les logs du ActivityMapper (DEBUG_MODE = true)

### Performance tests échouent
- Les timeouts peuvent varier selon la charge API Amadeus
- Ajustez les timeouts dans les tests si nécessaire
- Le cache peut ne pas fonctionner si Redis n'est pas configuré

## Liens utiles

- **Amadeus Tours and Activities API:** https://developers.amadeus.com/self-service/category/destination-experiences/api-doc/tours-and-activities
- **Amadeus Test Coordinates:** https://github.com/amadeus4dev/data-collection/blob/master/data/tours.md
- **Ticket Jira DR-69:** https://epitech-team-t7wc668a.atlassian.net/browse/DR-69
- **Documentation voyage service:** `dreamscape-services/voyage/README.md`

## Statut des tests

| Type | Fichier | Status | Coverage |
|------|---------|--------|----------|
| Unit | ActivityMapper.test.ts | ✅ Créé | TBD |
| Integration | activity-search.test.ts | ✅ Créé | TBD |
| E2E | activity-booking-workflow.test.ts | ✅ Créé | TBD |

## Contributeurs

- Tests créés par: Claude Code
- Ticket owner: Thomas Mayor
- Date création: 2025-12-19

## Changelog

- **2025-12-19:** Création initiale des tests unitaires, d'intégration et e2e
- **TODO:** Implémenter endpoint POST /api/activities/bookings
- **TODO:** Ajouter filtrage par catégorie et prix
