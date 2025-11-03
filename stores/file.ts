import { create } from 'zustand';

interface FileStore {
  selectedFileId: string | null;
  setSelectedFileId: (fileId: string | null) => void;
}

export const useFileStore = create<FileStore>((set) => ({
  selectedFileId: null,
  setSelectedFileId: (fileId: string | null) => set({ selectedFileId: fileId }),
}));
