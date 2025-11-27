import { create } from 'zustand';
import type { ProjectFile, FileData } from '@/hooks/use-file-editor';

type FileStoreState = {
  selectedFile: FileData | null;
  projectFiles: ProjectFile[] | null;
};

const DEFAULT_STATE: FileStoreState = {
  selectedFile: null,
  projectFiles: null,
};

export const useFileStore = create<FileStoreState>(() => DEFAULT_STATE);

export const useProjectFiles = () => {
  return useFileStore((state) => state.projectFiles);
};

export const useSelectedFile = () => {
  return useFileStore((state) => state.selectedFile);
};

export const useFileContent = () => {
  return useFileStore((state) => {
    const { selectedFile, projectFiles } = state;
    if (!selectedFile || !projectFiles) return null;
    const projectFile = projectFiles.find((f) => f.file.id === selectedFile.id);
    return projectFile?.document?.content ?? null;
  });
};

const getState = useFileStore.getState;
const setState = useFileStore.setState;

export const FileActions = {
  setSelectedFile: (file: FileData | null) => {
    setState({ selectedFile: file });
  },

  setContent: (content: string) => {
    const { selectedFile, projectFiles } = getState();

    if (!selectedFile || !projectFiles) {
      return;
    }

    const updatedFiles = projectFiles.map((projectFile) => {
      if (projectFile.file.id === selectedFile.id && projectFile.document) {
        return {
          ...projectFile,
          document: { ...projectFile.document, content },
        };
      }
      return projectFile;
    });

    setState({ projectFiles: updatedFiles });
  },

  init: (files: ProjectFile[]) => {
    const currentState = getState();
    const selectedFile = currentState.selectedFile
      ? currentState.selectedFile
      : selectInitialFile(files);
    setState({ projectFiles: files, selectedFile });
  },
};

const selectInitialFile = (files: ProjectFile[]): FileData | null => {
  const mainTexFile = files.find((f) => f.file.name === 'main.tex');
  return mainTexFile
    ? mainTexFile.file
    : files.length > 0
      ? files[0].file
      : null;
};
