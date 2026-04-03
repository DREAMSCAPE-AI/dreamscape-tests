/**
 * DR-564 — US-TEST-027
 * Tests unitaires : itineraryStore (store/itineraryStore)
 *
 * Scénarios couverts :
 * - fetchItineraries : succès (popule la liste), erreur
 * - fetchItineraryById : succès (set currentItinerary + update liste), erreur
 * - createItinerary : succès (prepend à la liste, set current), erreur re-throw
 * - updateItinerary : met à jour liste + current, erreur
 * - deleteItinerary : retire de la liste, efface current si c'était lui
 * - setCurrentItinerary
 * - addItem / deleteItem (met à jour currentItinerary.items)
 * - exportItinerary : appelle downloadFile pour pdf/ical
 * - clearError / reset
 *
 * @jest-environment jsdom
 * @ticket DR-564
 */

// ── Mock itineraryService ──────────────────────────────────────────────────
const mockGetItineraries = jest.fn();
const mockGetItineraryById = jest.fn();
const mockCreateItinerary = jest.fn();
const mockUpdateItinerary = jest.fn();
const mockDeleteItinerary = jest.fn();
const mockAddItem = jest.fn();
const mockUpdateItem = jest.fn();
const mockDeleteItem = jest.fn();
const mockReorderItems = jest.fn();
const mockExportItinerary = jest.fn();
const mockDownloadFile = jest.fn();

jest.mock('@/services/voyage/ItineraryService', () => ({
  __esModule: true,
  default: {
    getItineraries: mockGetItineraries,
    getItineraryById: mockGetItineraryById,
    createItinerary: mockCreateItinerary,
    updateItinerary: mockUpdateItinerary,
    deleteItinerary: mockDeleteItinerary,
    addItem: mockAddItem,
    updateItem: mockUpdateItem,
    deleteItem: mockDeleteItem,
    reorderItems: mockReorderItems,
    exportItinerary: mockExportItinerary,
    downloadFile: mockDownloadFile,
  },
}));

import { useItineraryStore } from '@/store/itineraryStore';

// ── Helpers ─────────────────────────────────────────────────────────────────

const initialStateOverride = {
  itineraries: [],
  currentItinerary: null,
  isLoading: false,
  isSaving: false,
  isExporting: false,
  error: null,
};

function resetStore() {
  useItineraryStore.setState(initialStateOverride);
}

const mockItinerary = {
  id: 'it-1',
  title: 'Paris Trip',
  userId: 'user-1',
  items: [],
  startDate: '2026-06-01',
  endDate: '2026-06-10',
};

const mockItinerary2 = {
  id: 'it-2',
  title: 'London Trip',
  userId: 'user-1',
  items: [],
};

const mockItem = {
  id: 'item-1',
  itineraryId: 'it-1',
  type: 'FLIGHT',
  order: 0,
};

// ─────────────────────────────────────────────────────────────────────────────

