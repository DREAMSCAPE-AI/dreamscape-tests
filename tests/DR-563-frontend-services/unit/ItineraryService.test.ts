/**
 * DR-563 — US-TEST-026
 * Tests unitaires : ItineraryService (services/voyage/ItineraryService)
 *
 * Importe le vrai service — import.meta.env transformé par vite-meta-transform.
 *
 * @jest-environment jsdom
 * @ticket DR-563
 */

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPut = jest.fn();
const mockDelete = jest.fn();
const mockPatch = jest.fn();

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    create: jest.fn(() => ({
      get: mockGet,
      post: mockPost,
      put: mockPut,
      delete: mockDelete,
      patch: mockPatch,
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    })),
  },
}));

process.env.VITE_VOYAGE_SERVICE_URL = 'http://localhost:3003';

import itineraryService from '@/services/voyage/ItineraryService';

// ── Fixtures ────────────────────────────────────────────────────────────────

const mockItinerary = { id: 'it-1', title: 'Paris Trip', items: [], userId: 'user-1' };
const mockItem = { id: 'item-1', itineraryId: 'it-1', type: 'FLIGHT', order: 0 };

// ─────────────────────────────────────────────────────────────────────────────

describe('ItineraryService', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── CRUD Itineraries ──────────────────────────────────────────────────────
  describe('getItineraries', () => {
    it('calls GET /itineraries and returns array', async () => {
      mockGet.mockResolvedValue({ data: [mockItinerary] });
      const result = await itineraryService.getItineraries();
      expect(mockGet).toHaveBeenCalledWith('/itineraries');
      expect(result).toHaveLength(1);
    });
  });

  describe('getItineraryById', () => {
    it('calls GET /itineraries/:id', async () => {
      mockGet.mockResolvedValue({ data: mockItinerary });
      const result = await itineraryService.getItineraryById('it-1');
      expect(mockGet).toHaveBeenCalledWith('/itineraries/it-1');
      expect(result.id).toBe('it-1');
    });

    it('propagates 404 errors', async () => {
      mockGet.mockRejectedValue(new Error('404 Not Found'));
      await expect(itineraryService.getItineraryById('non-existent')).rejects.toThrow('404 Not Found');
    });
  });

  describe('createItinerary', () => {
    it('calls POST /itineraries with DTO and returns new itinerary', async () => {
      const dto = { title: 'New Trip', startDate: '2026-07-01', endDate: '2026-07-10' };
      mockPost.mockResolvedValue({ data: { ...mockItinerary, ...dto } });
      const result = await itineraryService.createItinerary(dto as any);
      expect(mockPost).toHaveBeenCalledWith('/itineraries', dto);
      expect(result.title).toBe('New Trip');
    });
  });

  describe('updateItinerary', () => {
    it('calls PUT /itineraries/:id with update DTO', async () => {
      const dto = { title: 'Updated Trip' };
      mockPut.mockResolvedValue({ data: { ...mockItinerary, title: 'Updated Trip' } });
      const result = await itineraryService.updateItinerary('it-1', dto as any);
      expect(mockPut).toHaveBeenCalledWith('/itineraries/it-1', dto);
      expect(result.title).toBe('Updated Trip');
    });
  });

  describe('deleteItinerary', () => {
    it('calls DELETE /itineraries/:id', async () => {
      mockDelete.mockResolvedValue({});
      await itineraryService.deleteItinerary('it-1');
      expect(mockDelete).toHaveBeenCalledWith('/itineraries/it-1');
    });
  });

  // ── Items ─────────────────────────────────────────────────────────────────
  describe('addItem', () => {
    it('calls POST /itineraries/:itineraryId/items', async () => {
      const dto = { type: 'FLIGHT', flightId: 'f1', order: 0 };
      mockPost.mockResolvedValue({ data: mockItem });
      const result = await itineraryService.addItem('it-1', dto as any);
      expect(mockPost).toHaveBeenCalledWith('/itineraries/it-1/items', dto);
      expect(result.id).toBe('item-1');
    });
  });

  describe('updateItem', () => {
    it('calls PUT /itineraries/:itineraryId/items/:itemId', async () => {
      const dto = { notes: 'Window seat' };
      mockPut.mockResolvedValue({ data: { ...mockItem, notes: 'Window seat' } });
      const result = await itineraryService.updateItem('it-1', 'item-1', dto as any);
      expect(mockPut).toHaveBeenCalledWith('/itineraries/it-1/items/item-1', dto);
      expect(result.notes).toBe('Window seat');
    });
  });

  describe('deleteItem', () => {
    it('calls DELETE /itineraries/:itineraryId/items/:itemId', async () => {
      mockDelete.mockResolvedValue({});
      await itineraryService.deleteItem('it-1', 'item-1');
      expect(mockDelete).toHaveBeenCalledWith('/itineraries/it-1/items/item-1');
    });
  });

  describe('reorderItems', () => {
    it('calls PATCH /itineraries/:itineraryId/items/reorder', async () => {
      mockPatch.mockResolvedValue({});
      const dto = { items: [{ id: 'item-1', order: 0 }, { id: 'item-2', order: 1 }] };
      await itineraryService.reorderItems('it-1', dto as any);
      expect(mockPatch).toHaveBeenCalledWith('/itineraries/it-1/items/reorder', dto);
    });
  });

  // ── Export ────────────────────────────────────────────────────────────────
  describe('exportItinerary', () => {
    it('calls GET /itineraries/:id/export?format=pdf with responseType=blob', async () => {
      const blob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
      mockGet.mockResolvedValue({ data: blob });
      const result = await itineraryService.exportItinerary('it-1', 'pdf');
      expect(mockGet).toHaveBeenCalledWith('/itineraries/it-1/export', {
        params: { format: 'pdf' },
        responseType: 'blob',
      });
      expect(result.data).toBeInstanceOf(Blob);
    });

    it('calls GET /itineraries/:id/export?format=ical with responseType=blob', async () => {
      const blob = new Blob(['BEGIN:VCALENDAR'], { type: 'text/calendar' });
      mockGet.mockResolvedValue({ data: blob });
      const result = await itineraryService.exportItinerary('it-1', 'ical');
      expect(result.data).toBeInstanceOf(Blob);
    });

    it('calls GET /itineraries/:id/export?format=email without responseType', async () => {
      mockGet.mockResolvedValue({ data: { message: 'Email sent' } });
      const result = await itineraryService.exportItinerary('it-1', 'email');
      expect(result.message).toBe('Email sent');
    });

    it('throws for invalid export format', async () => {
      await expect(itineraryService.exportItinerary('it-1', 'fax' as any)).rejects.toThrow('Invalid export format');
    });
  });
});
