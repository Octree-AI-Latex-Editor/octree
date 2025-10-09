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
  showInlinePreview?: boolean; // controls inline 'after' preview decoration
}

// ---------------------- Helpers (pure) ----------------------

// Helper functions to extract line-based edit data
function getStartLine(suggestion: EditSuggestion): number {
  return suggestion.position?.line || 1;
}

function getOriginalLineCount(suggestion: EditSuggestion): number {
  // Use the originalLineCount field if provided
  if (suggestion.originalLineCount !== undefined) {
    return suggestion.originalLineCount;
  }
  
  // Fallback: determine line count based on edit type
  const content = suggestion.content || '';
  
  if (suggestion.editType === 'insert') {
    return 0; // Insert operations don't replace existing content
  } else if (suggestion.editType === 'delete') {
    // For delete operations, if no originalLineCount provided, use content length as heuristic
    return content.split('\n').length || 1;
  } else if (suggestion.editType === 'replace') {
    // For replace operations, if no originalLineCount provided, use content length as heuristic
    return content.split('\n').length || 1;
  }
  
  // Default fallback
  return 1;
}

function getSuggestedText(suggestion: EditSuggestion): string {
  return suggestion.content || '';
}

function normalizeNewlines(text: string): string {
  return text.replace(/\r\n?/g, '\n');
}

function countLines(text: string): number {
  if (!text) return 0;
  const norm = normalizeNewlines(text);
  return norm === '' ? 0 : norm.split('\n').length;
}

function getOriginalTextFromModel(
  model: Monaco.editor.ITextModel,
  startLine: number,
  originalLineCount: number
): string {
  if (originalLineCount === 0) return '';
  const endLine = startLine + originalLineCount - 1;
  if (
    startLine <= 0 ||
    endLine <= 0 ||
    startLine > model.getLineCount() ||
    endLine > model.getLineCount()
  ) {
    return '';
  }
  const lines: string[] = [];
  for (let ln = startLine; ln <= endLine; ln++) lines.push(model.getLineContent(ln));
  return lines.join('\n');
}

function computeDeltaLines(suggested: string, originalLineCount: number): number {
  const suggestedLines = countLines(suggested);
  return suggestedLines - originalLineCount;
}

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return !(aEnd < bStart || aStart > bEnd);
}

