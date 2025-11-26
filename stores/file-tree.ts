import { create } from 'zustand';

type FileTreeStoreState = {
  isLoading: boolean;
};

const DEFAULT_STATE: FileTreeStoreState = {
  isLoading: false,
};

export const useFileTreeStore = create<FileTreeStoreState>(() => DEFAULT_STATE);

const getState = useFileTreeStore.getState;
const setState = useFileTreeStore.setState;

export const FileTreeActions = {
  setLoading: (isLoading: boolean) => {
    setState({ isLoading });
  },
};

