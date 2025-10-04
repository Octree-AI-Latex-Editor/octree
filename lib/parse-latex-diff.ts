import { EditSuggestion } from '@/types/edit';
import { v4 as uuidv4 } from 'uuid';

const DIFF_BLOCK_REGEX = /```latex-diff[^\n]*\r?\n([\s\S]*?)\r?\n```/gi;
const DIFF_HEADER_REGEX =
  /@@\s*-(\d+)(?:,(\d+))?\s*\+(\d+)(?:,(\d+))?\s*@@/;

export function parseLatexDiff(content: string): EditSuggestion[] {
  const suggestions: EditSuggestion[] = [];
  let match: RegExpExecArray | null;

  while ((match = DIFF_BLOCK_REGEX.exec(content)) !== null) {
    const diffBlockContent = match[1];
    const lines = diffBlockContent.trim().split(/\r?\n/);

    const headerMatch = lines[0]?.match(DIFF_HEADER_REGEX);

    if (!headerMatch) {
      console.error('Could not parse diff header:', lines[0]);
      continue;
    }

    let originalContent = '';
    let suggestedContent = '';
    let actualOriginalLineCount = 0;
    let firstChangeIndex = -1;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const lineContent = line.slice(1);

      if (line.startsWith('-')) {
        originalContent += lineContent + '\n';
        actualOriginalLineCount++;
        if (firstChangeIndex === -1) {
          firstChangeIndex = i - 1;
        }
      } else if (line.startsWith('+')) {
        suggestedContent += lineContent + '\n';
        if (firstChangeIndex === -1) {
          firstChangeIndex = i - 1;
        }
      }
    }

    const referenceStartLine = parseInt(headerMatch[1], 10);
    const referenceOriginalCount = headerMatch[2]
      ? parseInt(headerMatch[2], 10)
      : 0;
    const referenceAddedStartLine = parseInt(headerMatch[3], 10);
    const hasValidAddedStart = !Number.isNaN(referenceAddedStartLine);

    const baseStartLine =
      actualOriginalLineCount > 0 || referenceOriginalCount > 0 || !hasValidAddedStart
        ? referenceStartLine
        : referenceAddedStartLine;

    const correctedStartLine =
      firstChangeIndex !== -1 ? baseStartLine + firstChangeIndex : baseStartLine;

    if (actualOriginalLineCount === 0 && referenceOriginalCount > 0) {
      actualOriginalLineCount = referenceOriginalCount;
    }

    originalContent = originalContent.replace(/\n$/, '');
    suggestedContent = suggestedContent.replace(/\n$/, '');

    if (originalContent || suggestedContent) {
      suggestions.push({
        id: uuidv4(),
        original: originalContent,
        suggested: suggestedContent,
        startLine: correctedStartLine,
        originalLineCount: actualOriginalLineCount,
        status: 'pending',
      });
    }
  }

  return suggestions;
}
