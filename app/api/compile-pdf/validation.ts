import type { CompileRequest } from './types';

export interface ValidationError {
  error: string;
  details: string;
  suggestion: string;
}

/**
 * Validates the compile request
 */
export function validateCompileRequest(body: CompileRequest): ValidationError | null {
  const { content, files } = body;

  // Validate: must have either content or files
  if (!content && (!files || files.length === 0)) {
    return {
      error: 'Invalid request',
      details: 'Must provide either content or files array',
      suggestion: 'Please provide valid LaTeX content or files',
    };
  }

  // For backward compatibility, if content is provided, validate it
  if (content && typeof content !== 'string') {
    return {
      error: 'Invalid content',
      details: 'Content must be a non-empty string',
      suggestion: 'Please provide valid LaTeX content',
    };
  }

  return null;
}

/**
 * Validates LaTeX structure
 */
export function validateLatexStructure(body: CompileRequest): ValidationError | null {
  const { content, files } = body;

  // Extract main content
  let mainContent = '';
  if (files && files.length > 0) {
    // Find main.tex in multi-file project
    const mainFile = files.find(f => f.path === 'main.tex') || files.find(f => f.path.endsWith('.tex'));
    mainContent = mainFile?.content || '';
  } else if (content) {
    mainContent = content;
  }

  if (!mainContent) {
    return null;
  }

  const hasDocumentClass = mainContent.includes('\\documentclass');
  const hasBeginDocument = mainContent.includes('\\begin{document}');
  const hasEndDocument = mainContent.includes('\\end{document}');

  if (!hasDocumentClass) {
    return {
      error: 'Invalid LaTeX structure',
      details: 'LaTeX document must start with \\documentclass declaration',
      suggestion: 'Add \\documentclass{article} at the beginning of your document',
    };
  }

  if (!hasBeginDocument || !hasEndDocument) {
    return {
      error: 'Invalid LaTeX structure',
      details: 'LaTeX document must have \\begin{document} and \\end{document}',
      suggestion: 'Wrap your content between \\begin{document} and \\end{document}',
    };
  }

  return null;
}