export function useEditSuggestions({
  editor,
  monacoInstance,
  showInlinePreview = true,
}: UseEditSuggestionsProps): EditSuggestionsState {
  const [editSuggestions, setEditSuggestions] = useState<EditSuggestion[]>([]);
  const [decorationIds, setDecorationIds] = useState<string[]>([]);
  const suggestionQueueRef = useRef<EditSuggestion[]>([]);
  const continueToastIdRef = useRef<string | number | null>(null);
  const promptDisplayedRef = useRef(false);
  const hasActiveBatchRef = useRef(false);
  
  // Use cached edit limit to check before requesting AI suggestions
  // Note: Quota is consumed on generation (in /api/octra-agent), not on accept
  const { canEdit } = useEditLimitCache();

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
      // Enrich suggestions with original text from the current model when missing
      let model: Monaco.editor.ITextModel | null = editor ? editor.getModel() : null;

      const withOriginals = incoming.map((s) => {
        if (s.original !== undefined || !model) return s;
        return {
          ...s,
          original: getOriginalTextFromModel(model, getStartLine(s), getOriginalLineCount(s)),
        };
      });

      const normalized = normalizeSuggestions(withOriginals);
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
        'You have reached your edit limit. Please upgrade to Pro for 200 edits per month.'
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
      const startLineNumber = getStartLine(suggestion);
      const originalLineCount = getOriginalLineCount(suggestion);
      const suggestedText = getSuggestedText(suggestion);
      
      const endLineNumber =
        originalLineCount > 0
          ? startLineNumber + originalLineCount - 1
          : startLineNumber;
      const endColumn =
        originalLineCount > 0
          ? model.getLineMaxColumn(endLineNumber)
          : 1;

      const rangeToReplace = new monacoInstance.Range(
        startLineNumber,
        1,
        endLineNumber,
        endColumn
      );

      // Apply suggestion immediately without conflict resolution
      editor.executeEdits('accept-ai-suggestion', [
        {
          range: rangeToReplace,
          text: suggestedText,
          forceMoveMarkers: true,
        },
      ]);

      // Note: Quota was already consumed when the suggestion was generated
      // in /api/octra-agent, so we don't need to track it again here

      // Rebase remaining suggestions to account for line shifts
      const deltaLines = computeDeltaLines(suggestedText, originalLineCount);
      const acceptedStart = startLineNumber;
      const acceptedEnd = endLineNumber;

      setEditSuggestions((prev) => {
        const remaining = prev.filter((s) => s.id !== suggestionId);
        const adjusted: EditSuggestion[] = [];
        for (const s of remaining) {
          const sStart = getStartLine(s);
          const sOriginalLineCount = getOriginalLineCount(s);
          const sEnd = sOriginalLineCount > 0 ? sStart + sOriginalLineCount - 1 : sStart;

          // If suggestion overlaps the accepted region, drop it (conflict)
          if (rangesOverlap(sStart, sEnd, acceptedStart, acceptedEnd)) {
            // Tie-aware insert: if both are pure insertions on the same line, shift instead of drop
            const acceptedIsInsert = originalLineCount === 0;
            const currentIsInsert = sOriginalLineCount === 0;
            if (
              acceptedIsInsert &&
              currentIsInsert &&
              sStart === acceptedStart &&
              deltaLines !== 0
            ) {
              // Update the position to account for line shifts
              adjusted.push({ 
                ...s, 
                position: { 
                  ...s.position, 
                  line: (s.position?.line || 1) + deltaLines 
                } 
              });
            }
            // Otherwise skip conflicting suggestion
            continue;
          }

          // If suggestion is after the accepted region, shift by deltaLines
          if (sStart > acceptedEnd && deltaLines !== 0) {
            adjusted.push({
              ...s,
              position: { 
                ...s.position, 
                line: (s.position?.line || 1) + deltaLines 
              },
            });
          } else {
            adjusted.push(s);
          }
        }
        return adjusted;
      });
      
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
      const startLineNumber = getStartLine(suggestion);
      const originalLineCount = getOriginalLineCount(suggestion);
      const suggestedText = getSuggestedText(suggestion);
      
      // Ensure endLineNumber is valid and >= startLineNumber
      const endLineNumber = Math.max(
        startLineNumber,
        startLineNumber + originalLineCount - 1
      );

      // Validate line numbers against the current model state
      if (
        startLineNumber <= 0 ||
        endLineNumber <= 0 ||
        startLineNumber > model.getLineCount() ||
        endLineNumber > model.getLineCount()
      ) {
        console.warn(
          `Suggestion ${suggestion.id} line numbers [${startLineNumber}-${endLineNumber}] are out of bounds for model line count ${model.getLineCount()}. Skipping decoration.`
        );
        return; // Skip this suggestion if lines are invalid
      }

      // Calculate end column precisely
      const endColumn =
        originalLineCount > 0
          ? model.getLineMaxColumn(endLineNumber) // End of the last original line
          : 1; // Insertion point column 1

      // Define the range for the original text (or insertion point)
      const originalRange = new monacoInstance.Range(
        startLineNumber,
        1, // Start column is always 1
        endLineNumber,
        endColumn
      );

      // --- Decoration 1: Mark original text (if any) + Glyph ---
      if (originalLineCount > 0) {
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
        newDecorations.push({
          range: new monacoInstance.Range(
            startLineNumber,
            1,
            startLineNumber,
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

      // --- Decoration 2: Show suggested text inline (if any and allowed) ---
      if (showInlinePreview && suggestedText && suggestedText.trim().length > 0) {
        // Use 'after' content widget placed at the end of the original range
        // The range for the 'after' widget itself should be zero-length
        const afterWidgetRange = new monacoInstance.Range(
          endLineNumber,
          endColumn,
          endLineNumber,
          endColumn
        );

        // Prepare suggested content, replacing newlines for inline view
        const inlineSuggestedContent = ` ${suggestedText.replace(/\n/g, ' ↵ ')}`;

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
