'use client';

import { useState, useCallback } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import type * as Monaco from 'monaco-editor';
import { createClient } from '@/lib/supabase/client';

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
  projectId?: string;
  currentFileId?: string;
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
  projectId,
  currentFileId,
}: UseEditorCompilationProps): CompilationState {
  const [compiling, setCompiling] = useState(false);
  const [pdfData, setPdfData] = useState<string | null>(null);
  const [compilationError, setCompilationError] = useState<CompilationError | null>(null);
  const [exportingPDF, setExportingPDF] = useState(false);

  // Helper function to fetch all project files and their contents
  const fetchProjectFiles = useCallback(async () => {
    if (!projectId) return null;

    try {
      const supabase = createClient();
      
      // Fetch all files in the project
      const { data: filesData, error: filesError } = await supabase
        .from('files')
        .select('*')
        .eq('project_id', projectId)
        .order('uploaded_at', { ascending: false });

      if (filesError || !filesData) {
        console.error('Error fetching project files:', filesError);
        return null;
      }

      console.log(`Found ${filesData.length} files in project:`, filesData.map((f: any) => f.name));

      // Fetch document content for each file
      const filesWithContent = await Promise.all(
        filesData.map(async (file: any) => {
          // Get the most recent document for this file
          const { data: docData, error: docError } = await supabase
            .from('documents')
            .select('content')
            .eq('project_id', projectId)
            .eq('filename', file.name)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (docError || !docData) {
            console.warn(`No document found for file: ${file.name}`, docError);
            return null;
          }

          console.log(`Loaded content for ${file.name}: ${(docData as any).content?.length} bytes`);

          return {
            path: file.name,
            content: (docData as any).content as string,
          };
        })
      );

      // Filter out null entries and return
      const validFiles = filesWithContent.filter((f): f is { path: string; content: string } => f !== null);
      console.log(`Returning ${validFiles.length} files with content:`, validFiles.map(f => f.path));
      
      return validFiles;
    } catch (error) {
      console.error('Error fetching project files:', error);
      return null;
    }
  }, [projectId]);

  const handleCompile = useCallback(async () => {
    if (compiling) return;

    setCompiling(true);
    setCompilationError(null);

    let handled = false;
    try {
      // Get the current content from the editor
      const currentContent = editorRef.current?.getValue() || content;

      console.log('Compiling content, length:', currentContent.length);
      console.log('Content preview:', currentContent.substring(0, 200) + '...');

      // Save the document first
      await saveDocument(currentContent);

      let requestBody: any;

      // If projectId is provided, fetch all files for multi-file compilation
      if (projectId) {
        const projectFiles = await fetchProjectFiles();
        
        if (projectFiles && projectFiles.length > 0) {
          // Update current file content in the array
          const updatedFiles = projectFiles.map(f => 
            (currentFileId && f.path === fileName) 
              ? { ...f, content: currentContent }
              : f
          );
          
          console.log(`Multi-file compilation: ${updatedFiles.length} files`);
          requestBody = { files: updatedFiles };
        } else {
          // Fallback to single file
          console.log('Single-file compilation (fallback)');
          requestBody = { content: currentContent };
        }
      } else {
        // No projectId: use single file compilation
        console.log('Single-file compilation');
        requestBody = { content: currentContent };
      }

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
        const errorMessage = data?.error || `Compilation failed with status ${response.status}`;
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
        console.log('PDF generated successfully, size:', data.size);
        setPdfData(data.pdf);
        setCompilationError(null); // Clear any previous errors
      } else {
        throw new Error('No PDF data received');
      }
    } catch (error) {
      console.error('Compilation error:', error);

      // Set compilation error for display
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
  }, [compiling, content, saveDocument, editorRef, projectId, currentFileId, fileName, fetchProjectFiles]);

  const handleExportPDF = useCallback(async () => {
    setExportingPDF(true);

    try {
      const currentContent = editorRef.current?.getValue() || content;

      let requestBody: any;

      // If projectId is provided, fetch all files for multi-file compilation
      if (projectId) {
        const projectFiles = await fetchProjectFiles();
        
        if (projectFiles && projectFiles.length > 0) {
          // Update current file content in the array
          const updatedFiles = projectFiles.map(f => 
            (currentFileId && f.path === fileName) 
              ? { ...f, content: currentContent }
              : f
          );
          
          requestBody = { files: updatedFiles };
        } else {
          requestBody = { content: currentContent };
        }
      } else {
        requestBody = { content: currentContent };
      }

      const response = await fetch('/api/compile-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
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
  }, [content, editorRef, fileName, projectId, currentFileId, fetchProjectFiles]);

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
