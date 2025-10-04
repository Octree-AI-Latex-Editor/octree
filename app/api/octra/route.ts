import { NextResponse } from 'next/server';
import { streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

export const runtime = 'edge';
export const preferredRegion = 'auto';

// Validate required environment variables
function validateApiKeys(): { isValid: boolean; error?: string } {
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;

  if (!hasAnthropic) {
    return {
      isValid: false,
      error: 'No Anthropic API key configured. Please set ANTHROPIC_API_KEY.'
    };
  }

  return { isValid: true };
}

// Model selection thresholds
const LARGE_FILE_THRESHOLD = 10000; // characters (increased - most LaTeX files are < 10k)
const LARGE_SELECTION_THRESHOLD = 2000; // characters (only selected text, not message)

// Smart model selection based on file size and selection complexity
function chooseModel(fileContentLength: number, selectedTextLength: number): 'claude-3-5-sonnet-latest' | 'claude-3-5-haiku-latest' {
  // Use GPT-5 (full) for:
  // 1. Very large files (>10k chars) - complex documents
  // 2. Large text selections (>2k chars) - complex edits
  if (fileContentLength > LARGE_FILE_THRESHOLD || selectedTextLength > LARGE_SELECTION_THRESHOLD) {
    console.log('Using Claude 3.5 Sonnet for large/complex request');
    return 'claude-3-5-sonnet-latest';
  }
  
  // Use GPT-5 mini for smaller, well-defined tasks
  console.log('Using Claude 3.5 Haiku for standard request');
  return 'claude-3-5-haiku-latest';
}

export async function POST(request: Request) {
  try {
    // Validate API keys first
    const keyValidation = validateApiKeys();
    if (!keyValidation.isValid) {
      return NextResponse.json(
        { error: keyValidation.error },
        { status: 503 }
      );
    }

    const { messages, fileContent, textFromEditor, changeType } = await request.json();

    // Validate request body
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request: messages array is required' },
        { status: 400 }
      );
    }

    if (!fileContent || typeof fileContent !== 'string') {
      return NextResponse.json(
        { error: 'Invalid request: fileContent is required' },
        { status: 400 }
      );
    }

    // --- Add Line Numbers to Content ---
    // Optimize for large files: only include relevant context if file is very large
    const lines = fileContent.split('\n');
    const MAX_LINES_FULL_CONTEXT = 500; // Only send full file if under 500 lines
    
    let numberedContent: string;
    if (lines.length <= MAX_LINES_FULL_CONTEXT) {
      // Send full file with line numbers
      numberedContent = lines
        .map((line: unknown, index: number) => `${index + 1}: ${line}`)
        .join('\n');
    } else {
      // For large files, provide smart context window
      // Include first 100 lines, last 100 lines, and context around selection if available
      const startLines = lines.slice(0, 100)
        .map((line: unknown, index: number) => `${index + 1}: ${line}`)
        .join('\n');
      const endLines = lines.slice(-100)
        .map((line: unknown, index: number) => `${lines.length - 100 + index + 1}: ${line}`)
        .join('\n');
      
      numberedContent = `${startLines}\n\n... [${lines.length - 200} lines omitted] ...\n\n${endLines}`;
      
      // If there's selected text, try to include that region
      if (textFromEditor && textFromEditor.length > 0) {
        // This is a simplified approach - in production you might want to find the exact line range
        numberedContent += `\n\n[Selected region context will be provided separately]`;
      }
    }
    // ------------------------------------

    // Calculate selection length for model selection (NOT including user message)
    const selectedTextLength = textFromEditor?.length || 0;
    
    // Choose model based on file size and selection size
    const selectedModel = chooseModel(fileContent.length, selectedTextLength);

    console.log('Octra API: Starting AI request with model:', selectedModel);
    console.log('Octra API: Messages count:', messages.length);
    console.log('Octra API: File content length:', fileContent.length);
    console.log('Octra API: Selected text length:', selectedTextLength);

    // Build the input for GPT-5 Responses API
    const systemPrompt = `You are Octra, a LaTeX expert AI assistant. Your goal is to provide helpful explanations and suggest precise code edits.

The user's current file content will be provided with line numbers prepended, like "1: \\documentclass...".

When suggesting edits based on the user's request and the provided numbered file content:
1.  Format edits *strictly* as latex-diff code blocks:
    \`\`\`latex-diff
    @@ -startLine,originalLineCount +newStartLine,newLineCount @@
    -old line 1 content (NO line number prefix!)
    -old line 2 content (NO line number prefix!)
    +new line 1 content (NO line number prefix!)
    +new line 2 content (NO line number prefix!)
    \`\`\`
2.  **CRITICAL: Line Number Accuracy (Referencing Prefixed Numbers):**
    *   The \`startLine\` and \`originalLineCount\` in the \`@@ ... @@\` header *must* accurately reflect the **prepended line numbers** shown in the input file content.
    *   \`startLine\` is the **prepended number** of the *first* line marked with '-' (or the line *before* the first '+'-marked line if only adding).
    *   \`originalLineCount\` is the *total number* of lines marked with '-' (corresponding to the count of original lines being replaced/removed). If only adding lines, this should often be 0.
    *   Double-check these numbers carefully against the **prepended numbers** in the provided numbered file content.
3.  **CRITICAL: Diff Body Content (NO Line Numbers):**
    *   The actual content shown on lines starting with \`-\` or \`+\` in the diff block MUST **NOT** include the prepended line number and colon (e.g., use \`-    F = m a\`, NOT \`- 17:     F = m a\`). Only include the original LaTeX code.
4.  **CRITICAL: Minimal Edits & Structure Preservation:**
    *   Modify *only* the specific parts requested or necessary. Preserve surrounding structures. Generate the minimal diff.
5.  **Multiple Suggestions:**
    *   When there are multiple unrelated or distant changes, generate a separate \`@@ ... @@\` diff hunk for each change, even if they are in the same file. Do NOT combine all changes into a single large hunk. Each hunk should represent a single atomic change or a group of adjacent changes.
6.  **Explanation:** Always explain *why* you are suggesting the changes *outside* the code block.

**Example Scenario (Input has line numbers):**
User Request: "Change F=ma to F=kx"
Relevant Numbered Original File Content:
\`\`\`latex
15: Some text before.
16: \\begin{equation}
17:     F = m a
18: \\end{equation}
19: Some text after.
\`\`\`
Correct Output Diff Block:
\`\`\`latex-diff
@@ -17,1 +17,1 @@
-    F = m a
+    F = k x
\`\`\`
*Explanation:* The change only affects the line numbered '17'. The header correctly reflects \`-17,1 +17,1\`. The diff body lines do NOT repeat the '17:'.

Current numbered file content:
---
${numberedContent}
---
${textFromEditor ? `\nSelected text from editor for context:\n---\n${textFromEditor}\n---\n\nThe user has selected this specific text and may be asking about improvements or changes to it.` : ''}`;

    const userMessage = messages[messages.length - 1]?.content || '';

    try {
      const result = await streamText({
        model: anthropic(selectedModel),
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          ...messages.slice(-3),
        ],
        temperature: 0.2,
        maxTokens: 2000,
      });

      console.log('Octra API: streamText completed');
      
      return result.toDataStreamResponse();
    } catch (apiError) {
      console.error('Octra API: streamText error:', apiError);
      throw apiError;
    }
  } catch (error) {
    console.error('AI API error:', error);
    
    // Provide more detailed error information
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const isRateLimitError = errorMessage.toLowerCase().includes('rate limit');
    const isAuthError = errorMessage.toLowerCase().includes('auth') || errorMessage.toLowerCase().includes('api key');
    
    if (isRateLimitError) {
      return NextResponse.json(
        { 
          error: 'AI service rate limit exceeded',
          details: 'Please try again in a few moments',
          retryable: true
        },
        { status: 429 }
      );
    }
    
    if (isAuthError) {
      return NextResponse.json(
        { 
          error: 'AI service authentication failed',
          details: 'Please check API key configuration',
          retryable: false
        },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to process request',
        details: errorMessage,
        retryable: true
      },
      { status: 500 }
    );
  }
}

