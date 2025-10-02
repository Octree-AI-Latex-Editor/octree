'use client';

import { useFileViewer } from '@/app/context/file-viewer';
import { useFileSwitcher } from '@/hooks/use-file-switcher';
import { useEditorState } from '@/hooks/use-editor-state';
import { useDocumentSave } from '@/hooks/use-document-save';
import { useGlobalEditorCompilation } from '@/hooks/use-global-editor-compilation';
import { useEditSuggestions } from '@/hooks/use-edit-suggestions';
import { useEditorKeyboardShortcuts } from '@/hooks/use-editor-keyboard-shortcuts';
import { useTextFormatting } from '@/hooks/use-text-formatting';
import { useEditorInteractions } from '@/hooks/use-editor-interactions';
import { useRef, useState, useEffect, useCallback } from 'react';
import { EditorToolbar } from '@/components/editor/toolbar';
import { MonacoEditor } from '@/components/editor/monaco-editor';
import { SelectionButton } from '@/components/editor/selection-button';
import { SuggestionActions } from '@/components/editor/suggestion-actions';
import { LoadingState } from '@/components/editor/loading-state';
import { ErrorState } from '@/components/editor/error-state';
import { GlobalPDFViewer } from '@/components/global-pdf-viewer';
import { Chat } from '@/components/chat';
import { CompilationError } from '@/components/latex/compilation-error';
import { ImageViewer } from '@/components/image-viewer';
import type * as Monaco from 'monaco-editor';
import type { EditSuggestion } from '@/types/edit';

