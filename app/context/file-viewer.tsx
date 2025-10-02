'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface File {
  id: string;
  name: string;
  project_id: string;
  type: string;
  size: number;
  uploaded_at: string | null;
}

interface DocumentData {
  id: string;
  title: string;
  content: string;
  owner_id: string;
  project_id: string;
  filename: string;
  document_type: string | null;
  created_at: string;
  updated_at: string;
}

interface FileViewerState {
  currentFile: File | null;
  currentDocument: DocumentData | null;
  setCurrentFile: (file: File | null) => void;
  setCurrentDocument: (document: DocumentData | null) => void;
  switchToFile: (file: File, document: DocumentData) => void;
  clearFile: () => void;
}

const FileViewerContext = createContext<FileViewerState | undefined>(undefined);

export function FileViewerProvider({ children }: { children: ReactNode }) {
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [currentDocument, setCurrentDocument] = useState<DocumentData | null>(null);

  const switchToFile = (file: File, document: DocumentData) => {
    setCurrentFile(file);
    setCurrentDocument(document);
  };

  const clearFile = () => {
    setCurrentFile(null);
    setCurrentDocument(null);
  };

  return (
    <FileViewerContext.Provider
      value={{
        currentFile,
        currentDocument,
        setCurrentFile,
        setCurrentDocument,
        switchToFile,
        clearFile,
      }}
    >
      {children}
    </FileViewerContext.Provider>
  );
}

export function useFileViewer() {
  const context = useContext(FileViewerContext);
  if (context === undefined) {
    throw new Error('useFileViewer must be used within a FileViewerProvider');
  }
  return context;
}
