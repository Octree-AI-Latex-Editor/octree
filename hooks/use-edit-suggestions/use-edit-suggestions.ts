'use client';

import { useCallback } from 'react';
import { toast } from 'sonner';
import { useEditLimitCache } from '../use-edit-limit-cache';
import { useSuggestionQueue } from './use-suggestion-queue';
import { useSuggestionDecorations } from './use-suggestion-decorations';
import { acceptSingleEdit, acceptAllEdits, rejectEdit } from './suggestion-operations';
import type { EditSuggestionsState, UseEditSuggestionsProps } from './types';

/**
 * Main hook for managing edit suggestions with decorations, queue, and operations
 */
export function useEditSuggestions({
  editor,
  monacoInstance,
  showInlinePreview = true,
}: UseEditSuggestionsProps): EditSuggestionsState {
  // Use cached edit limit to check before requesting AI suggestions
  // Note: Quota is consumed on generation (in /api/octra-agent), not on accept
  const { canEdit } = useEditLimitCache();

  // Manage suggestion queue with batching
  const {
    editSuggestions,
    setEditSuggestions,
    queuedSuggestions,
    totalPendingCount,
    handleEditSuggestion,
    handleNextSuggestion,
    clearContinueToast,
  } = useSuggestionQueue({ editor });

  // Manage editor decorations
  const { decorationIds, setDecorationIds } = useSuggestionDecorations({
    editor,
    monacoInstance,
    editSuggestions,
    showInlinePreview,
  });

  // Accept a single edit
  const handleAcceptEdit = useCallback(
    async (suggestionId: string) => {
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

      await acceptSingleEdit(
        suggestionId,
        editSuggestions,
        editor,
        monacoInstance,
        setEditSuggestions
      );
    },
    [canEdit, editor, monacoInstance, editSuggestions, setEditSuggestions]
  );

  // Accept all pending edits
  const handleAcceptAllEdits = useCallback(async () => {
    // Get ALL suggestions - both visible and queued
    const allPendingSuggestions = [
      ...editSuggestions.filter((s) => s.status === 'pending'),
      ...queuedSuggestions
    ];

    if (allPendingSuggestions.length === 0) return;

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

    await acceptAllEdits(
      allPendingSuggestions,
      editor,
      monacoInstance,
      () => {
        // Clear all suggestions and queue
        setEditSuggestions([]);
        clearContinueToast();
      }
    );
  }, [
    editSuggestions,
    queuedSuggestions,
    canEdit,
    editor,
    monacoInstance,
    setEditSuggestions,
    clearContinueToast,
  ]);

  // Reject a single edit
  const handleRejectEdit = useCallback(
    (suggestionId: string) => {
      rejectEdit(suggestionId, setEditSuggestions);
    },
    [setEditSuggestions]
  );

  return {
    editSuggestions,
    totalPendingCount,
    decorationIds,
    setDecorationIds,
    handleEditSuggestion,
    handleAcceptEdit,
    handleAcceptAllEdits,
    handleRejectEdit,
    handleNextSuggestion,
  };
}

