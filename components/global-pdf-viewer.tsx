'use client';

import { usePDFViewer } from '@/app/context/pdf-viewer';
import PDFViewer from '@/components/pdf-viewer';

export function GlobalPDFViewer() {
  const { pdfData, compiling, compilationError } = usePDFViewer();

  return (
    <PDFViewer 
      pdfData={pdfData} 
      isLoading={compiling}
    />
  );
}
