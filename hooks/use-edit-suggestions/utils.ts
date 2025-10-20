import { EditSuggestion } from '@/types/edit';
import type * as Monaco from 'monaco-editor';

/**
 * Utility functions for working with edit suggestions
 */

/**
 * Extract the starting line number from a suggestion
 */
export function getStartLine(suggestion: EditSuggestion): number {
  return suggestion.position?.line || 1;
}

/**
 * Get the number of original lines affected by this suggestion
 */
export function getOriginalLineCount(suggestion: EditSuggestion): number {
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

/**
 * Get the suggested text content from a suggestion
 */
export function getSuggestedText(suggestion: EditSuggestion): string {
  return suggestion.content || '';
}

/**
 * Normalize newlines to \n
 */
export function normalizeNewlines(text: string): string {
  return text.replace(/\r\n?/g, '\n');
}

/**
 * Count the number of lines in text
 */
export function countLines(text: string): number {
  if (!text) return 0;
  const norm = normalizeNewlines(text);
  return norm === '' ? 0 : norm.split('\n').length;
}

/**
 * Extract original text from the Monaco editor model
 */
export function getOriginalTextFromModel(
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
  for (let ln = startLine; ln <= endLine; ln++) {
    lines.push(model.getLineContent(ln));
  }
  return lines.join('\n');
}

/**
 * Calculate the line delta when applying a suggestion
 */
export function computeDeltaLines(suggested: string, originalLineCount: number): number {
  const suggestedLines = countLines(suggested);
  return suggestedLines - originalLineCount;
}

/**
 * Check if two line ranges overlap
 */
export function rangesOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number
): boolean {
  return !(aEnd < bStart || aStart > bEnd);
}

/**
 * Normalize suggestions to ensure consistent status
 */
export function normalizeSuggestions(suggestions: EditSuggestion[]): EditSuggestion[] {
  return suggestions.map((suggestion) => ({
    ...suggestion,
    status: 'pending' as const,
  }));
}

