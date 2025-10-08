import { LineEdit } from '@/lib/octra-agent/line-edits';

// EditSuggestion format using line-based edits
export interface EditSuggestion extends LineEdit {
  id: string;
  status: 'pending' | 'accepted' | 'rejected';
  original?: string; // Original content for delete operations
}
