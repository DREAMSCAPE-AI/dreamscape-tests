/**
 * US-IA-009.2 — Intégration Ollama Qwen2.5:7b (Enrichissement asynchrone)
 *
 * Tests du OllamaEnricherConsumer :
 * - start/stop du consumer
 * - processRecommendationEvent : appel Ollama + mise en cache
 * - Dégradation gracieuse si Ollama indisponible
 * - Déduplication : ne ré-enrichit pas si déjà en cache
 * - Pattern async non-bloquant (n'impacte pas le SLA < 500ms)
 * - getStats() retourne les compteurs corrects
 *
 * @ticket US-IA-009.2
 */

// Mock axios avant tout import
jest.mock('axios');
// Mock CacheService avant tout import
jest.mock('@ai/services/CacheService', () => ({
  default: {
    get: jest.fn(),
    setex: jest.fn(),
  },
}));

import axios from 'axios';
import CacheServiceDefault from '@ai/services/CacheService';
import { OllamaEnricherConsumer } from '@ai/services/OllamaEnricherConsumer';

const mockAxios = axios as jest.Mocked<typeof axios>;
const mockCache = CacheServiceDefault as jest.Mocked<typeof CacheServiceDefault>;

// Payload Ollama valide
const ollamaSuccessResponse = {
  data: {
    response: JSON.stringify({
      destinations: [
        {
          id: 'hotel-paris-1',
          enriched_reasons: ['Vue imprenable sur la Tour Eiffel', 'Service 5 étoiles'],
          alternatives: ['Hôtel du Palais', 'Grand Hôtel'],
          semantic_tags: ['romantique', 'luxe', 'patrimoine'],
          local_insights: 'Idéal pour un week-end culturel à Paris.',
        },
      ],
      global_insights: 'Paris offre un mélange unique de culture et de gastronomie.',
    }),
  },
};

const recommendationEvent = {
  userId: 'user-123',
  requestId: 'req-abc',
  recommendations: [
    {
      id: 'hotel-paris-1',
      name: 'Hôtel de Paris',
      location: { city: 'Paris', country: 'France' },
      score: 0.92,
      reasons: ['Emplacement central', 'Bien noté'],
    },
  ],
  timestamp: new Date(),
};

