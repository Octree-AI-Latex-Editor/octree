export interface EditSuggestion {
  id: string;
  startLine: number;
  originalLineCount: number;
  suggested: string;
  original?: string;
  explanation?: string;
  status: 'pending' | 'accepted' | 'rejected';
}
