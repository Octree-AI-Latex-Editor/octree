import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

export const runtime = 'edge';
export const preferredRegion = 'auto';

// Model selection for conflict resolution
const LARGE_FILE_THRESHOLD = 10000; // characters (match main route)

function chooseModel(fileContentLength: number): string {
  // Use GPT-5 (full) for large files that need complex conflict resolution
  if (fileContentLength > LARGE_FILE_THRESHOLD) {
    console.log('Conflict resolution: Using GPT-5 (full) for large file');
    return 'gpt-5-2025-08-07';
  }
  
  // Use GPT-5 mini for smaller files
  console.log('Conflict resolution: Using GPT-5 mini');
  return 'gpt-5-mini';
}

interface ConflictRequestBody {
  fileContent: string;
  suggestion: {
    id: string;
    original: string;
    suggested: string;
    startLine: number;
    originalLineCount: number;
  };
  currentText: string;
  isSmallChange: boolean;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ConflictRequestBody;
    const { fileContent, suggestion, currentText, isSmallChange } = body;

    // Enhanced validation
    if (!fileContent || typeof fileContent !== 'string') {
      return NextResponse.json(
        { error: 'Invalid conflict resolution payload: fileContent is required' },
        { status: 400 }
      );
    }

    if (!suggestion || !suggestion.suggested) {
      return NextResponse.json(
        { error: 'Invalid conflict resolution payload: suggestion data is required' },
        { status: 400 }
      );
    }

    if (typeof suggestion.startLine !== 'number' || suggestion.startLine < 1) {
      return NextResponse.json(
        { error: 'Invalid conflict resolution payload: valid startLine is required' },
        { status: 400 }
      );
    }

    const lines = fileContent.split('\n');
    const numberedContent = lines
      .map((line, index) => `${index + 1}: ${line}`)
      .join('\n');

    // Choose model based on file size
    const selectedModel = chooseModel(fileContent.length);

    const previousOriginal = suggestion.original.trim().length
      ? suggestion.original
      : '(no original content)';
    const previousSuggested = suggestion.suggested.trim().length
      ? suggestion.suggested
      : '(no suggested content)';

    // Use GPT-5 Responses API for conflict resolution
    const systemPrompt = `You are Octra, a LaTeX expert assistant. Provide updated latex-diff code blocks that apply the intended change. Ensure diffs use accurate line numbers, omit line number prefixes within the diff body, and keep changes minimal.

Current numbered file content:
---
${numberedContent}
---`;

    const userPrompt = `The document changed after an earlier suggestion. Update the suggestion so it applies cleanly now.

Previous suggestion metadata:
- Start line: ${suggestion.startLine}
- Original line count: ${suggestion.originalLineCount}
- Original snippet:
---
${previousOriginal}
---
- Intended replacement snippet:
---
${previousSuggested}
---

Current snippet at the targeted region:
---
${currentText || '(empty)'}
---

Return updated latex-diff code block(s) that integrate the intended replacement. Include a brief explanation after the code block.`;

    const { text } = await generateText({
      model: openai('gpt-4o-mini'),
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      temperature: 0.2,
      maxTokens: 1200,
    });

    return NextResponse.json({ content: text });
  } catch (error) {
    console.error('Conflict resolution error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const isRateLimitError = errorMessage.toLowerCase().includes('rate limit');
    
    if (isRateLimitError) {
      return NextResponse.json(
        { 
          error: 'AI service rate limit exceeded',
          details: 'Please wait a moment before trying again',
          retryable: true
        },
        { status: 429 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to resolve suggestion conflict',
        details: errorMessage,
        retryable: true
      },
      { status: 500 }
    );
  }
}
