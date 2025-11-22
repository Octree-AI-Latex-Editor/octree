'use client';

import { useState, useCallback } from 'react';
import type * as Monaco from 'monaco-editor';
import { createClient } from '@/lib/supabase/client';
import { useProject } from '@/stores/project';
import { useSelectedFile, useProjectFiles } from '@/stores/file';
import type { CompilationError } from '@/types/compilation';

export interface CompilationState {
  compiling: boolean;
  pdfData: string | null;
  compilationError: CompilationError | null;
  exportingPDF: boolean;
  handleCompile: () => Promise<boolean>;
  handleExportPDF: () => Promise<void>;
  debouncedAutoCompile: (content: string) => void;
  setCompilationError: (error: CompilationError | null) => void;
  setPdfData: (data: string | null) => void;
}

interface UseEditorCompilationProps {
  content: string;
  editorRef: React.MutableRefObject<Monaco.editor.IStandaloneCodeEditor | null>;
  fileName?: string;
  projectId?: string;
  currentFileId?: string | null;
}

function summarizeLog(log?: string) {
  if (!log) return undefined;
  const lines = log.split('\n').filter((line) => line.trim().length > 0);
  const lastLines = lines.slice(-5);
  return lastLines.join('\n');
}

export function useEditorCompilation({
  content,
  editorRef,
}: UseEditorCompilationProps): CompilationState {
  const project = useProject();
  const selectedFile = useSelectedFile();
  const projectFilesState = useProjectFiles();
  const projectId = project?.id;
  const fileName = selectedFile?.name;
  const [compiling, setCompiling] = useState(false);
  const [pdfData, setPdfData] = useState<string | null>(null);
  const [compilationError, setCompilationError] =
    useState<CompilationError | null>(null);
  const [exportingPDF, setExportingPDF] = useState(false);

  const normalizePath = useCallback((name: string) => {
    if (!name) return 'document.tex';
    if (name.includes('.')) return name;
    return `${name}.tex`;
  }, []);

  // Helper to determine if a file is binary based on extension
  const isBinaryFile = useCallback((filename: string): boolean => {
    const binaryExtensions = [
      '.eps',
      '.png',
      '.jpg',
      '.jpeg',
      '.gif',
      '.bmp',
      '.tiff',
      '.tif',
      '.pdf',
      '.ps',
      '.svg',
      '.webp',
      '.ico',
    ];
    const lowerName = filename.toLowerCase();
    return binaryExtensions.some((ext) => lowerName.endsWith(ext));
  }, []);

  // Helper function to fetch all project files and their contents
  const fetchProjectFiles = useCallback(async () => {
    if (!project?.id) return null;

    try {
      const supabase = createClient();
      
      const { data: storageFiles, error: storageError } = await supabase.storage
        .from('octree')
        .list(`projects/${project.id}`);

      if (storageError || !storageFiles) {
        console.error('Error fetching project files:', storageError);
        return null;
      }

      const actualFiles = storageFiles.filter((item) => item.id !== null);

      const filesWithContent = await Promise.all(
        actualFiles.map(async (file) => {
          try {
            const { data: fileBlob, error: downloadError } = await supabase.storage
              .from('octree')
              .download(`projects/${project.id}/${file.name}`);

            if (downloadError || !fileBlob) {
              console.warn(`No content found for file: ${file.name}`, downloadError);
              return null;
            }

            const isBinary = isBinaryFile(file.name);
            let content: string;

            if (isBinary) {
              const arrayBuffer = await fileBlob.arrayBuffer();
              const uint8Array = new Uint8Array(arrayBuffer);
              content = btoa(String.fromCharCode(...uint8Array));
            } else {
              content = await fileBlob.text();
            }

            const fileEntry: {
              path: string;
              content: string;
              encoding?: string;
            } = {
              path: file.name,
              content: content,
            };

            if (isBinary) {
              fileEntry.encoding = 'base64';
            }

            return fileEntry;
          } catch (error) {
            console.warn(`Error processing file: ${file.name}`, error);
            return null;
          }
        })
      );

      const validFiles = filesWithContent.filter(
        (f): f is { path: string; content: string; encoding?: string } =>
          f !== null
      );

      return validFiles;
    } catch (error) {
      console.error('Error fetching project files:', error);
      return null;
    }
  }, [project?.id, isBinaryFile]);

  const buildFilesPayload = useCallback(
    async (
      activePath: string,
      activeContent: string
    ): Promise<Array<{ path: string; content: string; encoding?: string }>> => {
      // Use the in-memory files first to get up-to-date project content
      if (projectFilesState && projectFilesState.length > 0) {
        const payload = projectFilesState.map((projectFile) => {
          const path = projectFile.file.name;
          if (
            projectFile.document &&
            typeof projectFile.document.content === 'string'
          ) {
            const content =
              path === activePath
                ? activeContent
                : projectFile.document.content;

            const fileEntry: {
              path: string;
              content: string;
              encoding?: string;
            } = {
              path,
              content,
            };

            // Mark binary files with base64 encoding
            if (isBinaryFile(path)) {
              fileEntry.encoding = 'base64';
            }

            return fileEntry;
          }
          return null;
        });

        const validPayload = payload.filter(
          (
            entry
          ): entry is { path: string; content: string; encoding?: string } =>
            entry !== null
        );
        if (validPayload.length > 0) {
          return validPayload;
        }
      }

      const fetched = await fetchProjectFiles();
      if (fetched && fetched.length > 0) {
        return fetched.map((file) =>
          file.path === activePath ? { ...file, content: activeContent } : file
        );
      }

      return [{ path: activePath, content: activeContent }];
    },
    [fetchProjectFiles, projectFilesState, isBinaryFile]
  );

  const handleCompile = useCallback(async (): Promise<boolean> => {
    if (compiling) return false;

    setCompiling(true);
    setCompilationError(null);

    let handled = false;
    try {
      const currentContent = editorRef.current?.getValue() || content;
      const normalizedFileName = normalizePath(fileName || 'document');

      const filesPayload = projectId
        ? await buildFilesPayload(normalizedFileName, currentContent)
        : [{ path: normalizedFileName, content: currentContent }];

      const requestBody = {
        files: filesPayload,
        projectId,
        lastModifiedFile: normalizedFileName,
      };

      const response = await fetch('/api/compile-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
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
        return true;
      }

      throw new Error('No PDF data received');
    } catch (error) {
      if (!handled) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown compilation error';
        setCompilationError({
          message: errorMessage,
          details: error instanceof Error ? error.stack : undefined,
        });
      }

      return false;
    } finally {
      setCompiling(false);
    }
  }, [
    compiling,
    content,
    editorRef,
    projectId,
    fileName,
    buildFilesPayload,
    normalizePath,
  ]);

  const handleExportPDF = useCallback(async () => {
    setExportingPDF(true);

    try {
      const currentContent = editorRef.current?.getValue() || content;
      const normalizedFileName = normalizePath(fileName || 'document');

      const filesPayload = projectId
        ? await buildFilesPayload(normalizedFileName, currentContent)
        : [{ path: normalizedFileName, content: currentContent }];

      const requestBody = {
        files: filesPayload,
        projectId,
        lastModifiedFile: normalizedFileName,
      };

      const response = await fetch('/api/compile-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const rawText = await response.text();
      let data: any;
      try {
        data = JSON.parse(rawText);
      } catch (error) {
        console.error('Failed to parse JSON:', error);
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
  }, [
    content,
    editorRef,
    fileName,
    projectId,
    buildFilesPayload,
    normalizePath,
  ]);

  // Auto-compile on content changes (debounced)
  const debouncedAutoCompile = useCallback((_content: string) => {
    // Auto compile disabled; compilation still available via explicit actions.
  }, []);

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
