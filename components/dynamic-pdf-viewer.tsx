'use client';

import '@/lib/promise-polyfill';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import React, { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { PageCallback } from 'react-pdf/dist/esm/shared/types.js';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Initialize the worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

const options = {
  cMapUrl: '/cmaps/',
  standardFontDataUrl: '/standard_fonts/',
};

interface PDFViewerProps {
  pdfData?: string | null; // Accept null as a possible value
  isLoading?: boolean;
}

function DynamicPDFViewer({ pdfData, isLoading = false }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [pageLoading, setPageLoading] = useState<boolean>(false);
  const [pageDimensions, setPageDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setPageNumber(1);
  }

  function changePage(offset: number) {
    const newPageNumber = Math.max(
      1,
      Math.min(numPages || 1, pageNumber + offset)
    );
    setPageNumber(newPageNumber);
    setPageLoading(true);
  }

  function previousPage(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    changePage(-1);
  }

  function nextPage(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    changePage(1);
  }

  function onPageLoadSuccess(page: PageCallback) {
    setPageLoading(false);
    const { width, height } = page;
    setPageDimensions({ width, height });
  }

  if (isLoading && !pdfData) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-slate-500">Compiling...</span>
      </div>
    );
  }

  if (!pdfData) {
    return (
      <p className="flex h-full items-center justify-center whitespace-pre text-sm text-slate-600">
        Click <span className="font-semibold">Compile</span> to see the PDF
        preview
      </p>
    );
  }

  // Create a data URL from the Base64 PDF
  const pdfUrl = `data:application/pdf;base64,${pdfData}`;

  const calculatePageWidth = () => {
    if (!pageDimensions) {
      return 595;
    }

    const aspectRatio = pageDimensions.width / pageDimensions.height;
    const viewportWidth =
      typeof window !== 'undefined' ? window.innerWidth : 1200;

    if (aspectRatio > 1.2) {
      return Math.min(pageDimensions.width, viewportWidth * 0.9);
    } else if (aspectRatio < 0.9) {
      return Math.min(pageDimensions.width, 595);
    } else {
      return Math.min(pageDimensions.width, 650);
    }
  };

  const pageWidth = calculatePageWidth();

  return (
    <div className="relative flex h-full w-full flex-col">
      {isLoading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/50">
          <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
        </div>
      )}
      {/* Main PDF viewer area with scrolling */}
      <div className="flex flex-1 justify-center overflow-auto py-2">
        {pageLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50">
            <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
          </div>
        )}

        <div className="flex items-start justify-center">
          <Document
            key={pdfData?.substring(0, 100)} // Force re-render when PDF data changes
            file={pdfUrl}
            options={options}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={
              <div className="flex items-center justify-center p-4">
                <Loader2 className="mr-2 h-5 w-5 animate-spin text-blue-500" />
              </div>
            }
          >
            <Page
              key={`page_${pageNumber}_${pdfData?.substring(0, 50)}`} // Key includes PDF data to force re-render when PDF changes
              pageNumber={pageNumber}
              width={pageWidth}
              className="border border-slate-200 shadow-sm"
              onLoadSuccess={onPageLoadSuccess}
              renderTextLayer={false} // Disable text layer for better performance
              renderAnnotationLayer={false} // Disable annotations for better performance
              loading={
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin text-blue-500" />
                </div>
              }
            />
          </Document>
        </div>
      </div>

      {/* Fixed pagination controls at the bottom */}
      {numPages && numPages > 1 && (
        <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 transform items-center rounded-md border border-slate-100 bg-white/90 px-1.5 py-1 shadow-md backdrop-blur-sm">
          <button
            onClick={previousPage}
            disabled={pageNumber <= 1}
            className={`rounded-full p-0.5 transition-colors ${
              pageNumber <= 1
                ? 'text-slate-300'
                : 'text-slate-500 hover:text-blue-500'
            }`}
            aria-label="Previous page"
          >
            <ChevronLeft size={16} />
          </button>

          <p className="mx-2 text-xs text-slate-600">
            <span className="font-medium">{pageNumber}</span>
            <span className="mx-1">/</span>
            <span>{numPages}</span>
          </p>

          <button
            onClick={nextPage}
            disabled={pageNumber >= numPages}
            className={`rounded-full p-0.5 transition-colors ${
              pageNumber >= numPages
                ? 'text-slate-300'
                : 'text-slate-400 hover:text-blue-500'
            }`}
            aria-label="Next page"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

export default DynamicPDFViewer;
