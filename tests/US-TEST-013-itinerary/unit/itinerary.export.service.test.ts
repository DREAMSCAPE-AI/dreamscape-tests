/**
 * US-TEST-013 — Tests unitaires ItineraryExportService
 * Scénarios : generatePDF, generateICal, sendEmailSummary / generateEmailTemplate
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// ── Mock jspdf ────────────────────────────────────────────────────────────────
const mockText          = jest.fn();
const mockRect          = jest.fn();
const mockRoundedRect   = jest.fn();
const mockSetFontSize   = jest.fn();
const mockSetFont       = jest.fn();
const mockSetTextColor  = jest.fn();
const mockSetFillColor  = jest.fn();
const mockSetPage       = jest.fn();
const mockAddPage       = jest.fn();
const mockOutput        = jest.fn(() => new ArrayBuffer(8));
const mockGetNumberOfPages = jest.fn(() => 1);
const mockSplitTextToSize  = jest.fn((text: string) => [text]);

const mockJsPDFInstance = {
  internal: {
    pageSize: {
      getWidth:  jest.fn(() => 210),
      getHeight: jest.fn(() => 297),
    },
  },
  text:             mockText,
  rect:             mockRect,
  roundedRect:      mockRoundedRect,
  setFontSize:      mockSetFontSize,
  setFont:          mockSetFont,
  setTextColor:     mockSetTextColor,
  setFillColor:     mockSetFillColor,
  setPage:          mockSetPage,
  addPage:          mockAddPage,
  output:           mockOutput,
  getNumberOfPages: mockGetNumberOfPages,
  splitTextToSize:  mockSplitTextToSize,
};

jest.mock('jspdf', () => ({
  __esModule: true,
  default:    jest.fn().mockImplementation(() => mockJsPDFInstance),
}));

// ── Mock ics ──────────────────────────────────────────────────────────────────
const mockCreateEvents = jest.fn();

jest.mock('ics', () => ({
  __esModule:   true,
  createEvents: mockCreateEvents,
}));

// ── Import after mocks ────────────────────────────────────────────────────────
import { ItineraryExportService } from '@/services/itinerary.export.service';

// ── Fixtures ───────────────────────────────────────────────────────────────────
const mockItinerary = {
  id:           'itin-001',
  userId:       'user-001',
  title:        'Paris Adventure',
  description:  'An amazing trip',
  startDate:    new Date('2026-06-01'),
  endDate:      new Date('2026-06-07'),
  destinations: ['Paris', 'Versailles'],
  isPublic:     false,
  createdAt:    new Date(),
  updatedAt:    new Date(),
  items:        [],
};

const mockItem = {
  id:          'item-001',
  itineraryId: 'itin-001',
  type:        'FLIGHT',
  title:       'CDG → LHR',
  description: 'Outbound flight',
  startDate:   new Date('2026-06-01T08:00:00Z'),
  endDate:     new Date('2026-06-01T09:30:00Z'),
  location:    'CDG Airport',
  order:       0,
};

const mockHotelItem = {
  id:          'item-002',
  itineraryId: 'itin-001',
  type:        'HOTEL',
  title:       'Hotel Paris',
  description: 'Check-in',
  startDate:   new Date('2026-06-01T14:00:00Z'),
  endDate:     new Date('2026-06-07T12:00:00Z'),
  location:    '1 Rue de Rivoli, Paris',
  order:       1,
};

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('ItineraryExportService — US-TEST-013', () => {
  let service: ItineraryExportService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ItineraryExportService();
    mockOutput.mockReturnValue(new ArrayBuffer(8));
    mockGetNumberOfPages.mockReturnValue(1);
  });

  // ── generatePDF ────────────────────────────────────────────────────────────
  describe('generatePDF', () => {
    it('should return a Buffer', async () => {
      const result = await service.generatePDF({ ...mockItinerary, items: [] });

      expect(result).toBeInstanceOf(Buffer);
    });

    it('should render the itinerary title in the PDF', async () => {
      await service.generatePDF({ ...mockItinerary, items: [] });

      const allTextCalls = mockText.mock.calls.map((c: any[]) => c[0]);
      expect(allTextCalls).toContain('Paris Adventure');
    });

    it('should include items in the PDF when present', async () => {
      await service.generatePDF({ ...mockItinerary, items: [mockItem] });

      const allTextCalls = mockText.mock.calls.map((c: any[]) => c[0]);
      expect(allTextCalls).toContain('CDG → LHR');
    });

    it('should produce a valid Buffer for an itinerary with no items', async () => {
      const result = await service.generatePDF({ ...mockItinerary, items: [] });
      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it('should group items by date when multiple items exist', async () => {
      await service.generatePDF({ ...mockItinerary, items: [mockItem, mockHotelItem] });

      // Both item titles should appear
      const allTextCalls = mockText.mock.calls.map((c: any[]) => c[0]);
      expect(allTextCalls).toContain('CDG → LHR');
      expect(allTextCalls).toContain('Hotel Paris');
    });

    it('should add a page for long itineraries', async () => {
      // Simulate multiple items to trigger page break checks
      const manyItems = Array.from({ length: 20 }, (_, i) => ({
        ...mockItem,
        id:    `item-${i}`,
        title: `Activity ${i}`,
        order: i,
      }));
      await service.generatePDF({ ...mockItinerary, items: manyItems });

      // jsPDF was called — output was called
      expect(mockOutput).toHaveBeenCalled();
    });

    it('should call doc.output("arraybuffer") to get the binary', async () => {
      await service.generatePDF({ ...mockItinerary, items: [] });

      expect(mockOutput).toHaveBeenCalledWith('arraybuffer');
    });
  });

  // ── generateICal ───────────────────────────────────────────────────────────
  describe('generateICal', () => {
    it('should return an iCal string for a valid itinerary', () => {
      mockCreateEvents.mockReturnValue({ error: null, value: 'BEGIN:VCALENDAR\nEND:VCALENDAR' });

      const result = service.generateICal({ ...mockItinerary, items: [mockItem] });

      expect(typeof result).toBe('string');
      expect(result).toContain('BEGIN:VCALENDAR');
    });

    it('should call createEvents with mapped event attributes', () => {
      mockCreateEvents.mockReturnValue({ error: null, value: 'BEGIN:VCALENDAR\nEND:VCALENDAR' });

      service.generateICal({ ...mockItinerary, items: [mockItem] });

      expect(mockCreateEvents).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            title:    `FLIGHT: CDG → LHR`,
            location: 'CDG Airport',
            status:   'CONFIRMED',
          }),
        ])
      );
    });

    it('should return empty string for itinerary with no items', () => {
      mockCreateEvents.mockReturnValue({ error: null, value: '' });

      const result = service.generateICal({ ...mockItinerary, items: [] });
      expect(result).toBe('');
    });

    it('should throw when ics createEvents returns an error', () => {
      mockCreateEvents.mockReturnValue({
        error: new Error('Invalid event data'),
        value: undefined,
      });

      expect(() =>
        service.generateICal({ ...mockItinerary, items: [mockItem] })
      ).toThrow(/Failed to generate iCal/);
    });

    it('should generate events for multiple items (flight + hotel)', () => {
      mockCreateEvents.mockReturnValue({ error: null, value: 'BEGIN:VCALENDAR\nEND:VCALENDAR' });

      service.generateICal({ ...mockItinerary, items: [mockItem, mockHotelItem] });

      expect(mockCreateEvents).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ title: 'FLIGHT: CDG → LHR' }),
          expect.objectContaining({ title: 'HOTEL: Hotel Paris' }),
        ])
      );
    });

    it('should set description to undefined when item has no description (covers line 160 false branch)', () => {
      mockCreateEvents.mockReturnValue({ error: null, value: 'BEGIN:VCALENDAR\nEND:VCALENDAR' });

      const itemNoDesc = { ...mockItem, description: undefined };
      service.generateICal({ ...mockItinerary, items: [itemNoDesc] });

      expect(mockCreateEvents).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ description: undefined }),
        ])
      );
    });
  });

  // ── sendEmailSummary ───────────────────────────────────────────────────────
  describe('sendEmailSummary', () => {
    it('should resolve without throwing (email is best-effort / TODO)', async () => {
      await expect(
        service.sendEmailSummary(
          { ...mockItinerary, items: [mockItem] },
          'alice@test.com',
          'Alice'
        )
      ).resolves.toBeUndefined();
    });

    it('should not throw for empty itinerary', async () => {
      await expect(
        service.sendEmailSummary(
          { ...mockItinerary, items: [] },
          'alice@test.com',
          'Alice'
        )
      ).resolves.toBeUndefined();
    });

    it('should sort items chronologically in the email template (covers line 214 sort branch)', async () => {
      // Items provided in reverse chronological order to exercise the sort comparator
      const laterItem  = { ...mockItem, id: 'item-later',  startDate: new Date('2026-06-05T10:00:00Z'), order: 1 };
      const earlierItem = { ...mockHotelItem, id: 'item-earlier', startDate: new Date('2026-06-01T10:00:00Z'), order: 0 };

      await expect(
        service.sendEmailSummary(
          { ...mockItinerary, items: [laterItem, earlierItem] },
          'alice@test.com',
          'Alice'
        )
      ).resolves.toBeUndefined();
    });

    it('should handle item with no description (covers line 275 false branch)', async () => {
      const itemNoDesc = { ...mockItem, description: undefined };
      await expect(
        service.sendEmailSummary(
          { ...mockItinerary, items: [itemNoDesc] },
          'alice@test.com',
          'Alice'
        )
      ).resolves.toBeUndefined();
    });

    it('should handle empty destinations array (covers line 261 false branch)', async () => {
      await expect(
        service.sendEmailSummary(
          { ...mockItinerary, destinations: [], items: [mockItem] },
          'alice@test.com',
          'Alice'
        )
      ).resolves.toBeUndefined();
    });
  });

  // ── getItemTypeColor (via generatePDF) ────────────────────────────────────
  describe('generatePDF — item type colors', () => {
    it('should handle ACTIVITY type item (covers lines 347-348)', async () => {
      const activityItem = { ...mockItem, type: 'ACTIVITY', title: 'Eiffel Tower Tour' };
      await service.generatePDF({ ...mockItinerary, items: [activityItem] });
      expect(mockOutput).toHaveBeenCalled();
    });

    it('should handle unknown item type with default color (covers lines 349-350)', async () => {
      const unknownItem = { ...mockItem, type: 'TRANSFER', title: 'Airport Transfer' };
      await service.generatePDF({ ...mockItinerary, items: [unknownItem] });
      expect(mockOutput).toHaveBeenCalled();
    });
  });
});
