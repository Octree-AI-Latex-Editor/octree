'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { EditSuggestion } from '@/types/edit';
import { parseLatexDiff } from '@/lib/parse-latex-diff';
import type * as Monaco from 'monaco-editor';
import { toast } from 'sonner';
import { useEditLimitCache } from './use-edit-limit-cache';

export interface EditSuggestionsState {
  editSuggestions: EditSuggestion[];
  decorationIds: string[];
  setDecorationIds: (ids: string[]) => void;
  handleEditSuggestion: (suggestion: EditSuggestion | EditSuggestion[]) => void;
  handleAcceptEdit: (suggestionId: string) => Promise<void>;
  handleRejectEdit: (suggestionId: string) => void;
  handleNextSuggestion: () => void;
}

interface UseEditSuggestionsProps {
  editor: Monaco.editor.IStandaloneCodeEditor | null;
  monacoInstance: typeof Monaco | null;
}

export function useEditSuggestions({
  editor,
  monacoInstance,
}: UseEditSuggestionsProps): EditSuggestionsState {
  const [editSuggestions, setEditSuggestions] = useState<EditSuggestion[]>([]);
  const [decorationIds, setDecorationIds] = useState<string[]>([]);
  const suggestionQueueRef = useRef<EditSuggestion[]>([]);
  const continueToastIdRef = useRef<string | number | null>(null);
  const promptDisplayedRef = useRef(false);
  const hasActiveBatchRef = useRef(false);
  
  // Use cached edit limit to avoid API calls on every accept
  const { canEdit, trackEdit } = useEditLimitCache();

  const clearContinueToast = useCallback(() => {
    if (continueToastIdRef.current !== null) {
      toast.dismiss(continueToastIdRef.current);
      continueToastIdRef.current = null;
    }
  }, []);

  const normalizeSuggestions = (suggestions: EditSuggestion[]) =>
    suggestions.map((suggestion) => ({
      ...suggestion,
      status: 'pending' as const,
    }));

  const applyIncomingSuggestions = useCallback(
    (
      incoming: EditSuggestion[],
      options: { suppressLimitNotice?: boolean } = {}
    ) => {
      const normalized = normalizeSuggestions(incoming);
      const firstBatch = normalized.slice(0, 5).map((suggestion) => ({
        ...suggestion,
      }));
      const remaining = normalized.slice(5).map((suggestion) => ({
        ...suggestion,
      }));

      setEditSuggestions(firstBatch);
      suggestionQueueRef.current = remaining;
      hasActiveBatchRef.current = firstBatch.length > 0;
      promptDisplayedRef.current = false;
      clearContinueToast();

      if (
        !options.suppressLimitNotice &&
        remaining.length > 0 &&
        firstBatch.length > 0
      ) {
        toast.info(
          'Showing the first 5 AI suggestions. Continue when you are ready to review more.'
        );
      }
    },
    [clearContinueToast]
  );

  const handleEditSuggestion = useCallback(
    (suggestionInput: EditSuggestion | EditSuggestion[]) => {
      const incomingArray = Array.isArray(suggestionInput)
        ? suggestionInput
        : [suggestionInput];

      if (incomingArray.length === 0) {
        setEditSuggestions([]);
        suggestionQueueRef.current = [];
        hasActiveBatchRef.current = false;
        promptDisplayedRef.current = false;
        clearContinueToast();
        return;
      }

      applyIncomingSuggestions(incomingArray);
    },
    [applyIncomingSuggestions, clearContinueToast]
  );

  const handleNextSuggestion = useCallback(() => {
    if (suggestionQueueRef.current.length === 0) {
      clearContinueToast();
      hasActiveBatchRef.current = false;
      promptDisplayedRef.current = false;
      return;
    }

    const nextBatch = suggestionQueueRef.current
      .slice(0, 5)
      .map((suggestion) => ({
        ...suggestion,
        status: 'pending' as const,
      }));

    suggestionQueueRef.current = suggestionQueueRef.current
      .slice(5)
      .map((suggestion) => ({
        ...suggestion,
        status: 'pending' as const,
      }));

    setEditSuggestions(nextBatch);
    hasActiveBatchRef.current = nextBatch.length > 0;
    promptDisplayedRef.current = false;
    clearContinueToast();
  }, [clearContinueToast]);

  const handleAcceptEdit = async (suggestionId: string) => {
    const suggestion = editSuggestions.find((s) => s.id === suggestionId);
    if (!suggestion || suggestion.status !== 'pending') return;

    // Fast check using cached status
    if (!canEdit) {
      toast.error(
        'You have reached your free edit limit. Please upgrade to Pro for unlimited edits.'
      );
      return;
    }

    if (!editor || !monacoInstance) {
      console.error('Editor or Monaco instance not available.');
      return;
    }

    const model = editor.getModel();
    if (!model) {
      console.error('Editor model not available.');
      return;
    }

    try {
      const startLineNumber = Math.max(1, suggestion.startLine);
      const isInsertionOnly = suggestion.originalLineCount === 0;

      let rangeToReplace: Monaco.Range;

      if (isInsertionOnly) {
        const lineCount = model.getLineCount();

        if (lineCount === 0) {
          rangeToReplace = new monacoInstance.Range(1, 1, 1, 1);
        } else if (startLineNumber > lineCount) {
          const lastLine = lineCount;
          const lastColumn = model.getLineMaxColumn(lastLine);
          rangeToReplace = new monacoInstance.Range(
            lastLine,
            lastColumn,
            lastLine,
            lastColumn
          );
        } else {
          rangeToReplace = new monacoInstance.Range(
            startLineNumber,
            1,
            startLineNumber,
            1
          );
        }
      } else {
        const endLineNumber =
          startLineNumber + suggestion.originalLineCount - 1;
        const endColumn = model.getLineMaxColumn(endLineNumber);

        rangeToReplace = new monacoInstance.Range(
          startLineNumber,
          1,
          endLineNumber,
          endColumn
        );
      }

      // Apply suggestion immediately without conflict resolution
      editor.executeEdits('accept-ai-suggestion', [
        {
          range: rangeToReplace,
          text: suggestion.suggested,
          forceMoveMarkers: true,
        },
      ]);

      // Track edit in background (non-blocking)
      trackEdit();

      setEditSuggestions((prev) => prev.filter((s) => s.id !== suggestionId));
      
      // Show success feedback
      toast.success('Edit applied', { duration: 1000 });
    } catch (error) {
      console.error('Error applying edit:', error);
      toast.error('Failed to apply this suggestion. Please try again.');
    }
  };

  const handleRejectEdit = (suggestionId: string) => {
    setEditSuggestions((prev) =>
      prev.filter((s) => s.id !== suggestionId)
    );
  };

  useEffect(() => {
    const pendingCount = editSuggestions.filter(
      (suggestion) => suggestion.status === 'pending'
    ).length;

    if (pendingCount > 0) {
      hasActiveBatchRef.current = true;
      return;
    }

    if (!hasActiveBatchRef.current) {
      clearContinueToast();
      promptDisplayedRef.current = false;
      return;
    }

    if (suggestionQueueRef.current.length > 0) {
      if (!promptDisplayedRef.current) {
        const toastId = toast.info(
          'More AI suggestions are ready. Continue when you want to review the next batch.',
          {
            action: {
              label: 'Continue',
              onClick: () => {
                clearContinueToast();
                promptDisplayedRef.current = false;
                handleNextSuggestion();
              },
            },
          }
        );
        continueToastIdRef.current = toastId as string | number;
        promptDisplayedRef.current = true;
      }
    } else {
      hasActiveBatchRef.current = false;
      promptDisplayedRef.current = false;
      clearContinueToast();
    }
  }, [editSuggestions, clearContinueToast, handleNextSuggestion]);

  // Update the decoration effect for a clear inline diff view
  useEffect(() => {
    // Ensure editor and monaco are ready
    if (!editor || !monacoInstance) {
      return;
    }

    const model = editor.getModel();
    if (!model) {
      return;
    }

    const oldDecorationIds = decorationIds; // Get IDs of previous decorations
    const newDecorations: Monaco.editor.IModelDeltaDecoration[] = [];

    const pendingSuggestions = editSuggestions.filter(
      (s) => s.status === 'pending'
    );

    pendingSuggestions.forEach((suggestion) => {
      const isInsertionOnly = suggestion.originalLineCount === 0;
      const startLineNumber = suggestion.startLine;
      const endLineNumber = Math.max(
        startLineNumber,
        startLineNumber + suggestion.originalLineCount - 1
      );
      const modelLineCount = model.getLineCount();
      const effectiveModelLineCount = Math.max(1, modelLineCount);

      // Validate line numbers against the current model state
      if (
        startLineNumber <= 0 ||
        endLineNumber <= 0 ||
        (!isInsertionOnly &&
          (startLineNumber > modelLineCount || endLineNumber > modelLineCount)) ||
        (isInsertionOnly && startLineNumber > modelLineCount + 1)
      ) {
        console.warn(
          `Suggestion ${suggestion.id} line numbers [${startLineNumber}-${endLineNumber}] are out of bounds for model line count ${model.getLineCount()}. Skipping decoration.`
        );
        return; // Skip this suggestion if lines are invalid
      }

      const decorationStartLine = isInsertionOnly
        ? Math.min(startLineNumber, effectiveModelLineCount)
        : startLineNumber;
      const decorationEndLine = isInsertionOnly
        ? decorationStartLine
        : endLineNumber;

      // Calculate end column precisely
      const endColumn = !isInsertionOnly
        ? model.getLineMaxColumn(decorationEndLine) // End of the last original line
        : startLineNumber > modelLineCount
        ? model.getLineMaxColumn(effectiveModelLineCount)
        : 1; // Insertion point column 1

      // Define the range for the original text (or insertion point)
      const originalRange = new monacoInstance.Range(
        decorationStartLine,
        1, // Start column is always 1
        decorationEndLine,
        endColumn
      );

      // --- Decoration 1: Mark original text (if any) + Glyph ---
      if (!isInsertionOnly) {
        // Apply red strikethrough to the original range
        newDecorations.push({
          range: originalRange,
          options: {
            className: 'octra-suggestion-deleted', // Red strikethrough style
            glyphMarginClassName: 'octra-suggestion-glyph', // Blue margin indicator
            glyphMarginHoverMessage: {
              value: `Suggestion: Replace Lines ${startLineNumber}-${endLineNumber}`,
            },
            stickiness:
              monacoInstance.editor.TrackedRangeStickiness
                .NeverGrowsWhenTypingAtEdges,
          },
        });
      } else {
        // If it's a pure insertion, just add the glyph marker at the start line
        const glyphLine = Math.min(startLineNumber, effectiveModelLineCount);
        newDecorations.push({
          range: new monacoInstance.Range(
            glyphLine,
            1,
            glyphLine,
            1
          ), // Point decoration
          options: {
            glyphMarginClassName: 'octra-suggestion-glyph',
            glyphMarginHoverMessage: {
              value: `Suggestion: Insert at Line ${startLineNumber}`,
            },
            stickiness:
              monacoInstance.editor.TrackedRangeStickiness
                .NeverGrowsWhenTypingAtEdges,
          },
        });
      }

      // --- Decoration 2: Show suggested text inline (if any) ---
      if (suggestion.suggested && suggestion.suggested.trim().length > 0) {
        // Use 'after' content widget placed at the end of the original range
        // The range for the 'after' widget itself should be zero-length
        const afterWidgetRange = new monacoInstance.Range(
          endLineNumber,
          endColumn,
          endLineNumber,
          endColumn
        );

        // Prepare suggested content, replacing newlines for inline view
        const inlineSuggestedContent = ` ${suggestion.suggested.replace(/\n/g, ' ↵ ')}`;

        newDecorations.push({
          range: afterWidgetRange, // Position the widget *after* the original range
          options: {
            after: {
              content: inlineSuggestedContent,
              inlineClassName: 'octra-suggestion-added', // Bold green style
            },
            stickiness:
              monacoInstance.editor.TrackedRangeStickiness
                .NeverGrowsWhenTypingAtEdges,
          },
        });
      }
    });

    // --- Apply Decorations ---
    // This is crucial: deltaDecorations removes old IDs and applies new ones atomically
    const newDecorationIds = editor.deltaDecorations(
      oldDecorationIds,
      newDecorations
    );
    // Update the state to store the IDs of the *currently applied* decorations
    setDecorationIds(newDecorationIds);

    // Dependencies: Re-run when suggestions change, or editor/monaco become available.
  }, [editSuggestions, editor, monacoInstance]); // Removed decorationIds from deps

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Optional: Clear decorations when component unmounts
      if (editor && decorationIds.length > 0) {
        editor.deltaDecorations(decorationIds, []);
      }
      clearContinueToast();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array for unmount cleanup

  return {
    editSuggestions,
    decorationIds,
    setDecorationIds,
    handleEditSuggestion,
    handleAcceptEdit,
    handleRejectEdit,
    handleNextSuggestion,
  };
}