describe('US-IA-009.2 — OllamaEnricherConsumer', () => {
  let consumer: OllamaEnricherConsumer;

  beforeEach(() => {
    jest.clearAllMocks();
    consumer = new OllamaEnricherConsumer();
  });

  // ─── start / stop ─────────────────────────────────────────────────────────────

  describe('start / stop', () => {
    it('should start the consumer', async () => {
      // Health check via axios.get
      mockAxios.get = jest.fn().mockResolvedValue({
        data: { models: [{ name: 'qwen2.5:7b' }] },
      });

      await consumer.start();

      expect(consumer['isRunning']).toBe(true);
    });

    it('should not start twice if already running', async () => {
      mockAxios.get = jest.fn().mockResolvedValue({ data: { models: [] } });

      await consumer.start();
      const firstGet = (mockAxios.get as jest.Mock).mock.calls.length;

      await consumer.start(); // Second call should be ignored
      expect((mockAxios.get as jest.Mock).mock.calls.length).toBe(firstGet);
    });

    it('should start even if Ollama health check fails (non-critical)', async () => {
      mockAxios.get = jest.fn().mockRejectedValue(new Error('Ollama unreachable'));

      await expect(consumer.start()).resolves.not.toThrow();
      expect(consumer['isRunning']).toBe(true);
    });

    it('should stop the consumer', async () => {
      consumer['isRunning'] = true;
      await consumer.stop();
      expect(consumer['isRunning']).toBe(false);
    });
  });

  // ─── processRecommendationEvent ───────────────────────────────────────────────

  describe('processRecommendationEvent', () => {
    it('should enrich recommendations and store in cache', async () => {
      mockCache.get.mockResolvedValue(null); // Pas encore en cache
      mockAxios.post = jest.fn().mockResolvedValue(ollamaSuccessResponse);
      mockCache.setex.mockResolvedValue(undefined as any);

      await consumer.processRecommendationEvent(recommendationEvent);

      // Vérifier l'appel Ollama
      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/generate'),
        expect.objectContaining({
          model: expect.any(String),
          prompt: expect.any(String),
          stream: false,
        }),
        expect.any(Object)
      );

      // Vérifier le stockage en cache
      expect(mockCache.setex).toHaveBeenCalledWith(
        `enriched:${recommendationEvent.userId}`,
        expect.any(Number), // TTL configurable
        expect.any(String)  // JSON sérialisé
      );
    });

    it('should skip enrichment if already cached (déduplication)', async () => {
      mockCache.get.mockResolvedValue(JSON.stringify({ destinations: [] }));

      await consumer.processRecommendationEvent(recommendationEvent);

      // Ollama ne doit PAS être appelé
      expect(mockAxios.post).not.toHaveBeenCalled();
      expect(mockCache.setex).not.toHaveBeenCalled();
    });

    it('should NOT throw on Ollama error (non-bloquant)', async () => {
      mockCache.get.mockResolvedValue(null);
      mockAxios.post = jest.fn().mockRejectedValue(new Error('Ollama timeout'));

      await expect(
        consumer.processRecommendationEvent(recommendationEvent)
      ).resolves.not.toThrow();
    });

    it('should increment errorCount on failure', async () => {
      mockCache.get.mockResolvedValue(null);
      mockAxios.post = jest.fn().mockRejectedValue(new Error('Ollama error'));

      const beforeErrors = consumer['errorCount'];
      await consumer.processRecommendationEvent(recommendationEvent);
      expect(consumer['errorCount']).toBe(beforeErrors + 1);
    });

    it('should increment enrichmentCount on success', async () => {
      mockCache.get.mockResolvedValue(null);
      mockAxios.post = jest.fn().mockResolvedValue(ollamaSuccessResponse);
      mockCache.setex.mockResolvedValue(undefined as any);

      const beforeCount = consumer['enrichmentCount'];
      await consumer.processRecommendationEvent(recommendationEvent);
      expect(consumer['enrichmentCount']).toBe(beforeCount + 1);
    });

    it('should truncate to max 10 recommendations for Ollama payload', async () => {
      const bigEvent = {
        ...recommendationEvent,
        recommendations: Array.from({ length: 20 }, (_, i) => ({
          id: `hotel-${i}`,
          name: `Hotel ${i}`,
          location: { city: 'Paris', country: 'France' },
          score: 0.8,
          reasons: ['Good'],
        })),
      };

      mockCache.get.mockResolvedValue(null);
      mockAxios.post = jest.fn().mockResolvedValue(ollamaSuccessResponse);
      mockCache.setex.mockResolvedValue(undefined as any);

      await consumer.processRecommendationEvent(bigEvent);

      const promptArg = (mockAxios.post as jest.Mock).mock.calls[0][1].prompt as string;
      // Le prompt ne doit contenir que les 10 premiers hotels (slice(0, 10))
      const parsedPayload = JSON.parse(
        promptArg.substring(promptArg.indexOf('['))
      );
      expect(parsedPayload.length).toBeLessThanOrEqual(10);
    });
  });

  // ─── Pattern non-bloquant ────────────────────────────────────────────────────

  describe('Pattern async (non-bloquant, hors critical path)', () => {
    it('should complete within 5s even with a slow Ollama response', async () => {
      mockCache.get.mockResolvedValue(null);
      // Simulate slow Ollama (but within test timeout)
      mockAxios.post = jest.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(ollamaSuccessResponse), 100))
      );
      mockCache.setex.mockResolvedValue(undefined as any);

      const start = Date.now();
      await consumer.processRecommendationEvent(recommendationEvent);
      const duration = Date.now() - start;

      // Le traitement async ne doit pas bloquer indéfiniment
      expect(duration).toBeLessThan(5000);
    });
  });
});
