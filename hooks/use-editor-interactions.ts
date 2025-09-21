'use client';

import React, { useState, useCallback } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import type * as Monaco from 'monaco-editor';

export interface EditorInteractionsState {
  showButton: boolean;
  buttonPos: { top: number; left: number };
  selectedText: string;
  textFromEditor: string | null;
  chatOpen: boolean;
  setChatOpen: React.Dispatch<React.SetStateAction<boolean>>;
  chatMinimized: boolean;
  setChatMinimized: React.Dispatch<React.SetStateAction<boolean>>;
  setTextFromEditor: (text: string | null) => void;
  handleCopy: (textToCopy?: string) => void;
  setupEditorListeners: (editor: Monaco.editor.IStandaloneCodeEditor) => void;
}

export function useEditorInteractions(): EditorInteractionsState {
  const [showButton, setShowButton] = useState(false);
  const [buttonPos, setButtonPos] = useState({ top: 0, left: 0 });
  const [selectedText, setSelectedText] = useState('');
  const [textFromEditor, setTextFromEditor] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMinimized, setChatMinimized] = useState(false);

  const handleCopy = useCallback(
    (textToCopy?: string) => {
      const currentSelectedText = textToCopy ?? selectedText;

      if (currentSelectedText.trim()) {
        setTextFromEditor(currentSelectedText);
        setShowButton(false);
        setChatOpen(true);
      }
    },
    [selectedText]
  );

  const debouncedCursorSelection = useDebouncedCallback(
    (editor: Monaco.editor.IStandaloneCodeEditor) => {
      const selection = editor.getSelection();
      const model = editor.getModel();
      const text = model?.getValueInRange(selection!);

      if (text && selection && !selection?.isEmpty()) {
        const range = {
          startLineNumber: selection.startLineNumber,
          startColumn: selection.startColumn,
          endLineNumber: selection.endLineNumber,
          endColumn: selection.endColumn,
        };
        const startCoords = editor.getScrolledVisiblePosition({
          lineNumber: range.startLineNumber,
          column: range.startColumn,
        });

        if (startCoords) {
          setButtonPos({
            top: startCoords.top - 30,
            left: startCoords.left,
          });
          setSelectedText(text);
          setShowButton(true);
        }
      } else {
        setShowButton(false);
        setSelectedText('');
      }
    },
    200
  );

  const setupEditorListeners = useCallback(
    (editor: Monaco.editor.IStandaloneCodeEditor) => {
      // Add selection change listener for floating button
      editor.onDidChangeCursorSelection(() => {
        debouncedCursorSelection(editor);
      });
    },
    [debouncedCursorSelection]
  );

  return {
    showButton,
    buttonPos,
    selectedText,
    textFromEditor,
    chatOpen,
    setChatOpen,
    chatMinimized,
    setChatMinimized,
    setTextFromEditor,
    handleCopy,
    setupEditorListeners,
  };
}
