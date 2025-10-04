'use client';

import { Button } from '@/components/ui/button';
import { DiffViewer } from '@/components/ui/diff-viewer';
import { Check, X } from 'lucide-react';
import { EditSuggestion } from '@/types/edit';

interface SuggestionActionsProps {
  suggestions: EditSuggestion[];
  onAccept: (suggestionId: string) => void;
  onReject: (suggestionId: string) => void;
}

export function SuggestionActions({
  suggestions,
  onAccept,
  onReject,
}: SuggestionActionsProps) {
  const pendingSuggestions = suggestions.filter((s) => s.status === 'pending');

  if (pendingSuggestions.length === 0) {
    return null;
  }

  return (
    <div className="absolute top-2 right-2 z-50 max-w-[350px] space-y-2">
      {pendingSuggestions.map((suggestion) => (
        <div
          key={suggestion.id}
          className="flex flex-col gap-2 rounded-lg border border-blue-200 bg-white p-3 shadow-xl backdrop-blur-sm"
        >
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-blue-700">
              Lines {suggestion.startLine}
              {suggestion.originalLineCount > 1 &&
                `-${suggestion.startLine + suggestion.originalLineCount - 1}`}
            </div>
            <div className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-500">
              AI Suggestion
            </div>
          </div>

          <DiffViewer
            original={suggestion.original ?? ''}
            suggested={suggestion.suggested}
            className="max-w-full"
          />

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onAccept(suggestion.id)}
              className="flex-1 border border-green-200 text-green-700 hover:border-green-300 hover:bg-green-50"
            >
              <Check size={14} className="mr-1" />
              Accept
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onReject(suggestion.id)}
              className="flex-1 border border-red-200 text-red-700 hover:border-red-300 hover:bg-red-50"
            >
              <X size={14} className="mr-1" />
              Reject
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
