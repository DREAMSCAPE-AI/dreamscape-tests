/**
 * US-TEST-012 — Tests unitaires routes/itineraries.ts
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';

// ── Mock ItineraryController ───────────────────────────────────────────────────
const mockGetItineraries    = jest.fn((_req: any, res: any) => res.json([]));
const mockGetItineraryById  = jest.fn((_req: any, res: any) => res.json({}));
const mockCreateItinerary   = jest.fn((_req: any, res: any) => res.status(201).json({}));
const mockUpdateItinerary   = jest.fn((_req: any, res: any) => res.json({}));
const mockDeleteItinerary   = jest.fn((_req: any, res: any) => res.status(204).end());
const mockAddItem           = jest.fn((_req: any, res: any) => res.status(201).json({}));
const mockUpdateItem        = jest.fn((_req: any, res: any) => res.json({}));
const mockDeleteItem        = jest.fn((_req: any, res: any) => res.status(204).end());
const mockReorderItems      = jest.fn((_req: any, res: any) => res.json({}));
const mockExportItinerary   = jest.fn((_req: any, res: any) => res.json({}));

jest.mock('@/controllers/itinerary.controller', () => ({
  __esModule: true,
  ItineraryController: jest.fn().mockImplementation(() => ({
    getItineraries:   mockGetItineraries,
    getItineraryById: mockGetItineraryById,
    createItinerary:  mockCreateItinerary,
    updateItinerary:  mockUpdateItinerary,
    deleteItinerary:  mockDeleteItinerary,
    addItem:          mockAddItem,
    updateItem:       mockUpdateItem,
    deleteItem:       mockDeleteItem,
    reorderItems:     mockReorderItems,
    exportItinerary:  mockExportItinerary,
  })),
}));

// Mock authProxy to always pass through
jest.mock('@/middleware/authProxy', () => ({
  __esModule: true,
  authenticateToken: jest.fn((_req: any, _res: any, next: any) => {
    _req.user = { id: 'user-001' };
    next();
  }),
}));

// ── App setup ─────────────────────────────────────────────────────────────────
import itinerariesRouter from '@/routes/itineraries';

const app = express();
app.use(express.json());
app.use('/itineraries', itinerariesRouter);

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('Itineraries Routes — US-TEST-012', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Re-setup default mocks after clearAllMocks
    mockGetItineraries.mockImplementation((_req: any, res: any) => res.json([]));
    mockGetItineraryById.mockImplementation((_req: any, res: any) => res.json({}));
    mockCreateItinerary.mockImplementation((_req: any, res: any) => res.status(201).json({}));
    mockUpdateItinerary.mockImplementation((_req: any, res: any) => res.json({}));
    mockDeleteItinerary.mockImplementation((_req: any, res: any) => res.status(204).end());
    mockAddItem.mockImplementation((_req: any, res: any) => res.status(201).json({}));
    mockDeleteItem.mockImplementation((_req: any, res: any) => res.status(204).end());
  });

  it('GET /itineraries → 200', async () => {
    const res = await request(app).get('/itineraries');
    expect(res.status).toBe(200);
    expect(mockGetItineraries).toHaveBeenCalled();
  });

  it('GET /itineraries/:id → 200', async () => {
    const res = await request(app).get('/itineraries/itin-001');
    expect(res.status).toBe(200);
    expect(mockGetItineraryById).toHaveBeenCalled();
  });

  it('POST /itineraries → 201', async () => {
    const res = await request(app)
      .post('/itineraries')
      .send({ title: 'Paris Trip', startDate: '2026-06-01', endDate: '2026-06-07' });
    expect(res.status).toBe(201);
    expect(mockCreateItinerary).toHaveBeenCalled();
  });

  it('PUT /itineraries/:id → 200', async () => {
    const res = await request(app)
      .put('/itineraries/itin-001')
      .send({ title: 'Updated' });
    expect(res.status).toBe(200);
    expect(mockUpdateItinerary).toHaveBeenCalled();
  });

  it('DELETE /itineraries/:id → 204', async () => {
    const res = await request(app).delete('/itineraries/itin-001');
    expect(res.status).toBe(204);
    expect(mockDeleteItinerary).toHaveBeenCalled();
  });

  it('POST /itineraries/:id/items → 201', async () => {
    const res = await request(app)
      .post('/itineraries/itin-001/items')
      .send({ type: 'FLIGHT', title: 'CDG → LHR', startDate: '2026-06-01', endDate: '2026-06-01' });
    expect(res.status).toBe(201);
    expect(mockAddItem).toHaveBeenCalled();
  });

  it('DELETE /itineraries/:id/items/:itemId → 204', async () => {
    const res = await request(app).delete('/itineraries/itin-001/items/item-001');
    expect(res.status).toBe(204);
    expect(mockDeleteItem).toHaveBeenCalled();
  });
});
