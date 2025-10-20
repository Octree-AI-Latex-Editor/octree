import { EditSuggestion } from '@/types/edit';
import type * as Monaco from 'monaco-editor';
import { toast } from 'sonner';
import {
  getStartLine,
  getOriginalLineCount,
  getSuggestedText,
  computeDeltaLines,
  rangesOverlap,
} from './utils';

/**
 * Accept a single edit suggestion and apply it to the editor
 */
export async function acceptSingleEdit(
  suggestionId: string,
  editSuggestions: EditSuggestion[],
  editor: Monaco.editor.IStandaloneCodeEditor,
  monacoInstance: typeof Monaco,
  onUpdate: (updater: (prev: EditSuggestion[]) => EditSuggestion[]) => void
): Promise<void> {
  const suggestion = editSuggestions.find((s) => s.id === suggestionId);
  if (!suggestion || suggestion.status !== 'pending') return;

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

    // Apply suggestion immediately
    editor.executeEdits('accept-ai-suggestion', [
      {
        range: rangeToReplace,
        text: suggestedText,
        forceMoveMarkers: true,
      },
    ]);

    // Rebase remaining suggestions to account for line shifts
    const deltaLines = computeDeltaLines(suggestedText, originalLineCount);
    const acceptedStart = startLineNumber;
    const acceptedEnd = endLineNumber;

    onUpdate((prev) => {
      const remaining = prev.filter((s) => s.id !== suggestionId);
      const adjusted: EditSuggestion[] = [];
      
      for (const s of remaining) {
        const sStart = getStartLine(s);
        const sOriginalLineCount = getOriginalLineCount(s);
        const sEnd = sOriginalLineCount > 0 ? sStart + sOriginalLineCount - 1 : sStart;

        // If suggestion overlaps the accepted region, handle conflict
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
    
    toast.success('Edit applied', { duration: 1000 });
  } catch (error) {
    console.error('Error applying edit:', error);
    toast.error('Failed to apply this suggestion. Please try again.');
  }
}

/**
 * Accept all pending edit suggestions at once
 */
export async function acceptAllEdits(
  allPendingSuggestions: EditSuggestion[],
  editor: Monaco.editor.IStandaloneCodeEditor,
  monacoInstance: typeof Monaco,
  onClearAll: () => void
): Promise<void> {
  if (allPendingSuggestions.length === 0) return;

  const model = editor.getModel();
  if (!model) {
    console.error('Editor model not available.');
    return;
  }

  try {
    // Sort suggestions from bottom to top (highest line first)
    // This prevents earlier edits from affecting the positions of later edits
    const sortedSuggestions = [...allPendingSuggestions].sort((a, b) => {
      const lineA = getStartLine(a);
      const lineB = getStartLine(b);
      return lineB - lineA; // Descending order
    });

    // Build all edit operations
    const edits = sortedSuggestions.map((suggestion) => {
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

      return {
        range: new monacoInstance.Range(
          startLineNumber,
          1,
          endLineNumber,
          endColumn
        ),
        text: suggestedText,
        forceMoveMarkers: true,
      };
    });

    // Apply all edits in a single batch operation
    editor.executeEdits('accept-all-ai-suggestions', edits);

    onClearAll();
    
    toast.success(`Applied ${allPendingSuggestions.length} edits`, { duration: 2000 });
  } catch (error) {
    console.error('Error applying all edits:', error);
    toast.error('Failed to apply suggestions. Please try again.');
  }
}

/**
 * Reject a single edit suggestion
 */
export function rejectEdit(
  suggestionId: string,
  onUpdate: (updater: (prev: EditSuggestion[]) => EditSuggestion[]) => void
): void {
  onUpdate((prev) => prev.filter((s) => s.id !== suggestionId));
}

