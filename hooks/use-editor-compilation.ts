'use client';

import { useState, useCallback } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import type * as Monaco from 'monaco-editor';

export interface CompilationError {
  message: string;
  details?: string;
  log?: string;
  stdout?: string;
  stderr?: string;
  code?: number;
}

export interface CompilationState {
  compiling: boolean;
  pdfData: string | null;
  compilationError: CompilationError | null;
  exportingPDF: boolean;
  handleCompile: () => Promise<void>;
  handleExportPDF: () => Promise<void>;
  debouncedAutoCompile: (content: string) => void;
  setCompilationError: (error: CompilationError | null) => void;
  setPdfData: (data: string | null) => void;
}

interface UseEditorCompilationProps {
  content: string;
  saveDocument: (content?: string) => Promise<boolean>;
  editorRef: React.MutableRefObject<Monaco.editor.IStandaloneCodeEditor | null>;
  fileName?: string;
}

export function useEditorCompilation({
  content,
  saveDocument,
  editorRef,
  fileName = 'document',
}: UseEditorCompilationProps): CompilationState {
  const [compiling, setCompiling] = useState(false);
  const [pdfData, setPdfData] = useState<string | null>(null);
  const [compilationError, setCompilationError] =
    useState<CompilationError | null>(null);
  const [exportingPDF, setExportingPDF] = useState(false);

  const handleCompile = useCallback(async () => {
    if (compiling) return;

    setCompiling(true);

    try {
      // Get the current content from the editor
      const currentContent = editorRef.current?.getValue() || content;

      console.log('Compiling content, length:', currentContent.length);
      console.log('Content preview:', currentContent.substring(0, 200) + '...');

      // Save the document first
      await saveDocument(currentContent);

      const response = await fetch('/api/compile-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: currentContent }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Compilation failed with status ${response.status}`
        );
      }

      const data = await response.json();

      if (data.pdf) {
        console.log('PDF generated successfully, size:', data.size);
        setPdfData(data.pdf);
        setCompilationError(null); // Clear any previous errors
      } else {
        throw new Error('No PDF data received');
      }
    } catch (error) {
      console.error('Compilation error:', error);

      // Set compilation error for display
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown compilation error';
      setCompilationError({
        message: errorMessage,
        details: error instanceof Error ? error.stack : undefined,
      });
    } finally {
      setCompiling(false);
    }
  }, [compiling, content, saveDocument, editorRef]);

  const handleExportPDF = useCallback(async () => {
    setExportingPDF(true);

    try {
      const currentContent = editorRef.current?.getValue() || content;

      const response = await fetch('/api/compile-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: currentContent }),
      });

      if (!response.ok) throw new Error('PDF compilation failed');

      const rawText = await response.text();
      let data;
      try {
        data = JSON.parse(rawText);
      } catch (e) {
        console.error('Failed to parse JSON:', e);
        throw new Error('Failed to parse server response');
      }

      if (data.pdf) {
        const binaryString = atob(data.pdf);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const blob = new Blob([bytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileName}.pdf`;
        document.body.appendChild(a);
        a.click();

        URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        throw new Error('No PDF data received from server');
      }
    } catch (error) {
      console.error('PDF export error:', error);
    } finally {
      setExportingPDF(false);
    }
  }, [content, editorRef, fileName]);

  // Auto-compile on content changes (debounced)
  const debouncedAutoCompile = useDebouncedCallback((content: string) => {
    if (!compiling && content.trim()) {
      handleCompile();
    }
  }, 1000);

  return {
    compiling,
    pdfData,
    compilationError,
    exportingPDF,
    handleCompile,
    handleExportPDF,
    debouncedAutoCompile,
    setCompilationError,
    setPdfData,
  };
}
