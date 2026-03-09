import { create } from 'zustand';
import type { Document } from '@/types';
import { documents as documentsApi } from '@/lib/api/endpoints';

interface DocumentStats {
  total: number;
  processing: number;
  completed: number;
  failed: number;
}

interface DocumentsState {
  documents: Document[];
  selectedDocument: Document | null;
  isLoading: boolean;
  stats: DocumentStats | null;
  totalPages: number;
  currentPage: number;

  fetchDocuments: (page?: number) => Promise<void>;
  uploadDocument: (file: File) => Promise<Document>;
  deleteDocument: (id: string) => Promise<void>;
  setSelected: (doc: Document | null) => void;
  fetchStats: () => Promise<void>;
}

export const useDocumentsStore = create<DocumentsState>((set, get) => ({
  documents: [],
  selectedDocument: null,
  isLoading: false,
  stats: null,
  totalPages: 1,
  currentPage: 1,

  fetchDocuments: async (page = 1) => {
    set({ isLoading: true });
    try {
      const response = await documentsApi.list({ page, page_size: 20 });
      set({
        documents: response.results,
        totalPages: response.total_pages,
        currentPage: response.page,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  uploadDocument: async (file: File) => {
    const doc = await documentsApi.upload(file);
    set((state) => ({
      documents: [doc, ...state.documents],
    }));
    return doc;
  },

  deleteDocument: async (id: string) => {
    await documentsApi.delete(id);
    set((state) => ({
      documents: state.documents.filter((d) => d.id !== id),
      selectedDocument:
        state.selectedDocument?.id === id ? null : state.selectedDocument,
    }));
    // Refresh stats
    get().fetchStats();
  },

  setSelected: (doc) => {
    set({ selectedDocument: doc });
  },

  fetchStats: async () => {
    try {
      const stats = await documentsApi.getStats();
      set({ stats });
    } catch {
      // silently fail for stats
    }
  },
}));
