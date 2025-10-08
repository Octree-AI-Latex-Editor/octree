/**
 * Content processing utilities for LaTeX documents
 * Handles file content formatting, numbering, and text processing
 */

/**
 * Build numbered content with line numbers for better editing precision
 * @param fileContent - The raw file content
 * @param textFromEditor - Optional selected text from editor
 * @returns Numbered content string
 */
export function buildNumberedContent(fileContent: string, textFromEditor?: string | null): string {
  const lines = fileContent.split('\n');
  const MAX_LINES_FULL_CONTEXT = 500;

  if (lines.length <= MAX_LINES_FULL_CONTEXT) {
    return lines
      .map((line, index) => `${index + 1}: ${line}`)
      .join('\n');
  }

  const startLines = lines
    .slice(0, 100)
    .map((line, index) => `${index + 1}: ${line}`)
    .join('\n');
  const endLines = lines
    .slice(-100)
    .map((line, index) => `${lines.length - 100 + index + 1}: ${line}`)
    .join('\n');

  let numbered = `${startLines}\n\n... [${lines.length - 200} lines omitted] ...\n\n${endLines}`;
  if (textFromEditor && textFromEditor.length > 0) {
    numbered += `\n\n[Selected region context will be provided separately]`;
  }
  return numbered;
}

/**
 * Normalize line endings by converting CRLF and CR to LF
 * @param text - Text to normalize
 * @returns Normalized text with LF line endings
 */
export function normalizeLineEndings(text: string): string {
  return text
    .split('\r\n').join('\n')
    .split('\r').join('\n');
}

/**
 * Validate API keys for required services
 * @returns Validation result with error message if invalid
 */
export function validateApiKeys(): { isValid: boolean; error?: string } {
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  if (!hasAnthropic) {
    return {
      isValid: false,
      error: 'No Anthropic API key configured. Please set ANTHROPIC_API_KEY.',
    };
  }
  return { isValid: true };
}

/**
 * Build system prompt for the AI agent
 * @param numberedContent - Numbered file content
 * @param textFromEditor - Optional selected text
 * @param selectionRange - Optional selection range
 * @returns Complete system prompt
 */
export function buildSystemPrompt(
  numberedContent: string,
  textFromEditor?: string | null,
  selectionRange?: { startLineNumber: number; endLineNumber: number } | null
): string {
  return `You are Octra, a LaTeX editing assistant. You edit LaTeX documents by calling the 'propose_edits' tool.

ABSOLUTE RULE: For ANY editing request, you MUST:
1. Immediately call the 'propose_edits' tool with the edit
2. NEVER explain what should be done manually
3. NEVER say you're "encountering issues" - just call the tool

You have THREE edit types:
- INSERT: { editType: 'insert', position: { line: N }, content: '...', originalLineCount: 0 }
- DELETE: { editType: 'delete', position: { line: N }, originalLineCount: M }
- REPLACE: { editType: 'replace', position: { line: N }, content: '...', originalLineCount: M }

EXAMPLES:

User: "add a title"
You: [Call propose_edits with insert at line 2]

User: "remove the introduction"
You: [Call propose_edits with delete]

User: "fix the equation"
You: [Call propose_edits with replace]

WORKFLOW:
1. User asks for edit → You call propose_edits immediately
2. Tool returns success → You say "Done! Added/changed X"
3. That's it. No manual instructions, no explaining what to do.

Line numbers below are 1-indexed. Match them exactly in your edits.

---
${numberedContent}
---${textFromEditor ? `

Selected text:
---
${textFromEditor}
---` : ''}${selectionRange ? `

Selection: lines ${selectionRange.startLineNumber}-${selectionRange.endLineNumber}` : ''}`;
}
