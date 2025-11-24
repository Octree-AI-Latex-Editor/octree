'use client';

import useSWR from 'swr';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import { formatCompilationErrorForAI } from '@/lib/utils';
import { FileActions, useProjectFiles, useSelectedFile } from '@/stores/file';
import { getProject, getProjectFiles } from '@/lib/requests/project';
import type { ProjectFile } from '@/hooks/use-file-editor';
import { useParams } from 'next/navigation';
import type { Project } from '@/types/project';
import { ProjectActions } from '@/stores/project';
import type { EditSuggestion } from '@/types/edit';
import { isImageFile } from '@/lib/constants/file-types';
import { ImageViewer } from '@/components/image-viewer';

export default function ProjectPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);

  const { content, setContent } = useEditorState();

  const projectFiles = useProjectFiles();
  const selectedFile = useSelectedFile();

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

  const [autoSendMessage, setAutoSendMessage] = useState<string | null>(null);
  const [hasCompiledOnMount, setHasCompiledOnMount] = useState(false);

  const projectFileContext = useMemo(
    () =>
      projectFiles
        ? projectFiles.map((projectFile) => ({
            path: projectFile.file.name,
            content: projectFile.document?.content ?? '',
          }))
        : [],
    [projectFiles]
  );

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

  const isImage = selectedFile ? isImageFile(selectedFile.name) : false;

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

      <ResizablePanelGroup
        direction="horizontal"
        className="flex min-h-0 flex-1"
      >
        <ResizablePanel defaultSize={50} minSize={30}>
          <div className="relative h-full">
            <div className="h-full overflow-hidden">
              {isImage && selectedFile ? (
                <ImageViewer
                  projectId={projectId}
                  fileName={selectedFile.name}
                />
              ) : (
                <>
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
                </>
              )}
            </div>
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={50} minSize={40}>
          <div className="h-full overflow-hidden border-l border-slate-200">
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
        </ResizablePanel>
      </ResizablePanelGroup>

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
        projectFiles={projectFileContext}
        currentFilePath={selectedFile?.name ?? null}
        autoSendMessage={autoSendMessage}
        setAutoSendMessage={setAutoSendMessage}
      />
    </div>
  );
}
