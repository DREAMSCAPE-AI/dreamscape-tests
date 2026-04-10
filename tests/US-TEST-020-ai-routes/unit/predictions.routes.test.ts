/**
 * US-TEST-020 — Predictions Route Unit Tests
 *
 * Tests for routes/predictions.ts:
 * - GET /trip-purpose: missing params → 400, success → 200, error → 500
 * - Non-Error throw → 'Unknown error'
 * - returnDate is optional
 */

jest.mock('@/services/AmadeusService', () => ({
  __esModule: true,
  default: {
    predictTripPurpose: jest.fn(),
  },
}));

import express from 'express';
import request from 'supertest';
import predictionsRouter from '@ai/routes/predictions';
import AmadeusService from '@/services/AmadeusService';

const app = express();
app.use(express.json());
app.use('/', predictionsRouter);

const mockPredict = AmadeusService.predictTripPurpose as jest.Mock;

describe('US-TEST-020 — GET /trip-purpose', () => {
  describe('parameter validation', () => {
    it('should return 400 when originLocationCode is missing', async () => {
      const res = await request(app).get('/trip-purpose').query({
        destinationLocationCode: 'JFK',
        departureDate: '2024-06-01',
        searchDate: '2024-05-01',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Missing required parameters');
    });

    it('should return 400 when destinationLocationCode is missing', async () => {
      const res = await request(app).get('/trip-purpose').query({
        originLocationCode: 'CDG',
        departureDate: '2024-06-01',
        searchDate: '2024-05-01',
      });

      expect(res.status).toBe(400);
    });

    it('should return 400 when departureDate is missing', async () => {
      const res = await request(app).get('/trip-purpose').query({
        originLocationCode: 'CDG',
        destinationLocationCode: 'JFK',
        searchDate: '2024-05-01',
      });

      expect(res.status).toBe(400);
    });

    it('should return 400 when searchDate is missing', async () => {
      const res = await request(app).get('/trip-purpose').query({
        originLocationCode: 'CDG',
        destinationLocationCode: 'JFK',
        departureDate: '2024-06-01',
      });

      expect(res.status).toBe(400);
    });
  });

  describe('success', () => {
    it('should return 200 with prediction result when all required params provided', async () => {
      const prediction = { data: [{ tripScore: 0.9, purpose: 'leisure' }] };
      mockPredict.mockResolvedValue(prediction);

      const res = await request(app).get('/trip-purpose').query({
        originLocationCode: 'CDG',
        destinationLocationCode: 'JFK',
        departureDate: '2024-06-01',
        searchDate: '2024-05-01',
      });

      expect(res.status).toBe(200);
      expect(res.body).toEqual(prediction);
    });

    it('should work without returnDate (optional parameter)', async () => {
      mockPredict.mockResolvedValue({ data: [] });

      const res = await request(app).get('/trip-purpose').query({
        originLocationCode: 'CDG',
        destinationLocationCode: 'JFK',
        departureDate: '2024-06-01',
        searchDate: '2024-05-01',
        // returnDate omitted intentionally
      });

      expect(res.status).toBe(200);
      expect(mockPredict).toHaveBeenCalledWith(
        expect.objectContaining({ returnDate: undefined })
      );
    });

    it('should pass returnDate to AmadeusService when provided', async () => {
      mockPredict.mockResolvedValue({ data: [] });

      await request(app).get('/trip-purpose').query({
        originLocationCode: 'CDG',
        destinationLocationCode: 'JFK',
        departureDate: '2024-06-01',
        returnDate: '2024-06-15',
        searchDate: '2024-05-01',
      });

      expect(mockPredict).toHaveBeenCalledWith(
        expect.objectContaining({ returnDate: '2024-06-15' })
      );
    });
  });

  describe('error handling', () => {
    it('should return 500 with error message when AmadeusService throws Error', async () => {
      mockPredict.mockRejectedValue(new Error('Amadeus API unavailable'));

      const res = await request(app).get('/trip-purpose').query({
        originLocationCode: 'CDG',
        destinationLocationCode: 'JFK',
        departureDate: '2024-06-01',
        searchDate: '2024-05-01',
      });

      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Amadeus API unavailable');
    });

    it('should return "Unknown error" when thrown value is not an Error', async () => {
      mockPredict.mockRejectedValue('plain string error');

      const res = await request(app).get('/trip-purpose').query({
        originLocationCode: 'CDG',
        destinationLocationCode: 'JFK',
        departureDate: '2024-06-01',
        searchDate: '2024-05-01',
      });

      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Unknown error');
    });
  });
});
