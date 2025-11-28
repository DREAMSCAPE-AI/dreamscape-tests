# DR-67: Tests pour Intégration API Amadeus Hébergements

## Vue d'ensemble

Ce dossier contient tous les tests pour le ticket **DR-67 - US-VOYAGE-005 : Intégration API Amadeus Hébergements**.

**Ticket Jira:** https://epitech-team-t7wc668a.atlassian.net/browse/DR-67

## Structure des tests

```
DR-67-amadeus-hotels/
├── unit/
│   └── HotelOfferMapper.test.ts          # Tests unitaires du mapper
├── integration/
│   └── hotel-search.test.ts              # Tests d'intégration API
├── e2e/
│   └── hotel-booking-workflow.test.ts    # Tests e2e (à créer)
└── README.md                              # Ce fichier
```

## Tests Unitaires

### HotelOfferMapper.test.ts

Tests pour la transformation des données Amadeus vers nos DTOs :

- **mapToDTO()** - Transformation Amadeus API → HotelOfferDTO
  - Mapping des champs basiques
  - Gestion des champs optionnels
  - Valeurs par défaut

- **mapToDTOs()** - Transformation d'arrays
  - Mapping de plusieurs hôtels
  - Gestion des erreurs (null, undefined)

- **mapToSimplified()** - Transformation DTO → SimplifiedHotelOfferDTO
  - Simplification pour le frontend
  - Calcul des nuits
  - Calcul du prix par nuit
  - Détection des politiques d'annulation gratuites
  - Extraction des taxes

- **mapToSimplifiedList()** - Transformation d'arrays simplifiés

- **mapAmadeusToSimplified()** - Raccourci Amadeus → Simplified

**Exécuter les tests unitaires:**
```bash
npm run test:unit
# ou
npm test tests/DR-67-amadeus-hotels/unit/
```

## Tests d'Intégration

### hotel-search.test.ts

Tests de l'API REST Voyage Service (endpoints `/api/hotels/*`) :

#### POST /api/hotels/search
- ✅ Recherche avec code ville (cityCode)
- ✅ Recherche avec coordonnées (latitude/longitude)
- ✅ Pagination (page, pageSize)
- ✅ Validation paramètres (400 errors)
- ✅ Format dates YYYY-MM-DD
- ✅ checkIn < checkOut validation

#### GET /api/hotels/details/:hotelId
- ✅ Récupération détails d'un hôtel
- ✅ Gestion 404 si hôtel non trouvé
- ✅ Paramètres: adults, roomQuantity, dates

#### GET /api/hotels/ratings
- ✅ Récupération ratings de plusieurs hôtels
- ✅ Format: hotelIds (comma-separated)

#### GET /api/hotels/list
- ✅ Liste par ville (cityCode)
- ✅ Liste par coordonnées
- ✅ Radius filtering

#### GET /api/hotels/:hotelId/images
- ✅ Récupération images d'un hôtel

#### POST /api/hotels/bookings
- ✅ Retourne 501 Not Implemented (futur feature)

#### Cache Integration
- ✅ Vérification cache Redis
- ✅ Performance cache hit vs miss
- ✅ TTL 30 minutes pour recherches

**Variables d'environnement:**
```bash
VOYAGE_SERVICE_URL=http://localhost:3003  # URL du service voyage
```

**Exécuter les tests d'intégration:**
```bash
# Démarrer le service voyage d'abord
npm run test:integration
# ou
npm test tests/DR-67-amadeus-hotels/integration/
```

## Tests E2E

### hotel-booking-workflow.test.ts (À créer)

Tests du workflow complet de réservation d'hôtel :

1. Recherche d'hôtels
2. Sélection d'un hôtel
3. Consultation détails
4. Ajout informations voyageurs
5. Paiement (mock)

**Exécuter les tests e2e:**
```bash
npm run test:e2e
# ou
npm test tests/DR-67-amadeus-hotels/e2e/
```

## Configuration

### Prerequisites

1. **Services requis:**
   - Voyage Service (port 3003)
   - MongoDB (pour cache tests)
   - Redis (pour cache tests)

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
# Tous les tests DR-67
npm test tests/DR-67-amadeus-hotels/

# Tests unitaires seulement
npm test tests/DR-67-amadeus-hotels/unit/

# Tests d'intégration seulement
npm test tests/DR-67-amadeus-hotels/integration/

# Avec coverage
npm run test:coverage -- tests/DR-67-amadeus-hotels/

# Mode watch
npm test -- --watch tests/DR-67-amadeus-hotels/
```

## Résultats attendus

### Coverage Targets
- **Unit tests:** > 90%
- **Integration tests:** > 80%
- **E2E tests:** > 70%

### Performance Targets
- **Hotel search (cold):** < 3000ms
- **Hotel search (cached):** < 50ms
- **Hotel details:** < 1000ms
- **Hotel images:** < 1000ms

## Structure des DTOs

### HotelOfferDTO (backend)
```typescript
{
  type: string;
  hotel: {
    hotelId: string;
    name: string;
    latitude?: number;
    longitude?: number;
    amenities: string[];
    ratings?: { overall: number; numberOfReviews: number };
    // ...
  };
  offers: [{
    id: string;
    checkInDate: string;
    checkOutDate: string;
    room: {...};
    price: {...};
    policies: {...};
  }];
}
```

### SimplifiedHotelOfferDTO (frontend)
```typescript
{
  id: string;
  hotelId: string;
  name: string;
  location: { latitude: number; longitude: number };
  address: { street: string; city: string; country: string };
  rating: number | null;
  nights: number;
  price: {
    amount: number;
    currency: string;
    perNight: number;
    taxes?: number;
  };
  room: {...};
  amenities: string[];
  images: string[];
  cancellation: {
    freeCancellation: boolean;
    deadline: string | null;
    penalty: number | null;
  };
}
```

## Troubleshooting

### Tests échouent avec "Connection refused"
- Vérifiez que le Voyage Service est démarré
- Vérifiez VOYAGE_SERVICE_URL dans `.env`

### Tests échouent avec "Amadeus API error"
- Vérifiez les credentials Amadeus
- Vérifiez les quotas API Amadeus
- Utilisez le mode test Amadeus (pas production)

### Tests cache échouent
- Vérifiez que Redis est démarré
- Vérifiez REDIS_URL dans la config du Voyage Service

### Performance tests échouent
- Les timeouts peuvent varier selon la charge API Amadeus
- Ajustez les timeouts dans les tests si nécessaire

## Liens utiles

- **Amadeus Hotel Search API:** https://developers.amadeus.com/self-service/category/hotels/api-doc/hotel-search
- **Ticket Jira DR-67:** https://epitech-team-t7wc668a.atlassian.net/browse/DR-67
- **Documentation voyage service:** `dreamscape-services/voyage/README.md`

## Statut des tests

| Type | Fichier | Status | Coverage |
|------|---------|--------|----------|
| Unit | HotelOfferMapper.test.ts | ✅ Créé | TBD |
| Integration | hotel-search.test.ts | ✅ Créé | TBD |
| E2E | hotel-booking-workflow.test.ts | ⏳ À créer | TBD |

## Contributeurs

- Tests créés par: Claude Code
- Ticket owner: Thomas Mayor
- Date création: 2025-11-27

## Changelog

- **2025-11-27:** Création initiale des tests unitaires et d'intégration
- **TODO:** Ajout tests e2e workflow complet
