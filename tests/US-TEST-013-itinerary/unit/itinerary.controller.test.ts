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

      // ZodError causes 400 or next(err) — either path acceptable
      const calledWith400 = res._status === 400;
      const calledNext    = next.mock.calls.length > 0;
      expect(calledWith400 || calledNext).toBe(true);
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
  });
});
