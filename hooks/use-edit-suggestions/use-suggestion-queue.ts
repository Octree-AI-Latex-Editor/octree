import { useState, useRef, useCallback, useEffect } from 'react';
import { EditSuggestion } from '@/types/edit';
import { toast } from 'sonner';
import { normalizeSuggestions, getOriginalTextFromModel, getStartLine, getOriginalLineCount } from './utils';
import type * as Monaco from 'monaco-editor';

interface UseSuggestionQueueProps {
  editor: Monaco.editor.IStandaloneCodeEditor | null;
}

/**
 * Manages the queue of edit suggestions with batching logic
 */
export function useSuggestionQueue({ editor }: UseSuggestionQueueProps) {
  const [editSuggestions, setEditSuggestions] = useState<EditSuggestion[]>([]);
  const suggestionQueueRef = useRef<EditSuggestion[]>([]);
  const continueToastIdRef = useRef<string | number | null>(null);
  const promptDisplayedRef = useRef(false);
  const hasActiveBatchRef = useRef(false);

  const clearContinueToast = useCallback(() => {
    if (continueToastIdRef.current !== null) {
      toast.dismiss(continueToastIdRef.current);
      continueToastIdRef.current = null;
    }
  }, []);

  const applyIncomingSuggestions = useCallback(
    (
      incoming: EditSuggestion[],
      options: { suppressLimitNotice?: boolean } = {}
    ) => {
      // Enrich suggestions with original text from the current model when missing
      const model: Monaco.editor.ITextModel | null = editor ? editor.getModel() : null;

      const withOriginals = incoming.map((s) => {
        if (s.original !== undefined || !model) return s;
        return {
          ...s,
          original: getOriginalTextFromModel(model, getStartLine(s), getOriginalLineCount(s)),
        };
      });

      const normalized = normalizeSuggestions(withOriginals);
      const firstBatch = normalized.slice(0, 5);
      const remaining = normalized.slice(5);

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
    [editor, clearContinueToast]
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

    const nextBatch = suggestionQueueRef.current.slice(0, 5).map((suggestion) => ({
      ...suggestion,
      status: 'pending' as const,
    }));

    suggestionQueueRef.current = suggestionQueueRef.current.slice(5).map((suggestion) => ({
      ...suggestion,
      status: 'pending' as const,
    }));

    setEditSuggestions(nextBatch);
    hasActiveBatchRef.current = nextBatch.length > 0;
    promptDisplayedRef.current = false;
    clearContinueToast();
  }, [clearContinueToast]);

  // Show continue prompt when current batch is complete
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearContinueToast();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalPendingCount = 
    editSuggestions.filter((s) => s.status === 'pending').length + 
    suggestionQueueRef.current.length;

  return {
    editSuggestions,
    setEditSuggestions,
    queuedSuggestions: suggestionQueueRef.current,
    totalPendingCount,
    handleEditSuggestion,
    handleNextSuggestion,
    clearContinueToast,
  };
}

