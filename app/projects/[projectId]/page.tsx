'use client';

import useSWR from 'swr';
import { useCallback, useEffect, useRef, useState } from 'react';
import type * as Monaco from 'monaco-editor';
import { useEditorState } from '@/hooks/use-editor-state';
import { useDocumentSave } from '@/hooks/use-document-save';
import { useTextFormatting } from '@/hooks/use-text-formatting';
import { useEditorCompilation } from '@/hooks/use-editor-compilation';
import { useEditSuggestions } from '@/hooks/use-edit-suggestions';
import { useEditorInteractions } from '@/hooks/use-editor-interactions';
import { useEditorKeyboardShortcuts } from '@/hooks/use-editor-keyboard-shortcuts';
import { MonacoEditor } from '@/components/editor/monaco-editor';
import { EditorToolbar } from '@/components/editor/toolbar';
import { SelectionButton } from '@/components/editor/selection-button';
import { SuggestionActions } from '@/components/editor/suggestion-actions';
import { LoadingState } from '@/components/editor/loading-state';
import { ErrorState } from '@/components/editor/error-state';
import PDFViewer from '@/components/pdf-viewer';
import { Chat } from '@/components/chat';
import { CompilationError } from '@/components/latex/compilation-error';
import { useSidebar } from '@/components/ui/sidebar';
import { cn, formatCompilationErrorForAI } from '@/lib/utils';
import { FileActions } from '@/stores/file';
import { getProject, getProjectFiles } from '@/lib/requests/project';
import type { ProjectFile } from '@/hooks/use-file-editor';
import { useParams } from 'next/navigation';
import type { Project } from '@/types/project';
import { ProjectActions } from '@/stores/project';
import type { EditSuggestion } from '@/types/edit';

export default function ProjectPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);

  const { content, setContent } = useEditorState();

  const {
    data: projectData,
    isLoading: isProjectLoading,
    error: projectError,
  } = useSWR<Project>(projectId ? ['project', projectId] : null, () =>
    getProject(projectId)
  );

  const {
    data: filesData,
    isLoading: isFilesLoading,
    error: filesError,
  } = useSWR<ProjectFile[]>(projectId ? ['files', projectId] : null, () =>
    getProjectFiles(projectId)
  );

  const { isSaving, lastSaved, handleSaveDocument, debouncedSave } =
    useDocumentSave();

  const { handleTextFormat } = useTextFormatting({ editorRef });

  const {
    compiling,
    pdfData,
    compilationError,
    exportingPDF,
    handleCompile,
    handleExportPDF,
    setCompilationError,
  } = useEditorCompilation({
    content,
    editorRef,
  });

  const {
    editSuggestions,
    totalPendingCount,
    handleEditSuggestion,
    handleAcceptEdit,
    handleAcceptAllEdits,
    handleRejectEdit,
  } = useEditSuggestions({
    editor: editorRef.current,
    monacoInstance: monacoRef.current,
  });

  const {
    showButton,
    buttonPos,
    selectedText,
    textFromEditor,
    selectionRange,
    chatOpen,
    setChatOpen,
    setTextFromEditor,
    handleCopy,
    setupEditorListeners,
  } = useEditorInteractions();

  const { open: sidebarOpen } = useSidebar();
  const [autoSendMessage, setAutoSendMessage] = useState<string | null>(null);
  const [hasCompiledOnMount, setHasCompiledOnMount] = useState(false);

  useEffect(() => {
    if (filesData) {
      FileActions.init(filesData);
    }
  }, [filesData]);

  useEffect(() => {
    if (projectData) {
      ProjectActions.init(projectData);
    }
  }, [projectData]);

  useEffect(() => {
    if (content && !hasCompiledOnMount) {
      setHasCompiledOnMount(true);
      handleCompile();
    }
  }, [content, hasCompiledOnMount]);

  const handleEditorChange = (value: string) => {
    setContent(value);
    debouncedSave(value);
  };

  const handleEditorMount = (
    editor: Monaco.editor.IStandaloneCodeEditor,
    monaco: typeof Monaco
  ) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    setupEditorListeners(editor);
  };

  const handleSuggestionFromChat = useCallback(
    (suggestions: EditSuggestion | EditSuggestion[]) => {
      handleEditSuggestion(suggestions);
    },
    [handleEditSuggestion]
  );

  useEditorKeyboardShortcuts({
    editor: editorRef.current,
    monacoInstance: monacoRef.current,
    onSave: async (currentContent: string) => {
      const compiled = await handleCompile();
      if (compiled) {
        await handleSaveDocument(currentContent);
      }
    },
    onCopy: () => {
      if (selectedText.trim()) {
        setTextFromEditor(selectedText);
        setChatOpen(true);
      }
    },
    onTextFormat: handleTextFormat,
  });

  if (isProjectLoading || isFilesLoading) return <LoadingState />;
  if (projectError || filesError)
    return <ErrorState error="Error fetching project" />;
  if (!filesData) return <ErrorState error="No files found" />;

  return (
    <div className="flex h-[calc(100vh-45px)] flex-col bg-slate-100">
      <EditorToolbar
        onTextFormat={handleTextFormat}
        onCompile={handleCompile}
        onExportPDF={handleExportPDF}
        onOpenChat={() => {
          if (selectedText.trim()) {
            setTextFromEditor(selectedText);
          }
          setChatOpen(true);
        }}
        compiling={compiling}
        exportingPDF={exportingPDF}
        isSaving={isSaving}
        lastSaved={lastSaved}
      />

      <div className="flex min-h-0 flex-1">
        <div className="relative flex-1 overflow-hidden">
          <MonacoEditor
            content={content}
            onChange={handleEditorChange}
            onMount={handleEditorMount}
            className="h-full"
          />
          <SelectionButton
            show={showButton}
            position={buttonPos}
            onCopy={() => handleCopy()}
          />
          <SuggestionActions
            suggestions={editSuggestions}
            onAccept={handleAcceptEdit}
            onReject={handleRejectEdit}
          />
        </div>

        <div
          className={cn(
            sidebarOpen ? 'w-[60%]' : 'flex-1',
            'overflow-hidden border-l border-slate-200'
          )}
        >
          {compilationError ? (
            <div className="flex h-full items-start justify-center overflow-auto p-4">
              <CompilationError
                error={compilationError}
                onRetry={handleCompile}
                onDismiss={() => setCompilationError(null)}
                onFixWithAI={() => {
                  const errorContext =
                    formatCompilationErrorForAI(compilationError);
                  setTextFromEditor(errorContext);
                  setChatOpen(true);
                  setAutoSendMessage('Fix this error');
                  setCompilationError(null);
                }}
                className="w-full max-w-4xl"
              />
            </div>
          ) : (
            <PDFViewer pdfData={pdfData} isLoading={compiling} />
          )}
        </div>
      </div>

      <Chat
        isOpen={chatOpen}
        setIsOpen={setChatOpen}
        onEditSuggestion={handleSuggestionFromChat}
        onAcceptAllEdits={handleAcceptAllEdits}
        pendingEditCount={totalPendingCount}
        fileContent={content}
        textFromEditor={textFromEditor}
        setTextFromEditor={setTextFromEditor}
        selectionRange={selectionRange}
        autoSendMessage={autoSendMessage}
        setAutoSendMessage={setAutoSendMessage}
      />
    </div>
  );
}