export function ClientFileEditor({ projectId }: { projectId: string }) {
  const { currentFile, currentDocument } = useFileViewer();
  const { fetchAndSwitchToFile } = useFileSwitcher();
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  
  
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  // Always call all hooks at the top level
  const content = currentDocument?.content || '';
  const file = currentFile;
  const hasFile = currentFile && currentDocument;

  // Editor state - always call this hook
  const {
    content: editorContent,
    setContent: setEditorContent,
    editorRef: stateEditorRef,
  } = useEditorState(content);

  // Document save hook - always call this hook
  const { handleSaveDocument, isSaving, lastSaved } = useDocumentSave(
    projectId,
    file?.id || '',
    editorContent,
  );

  // Editor interaction handlers - always call these hooks
  const handleEditorChange = useCallback((value: string) => {
    setEditorContent(value);
    // Auto-save will be handled by the document save hook
  }, [setEditorContent]);

  const handleEditorMount = useCallback((editor: any) => {
    stateEditorRef.current = editor;
  }, [stateEditorRef]);

  // Compilation hook - always call this hook
  const {
    compiling,
    compilationError,
    exportingPDF,
    handleCompile,
    handleExportPDF,
    debouncedAutoCompile,
    setCompilationError,
  } = useGlobalEditorCompilation({
    content: editorContent,
    saveDocument: handleSaveDocument,
    editorRef: stateEditorRef,
    fileName: file?.name || '',
  });

  // Edit suggestions hook - always call this hook
  const {
    editSuggestions,
    handleEditSuggestion,
    handleAcceptEdit,
    handleRejectEdit,
  } = useEditSuggestions({
    editor: stateEditorRef.current,
    monacoInstance: null,
  });

  // Text formatting hook - always call this hook
  const { handleTextFormat } = useTextFormatting({ editorRef: stateEditorRef });

  // Editor interactions hook - always call this hook
  const {
    showButton: interactionShowButton,
    buttonPos: interactionButtonPos,
    selectedText,
    textFromEditor: interactionTextFromEditor,
    chatOpen: interactionChatOpen,
    setChatOpen: setInteractionChatOpen,
    chatMinimized: interactionChatMinimized,
    setChatMinimized: setInteractionChatMinimized,
    setTextFromEditor: setInteractionTextFromEditor,
    handleCopy: interactionHandleCopy,
  } = useEditorInteractions();

  const handleSuggestionFromChat = useCallback((suggestions: any) => {
    handleEditSuggestion(suggestions);
  }, [handleEditSuggestion]);

  // Keyboard shortcuts hook - always call this hook
  useEditorKeyboardShortcuts({
    editor: stateEditorRef.current,
    monacoInstance: null,
    onSave: handleSaveDocument,
    onCopy: interactionHandleCopy,
    onTextFormat: handleTextFormat,
  });

  // Handle initial file load from URL
  useEffect(() => {
    const loadInitialFile = async () => {
      const pathParts = window.location.pathname.split('/');
      const fileIndex = pathParts.findIndex((part) => part === 'files');
      if (fileIndex !== -1 && pathParts[fileIndex + 1]) {
        const fileId = pathParts[fileIndex + 1];
        if (fileId && fileId !== currentFile?.id) {
          await fetchAndSwitchToFile(fileId, projectId);
        }
      }
      setInitialLoadComplete(true);
    };

    if (!initialLoadComplete) {
      loadInitialFile();
    }
  }, [fetchAndSwitchToFile, projectId, currentFile?.id, initialLoadComplete]);

  // Auto-compile on content changes
  useEffect(() => {
    if (editorContent && editorContent.trim()) {
      debouncedAutoCompile(editorContent);
    }
  }, [editorContent, debouncedAutoCompile]);

  // If no file is selected, show a placeholder or loading state
  if (!hasFile) {
    if (!initialLoadComplete) {
      return <LoadingState />;
    }
    
    return (
      <div className="flex h-screen flex-col bg-slate-100">
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-600 mb-2">No file selected</h2>
            <p className="text-gray-500">Choose a file from the sidebar to start editing</p>
          </div>
        </div>
      </div>
    );
  }

  // Helper function to check if a file is an image
  const isImageFile = (fileName: string, documentType: string) => {
    if (documentType === 'image') return true;
    const extension = fileName.split('.').pop()?.toLowerCase();
    return ['png', 'jpg', 'jpeg'].includes(extension || '');
  };

  // Check if this is an image file
  const isImage = isImageFile(file.name, currentDocument.document_type || '');

  // If it's an image file, show the image viewer on the left and PDF viewer on the right
  if (isImage) {
    return (
      <div className="flex h-screen flex-col bg-slate-100">
        <EditorToolbar
          onTextFormat={handleTextFormat}
          onCompile={handleCompile}
          onExportPDF={handleExportPDF}
          compiling={compiling}
          exportingPDF={exportingPDF}
          isSaving={isSaving}
          lastSaved={lastSaved}
          projectId={projectId}
        />

        <div className="flex min-h-0 flex-1">
          <div className="relative flex-1 overflow-hidden">
            <ImageViewer
              imageData={currentDocument.content}
              fileName={file.name}
            />
          </div>

          <div className="w-1/2 overflow-hidden border-l border-slate-200">
            <GlobalPDFViewer />
          </div>
        </div>

        {compilationError && (
          <CompilationError
            error={compilationError}
            onRetry={handleCompile}
            onDismiss={() => setCompilationError(null)}
          />
        )}
      </div>
    );
  }

  // For non-image files, show the regular editor
  return (
    <div className="flex h-screen flex-col bg-slate-100">
      <EditorToolbar
        onTextFormat={handleTextFormat}
        onCompile={handleCompile}
        onExportPDF={handleExportPDF}
        compiling={compiling}
        exportingPDF={exportingPDF}
        isSaving={isSaving}
        lastSaved={lastSaved}
        projectId={projectId}
      />

      <div className="flex min-h-0 flex-1">
        <div className="relative flex-1 overflow-hidden">
          <MonacoEditor
            content={editorContent}
            onChange={handleEditorChange}
            onMount={handleEditorMount}
            className="h-full"
          />
          <SelectionButton
            show={interactionShowButton}
            position={interactionButtonPos}
            onCopy={() => interactionHandleCopy()}
          />
          <SuggestionActions
            suggestions={editSuggestions}
            onAccept={handleAcceptEdit}
            onReject={handleRejectEdit}
          />
        </div>

        <div className="w-1/2 overflow-hidden border-l border-slate-200">
          <GlobalPDFViewer />
        </div>
      </div>

      <Chat
        isMinimized={interactionChatMinimized}
        setIsMinimized={setInteractionChatMinimized}
        isOpen={interactionChatOpen}
        setIsOpen={setInteractionChatOpen}
        onEditSuggestion={handleSuggestionFromChat}
        fileContent={editorContent}
        textFromEditor={interactionTextFromEditor}
        setTextFromEditor={setInteractionTextFromEditor}
      />

      {compilationError && (
        <CompilationError
          error={compilationError}
          onRetry={handleCompile}
          onDismiss={() => setCompilationError(null)}
        />
      )}
    </div>
  );
}
