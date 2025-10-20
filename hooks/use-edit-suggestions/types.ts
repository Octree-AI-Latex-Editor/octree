import { EditSuggestion } from '@/types/edit';
import type * as Monaco from 'monaco-editor';

/**
 * Internal types for edit suggestions management
 */

export interface EditSuggestionsState {
  editSuggestions: EditSuggestion[];
  totalPendingCount: number;
  decorationIds: string[];
  setDecorationIds: (ids: string[]) => void;
  handleEditSuggestion: (suggestion: EditSuggestion | EditSuggestion[]) => void;
  handleAcceptEdit: (suggestionId: string) => Promise<void>;
  handleAcceptAllEdits: () => Promise<void>;
  handleRejectEdit: (suggestionId: string) => void;
  handleNextSuggestion: () => void;
}

export interface UseEditSuggestionsProps {
  editor: Monaco.editor.IStandaloneCodeEditor | null;
  monacoInstance: typeof Monaco | null;
  showInlinePreview?: boolean; // controls inline 'after' preview decoration
}

export interface SuggestionQueueState {
  editSuggestions: EditSuggestion[];
  queuedSuggestions: EditSuggestion[];
  totalPendingCount: number;
  hasActiveBatch: boolean;
}