describe('itineraryStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
    localStorage.clear();
  });

  // ── Initial state ──────────────────────────────────────────────────────────
  describe('initial state', () => {
    it('has empty itineraries and null current', () => {
      const s = useItineraryStore.getState();
      expect(s.itineraries).toHaveLength(0);
      expect(s.currentItinerary).toBeNull();
      expect(s.isLoading).toBe(false);
      expect(s.error).toBeNull();
    });
  });

  // ── fetchItineraries ───────────────────────────────────────────────────────
  describe('fetchItineraries', () => {
    it('populates itineraries list on success', async () => {
      mockGetItineraries.mockResolvedValue([mockItinerary, mockItinerary2]);

      await useItineraryStore.getState().fetchItineraries();

      const s = useItineraryStore.getState();
      expect(mockGetItineraries).toHaveBeenCalled();
      expect(s.itineraries).toHaveLength(2);
      expect(s.isLoading).toBe(false);
      expect(s.error).toBeNull();
    });

    it('sets error on failure', async () => {
      mockGetItineraries.mockRejectedValue(new Error('Network Error'));

      await useItineraryStore.getState().fetchItineraries();

      const s = useItineraryStore.getState();
      expect(s.itineraries).toHaveLength(0);
      expect(s.error).toBe('Network Error');
      expect(s.isLoading).toBe(false);
    });
  });

  // ── fetchItineraryById ─────────────────────────────────────────────────────
  describe('fetchItineraryById', () => {
    it('sets currentItinerary on success', async () => {
      mockGetItineraryById.mockResolvedValue(mockItinerary);

      await useItineraryStore.getState().fetchItineraryById('it-1');

      const s = useItineraryStore.getState();
      expect(s.currentItinerary).toEqual(mockItinerary);
      expect(s.isLoading).toBe(false);
    });

    it('updates itinerary in list if it exists', async () => {
      const updatedItinerary = { ...mockItinerary, title: 'Updated Paris Trip' };
      useItineraryStore.setState({ itineraries: [mockItinerary] });
      mockGetItineraryById.mockResolvedValue(updatedItinerary);

      await useItineraryStore.getState().fetchItineraryById('it-1');

      expect(useItineraryStore.getState().itineraries[0].title).toBe('Updated Paris Trip');
    });

    it('sets error on failure', async () => {
      mockGetItineraryById.mockRejectedValue(new Error('404 Not Found'));

      await useItineraryStore.getState().fetchItineraryById('bad-id');

      expect(useItineraryStore.getState().error).toBe('404 Not Found');
    });
  });

  // ── createItinerary ────────────────────────────────────────────────────────
  describe('createItinerary', () => {
    it('prepends to list and sets as current', async () => {
      useItineraryStore.setState({ itineraries: [mockItinerary2] });
      mockCreateItinerary.mockResolvedValue(mockItinerary);

      const result = await useItineraryStore.getState().createItinerary({ title: 'Paris Trip' });

      const s = useItineraryStore.getState();
      expect(result).toEqual(mockItinerary);
      expect(s.itineraries[0]).toEqual(mockItinerary);
      expect(s.itineraries).toHaveLength(2);
      expect(s.currentItinerary).toEqual(mockItinerary);
      expect(s.isSaving).toBe(false);
    });

    it('sets error and re-throws on failure', async () => {
      mockCreateItinerary.mockRejectedValue(new Error('Validation Error'));

      await expect(useItineraryStore.getState().createItinerary({ title: '' })).rejects.toThrow('Validation Error');

      expect(useItineraryStore.getState().error).toBe('Validation Error');
    });
  });

  // ── updateItinerary ────────────────────────────────────────────────────────
  describe('updateItinerary', () => {
    it('updates itinerary in list and current', async () => {
      const updated = { ...mockItinerary, title: 'Updated' };
      useItineraryStore.setState({ itineraries: [mockItinerary], currentItinerary: mockItinerary });
      mockUpdateItinerary.mockResolvedValue(updated);

      await useItineraryStore.getState().updateItinerary('it-1', { title: 'Updated' });

      const s = useItineraryStore.getState();
      expect(s.itineraries[0].title).toBe('Updated');
      expect(s.currentItinerary?.title).toBe('Updated');
    });

    it('does not change current if different itinerary updated', async () => {
      const updated = { ...mockItinerary2, title: 'Updated London' };
      useItineraryStore.setState({ itineraries: [mockItinerary, mockItinerary2], currentItinerary: mockItinerary });
      mockUpdateItinerary.mockResolvedValue(updated);

      await useItineraryStore.getState().updateItinerary('it-2', { title: 'Updated London' });

      expect(useItineraryStore.getState().currentItinerary?.id).toBe('it-1');
    });

    it('re-throws on failure', async () => {
      mockUpdateItinerary.mockRejectedValue(new Error('Server Error'));

      await expect(useItineraryStore.getState().updateItinerary('it-1', {})).rejects.toThrow();
    });
  });

  // ── deleteItinerary ────────────────────────────────────────────────────────
  describe('deleteItinerary', () => {
    it('removes from list', async () => {
      useItineraryStore.setState({ itineraries: [mockItinerary, mockItinerary2] });
      mockDeleteItinerary.mockResolvedValue(undefined);

      await useItineraryStore.getState().deleteItinerary('it-1');

      expect(useItineraryStore.getState().itineraries).toHaveLength(1);
      expect(useItineraryStore.getState().itineraries[0].id).toBe('it-2');
    });

    it('clears currentItinerary if the deleted one was current', async () => {
      useItineraryStore.setState({ itineraries: [mockItinerary], currentItinerary: mockItinerary });
      mockDeleteItinerary.mockResolvedValue(undefined);

      await useItineraryStore.getState().deleteItinerary('it-1');

      expect(useItineraryStore.getState().currentItinerary).toBeNull();
    });

    it('keeps currentItinerary if different one deleted', async () => {
      useItineraryStore.setState({ itineraries: [mockItinerary, mockItinerary2], currentItinerary: mockItinerary2 });
      mockDeleteItinerary.mockResolvedValue(undefined);

      await useItineraryStore.getState().deleteItinerary('it-1');

      expect(useItineraryStore.getState().currentItinerary?.id).toBe('it-2');
    });
  });

  // ── setCurrentItinerary ────────────────────────────────────────────────────
  describe('setCurrentItinerary', () => {
    it('sets and clears currentItinerary', () => {
      useItineraryStore.getState().setCurrentItinerary(mockItinerary);
      expect(useItineraryStore.getState().currentItinerary).toEqual(mockItinerary);

      useItineraryStore.getState().setCurrentItinerary(null);
      expect(useItineraryStore.getState().currentItinerary).toBeNull();
    });
  });

  // ── addItem ────────────────────────────────────────────────────────────────
  describe('addItem', () => {
    it('adds item to currentItinerary when it matches', async () => {
      useItineraryStore.setState({ currentItinerary: { ...mockItinerary, items: [] } });
      mockAddItem.mockResolvedValue(mockItem);
      // fetchItineraryById is called after addItem
      mockGetItineraryById.mockResolvedValue({ ...mockItinerary, items: [mockItem] });

      await useItineraryStore.getState().addItem('it-1', { type: 'FLIGHT', order: 0 });

      expect(mockAddItem).toHaveBeenCalledWith('it-1', { type: 'FLIGHT', order: 0 });
    });

    it('re-throws on failure', async () => {
      mockAddItem.mockRejectedValue(new Error('Add failed'));

      await expect(useItineraryStore.getState().addItem('it-1', {})).rejects.toThrow('Add failed');

      expect(useItineraryStore.getState().error).toBe('Add failed');
    });
  });

  // ── deleteItem ─────────────────────────────────────────────────────────────
  describe('deleteItem', () => {
    it('removes item from currentItinerary.items', async () => {
      useItineraryStore.setState({
        currentItinerary: { ...mockItinerary, items: [mockItem] },
      });
      mockDeleteItem.mockResolvedValue(undefined);

      await useItineraryStore.getState().deleteItem('it-1', 'item-1');

      expect(mockDeleteItem).toHaveBeenCalledWith('it-1', 'item-1');
      expect(useItineraryStore.getState().currentItinerary?.items).toHaveLength(0);
    });

    it('re-throws on failure', async () => {
      mockDeleteItem.mockRejectedValue(new Error('Delete failed'));

      await expect(useItineraryStore.getState().deleteItem('it-1', 'item-1')).rejects.toThrow();
    });
  });

  // ── exportItinerary ────────────────────────────────────────────────────────
  describe('exportItinerary', () => {
    it('calls downloadFile for pdf export', async () => {
      const blob = new Blob(['%PDF'], { type: 'application/pdf' });
      mockExportItinerary.mockResolvedValue({ data: blob });

      await useItineraryStore.getState().exportItinerary('it-1', 'pdf');

      expect(mockExportItinerary).toHaveBeenCalledWith('it-1', 'pdf');
      expect(mockDownloadFile).toHaveBeenCalledWith(blob, 'itinerary-it-1.pdf');
      expect(useItineraryStore.getState().isExporting).toBe(false);
    });

    it('does not call downloadFile for email (no blob)', async () => {
      mockExportItinerary.mockResolvedValue({ message: 'Email sent' });

      await useItineraryStore.getState().exportItinerary('it-1', 'email');

      expect(mockDownloadFile).not.toHaveBeenCalled();
    });

    it('sets error and re-throws on failure', async () => {
      mockExportItinerary.mockRejectedValue(new Error('Export failed'));

      await expect(useItineraryStore.getState().exportItinerary('it-1', 'pdf')).rejects.toThrow();

      expect(useItineraryStore.getState().error).toBeTruthy();
    });
  });

  // ── clearError / reset ─────────────────────────────────────────────────────
  describe('clearError', () => {
    it('sets error to null', () => {
      useItineraryStore.setState({ error: 'Something went wrong' });
      useItineraryStore.getState().clearError();
      expect(useItineraryStore.getState().error).toBeNull();
    });
  });

  describe('reset', () => {
    it('resets all state to initial values', () => {
      useItineraryStore.setState({
        itineraries: [mockItinerary],
        currentItinerary: mockItinerary,
        isLoading: true,
        error: 'Err',
      });

      useItineraryStore.getState().reset();

      const s = useItineraryStore.getState();
      expect(s.itineraries).toHaveLength(0);
      expect(s.currentItinerary).toBeNull();
      expect(s.isLoading).toBe(false);
      expect(s.error).toBeNull();
    });
  });
});
