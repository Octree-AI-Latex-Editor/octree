'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface PDFViewerState {
  pdfData: string | null;
  compiling: boolean;
  compilationError: string | null;
  setPdfData: (data: string | null) => void;
  setCompiling: (compiling: boolean) => void;
  setCompilationError: (error: string | null) => void;
  clearPDF: () => void;
}

const PDFViewerContext = createContext<PDFViewerState | undefined>(undefined);

export function PDFViewerProvider({ children }: { children: ReactNode }) {
  const [pdfData, setPdfData] = useState<string | null>(null);
  const [compiling, setCompiling] = useState(false);
  const [compilationError, setCompilationError] = useState<string | null>(null);

  const clearPDF = () => {
    setPdfData(null);
    setCompilationError(null);
  };

  return (
    <PDFViewerContext.Provider
      value={{
        pdfData,
        compiling,
        compilationError,
        setPdfData,
        setCompiling,
        setCompilationError,
        clearPDF,
      }}
    >
      {children}
    </PDFViewerContext.Provider>
  );
}

export function usePDFViewer() {
  const context = useContext(PDFViewerContext);
  if (context === undefined) {
    throw new Error('usePDFViewer must be used within a PDFViewerProvider');
  }
  return context;
}
