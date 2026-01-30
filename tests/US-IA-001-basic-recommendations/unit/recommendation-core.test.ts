/**
 * Basic Recommendations - Core Functionality Tests
 *
 * Tests the core recommendation system components:
 * - Vector similarity calculations
 * - Scoring algorithms
 * - Recommendation generation
 *
 * @ticket US-IA-001
 */

describe('IA-001: Basic Recommendations System', () => {
  describe('Core Components', () => {
    it('should have ScoringService available', async () => {
      // Verify the service can be imported
      const { ScoringService } = await import('@ai/services/ScoringService');
      expect(ScoringService).toBeDefined();

      // Verify service can be instantiated
      const service = new ScoringService();
      expect(service).toBeInstanceOf(ScoringService);
    });

    it('should have VectorizationService available', async () => {
      // Verify the service can be imported
      const { VectorizationService } = await import('@ai/services/VectorizationService');
      expect(VectorizationService).toBeDefined();

      // Verify service can be instantiated
      const service = new VectorizationService();
      expect(service).toBeInstanceOf(VectorizationService);
    });

    it('should export VECTOR_DIMENSIONS constant', async () => {
      const { VECTOR_DIMENSIONS } = await import('@ai/services/VectorizationService');
      expect(VECTOR_DIMENSIONS).toBe(8);
    });
  });

  describe('Cosine Similarity Algorithm', () => {
    let scoringService: any;

    beforeAll(async () => {
      const { ScoringService } = await import('@ai/services/ScoringService');
      scoringService = new ScoringService();
    });

    it('should calculate similarity for identical vectors as 1.0', () => {
      const vecA = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
      const vecB = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];

      const similarity = scoringService.cosineSimilarity(vecA, vecB);
      expect(similarity).toBeCloseTo(1.0, 5);
    });

    it('should calculate similarity for orthogonal vectors as 0', () => {
      const vecA = [1, 0, 0, 0, 0, 0, 0, 0];
      const vecB = [0, 1, 0, 0, 0, 0, 0, 0];

      const similarity = scoringService.cosineSimilarity(vecA, vecB);
      expect(similarity).toBe(0);
    });

    it('should return value between 0 and 1 for similar vectors', () => {
      const vecA = [0.8, 0.2, 0.5, 0.7, 0.3, 0.9, 0.6, 0.8];
      const vecB = [0.7, 0.3, 0.4, 0.6, 0.4, 0.8, 0.5, 0.7];

      const similarity = scoringService.cosineSimilarity(vecA, vecB);
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThanOrEqual(1);
    });

    it('should handle zero vectors gracefully', () => {
      const vecA = [0, 0, 0, 0, 0, 0, 0, 0];
      const vecB = [1, 1, 1, 1, 1, 1, 1, 1];

      const similarity = scoringService.cosineSimilarity(vecA, vecB);
      expect(similarity).toBe(0);
    });
  });

  describe('Euclidean Similarity Algorithm', () => {
    let scoringService: any;

    beforeAll(async () => {
      const { ScoringService } = await import('@ai/services/ScoringService');
      scoringService = new ScoringService();
    });

    it('should return 1.0 for identical vectors', () => {
      const vecA = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
      const vecB = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];

      const similarity = scoringService.euclideanSimilarity(vecA, vecB);
      expect(similarity).toBe(1);
    });

    it('should return value between 0 and 1', () => {
      const vecA = [0.8, 0.2, 0.5, 0.7, 0.3, 0.9, 0.6, 0.8];
      const vecB = [0.7, 0.3, 0.4, 0.6, 0.4, 0.8, 0.5, 0.7];

      const similarity = scoringService.euclideanSimilarity(vecA, vecB);
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThanOrEqual(1);
    });
  });

  describe('Hybrid Similarity Algorithm', () => {
    let scoringService: any;

    beforeAll(async () => {
      const { ScoringService } = await import('@ai/services/ScoringService');
      scoringService = new ScoringService();
    });

    it('should combine cosine and euclidean with 70/30 weighting', () => {
      const vecA = [0.8, 0.2, 0.5, 0.7, 0.3, 0.9, 0.6, 0.8];
      const vecB = [0.8, 0.2, 0.5, 0.7, 0.3, 0.9, 0.6, 0.8];

      const hybrid = scoringService.hybridSimilarity(vecA, vecB);
      const cosine = scoringService.cosineSimilarity(vecA, vecB);
      const euclidean = scoringService.euclideanSimilarity(vecA, vecB);

      const expected = 0.7 * cosine + 0.3 * euclidean;
      expect(hybrid).toBeCloseTo(expected, 5);
    });

    it('should return value between 0 and 1', () => {
      const vecA = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
      const vecB = [0.3, 0.7, 0.4, 0.6, 0.5, 0.5, 0.4, 0.6];

      const similarity = scoringService.hybridSimilarity(vecA, vecB);
      expect(similarity).toBeGreaterThanOrEqual(0);
      expect(similarity).toBeLessThanOrEqual(1);
    });
  });

  describe('Explainability Features', () => {
    let scoringService: any;

    beforeAll(async () => {
      const { ScoringService } = await import('@ai/services/ScoringService');
      scoringService = new ScoringService();
    });

    it('should generate reasons for matching dimensions', () => {
      const userVec = [0.8, 0.2, 0.5, 0.7, 0.3, 0.9, 0.6, 0.8];
      const itemVec = [0.82, 0.18, 0.52, 0.68, 0.32, 0.88, 0.62, 0.82];

      const reasons = scoringService.generateReasons(userVec, itemVec);
      expect(reasons).toBeInstanceOf(Array);
      expect(reasons.length).toBeGreaterThan(0);
    });

    it('should calculate confidence score', () => {
      const score = 0.8;
      const popularity = 0.7;

      const confidence = scoringService.calculateConfidence(score, popularity);
      expect(confidence).toBeGreaterThanOrEqual(0);
      expect(confidence).toBeLessThanOrEqual(1);
    });
  });
});
