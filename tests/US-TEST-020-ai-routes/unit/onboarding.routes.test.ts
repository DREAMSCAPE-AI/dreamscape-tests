/**
 * US-TEST-020 — Onboarding Routes Unit Tests
 *
 * Tests for routes/onboarding.ts:
 * - POST /onboarding/complete
 * - PATCH /users/:userId/refine
 * - GET /users/:userId/segment
 * - POST /users/:userId/regenerate
 */

jest.mock('@dreamscape/db', () => ({
  prisma: {
    userVector: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('@ai/onboarding/onboarding-orchestrator.service', () => ({
  OnboardingOrchestratorService: jest.fn().mockImplementation(() => ({
    processOnboardingComplete: jest.fn(),
    refineUserProfile: jest.fn(),
  })),
}));

import express from 'express';
import request from 'supertest';
import { prisma } from '@dreamscape/db';
import { OnboardingOrchestratorService } from '@ai/onboarding/onboarding-orchestrator.service';
import onboardingRouter from '@ai/routes/onboarding';

const mockPrismaUserVector = prisma.userVector as jest.Mocked<typeof prisma.userVector>;

function getOrchestratorInstance() {
  const MockClass = OnboardingOrchestratorService as jest.MockedClass<typeof OnboardingOrchestratorService>;
  return MockClass.mock.instances[MockClass.mock.instances.length - 1] as any;
}

let app: express.Application;

beforeEach(() => {
  app = express();
  app.use(express.json());
  app.use('/', onboardingRouter);
});

// ─── POST /onboarding/complete ────────────────────────────────────────────────

describe('POST /onboarding/complete', () => {
  it('should return 400 when userId is missing', async () => {
    const res = await request(app).post('/onboarding/complete').send({ onboardingData: {} });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('userId is required');
  });

  it('should return 500 when orchestrator returns success: false', async () => {
    const orchestrator = getOrchestratorInstance();
    orchestrator.processOnboardingComplete.mockResolvedValue({
      success: false,
      error: 'Onboarding not completed',
      recommendations: [],
      metadata: {},
    });

    const res = await request(app)
      .post('/onboarding/complete')
      .send({ userId: 'user-1' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Onboarding not completed');
  });

  it('should return 200 with vector and recommendations on success', async () => {
    const orchestrator = getOrchestratorInstance();
    orchestrator.processOnboardingComplete.mockResolvedValue({
      success: true,
      fallback: false,
      userVector: {
        primarySegment: 'BUDGET_BACKPACKER',
        confidence: 0.85,
        source: 'segment_blended',
      },
      recommendations: [{ id: 'rec-1' }],
      metadata: { processingTime: 500, strategy: 'hybrid' },
    });

    const res = await request(app)
      .post('/onboarding/complete')
      .send({ userId: 'user-1', onboardingData: { isOnboardingCompleted: true } });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.userVector.segment).toBe('BUDGET_BACKPACKER');
    expect(res.body.recommendations).toHaveLength(1);
  });

  it('should return 500 with message when orchestrator throws an Error', async () => {
    const orchestrator = getOrchestratorInstance();
    orchestrator.processOnboardingComplete.mockRejectedValue(new Error('Orchestrator crashed'));

    const res = await request(app)
      .post('/onboarding/complete')
      .send({ userId: 'user-1' });

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Orchestrator crashed');
  });

  it('should return "Unknown error" when orchestrator throws a non-Error', async () => {
    const orchestrator = getOrchestratorInstance();
    orchestrator.processOnboardingComplete.mockRejectedValue('plain string');

    const res = await request(app)
      .post('/onboarding/complete')
      .send({ userId: 'user-1' });

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Unknown error');
  });
});

// ─── PATCH /users/:userId/refine ──────────────────────────────────────────────

describe('PATCH /users/:userId/refine', () => {
  it('should return 400 when interaction body is missing', async () => {
    const res = await request(app).patch('/users/user-1/refine').send({});

    expect(res.status).toBe(400);
  });

  it('should return 400 when interaction.type is missing', async () => {
    const res = await request(app)
      .patch('/users/user-1/refine')
      .send({ interaction: { destinationId: 'dest-1' } });

    expect(res.status).toBe(400);
  });

  it('should return 400 when interaction.destinationId is missing', async () => {
    const res = await request(app)
      .patch('/users/user-1/refine')
      .send({ interaction: { type: 'view' } });

    expect(res.status).toBe(400);
  });

  it('should return 200 with refinement result on success', async () => {
    const orchestrator = getOrchestratorInstance();
    orchestrator.refineUserProfile.mockResolvedValue({
      vectorUpdated: true,
      segmentsChanged: false,
      newRecommendationsGenerated: true,
    });

    const res = await request(app).patch('/users/user-1/refine').send({
      interaction: { type: 'view', destinationId: 'dest-paris' },
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.vectorUpdated).toBe(true);
  });

  it('should return 500 with "Unknown error" when refine throws a non-Error', async () => {
    const orchestrator = getOrchestratorInstance();
    orchestrator.refineUserProfile.mockRejectedValue('fail');

    const res = await request(app).patch('/users/user-1/refine').send({
      interaction: { type: 'book', destinationId: 'dest-1' },
    });

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Unknown error');
  });
});

// ─── GET /users/:userId/segment ───────────────────────────────────────────────

describe('GET /users/:userId/segment', () => {
  it('should return 404 when userVector is not found', async () => {
    (mockPrismaUserVector.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await request(app).get('/users/user-unknown/segment');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('User vector not found');
  });

  it('should return 200 with segment data when userVector exists', async () => {
    (mockPrismaUserVector.findUnique as jest.Mock).mockResolvedValue({
      segments: [{ segment: 'BUDGET_BACKPACKER', score: 0.8 }],
      primarySegment: 'BUDGET_BACKPACKER',
      segmentConfidence: 0.85,
      lastSegmentUpdate: new Date('2024-01-01'),
    });

    const res = await request(app).get('/users/user-1/segment');

    expect(res.status).toBe(200);
    expect(res.body.userId).toBe('user-1');
    expect(res.body.primarySegment).toBe('BUDGET_BACKPACKER');
    expect(res.body.confidence).toBe(0.85);
  });

  it('should return 500 when prisma throws an Error', async () => {
    (mockPrismaUserVector.findUnique as jest.Mock).mockRejectedValue(new Error('DB connection lost'));

    const res = await request(app).get('/users/user-err/segment');

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('DB connection lost');
  });

  it('should return "Unknown error" when prisma throws a non-Error', async () => {
    (mockPrismaUserVector.findUnique as jest.Mock).mockRejectedValue('db error string');

    const res = await request(app).get('/users/user-err/segment');

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Unknown error');
  });
});

// ─── POST /users/:userId/regenerate ──────────────────────────────────────────

describe('POST /users/:userId/regenerate', () => {
  it('should return 200 with regeneration result on success', async () => {
    const orchestrator = getOrchestratorInstance();
    orchestrator.processOnboardingComplete.mockResolvedValue({
      success: true,
      recommendations: [{ id: 'r1' }, { id: 'r2' }],
      metadata: { strategy: 'hybrid' },
    });

    const res = await request(app).post('/users/user-1/regenerate');

    expect(res.status).toBe(200);
    expect(res.body.regenerated).toBe(true);
    expect(res.body.recommendations).toBe(2);
  });

  it('should return 500 with message when processOnboardingComplete throws', async () => {
    const orchestrator = getOrchestratorInstance();
    orchestrator.processOnboardingComplete.mockRejectedValue(new Error('Regen failed'));

    const res = await request(app).post('/users/user-2/regenerate');

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Regen failed');
  });

  it('should return "Unknown error" when thrown value is not an Error', async () => {
    const orchestrator = getOrchestratorInstance();
    orchestrator.processOnboardingComplete.mockRejectedValue(42);

    const res = await request(app).post('/users/user-3/regenerate');

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Unknown error');
  });
});
