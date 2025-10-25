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
  requestId?: string | null;
  queueMs?: number | null;
  durationMs?: number | null;
  summary?: string;
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

function summarizeLog(log?: string) {
  if (!log) return undefined;
  const lines = log.split('\n').filter((line) => line.trim().length > 0);
  const lastLines = lines.slice(-5);
  return lastLines.join('\n');
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
    setCompilationError(null);

    let handled = false;
    try {
      const currentContent = editorRef.current?.getValue() || content;

      await saveDocument(currentContent);

      const response = await fetch('/api/compile-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: currentContent }),
      });

      const raw = await response.text();
      let data: any;
      try {
        data = JSON.parse(raw);
      } catch (parseError) {
        throw new Error('Unexpected response from compilation service');
      }

      if (!response.ok) {
        const errorMessage =
          data?.error || `Compilation failed with status ${response.status}`;
        const structuredError = {
          message: errorMessage,
          details: data?.details,
          log: data?.log,
          stdout: data?.stdout,
          stderr: data?.stderr,
          code: data?.code,
          requestId: data?.requestId,
          queueMs: data?.queueMs,
          durationMs: data?.durationMs,
          summary: summarizeLog(data?.log || data?.stderr || data?.stdout),
        };
        setCompilationError(structuredError);
        handled = true;
        throw new Error(errorMessage);
      }

      if (data.pdf) {
        setPdfData(data.pdf);
        setCompilationError(null);
      } else {
        throw new Error('No PDF data received');
      }
    } catch (error) {
      console.error('Compilation error:', error);

      if (!handled) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown compilation error';
        setCompilationError({
          message: errorMessage,
          details: error instanceof Error ? error.stack : undefined,
        });
      }
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

      const rawText = await response.text();
      let data: any;
      try {
        data = JSON.parse(rawText);
      } catch (e) {
        console.error('Failed to parse JSON:', e);
        throw new Error('Failed to parse server response');
      }

      if (!response.ok) {
        const errorMessage = data?.error || 'PDF compilation failed';
        throw new Error(errorMessage);
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
