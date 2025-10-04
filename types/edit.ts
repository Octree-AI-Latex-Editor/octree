import { ASTEdit } from '@/lib/octra-agent/ast-edits';

// Legacy EditSuggestion format for backward compatibility
export interface LegacyEditSuggestion {
  id: string;
  startLine: number;
  originalLineCount: number;
  suggested: string;
  original?: string;
  explanation?: string;
  status: 'pending' | 'accepted' | 'rejected';
}

// New AST-based EditSuggestion format
export interface EditSuggestion extends ASTEdit {
  id: string;
  status: 'pending' | 'accepted' | 'rejected';
  original?: string; // Keep original for backward compatibility
}

// Type guard to check if an edit suggestion is in legacy format
export function isLegacyEditSuggestion(edit: EditSuggestion | LegacyEditSuggestion): edit is LegacyEditSuggestion {
  return 'startLine' in edit && 'originalLineCount' in edit && 'suggested' in edit;
}
