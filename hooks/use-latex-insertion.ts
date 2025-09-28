'use client';

import { useCallback } from 'react';
import type * as Monaco from 'monaco-editor';

export interface LatexInsertionState {
  insertLatexCode: (latexCode: string) => void;
}

interface UseLatexInsertionProps {
  editorRef: React.MutableRefObject<Monaco.editor.IStandaloneCodeEditor | null>;
}

export function useLatexInsertion({
  editorRef,
}: UseLatexInsertionProps): LatexInsertionState {
  const insertLatexCode = useCallback(
    (latexCode: string) => {
      const editor = editorRef.current;
      if (!editor) return;

      const model = editor.getModel();
      if (!model) return;

      const selection = editor.getSelection();
      const position = selection ? selection.getEndPosition() : editor.getPosition();

      if (!position) return;

      // Insert the LaTeX code at the current cursor position
      editor.executeEdits('insert-latex', [
        {
          range: {
            startLineNumber: position.lineNumber,
            startColumn: position.column,
            endLineNumber: position.lineNumber,
            endColumn: position.column,
          },
          text: latexCode,
          forceMoveMarkers: true,
        },
      ]);

      // Move cursor to the end of the inserted text
      const newPosition = {
        lineNumber: position.lineNumber,
        column: position.column + latexCode.length,
      };
      editor.setPosition(newPosition);
      editor.focus();
    },
    [editorRef]
  );

  return {
    insertLatexCode,
  };
}

