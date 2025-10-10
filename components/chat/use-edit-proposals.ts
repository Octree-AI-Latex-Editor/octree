import { useState, useRef, useCallback } from 'react';
import { LineEdit } from '@/lib/octra-agent/line-edits';
import { EditSuggestion } from '@/types/edit';

export type ProposalState = 'pending' | 'success' | 'error';

export interface ProposalIndicator {
  state: ProposalState;
  count?: number;
  violations?: number;
  errorMessage?: string;
}

export function useEditProposals(fileContent: string) {
  const [proposalIndicators, setProposalIndicators] = useState<
    Record<string, ProposalIndicator>
  >({});
  const processedEditsRef = useRef<Set<string>>(new Set());
  const pendingTimestampRef = useRef<Record<string, number>>({});
  const editIdCounterRef = useRef(0);

  const clearProposals = useCallback(() => {
    processedEditsRef.current.clear();
    setProposalIndicators({});
  }, []);

  const setPending = useCallback((messageId: string, count: number, violations?: number) => {
    pendingTimestampRef.current[messageId] = Date.now();
    setProposalIndicators((prev) => ({
      ...prev,
      [messageId]: {
        state: 'pending',
        count,
        violations,
      },
    }));
  }, []);

  const setError = useCallback((messageId: string, errorMessage: string) => {
    setProposalIndicators((prev) => ({
      ...prev,
      [messageId]: {
        state: 'error',
        errorMessage,
      },
    }));
  }, []);

  const convertEditsToSuggestions = useCallback(
    (edits: LineEdit[], messageId: string): EditSuggestion[] => {
      // Create unique key for deduplication
      const editsKey = JSON.stringify(
        edits.map((e) => ({
          type: e.editType,
          line: e.position?.line,
          content: e.content,
          lineCount: e.originalLineCount,
          explanation: e.explanation,
        }))
      );

      // Skip duplicates
      if (processedEditsRef.current.has(editsKey)) {
        console.log('[Chat] Skipping duplicate edits');
        return [];
      }
      processedEditsRef.current.add(editsKey);

      // Map to EditSuggestions
      const mapped: EditSuggestion[] = edits.map((edit, idx) => {
        let originalContent = '';
        if (
          edit.editType === 'delete' &&
          edit.position?.line &&
          edit.originalLineCount
        ) {
          const startLine = edit.position.line;
          const lineCount = edit.originalLineCount;
          const lines = fileContent.split('\n');
          const endLine = Math.min(startLine + lineCount - 1, lines.length);
          originalContent = lines.slice(startLine - 1, endLine).join('\n');
        }

        editIdCounterRef.current += 1;

        return {
          ...edit,
          id: `${Date.now()}-${editIdCounterRef.current}-${idx}`,
          status: 'pending' as const,
          original: originalContent,
        };
      });

      // Set success indicator with minimum display time
      if (mapped.length > 0) {
        const minDisplayTime = 800;
        const pendingStartTime = pendingTimestampRef.current[messageId];

        if (pendingStartTime) {
          const elapsed = Date.now() - pendingStartTime;
          const remainingTime = Math.max(0, minDisplayTime - elapsed);

          setTimeout(() => {
            setProposalIndicators((prev) => ({
              ...prev,
              [messageId]: {
                state: 'success',
                count: mapped.length,
              },
            }));
            delete pendingTimestampRef.current[messageId];
          }, remainingTime);
        } else {
          setProposalIndicators((prev) => ({
            ...prev,
            [messageId]: {
              state: 'success',
              count: mapped.length,
            },
          }));
        }
      }

      return mapped;
    },
    [fileContent]
  );

  return {
    proposalIndicators,
    clearProposals,
    setPending,
    setError,
    convertEditsToSuggestions,
  };
}

