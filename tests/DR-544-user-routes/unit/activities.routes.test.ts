import request from 'supertest';
import express, { Express } from 'express';
import { jest, describe, it, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';

// ── AmadeusService mock ───────────────────────────────────────────────────────
const mockSearchActivities = jest.fn();
const mockGetActivityDetails = jest.fn();

jest.mock('../../../../dreamscape-services/user/src/services/AmadeusService', () => ({
  __esModule: true,
  default: {
    searchActivities: mockSearchActivities,
    getActivityDetails: mockGetActivityDetails,
  },
}));

import activitiesRouter from '../../../../dreamscape-services/user/src/routes/activities';

// ── Test data ─────────────────────────────────────────────────────────────────
const mockActivity = {
  id: 'activity-1',
  name: 'Eiffel Tower Tour',
  description: 'A guided tour of the Eiffel Tower',
  price: { amount: '25.00', currencyCode: 'EUR' },
  location: { latitude: 48.8584, longitude: 2.2945 },
};

describe('Activities Routes', () => {
  let app: Express;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/users/activities', activitiesRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  // ─── GET /search ───────────────────────────────────────────────────────────
  describe('GET /search', () => {
    it('should return 400 when no coordinates are provided', async () => {
      const res = await request(app)
        .get('/api/v1/users/activities/search')
        .expect(400);

      expect(res.body.error).toContain('coordinates');
    });

    it('should return 200 with results using lat/lng', async () => {
      mockSearchActivities.mockResolvedValue([mockActivity] as never);

      const res = await request(app)
        .get('/api/v1/users/activities/search')
        .query({ latitude: '48.8584', longitude: '2.2945' })
        .expect(200);

      expect(mockSearchActivities).toHaveBeenCalledWith(
        expect.objectContaining({ latitude: 48.8584, longitude: 2.2945 })
      );
      expect(res.body).toEqual([mockActivity]);
    });

    it('should return 200 with results using bounding box', async () => {
      mockSearchActivities.mockResolvedValue([mockActivity] as never);

      const res = await request(app)
        .get('/api/v1/users/activities/search')
        .query({ north: '49.0', west: '2.0', south: '48.5', east: '2.5' })
        .expect(200);

      expect(mockSearchActivities).toHaveBeenCalledWith(
        expect.objectContaining({ north: 49.0, west: 2.0, south: 48.5, east: 2.5 })
      );
    });

    it('should pass radius when provided', async () => {
      mockSearchActivities.mockResolvedValue([] as never);

      await request(app)
        .get('/api/v1/users/activities/search')
        .query({ latitude: '48.8584', longitude: '2.2945', radius: '5' })
        .expect(200);

      expect(mockSearchActivities).toHaveBeenCalledWith(
        expect.objectContaining({ radius: 5 })
      );
    });

    it('should return 500 on service error', async () => {
      mockSearchActivities.mockRejectedValue(new Error('Amadeus API error') as never);

      const res = await request(app)
        .get('/api/v1/users/activities/search')
        .query({ latitude: '48.8584', longitude: '2.2945' })
        .expect(500);

      expect(res.body.error).toContain('Failed to search activities');
    });
  });

  // ─── GET /details/:activityId ──────────────────────────────────────────────
  describe('GET /details/:activityId', () => {
    it('should return 200 with activity details', async () => {
      mockGetActivityDetails.mockResolvedValue(mockActivity as never);

      const res = await request(app)
        .get('/api/v1/users/activities/details/activity-1')
        .expect(200);

      expect(mockGetActivityDetails).toHaveBeenCalledWith('activity-1');
      expect(res.body).toEqual(mockActivity);
    });

    it('should return 500 on service error', async () => {
      mockGetActivityDetails.mockRejectedValue(new Error('Not found') as never);

      const res = await request(app)
        .get('/api/v1/users/activities/details/unknown-id')
        .expect(500);

      expect(res.body.error).toContain('Failed to get activity details');
    });
  });

  // ─── GET /:activityId ──────────────────────────────────────────────────────
  describe('GET /:activityId', () => {
    it('should return 200 with activity by ID', async () => {
      mockGetActivityDetails.mockResolvedValue(mockActivity as never);

      const res = await request(app)
        .get('/api/v1/users/activities/activity-1')
        .expect(200);

      expect(mockGetActivityDetails).toHaveBeenCalledWith('activity-1');
      expect(res.body).toEqual(mockActivity);
    });

    it('should return 500 on service error', async () => {
      mockGetActivityDetails.mockRejectedValue(new Error('Service error') as never);

      const res = await request(app)
        .get('/api/v1/users/activities/bad-id')
        .expect(500);

      expect(res.body.error).toContain('Failed to get activity by ID');
    });
  });
});
