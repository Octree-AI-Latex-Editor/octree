'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { loader } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import {
  latexLanguageConfiguration,
  latexTokenProvider,
  registerLatexCompletions,
} from '@/lib/editor-config';
import { EditSuggestion } from '@/types/edit';

import { useFileEditor } from '@/hooks/use-file-editor';
import { useEditorState } from '@/hooks/use-editor-state';
import { useDocumentSave } from '@/hooks/use-document-save';
import { useEditorCompilation } from '@/hooks/use-editor-compilation';
import { useEditSuggestions } from '@/hooks/use-edit-suggestions';
import { useEditorKeyboardShortcuts } from '@/hooks/use-editor-keyboard-shortcuts';
import { useTextFormatting } from '@/hooks/use-text-formatting';
import { useEditorInteractions } from '@/hooks/use-editor-interactions';

import { EditorToolbar } from '@/components/editor/toolbar';
import { MonacoEditor } from '@/components/editor/monaco-editor';
import { SelectionButton } from '@/components/editor/selection-button';
import { SuggestionActions } from '@/components/editor/suggestion-actions';
import { LoadingState } from '@/components/editor/loading-state';
import { ErrorState } from '@/components/editor/error-state';
import PDFViewer from '@/components/pdf-viewer';
import { Chat } from '@/components/chat';
import { CompilationError } from '@/components/latex/compilation-error';

export default function FileEditorPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const fileId = params.fileId as string;

  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);

  const { project, file, documentData, isLoading, error } = useFileEditor();

  const { content, setContent } = useEditorState(documentData?.content || '');

  const { isSaving, lastSaved, handleSaveDocument, debouncedSave } =
    useDocumentSave({
      projectId,
      fileId,
      content,
    });

  const {
    compiling,
    pdfData,
    compilationError,
    exportingPDF,
    handleCompile,
    handleExportPDF,
    debouncedAutoCompile,
    setCompilationError,
  } = useEditorCompilation({
    content,
    saveDocument: handleSaveDocument,
    editorRef,
    fileName: file?.name,
    projectId,
    currentFileId: fileId,
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

  const { handleTextFormat } = useTextFormatting({ editorRef });

  const {
    showButton,
    buttonPos,
    selectedText,
    textFromEditor,
    selectionRange,
    chatOpen,
    setChatOpen,
    chatMinimized,
    setChatMinimized,
    setTextFromEditor,
    handleCopy,
    setupEditorListeners,
  } = useEditorInteractions();

  useEffect(() => {
    loader.init().then((monaco) => {
      monaco.languages.register({ id: 'latex' });
      monaco.languages.setLanguageConfiguration(
        'latex',
        latexLanguageConfiguration
      );
      monaco.languages.setMonarchTokensProvider('latex', latexTokenProvider);
      registerLatexCompletions(monaco);
    });
  }, []);

  useEffect(() => {
    if (documentData?.content !== undefined) {
      setContent(documentData.content);
    }
  }, [documentData?.content, setContent]);

  useEffect(() => {
    if (content && !compiling && !pdfData) {
      handleCompile();
    }
  }, [content]);

  const handleEditorChange = useCallback(
    (value: string) => {
      setContent(value);
      debouncedSave(value);
      debouncedAutoCompile(value);
    },
    [setContent, debouncedSave, debouncedAutoCompile]
  );

  const handleSuggestionFromChat = useCallback(
    (suggestions: EditSuggestion | EditSuggestion[]) => {
      handleEditSuggestion(suggestions);
    },
    [handleEditSuggestion]
  );

  useEditorKeyboardShortcuts({
    editor: editorRef.current,
    monacoInstance: monacoRef.current,
    onSave: (currentContent: string) => {
      // Update content state first
      setContent(currentContent);
      // Then save and compile
      handleSaveDocument(currentContent).then(() => handleCompile());
    },
    onCopy: () => {
      if (selectedText.trim()) {
        setTextFromEditor(selectedText);
        setChatOpen(true);
        setChatMinimized(false);
      }
    },
    onTextFormat: handleTextFormat,
  });

  const handleEditorMount = useCallback(
    (editor: Monaco.editor.IStandaloneCodeEditor, monaco: typeof Monaco) => {
      editorRef.current = editor;
      monacoRef.current = monaco;

      setupEditorListeners(editor);

      editor.onDidChangeModelContent(() => {
        const currentContent = editor.getValue();
        debouncedAutoCompile(currentContent);
      });
    },
    [setupEditorListeners, debouncedAutoCompile]
  );

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;
  if (!project || !documentData || !file)
    return <ErrorState error="Project or file not found" />;

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
          setChatMinimized(false);
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

        <div className="w-1/2 overflow-hidden border-l border-slate-200">
          <PDFViewer pdfData={pdfData} isLoading={compiling} />
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
      />

      {compilationError && (
        <CompilationError
          error={compilationError}
          onRetry={handleCompile}
          onDismiss={() => setCompilationError(null)}
          onFixWithAI={() => {
            // Format error details for AI
            const errorContext = [
              `LaTeX Compilation Error:`,
              `${compilationError.message}`,
              compilationError.details &&
                `\nDetails: ${compilationError.details}`,
              compilationError.summary &&
                `\nError Summary:\n${compilationError.summary}`,
              compilationError.log &&
                `\nLog (last lines):\n${compilationError.log.split('\n').slice(-20).join('\n')}`,
            ]
              .filter(Boolean)
              .join('\n');

            setTextFromEditor(errorContext);
            setChatOpen(true);
            setChatMinimized(false);
            setCompilationError(null);
          }}
        />
      )}
    </div>
  );
}
