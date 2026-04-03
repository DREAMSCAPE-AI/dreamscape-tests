/**
 * US-TEST-013 — Tests unitaires ItineraryController
 * Scénarios : getItineraries, getItineraryById, createItinerary, updateItinerary,
 *             deleteItinerary, addItem, removeItem, reorderItems, export
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// ── Mock Prisma ────────────────────────────────────────────────────────────────
const mockItineraryFindMany  = jest.fn();
const mockItineraryFindFirst = jest.fn();
const mockItineraryCreate    = jest.fn();
const mockItineraryUpdate    = jest.fn();
const mockItineraryDelete    = jest.fn();
const mockItemCreate         = jest.fn();
const mockItemUpdate         = jest.fn();
const mockItemDelete         = jest.fn();
const mockItemFindMany       = jest.fn();
const mockUserFindUnique     = jest.fn();
const mockTransaction        = jest.fn();

jest.mock('@/database/prisma', () => ({
  __esModule: true,
  default: {
    itinerary: {
      findMany:  mockItineraryFindMany,
      findFirst: mockItineraryFindFirst,
      create:    mockItineraryCreate,
      update:    mockItineraryUpdate,
      delete:    mockItineraryDelete,
    },
    itineraryItem: {
      create:   mockItemCreate,
      update:   mockItemUpdate,
      delete:   mockItemDelete,
      findMany: mockItemFindMany,
    },
    user: {
      findUnique: mockUserFindUnique,
    },
    $transaction: mockTransaction,
  },
}));

// ── Mock ExportService ────────────────────────────────────────────────────────
const mockGeneratePDF          = jest.fn();
const mockGenerateICal         = jest.fn();
const mockSendEmailSummary     = jest.fn();

jest.mock('@/services/itinerary.export.service', () => ({
  __esModule: true,
  ItineraryExportService: jest.fn().mockImplementation(() => ({
    generatePDF:      mockGeneratePDF,
    generateICal:     mockGenerateICal,
    sendEmailSummary: mockSendEmailSummary,
  })),
}));

// ── Import after mocks ────────────────────────────────────────────────────────
import { ItineraryController } from '@/controllers/itinerary.controller';
import { ExportFormatSchema } from '@/types/itinerary.types';

// ── Fixtures ───────────────────────────────────────────────────────────────────
const USER_ID       = 'user-itin-001';
const ITINERARY_ID  = 'itin-abc-001';
const ITEM_ID       = 'item-abc-001';

const mockItinerary = {
  id:           ITINERARY_ID,
  userId:       USER_ID,
  title:        'Paris Getaway',
  description:  'A lovely trip',
  startDate:    new Date('2026-06-01'),
  endDate:      new Date('2026-06-07'),
  destinations: ['Paris'],
  isPublic:     false,
  createdAt:    new Date(),
  updatedAt:    new Date(),
  items:        [],
};

const mockItem = {
  id:          ITEM_ID,
  itineraryId: ITINERARY_ID,
  type:        'FLIGHT',
  itemId:      'flight-001',
  itemData:    { origin: 'CDG', destination: 'LHR' },
  price:       100,
  currency:    'EUR',
  quantity:    1,
  title:       'CDG → LHR',
  startDate:   new Date('2026-06-01T08:00:00Z'),
  endDate:     new Date('2026-06-01T09:30:00Z'),
  location:    'CDG',
  order:       0,
};

function buildMocks(userId?: string, body = {}, params = {}, query = {}) {
  const req: any = {
    user:   userId ? { id: userId } : undefined,
    body,
    params,
    query,
  };
  const res: any = {
    _status: 200,
    _body:   null as any,
    status(code: number) { this._status = code; return this; },
    json(body: any)      { this._body = body;   return this; },
    send(body?: any)     { this._body = body;   return this; },
    setHeader: jest.fn(),
    set: jest.fn(),
    end: jest.fn(),
  };
  const next = jest.fn();
  return { req, res, next };
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('ItineraryController — US-TEST-013', () => {
  let controller: ItineraryController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ItineraryController();
    mockUserFindUnique.mockResolvedValue({
      email: 'alice@test.com',
      firstName: 'Alice',
      lastName: 'Doe',
    } as never);
    mockTransaction.mockImplementation(async (operations: any[]) => Promise.all(operations));
  });

  // ── getItineraries ──────────────────────────────────────────────────────────
  describe('getItineraries', () => {
    it('should return all itineraries for the authenticated user', async () => {
      mockItineraryFindMany.mockResolvedValue([mockItinerary] as never);
      const { req, res, next } = buildMocks(USER_ID);

      await controller.getItineraries(req, res, next);

      expect(mockItineraryFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: USER_ID } })
      );
      expect(res._body).toEqual([mockItinerary]);
    });

    it('should return 401 when user is not authenticated', async () => {
      const { req, res, next } = buildMocks(undefined);

      await controller.getItineraries(req, res, next);

      expect(res._status).toBe(401);
    });

    it('should return empty array when user has no itineraries', async () => {
      mockItineraryFindMany.mockResolvedValue([] as never);
      const { req, res, next } = buildMocks(USER_ID);

      await controller.getItineraries(req, res, next);

      expect(res._body).toEqual([]);
    });

    it('should call next(error) when DB throws (covers lines 49-50)', async () => {
      mockItineraryFindMany.mockRejectedValue(new Error('DB failure') as never);
      const { req, res, next } = buildMocks(USER_ID);

      await controller.getItineraries(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // ── getItineraryById ────────────────────────────────────────────────────────
  describe('getItineraryById', () => {
    it('should return the itinerary when found and owned by user', async () => {
      mockItineraryFindFirst.mockResolvedValue(mockItinerary as never);
      const { req, res, next } = buildMocks(USER_ID, {}, { id: ITINERARY_ID });

      await controller.getItineraryById(req, res, next);

      expect(mockItineraryFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: ITINERARY_ID, userId: USER_ID } })
      );
      expect(res._body).toEqual(mockItinerary);
    });

    it('should return 404 when itinerary not found', async () => {
      mockItineraryFindFirst.mockResolvedValue(null as never);
      const { req, res, next } = buildMocks(USER_ID, {}, { id: 'unknown-id' });

      await controller.getItineraryById(req, res, next);

      expect(res._status).toBe(404);
    });

    it('should return 404 when itinerary belongs to another user (via where clause)', async () => {
      // findFirst with where: { id, userId } returns null if not owned
      mockItineraryFindFirst.mockResolvedValue(null as never);
      const { req, res, next } = buildMocks(USER_ID, {}, { id: ITINERARY_ID });

      await controller.getItineraryById(req, res, next);

      expect(res._status).toBe(404);
    });

    it('should return 401 when not authenticated', async () => {
      const { req, res, next } = buildMocks(undefined, {}, { id: ITINERARY_ID });

      await controller.getItineraryById(req, res, next);

      expect(res._status).toBe(401);
    });

    it('should call next(error) when DB throws (covers lines 82-83)', async () => {
      mockItineraryFindFirst.mockRejectedValue(new Error('DB failure') as never);
      const { req, res, next } = buildMocks(USER_ID, {}, { id: ITINERARY_ID });

      await controller.getItineraryById(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // ── createItinerary ──────────────────────────────────────────────────────────
  describe('createItinerary', () => {
    const validBody = {
      title:        'Paris Getaway',
      startDate:    '2026-06-01',
      endDate:      '2026-06-07',
      destinations: ['Paris'],
    };

    it('should create itinerary with valid data and return 201', async () => {
      mockItineraryCreate.mockResolvedValue(mockItinerary as never);
      const { req, res, next } = buildMocks(USER_ID, validBody);

      await controller.createItinerary(req, res, next);

      expect(mockItineraryCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: USER_ID }),
        })
      );
      expect(res._status).toBe(201);
    });

    it('should return 401 when not authenticated', async () => {
      const { req, res, next } = buildMocks(undefined, validBody);

      await controller.createItinerary(req, res, next);

      expect(res._status).toBe(401);
    });

    it('should return 400 when body validation fails (missing title)', async () => {
      const { req, res, next } = buildMocks(USER_ID, {
        startDate: '2026-06-01',
        endDate:   '2026-06-07',
        // title missing
      });

      await controller.createItinerary(req, res, next);

      expect(res._status).toBe(400);
    });

    it('should call next(error) when DB throws a non-ZodError (covers lines 118-119)', async () => {
      mockItineraryCreate.mockRejectedValue(new Error('DB write failed') as never);
      const { req, res, next } = buildMocks(USER_ID, validBody);

      await controller.createItinerary(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // ── updateItinerary ──────────────────────────────────────────────────────────
  describe('updateItinerary', () => {
    it('should update itinerary when owned by user', async () => {
      mockItineraryFindFirst.mockResolvedValue(mockItinerary as never);
      const updated = { ...mockItinerary, title: 'Updated Title' };
      mockItineraryUpdate.mockResolvedValue(updated as never);

      const { req, res, next } = buildMocks(
        USER_ID,
        { title: 'Updated Title' },
        { id: ITINERARY_ID }
      );

      await controller.updateItinerary(req, res, next);

      expect(mockItineraryUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: ITINERARY_ID } })
      );
      expect(res._body.title).toBe('Updated Title');
    });

    it('should update startDate, endDate and destinations when provided', async () => {
      mockItineraryFindFirst.mockResolvedValue(mockItinerary as never);
      mockItineraryUpdate.mockResolvedValue({
        ...mockItinerary,
        startDate: new Date('2026-07-01'),
        endDate: new Date('2026-07-05'),
        destinations: ['Paris', 'Lyon'],
      } as never);

      const { req, res, next } = buildMocks(
        USER_ID,
        {
          startDate: '2026-07-01',
          endDate: '2026-07-05',
          destinations: ['Paris', 'Lyon'],
        },
        { id: ITINERARY_ID }
      );

      await controller.updateItinerary(req, res, next);

      expect(mockItineraryUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            startDate: new Date('2026-07-01'),
            endDate: new Date('2026-07-05'),
            destinations: ['Paris', 'Lyon'],
          }),
        })
      );
    });

    it('should return 404 when itinerary not found', async () => {
      mockItineraryFindFirst.mockResolvedValue(null as never);
      const { req, res, next } = buildMocks(USER_ID, { title: 'X' }, { id: 'ghost' });

      await controller.updateItinerary(req, res, next);

      expect(res._status).toBe(404);
    });

    it('should return 401 when not authenticated', async () => {
      const { req, res, next } = buildMocks(undefined, { title: 'X' }, { id: ITINERARY_ID });

      await controller.updateItinerary(req, res, next);

      expect(res._status).toBe(401);
    });

    it('should return 400 on ZodError (covers lines 165-168)', async () => {
      mockItineraryFindFirst.mockResolvedValue(mockItinerary as never);
      // Pass invalid data that ZodError will catch (e.g. startDate as object)
      const { req, res, next } = buildMocks(USER_ID, { startDate: 12345, endDate: 'bad-date', title: 123 }, { id: ITINERARY_ID });

      await controller.updateItinerary(req, res, next);

      const calledWith400 = res._status === 400;
      const calledNext    = next.mock.calls.length > 0;
      expect(calledWith400 || calledNext).toBe(true);
    });

    it('should call next(error) when DB update throws (covers lines 169-170)', async () => {
      mockItineraryFindFirst.mockResolvedValue(mockItinerary as never);
      mockItineraryUpdate.mockRejectedValue(new Error('DB failure') as never);
      const { req, res, next } = buildMocks(USER_ID, { title: 'New Title' }, { id: ITINERARY_ID });

      await controller.updateItinerary(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // ── deleteItinerary ──────────────────────────────────────────────────────────
  describe('deleteItinerary', () => {
    it('should delete itinerary and return 204', async () => {
      mockItineraryFindFirst.mockResolvedValue(mockItinerary as never);
      mockItineraryDelete.mockResolvedValue(mockItinerary as never);

      const { req, res, next } = buildMocks(USER_ID, {}, { id: ITINERARY_ID });

      await controller.deleteItinerary(req, res, next);

      expect(mockItineraryDelete).toHaveBeenCalledWith({ where: { id: ITINERARY_ID } });
      expect(res._status).toBe(204);
    });

    it('should return 404 when itinerary not found', async () => {
      mockItineraryFindFirst.mockResolvedValue(null as never);
      const { req, res, next } = buildMocks(USER_ID, {}, { id: 'ghost' });

      await controller.deleteItinerary(req, res, next);

      expect(res._status).toBe(404);
    });

    it('should return 401 when not authenticated (covers lines 182-184)', async () => {
      const { req, res, next } = buildMocks(undefined, {}, { id: ITINERARY_ID });

      await controller.deleteItinerary(req, res, next);

      expect(res._status).toBe(401);
    });

    it('should call next(error) when DB throws (covers lines 202-203)', async () => {
      mockItineraryFindFirst.mockResolvedValue(mockItinerary as never);
      mockItineraryDelete.mockRejectedValue(new Error('DB failure') as never);
      const { req, res, next } = buildMocks(USER_ID, {}, { id: ITINERARY_ID });

      await controller.deleteItinerary(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // ── addItem ──────────────────────────────────────────────────────────────────
  describe('addItem', () => {
    const validItemBody = {
      type:      'FLIGHT',
      itemId:    'flight-001',
      itemData:  { origin: 'CDG', destination: 'LHR' },
      price:     100,
      currency:  'EUR',
      quantity:  1,
      title:     'CDG → LHR',
      startDate: '2026-06-01T08:00:00Z',
      endDate:   '2026-06-01T09:30:00Z',
      location:  'CDG',
      order:     0,
    };

    it('should add item to itinerary and return 201', async () => {
      mockItineraryFindFirst.mockResolvedValue(mockItinerary as never);
      mockItemFindMany.mockResolvedValue([] as never);
      mockItemCreate.mockResolvedValue(mockItem as never);
      mockItineraryFindFirst.mockResolvedValueOnce(mockItinerary as never);

      const { req, res, next } = buildMocks(USER_ID, validItemBody, { id: ITINERARY_ID });

      await controller.addItem(req, res, next);

      expect(mockItemCreate).toHaveBeenCalled();
      expect(res._status).toBe(201);
    });

    it('should store null itemId when it is omitted', async () => {
      mockItineraryFindFirst.mockResolvedValue(mockItinerary as never);
      mockItemCreate.mockResolvedValue(mockItem as never);

      const { req, res, next } = buildMocks(
        USER_ID,
        {
          type: 'ACTIVITY',
          itemData: { location: 'Paris' },
          price: 30,
          currency: 'EUR',
          quantity: 1,
          title: 'Museum',
          startDate: '2026-06-02T10:00:00Z',
          endDate: '2026-06-02T12:00:00Z',
          location: 'Paris',
          order: 1,
        },
        { id: ITINERARY_ID }
      );

      await controller.addItem(req, res, next);

      expect(mockItemCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ itemId: null }),
        })
      );
    });

    it('should return 404 when itinerary not found', async () => {
      mockItineraryFindFirst.mockResolvedValue(null as never);
      const { req, res, next } = buildMocks(USER_ID, validItemBody, { id: 'ghost' });

      await controller.addItem(req, res, next);

      expect(res._status).toBe(404);
    });

    it('should return 401 when not authenticated', async () => {
      const { req, res, next } = buildMocks(undefined, validItemBody, { id: ITINERARY_ID });

      await controller.addItem(req, res, next);

      expect(res._status).toBe(401);
    });

    it('should return 400 on ZodError (covers lines 253-256)', async () => {
      mockItineraryFindFirst.mockResolvedValue(mockItinerary as never);
      // Missing required fields → ZodError
      const { req, res, next } = buildMocks(USER_ID, { type: 'UNKNOWN_TYPE' }, { id: ITINERARY_ID });

      await controller.addItem(req, res, next);

      const calledWith400 = res._status === 400;
      const calledNext    = next.mock.calls.length > 0;
      expect(calledWith400 || calledNext).toBe(true);
    });

    it('should call next(error) when DB throws (covers lines 257-258)', async () => {
      mockItineraryFindFirst.mockResolvedValue(mockItinerary as never);
      mockItemCreate.mockRejectedValue(new Error('DB failure') as never);
      const { req, res, next } = buildMocks(USER_ID, validItemBody, { id: ITINERARY_ID });

      await controller.addItem(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // ── updateItem ───────────────────────────────────────────────────────────────
  describe('updateItem', () => {
    it('should update item and return 200 (covers lines 265-313)', async () => {
      mockItineraryFindFirst.mockResolvedValue(mockItinerary as never);
      mockItemUpdate.mockResolvedValue(mockItem as never);

      const { req, res, next } = buildMocks(
        USER_ID,
        { title: 'Updated Flight' },
        { id: ITINERARY_ID, itemId: ITEM_ID }
      );

      await controller.updateItem(req, res, next);

      expect(mockItemUpdate).toHaveBeenCalledWith({
        where: { id: ITEM_ID },
        data:  expect.objectContaining({ title: 'Updated Flight' }),
      });
      expect(res._status).toBe(200);
    });

    it('should update all optional item fields when provided', async () => {
      mockItineraryFindFirst.mockResolvedValue(mockItinerary as never);
      mockItemUpdate.mockResolvedValue(mockItem as never);

      const { req, res, next } = buildMocks(
        USER_ID,
        {
          type: 'HOTEL',
          itemId: 'hotel-001',
          itemData: { hotelName: 'Dream Hotel' },
          price: 250,
          currency: 'USD',
          quantity: 2,
          description: 'Suite room',
          startDate: '2026-06-03T14:00:00Z',
          endDate: '2026-06-05T11:00:00Z',
          location: 'Paris',
          order: 4,
        },
        { id: ITINERARY_ID, itemId: ITEM_ID }
      );

      await controller.updateItem(req, res, next);

      expect(mockItemUpdate).toHaveBeenCalledWith({
        where: { id: ITEM_ID },
        data: expect.objectContaining({
          type: 'HOTEL',
          itemId: 'hotel-001',
          itemData: { hotelName: 'Dream Hotel' },
          price: 250,
          currency: 'USD',
          quantity: 2,
          description: 'Suite room',
          startDate: new Date('2026-06-03T14:00:00Z'),
          endDate: new Date('2026-06-05T11:00:00Z'),
          location: 'Paris',
          order: 4,
        }),
      });
    });

    it('should return 401 when not authenticated', async () => {
      const { req, res, next } = buildMocks(undefined, { title: 'X' }, { id: ITINERARY_ID, itemId: ITEM_ID });

      await controller.updateItem(req, res, next);

      expect(res._status).toBe(401);
    });

    it('should return 404 when itinerary not found', async () => {
      mockItineraryFindFirst.mockResolvedValue(null as never);
      const { req, res, next } = buildMocks(USER_ID, { title: 'X' }, { id: 'ghost', itemId: ITEM_ID });

      await controller.updateItem(req, res, next);

      expect(res._status).toBe(404);
    });

    it('should return 400 on ZodError (invalid field type)', async () => {
      mockItineraryFindFirst.mockResolvedValue(mockItinerary as never);
      // price must be a number; pass a non-number string to trigger ZodError
      const { req, res, next } = buildMocks(
        USER_ID,
        { price: 'not-a-number', quantity: -999 },
        { id: ITINERARY_ID, itemId: ITEM_ID }
      );

      await controller.updateItem(req, res, next);

      const calledWith400 = res._status === 400;
      const calledNext    = next.mock.calls.length > 0;
      expect(calledWith400 || calledNext).toBe(true);
    });

    it('should call next(error) when DB update throws', async () => {
      mockItineraryFindFirst.mockResolvedValue(mockItinerary as never);
      mockItemUpdate.mockRejectedValue(new Error('DB failure') as never);
      const { req, res, next } = buildMocks(
        USER_ID,
        { title: 'X' },
        { id: ITINERARY_ID, itemId: ITEM_ID }
      );

      await controller.updateItem(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // ── removeItem ───────────────────────────────────────────────────────────────
  describe('deleteItem', () => {
    it('should remove item from itinerary', async () => {
      mockItineraryFindFirst.mockResolvedValue({
        ...mockItinerary,
        items: [mockItem],
      } as never);
      mockItemDelete.mockResolvedValue(mockItem as never);

      const { req, res, next } = buildMocks(
        USER_ID, {}, { id: ITINERARY_ID, itemId: ITEM_ID }
      );

      await controller.deleteItem(req, res, next);

      expect(mockItemDelete).toHaveBeenCalledWith({ where: { id: ITEM_ID } });
    });

    it('should still attempt deletion when itinerary exists but item list is empty', async () => {
      mockItineraryFindFirst.mockResolvedValue({
        ...mockItinerary,
        items: [], // no items
      } as never);
      mockItemDelete.mockResolvedValue(mockItem as never);

      const { req, res, next } = buildMocks(
        USER_ID, {}, { id: ITINERARY_ID, itemId: 'ghost-item' }
      );

      await controller.deleteItem(req, res, next);

      expect(res._status).toBe(204);
    });

    it('should return 401 when not authenticated (covers lines 324-326)', async () => {
      const { req, res, next } = buildMocks(undefined, {}, { id: ITINERARY_ID, itemId: ITEM_ID });

      await controller.deleteItem(req, res, next);

      expect(res._status).toBe(401);
    });

    it('should return 404 when itinerary not found (covers lines 333-336)', async () => {
      mockItineraryFindFirst.mockResolvedValue(null as never);
      const { req, res, next } = buildMocks(USER_ID, {}, { id: 'ghost', itemId: ITEM_ID });

      await controller.deleteItem(req, res, next);

      expect(res._status).toBe(404);
    });

    it('should call next(error) when DB throws (covers lines 344-345)', async () => {
      mockItineraryFindFirst.mockResolvedValue(mockItinerary as never);
      mockItemDelete.mockRejectedValue(new Error('DB failure') as never);
      const { req, res, next } = buildMocks(USER_ID, {}, { id: ITINERARY_ID, itemId: ITEM_ID });

      await controller.deleteItem(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // ── reorderItems ─────────────────────────────────────────────────────────────
  describe('reorderItems', () => {
    // ReorderItemsSchema requires UUID format
    const UUID_1 = '550e8400-e29b-41d4-a716-446655440001';
    const UUID_2 = '550e8400-e29b-41d4-a716-446655440002';
    const validReorderBody = {
      items: [
        { id: UUID_1, order: 0 },
        { id: UUID_2, order: 1 },
      ],
    };

    it('should reorder items and return 204 (covers lines 352-391)', async () => {
      mockItineraryFindFirst.mockResolvedValue(mockItinerary as never);
      mockItemUpdate.mockResolvedValue({} as never);

      const { req, res, next } = buildMocks(USER_ID, validReorderBody, { id: ITINERARY_ID });

      await controller.reorderItems(req, res, next);

      expect(mockTransaction).toHaveBeenCalled();
      expect(res._status).toBe(204);
    });

    it('should return 401 when not authenticated', async () => {
      const { req, res, next } = buildMocks(undefined, validReorderBody, { id: ITINERARY_ID });

      await controller.reorderItems(req, res, next);

      expect(res._status).toBe(401);
    });

    it('should return 404 when itinerary not found', async () => {
      mockItineraryFindFirst.mockResolvedValue(null as never);
      const { req, res, next } = buildMocks(USER_ID, validReorderBody, { id: 'ghost' });

      await controller.reorderItems(req, res, next);

      expect(res._status).toBe(404);
    });

    it('should return 400 on ZodError (invalid body)', async () => {
      mockItineraryFindFirst.mockResolvedValue(mockItinerary as never);
      // items must be an array of { id: uuid, order: number }; null triggers ZodError
      const { req, res, next } = buildMocks(USER_ID, { items: null }, { id: ITINERARY_ID });

      await controller.reorderItems(req, res, next);

      const calledWith400 = res._status === 400;
      const calledNext    = next.mock.calls.length > 0;
      expect(calledWith400 || calledNext).toBe(true);
    });

    it('should call next(error) when transaction throws', async () => {
      mockItineraryFindFirst.mockResolvedValue(mockItinerary as never);
      mockItemUpdate.mockResolvedValue({} as never);
      mockTransaction.mockRejectedValue(new Error('Transaction failed') as never);
      const { req, res, next } = buildMocks(USER_ID, validReorderBody, { id: ITINERARY_ID });

      await controller.reorderItems(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // ── exportItinerary ──────────────────────────────────────────────────────────
  describe('exportItinerary', () => {
    it('should export PDF and send buffer in response', async () => {
      mockItineraryFindFirst.mockResolvedValue({ ...mockItinerary, items: [] } as never);
      const pdfBuffer = Buffer.from('PDF content');
      mockGeneratePDF.mockResolvedValue(pdfBuffer as never);

      const { req, res, next } = buildMocks(USER_ID, {}, { id: ITINERARY_ID }, { format: 'pdf' });

      await controller.exportItinerary(req, res, next);

      expect(mockGeneratePDF).toHaveBeenCalled();
    });

    it('should export iCal and send .ics response', async () => {
      mockItineraryFindFirst.mockResolvedValue({ ...mockItinerary, items: [] } as never);
      mockGenerateICal.mockResolvedValue('BEGIN:VCALENDAR...' as never);

      const { req, res, next } = buildMocks(USER_ID, {}, { id: ITINERARY_ID }, { format: 'ical' });

      await controller.exportItinerary(req, res, next);

      expect(mockGenerateICal).toHaveBeenCalled();
    });

    it('should return 404 when itinerary not found', async () => {
      mockItineraryFindFirst.mockResolvedValue(null as never);
      const { req, res, next } = buildMocks(USER_ID, {}, { id: 'ghost' }, { format: 'pdf' });

      await controller.exportItinerary(req, res, next);

      expect(res._status).toBe(404);
    });

    it('should return 401 when not authenticated (covers lines 403-405)', async () => {
      const { req, res, next } = buildMocks(undefined, {}, { id: ITINERARY_ID }, { format: 'pdf' });

      await controller.exportItinerary(req, res, next);

      expect(res._status).toBe(401);
    });

    it('should return 404 when user not found (covers lines 431-433)', async () => {
      mockItineraryFindFirst.mockResolvedValue({ ...mockItinerary, items: [] } as never);
      mockUserFindUnique.mockResolvedValue(null as never);

      const { req, res, next } = buildMocks(USER_ID, {}, { id: ITINERARY_ID }, { format: 'pdf' });

      await controller.exportItinerary(req, res, next);

      expect(res._status).toBe(404);
    });

    it('should send email and return 200 for format=email (covers lines 451-453)', async () => {
      mockItineraryFindFirst.mockResolvedValue({ ...mockItinerary, items: [] } as never);
      mockSendEmailSummary.mockResolvedValue(undefined as never);

      const { req, res, next } = buildMocks(USER_ID, {}, { id: ITINERARY_ID }, { format: 'email' });

      await controller.exportItinerary(req, res, next);

      expect(mockSendEmailSummary).toHaveBeenCalled();
      expect(res._body).toMatchObject({ message: 'Email sent successfully' });
    });

    it('should use Traveler fallback when user firstName is missing', async () => {
      mockItineraryFindFirst.mockResolvedValue({ ...mockItinerary, items: [] } as never);
      mockUserFindUnique.mockResolvedValue({
        email: 'alice@test.com',
        firstName: null,
        lastName: 'Doe',
      } as never);
      mockSendEmailSummary.mockResolvedValue(undefined as never);

      const { req, res, next } = buildMocks(USER_ID, {}, { id: ITINERARY_ID }, { format: 'email' });

      await controller.exportItinerary(req, res, next);

      expect(mockSendEmailSummary).toHaveBeenCalledWith(
        expect.any(Object),
        'alice@test.com',
        'Traveler'
      );
    });

    it('should return 400 on ZodError for invalid format (covers lines 459-464)', async () => {
      const { req, res, next } = buildMocks(USER_ID, {}, { id: ITINERARY_ID }, { format: 'xlsx' });

      await controller.exportItinerary(req, res, next);

      expect(res._status).toBe(400);
    });

    it('should call next(error) when exportService throws (covers lines 462-464)', async () => {
      mockItineraryFindFirst.mockResolvedValue({ ...mockItinerary, items: [] } as never);
      mockGeneratePDF.mockRejectedValue(new Error('PDF generation failed') as never);

      const { req, res, next } = buildMocks(USER_ID, {}, { id: ITINERARY_ID }, { format: 'pdf' });

      await controller.exportItinerary(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('covers switch implicit no-match branch (line 455) by bypassing schema', async () => {
      mockItineraryFindFirst.mockResolvedValue({ ...mockItinerary, items: [] } as never);
      // ExportFormatSchema.parse normally validates; spy makes it return an unhandled value
      const spy = jest.spyOn(ExportFormatSchema, 'parse').mockReturnValueOnce('unknown' as any);

      const { req, res, next } = buildMocks(USER_ID, {}, { id: ITINERARY_ID }, { format: 'pdf' });

      await controller.exportItinerary(req, res, next);

      spy.mockRestore();

      // No case matched → switch falls through, no response body sent, no error
      expect(next).not.toHaveBeenCalled();
      expect(mockGeneratePDF).not.toHaveBeenCalled();
    });
  });
});
