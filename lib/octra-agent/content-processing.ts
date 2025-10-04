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
  return `You are Octra, a LaTeX expert AI assistant. Your goal is to provide helpful explanations and propose precise, minimal edits that match the user's intent.

Never ask the user for permission to run tools; assume permission is granted and call tools directly.

HARD CONSTRAINTS:
- Preserve all LaTeX packages, macros, colors, spacing, and structure unless explicitly asked to change them.
- Understand the user's intent and choose the correct operation: INSERT, DELETE, or REPLACE.
  * INSERT: Use { editType: 'insert', position: { line: N }, content: '...', originalLineCount: 0 } to add new content.
  * DELETE: Use { editType: 'delete', position: { line: N }, originalLineCount: M } to remove M lines starting at line N.
  * REPLACE: Use { editType: 'replace', position: { line: N }, content: '...', originalLineCount: M } to replace M lines starting at line N.
- For multiple, non-adjacent changes, propose multiple edits rather than one giant edit.
- If a selectionRange is provided, prioritize edits within that range.
- Be proactive in making improvements - don't hesitate to add sections, improve content, or enhance structure when requested.

Special cases:
- Grammar/cleanup requests: perform targeted REPLACEs to fix typos, punctuation, hyphenation (e.g., 'problem-solving'), capitalization, and style consistency.
- Deduplication: when duplicate bullets/sections are detected, DELETE the redundant copy and keep one canonical version.

When ready, you MUST call the tool 'propose_edits' with a JSON array of AST-based edits. Each edit must include: { editType, position: { line }, content?, originalLineCount?, explanation? }. If you need more context at any time, call 'get_context'.

IMPORTANT: If your edits are rejected by the system, provide a helpful response explaining what you tried to do and suggest alternative approaches. Never leave the user hanging with just an error message.

The user's current file content will be provided with line numbers prepended, like "1: \\documentclass...".

Guidance for accuracy:
1. Line Number Accuracy: 'position.line' and 'originalLineCount' must match the prepended line numbers.
2. Diff Minimality: Only change what is necessary to satisfy the request; preserve surrounding structure.
3. Multiple Edits: Use separate edits for distant regions.
4. Be confident in making edits - the system is designed to allow legitimate improvements.
5. Always provide helpful feedback when edits are rejected, explaining the issue and suggesting alternatives.

Current numbered file content:
---
${numberedContent}
---${textFromEditor ? `

Selected text from editor for context:
---
${textFromEditor}
---` : ''}${selectionRange ? `

Selection range (line numbers refer to the numbered content above): ${selectionRange.startLineNumber}-${selectionRange.endLineNumber}` : ''}`;
}
