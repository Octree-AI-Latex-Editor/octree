'use client';

import { useState, useCallback } from 'react';
import type * as Monaco from 'monaco-editor';
import { createClient } from '@/lib/supabase/client';
import { useProject } from '@/stores/project';
import { useSelectedFile, useFileContent, useProjectFiles } from '@/stores/file';
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
      '.eps', '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.tif',
      '.pdf', '.ps', '.svg', '.webp', '.ico',
    ];
    const lowerName = filename.toLowerCase();
    return binaryExtensions.some(ext => lowerName.endsWith(ext));
  }, []);

  // Helper function to fetch all project files and their contents
  const fetchProjectFiles = useCallback(async () => {
    if (!project?.id) return null;

    try {
      const supabase = createClient();
      // Fetch all files in the project
      const { data: filesData, error: filesError } = await supabase
        .from('files')
        .select('*')
        .eq('project_id', project.id)
        .order('uploaded_at', { ascending: false });

      if (filesError || !filesData) {
        console.error('Error fetching project files:', filesError);
        return null;
      }

      // Fetch document content for each file
      const filesWithContent = await Promise.all(
        filesData.map(async (file: any) => {
          // Get the most recent document for this file
          const { data: docData, error: docError } = await supabase
            .from('documents')
            .select('content')
            .eq('project_id', project.id)
            .eq('filename', file.name)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (docError || !docData) {
            console.warn(`No document found for file: ${file.name}`, docError);
            return null;
          }

          console.log('[compile] fetched document from Supabase', {
            projectId: project.id,
            path: file.name,
            contentLength: (docData as any).content?.length ?? 0,
          });

          const fileEntry: { path: string; content: string; encoding?: string } = {
            path: file.name,
            content: (docData as any).content as string,
          };

          // Mark binary files with base64 encoding
          if (isBinaryFile(file.name)) {
            fileEntry.encoding = 'base64';
          }

          return fileEntry;
        })
      );

      // Filter out null entries and return
      const validFiles = filesWithContent.filter(
        (f): f is { path: string; content: string; encoding?: string } => f !== null
      );

      console.log('[compile] Supabase project files resolved', {
        projectId: project.id,
        total: filesData.length,
        withContent: validFiles.length,
      });

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
        console.log('[compile] building payload from store', {
          count: projectFilesState.length,
          activePath,
        });

        const payload = projectFilesState.map((projectFile) => {
          const path = projectFile.file.name;
          if (projectFile.document && typeof projectFile.document.content === 'string') {
            const content =
              path === activePath
                ? activeContent
                : projectFile.document.content;
            
            const fileEntry: { path: string; content: string; encoding?: string } = {
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
          (entry): entry is { path: string; content: string; encoding?: string } => entry !== null
        );
        if (validPayload.length > 0) {
          console.log('[compile] payload from store (filtered)', {
            activePath,
            files: validPayload.map((file) => ({
              path: file.path,
              contentLength: file.content.length,
              isActive: file.path === activePath,
              encoding: file.encoding,
            })),
          });
          return validPayload;
        }
      }

      // Fall back to fetching from Supabase if the store is empty or missing content
      const fetched = await fetchProjectFiles();
      if (fetched && fetched.length > 0) {
        console.log('[compile] payload from Supabase fetch', {
          count: fetched.length,
          activePath,
        });
        return fetched.map((file) =>
          file.path === activePath ? { ...file, content: activeContent } : file
        );
      }

      // Final fallback: single-file payload with the active document
      console.warn('[compile] falling back to single-file payload', {
        activePath,
        activeContentLength: activeContent.length,
      });
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

      console.log('[compile] sending compile request', {
        projectId,
        lastModifiedFile: normalizedFileName,
        files: filesPayload.map((file) => ({
          path: file.path,
          contentLength: file.content.length,
          hasDocumentClass: file.content.includes('\n\\documentclass'),
          hasBibliographyCommand: file.content.includes('\n\\bibliography'),
        })),
      });

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
      console.error('Compilation error:', error);

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
      // Use already compiled PDF data instead of recompiling
      if (!pdfData) {
        throw new Error('No compiled PDF available. Please compile the document first.');
      }

      // Convert base64 PDF data to blob and download
      const binaryString = atob(pdfData);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName || 'document'}.pdf`;
      document.body.appendChild(a);
      a.click();

      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('PDF export error:', error);
    } finally {
      setExportingPDF(false);
    }
  }, [pdfData, fileName]);

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
