/**
 * US-IA-009.6 — A/B Testing Framework
 *
 * Tests the ABTestingService :
 * - Bucketing déterministe (même userId → même bucket)
 * - Répartition 50% ML / 50% rule-based par défaut
 * - Désactivation globale → toujours rule-based
 * - Mise à jour dynamique du split
 * - Validation des bornes (0-100)
 *
 * @ticket US-IA-009.6
 */

import {
  ABTestingService,
  initializeABTestingService,
  getABTestingService,
} from '@ai/services/ABTestingService';

describe('US-IA-009.6 — ABTestingService', () => {
  describe('Initialisation', () => {
    it('should instantiate with default config (50% ML split)', () => {
      const svc = new ABTestingService();
      const cfg = svc.getConfig();

      expect(cfg.mlSplitPercent).toBe(50);
      expect(cfg.enabled).toBe(true);
      expect(cfg.testName).toBe('ml_vs_rulebased_v1');
    });

    it('should accept partial config override', () => {
      const svc = new ABTestingService({ mlSplitPercent: 30 });
      expect(svc.getConfig().mlSplitPercent).toBe(30);
    });

    it('should return singleton via getABTestingService()', () => {
      const a = getABTestingService();
      const b = getABTestingService();
      expect(a).toBe(b);
    });

    it('should replace singleton via initializeABTestingService()', () => {
      const svc = initializeABTestingService({ mlSplitPercent: 10 });
      expect(svc.getConfig().mlSplitPercent).toBe(10);
      // Restore default for subsequent tests
      initializeABTestingService({ mlSplitPercent: 50 });
    });
  });

  describe('shouldUseMLModel — bucketing déterministe', () => {
    it('should return the same result for the same userId across calls', () => {
      const svc = new ABTestingService({ mlSplitPercent: 50 });
      const userId = 'user-stable-123';

      const first = svc.shouldUseMLModel(userId);
      const second = svc.shouldUseMLModel(userId);
      const third = svc.shouldUseMLModel(userId);

      expect(first).toBe(second);
      expect(second).toBe(third);
    });

    it('should return false for ALL users when split is 0%', () => {
      const svc = new ABTestingService({ mlSplitPercent: 0 });
      const userIds = Array.from({ length: 100 }, (_, i) => `user-${i}`);

      userIds.forEach((id) => {
        expect(svc.shouldUseMLModel(id)).toBe(false);
      });
    });

    it('should return true for ALL users when split is 100%', () => {
      const svc = new ABTestingService({ mlSplitPercent: 100 });
      const userIds = Array.from({ length: 100 }, (_, i) => `user-${i}`);

      userIds.forEach((id) => {
        expect(svc.shouldUseMLModel(id)).toBe(true);
      });
    });

    it('should distribute ~50% users to ML group with 50% split', () => {
      const svc = new ABTestingService({ mlSplitPercent: 50 });
      const userIds = Array.from({ length: 1000 }, (_, i) => `user-${i}`);
      const mlCount = userIds.filter((id) => svc.shouldUseMLModel(id)).length;

      // Expect roughly 50% (±5% tolerance on 1000 users)
      expect(mlCount).toBeGreaterThan(450);
      expect(mlCount).toBeLessThan(550);
    });

    it('should return false for all users when A/B testing is disabled', () => {
      const svc = new ABTestingService({ mlSplitPercent: 100, enabled: false });
      const userId = 'any-user-id';

      expect(svc.shouldUseMLModel(userId)).toBe(false);
    });
  });

  describe('updateMLSplit', () => {
    it('should update the split percentage', () => {
      const svc = new ABTestingService({ mlSplitPercent: 50 });
      svc.updateMLSplit(25);
      expect(svc.getConfig().mlSplitPercent).toBe(25);
    });

    it('should accept 0 (all rule-based)', () => {
      const svc = new ABTestingService();
      svc.updateMLSplit(0);
      expect(svc.getConfig().mlSplitPercent).toBe(0);
    });

    it('should accept 100 (all ML)', () => {
      const svc = new ABTestingService();
      svc.updateMLSplit(100);
      expect(svc.getConfig().mlSplitPercent).toBe(100);
    });

    it('should throw for values < 0', () => {
      const svc = new ABTestingService();
      expect(() => svc.updateMLSplit(-1)).toThrow('ML split must be between 0 and 100');
    });

    it('should throw for values > 100', () => {
      const svc = new ABTestingService();
      expect(() => svc.updateMLSplit(101)).toThrow('ML split must be between 0 and 100');
    });
  });

  describe('setEnabled', () => {
    it('should disable A/B testing globally', () => {
      const svc = new ABTestingService({ mlSplitPercent: 100 });
      svc.setEnabled(false);
      expect(svc.shouldUseMLModel('any-user')).toBe(false);
    });

    it('should re-enable A/B testing', () => {
      const svc = new ABTestingService({ mlSplitPercent: 100, enabled: false });
      svc.setEnabled(true);
      expect(svc.shouldUseMLModel('any-user')).toBe(true);
    });
  });

  describe('getSummary', () => {
    it('should return correct summary', () => {
      const svc = new ABTestingService({ mlSplitPercent: 30 });
      const summary = svc.getSummary();

      expect(summary.testName).toBe('ml_vs_rulebased_v1');
      expect(summary.mlSplitPercent).toBe(30);
      expect(summary.ruleBasedPercent).toBe(70);
      expect(summary.enabled).toBe(true);
    });

    it('mlSplitPercent + ruleBasedPercent should always equal 100', () => {
      [0, 25, 50, 75, 100].forEach((split) => {
        const svc = new ABTestingService({ mlSplitPercent: split });
        const { mlSplitPercent, ruleBasedPercent } = svc.getSummary();
        expect(mlSplitPercent + ruleBasedPercent).toBe(100);
      });
    });
  });
});
