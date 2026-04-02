# US-IA-011 : Destination Diversity Enforcement

Tests pour l'application des contraintes de diversité géographique dans les recommandations d'hébergement.

## 📋 Vue d'ensemble

Ce test vérifie que le système de recommandations :
- **Diversifie les destinations** par pays pour éviter la sur-recommandation
- **Applique des contraintes** strictes (max hotels par pays, min pays différents)
- **Booste la nouveauté** en favorisant les pays non explorés
- **Maintient les performances** (< 20ms d'overhead)

## 🧪 Tests

### ✅ Tests passants (3/6)

1. **Test 2 : maxSameCountry** - Limite max de 4 hôtels par pays
2. **Test 5 : Performance** - Overhead < 20ms
3. **Test 6 : Configuration** - Flexibilité de la config

### ⚠️ Tests échouants (3/6) - À implémenter

1. **Test 1 : Italy-only scenario** - Forcer 5+ pays même avec forte préférence Italie
2. **Test 3 : minCountries** - Minimum 5 pays dans le top-20
3. **Test 4 : Novelty scoring** - Boost pour pays non explorés

## 🏗️ Architecture

### Fichiers modifiés

#### Types étendus (`accommodation-vector.types.ts`)
```typescript
location: {
  city?: string;           // Nom de ville (e.g., "Paris")
  country?: string;        // Nom de pays (e.g., "France")
  countryCode?: string;    // Code ISO (e.g., "FR")
  cityCode: string;        // Code IATA (e.g., "PAR")
  // ... autres champs
}

breakdown: {
  // ... scores existants
  mlScore?: number;        // Score ML optionnel (US-IA-009)
}
```

#### Service à compléter (`accommodation-scoring.service.ts`)
- `enforceDestinationDiversity()` - Applique les contraintes de diversité
- `applyNoveltyBoost()` - Booste les destinations non explorées
- `countryDistributionCheck()` - Vérifie minCountries/maxSameCountry

## 🚀 Exécution

```bash
# Depuis dreamscape-tests
cd ~/Documents/DREAMSCAPE/dreamscape-tests
npx jest tests/US-IA-011-destination-diversity/unit/diversity.test.ts

# Ou avec watch mode
npx jest --watch tests/US-IA-011-destination-diversity/unit/diversity.test.ts
```

## 📊 Résultats attendus

Quand implémenté correctement, tous les tests devraient passer :

```
✅ Test 1: Italy-only scenario - 5+ pays même avec 20/30 hôtels italiens
✅ Test 2: maxSameCountry - Max 4 hôtels par pays
✅ Test 3: minCountries - Min 5 pays dans top-20
✅ Test 4: Novelty scoring - Espagne/Portugal > France (déjà vue)
✅ Test 5: Performance - < 20ms overhead
✅ Test 6: Configuration - Config modifiable
```

## 🎯 Prochaines étapes

1. Implémenter la logique de diversité dans `AccommodationScoringService`
2. Ajouter le scoring de nouveauté basé sur l'historique utilisateur
3. Optimiser les performances (actuellement ~1ms, objectif < 20ms OK)
4. Intégrer avec les métriques de qualité (diversityScore, etc.)

## 🔗 Tickets liés

- **US-IA-009** : Intégration ML (mlScore dans breakdown)
- **US-IA-010** : Déploiement Ollama
- **US-IA-011** : Diversité des recommandations (ce ticket)

---

**Statut actuel** : Tests configurés ✅ | Logique métier à implémenter ⚠️
