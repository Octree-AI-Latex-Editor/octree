'use client';

import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import React, { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Polyfill for Promise.withResolvers if not available
if (!Promise.withResolvers) {
  (Promise as any).withResolvers = function <T>() {
    let resolve: (value: T) => void;
    let reject: (reason?: any) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve: resolve!, reject: reject! };
  };
}

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

  function onPageLoadSuccess() {
    setPageLoading(false);
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="text-primary h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!pdfData) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-600">
        <div className="text-center">
          <p>Click <span className="font-semibold">Compile</span> to see the PDF preview</p>
        </div>
      </div>
    );
  }

  // Create a data URL from the Base64 PDF
  const pdfUrl = `data:application/pdf;base64,${pdfData}`;

  return (
    <div className="relative flex h-full w-full flex-col">
      {/* Main PDF viewer area with scrolling */}
      <div className="flex flex-1 justify-center overflow-auto min-h-0">
        {pageLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50">
            <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
          </div>
        )}

        <Document
          file={pdfUrl}
          options={options}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={(error) => {
            console.error('PDF load error:', error);
          }}
          loading={
            <div className="flex items-center justify-center p-4">
              <Loader2 className="mr-2 h-5 w-5 animate-spin text-blue-500" />
            </div>
          }
          error={
            <div className="flex items-center justify-center p-4 text-red-500">
              <p>Error loading PDF</p>
            </div>
          }
        >
          <Page
            key={`page_${pageNumber}`} // Key for force re-render
            pageNumber={pageNumber}
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
