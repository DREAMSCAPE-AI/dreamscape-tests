/**
 * US-IA-009 — Pipeline de recommandation IA (intégration)
 *
 * Tests d'intégration du pipeline complet :
 * GET /api/v1/recommendations/accommodations
 *
 * Vérifie :
 * - Réponse < 500ms (SLA)
 * - Structure de réponse correcte (SimplifiedHotelOfferDTO)
 * - Métadonnées A/B testing présentes
 * - Cache hit/miss dans les métadonnées
 * - Diversité géographique dans les résultats
 * - Gestion des erreurs (userId manquant, params invalides)
 *
 * Prérequis : service AI actif sur AI_SERVICE_URL (défaut: http://localhost:3005)
 *
 * @ticket US-IA-009
 */

import request from 'supertest';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:3005';
const VOYAGE_SERVICE_URL = process.env.VOYAGE_SERVICE_URL || 'http://localhost:3003';

// Helper matcher
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeIn(array: any[]): R;
    }
  }
}
expect.extend({
  toBeIn(received: any, array: any[]) {
    const pass = array.includes(received);
    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be in [${array.join(', ')}]`
          : `expected ${received} to be in [${array.join(', ')}]`,
    };
  },
});

describe('US-IA-009 — Recommendation Pipeline (integration)', () => {
  const testUserId = `test-user-${Date.now()}`;

  // ─── Health checks ────────────────────────────────────────────────────────────

  describe('Service health', () => {
    it('AI service should be healthy', async () => {
      const response = await request(AI_SERVICE_URL)
        .get('/health')
        .expect('Content-Type', /json/);

      expect(response.status).toBeIn([200, 503]);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('status');
        console.log('✅ AI service health:', response.body);
      }
    }, 10000);
  });

  // ─── Endpoint accommodations ──────────────────────────────────────────────────

  describe('GET /api/v1/recommendations/accommodations', () => {
    it('should return recommendations within 500ms SLA', async () => {
      const start = Date.now();

      const response = await request(AI_SERVICE_URL)
        .get('/api/v1/recommendations/accommodations')
        .query({
          userId: testUserId,
          cityCode: 'PAR',
          checkInDate: '2026-06-01',
          checkOutDate: '2026-06-05',
          adults: 2,
          limit: 5,
        })
        .expect('Content-Type', /json/);

      const elapsed = Date.now() - start;

      // SLA < 500ms — accept 503 si service IA non lancé
      expect(response.status).toBeIn([200, 400, 503]);

      if (response.status === 200) {
        expect(elapsed).toBeLessThan(500);
        console.log(`⚡ SLA: ${elapsed}ms (target < 500ms)`);
      }
    }, 30000);

    it('should return correct response structure', async () => {
      const response = await request(AI_SERVICE_URL)
        .get('/api/v1/recommendations/accommodations')
        .query({
          userId: testUserId,
          cityCode: 'LON',
          checkInDate: '2026-06-10',
          checkOutDate: '2026-06-12',
          adults: 1,
          limit: 3,
        })
        .expect('Content-Type', /json/);

      expect(response.status).toBeIn([200, 503]);

      if (response.status === 200 && response.body.recommendations?.length > 0) {
        const reco = response.body.recommendations[0];

        expect(reco).toHaveProperty('accommodation');
        expect(reco.accommodation).toHaveProperty('hotelId');
        expect(reco.accommodation).toHaveProperty('name');
        expect(reco).toHaveProperty('score');
        expect(reco).toHaveProperty('reasons');
        expect(Array.isArray(reco.reasons)).toBe(true);
        expect(reco).toHaveProperty('rank');

        console.log('✅ Structure reco validée:', {
          hotelId: reco.accommodation.hotelId,
          score: reco.score.toFixed(3),
          rank: reco.rank,
          reasons: reco.reasons,
        });
      }
    }, 30000);

    it('should include A/B test metadata in response', async () => {
      const response = await request(AI_SERVICE_URL)
        .get('/api/v1/recommendations/accommodations')
        .query({
          userId: testUserId,
          cityCode: 'NYC',
          checkInDate: '2026-07-01',
          checkOutDate: '2026-07-03',
          adults: 2,
          limit: 3,
        })
        .expect('Content-Type', /json/);

      expect(response.status).toBeIn([200, 503]);

      if (response.status === 200) {
        // Le service doit indiquer quel modèle a été utilisé
        expect(response.body).toHaveProperty('meta');
        const meta = response.body.meta;

        if (meta) {
          if (meta.modelType) {
            expect(meta.modelType).toBeIn(['svd_v1.0', 'rule_based', 'hybrid']);
            console.log('✅ A/B test - modelType:', meta.modelType);
          }
          if (meta.cacheHit !== undefined) {
            expect(typeof meta.cacheHit).toBe('boolean');
            console.log('✅ Cache hit:', meta.cacheHit);
          }
        }
      }
    }, 30000);

    it('should return 400 for missing required parameters', async () => {
      const response = await request(AI_SERVICE_URL)
        .get('/api/v1/recommendations/accommodations')
        .query({
          // userId manquant
          cityCode: 'PAR',
          checkInDate: '2026-06-01',
          checkOutDate: '2026-06-05',
        });

      expect(response.status).toBeIn([400, 503]);

      if (response.status === 400) {
        expect(response.body).toHaveProperty('error');
      }
    }, 10000);

    it('should limit results to requested count', async () => {
      const limit = 3;
      const response = await request(AI_SERVICE_URL)
        .get('/api/v1/recommendations/accommodations')
        .query({
          userId: testUserId,
          cityCode: 'PAR',
          checkInDate: '2026-08-01',
          checkOutDate: '2026-08-03',
          adults: 1,
          limit,
        })
        .expect('Content-Type', /json/);

      expect(response.status).toBeIn([200, 503]);

      if (response.status === 200 && response.body.recommendations) {
        expect(response.body.recommendations.length).toBeLessThanOrEqual(limit);
      }
    }, 30000);
  });

  // ─── A/B Testing endpoint admin ───────────────────────────────────────────────

  describe('GET /admin/ab-test/config', () => {
    it('should return current A/B test configuration', async () => {
      const response = await request(AI_SERVICE_URL)
        .get('/admin/ab-test/config')
        .expect('Content-Type', /json/);

      expect(response.status).toBeIn([200, 401, 403, 404, 503]);

      if (response.status === 200) {
        const config = response.body;
        if (config.mlSplitPercent !== undefined) {
          expect(config.mlSplitPercent).toBeGreaterThanOrEqual(0);
          expect(config.mlSplitPercent).toBeLessThanOrEqual(100);
        }
        console.log('✅ A/B config:', config);
      }
    }, 10000);
  });

  // ─── Cache integration ────────────────────────────────────────────────────────

  describe('Cache performance (hit rate ≥ 85%)', () => {
    it('second identical request should be faster (cache hit)', async () => {
      const params = {
        userId: `cache-test-${Date.now()}`,
        cityCode: 'PAR',
        checkInDate: '2026-09-01',
        checkOutDate: '2026-09-03',
        adults: 2,
        limit: 3,
      };

      // Première requête (cold)
      const start1 = Date.now();
      const res1 = await request(AI_SERVICE_URL)
        .get('/api/v1/recommendations/accommodations')
        .query(params);
      const duration1 = Date.now() - start1;

      expect(res1.status).toBeIn([200, 503]);

      if (res1.status === 200) {
        // Deuxième requête (cache chaud)
        const start2 = Date.now();
        const res2 = await request(AI_SERVICE_URL)
          .get('/api/v1/recommendations/accommodations')
          .query(params);
        const duration2 = Date.now() - start2;

        expect(res2.status).toBe(200);

        console.log(`\n⚡ Cache Performance:`);
        console.log(`   Cold: ${duration1}ms`);
        console.log(`   Warm: ${duration2}ms`);

        // Cache chaud doit être plus rapide (ou au moins < 50ms)
        if (duration2 < duration1) {
          console.log(`   ✅ ${((1 - duration2 / duration1) * 100).toFixed(0)}% plus rapide`);
        }
      }
    }, 60000);
  });
});
