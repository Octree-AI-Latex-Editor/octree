import { NextResponse } from 'next/server';
import { query, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';

// Import helper modules
import { 
  validateApiKeys, 
  buildNumberedContent, 
  buildSystemPrompt,
  inferIntent,
  ASTEdit,
  createOctraTools,
  createSSEStream, 
  processStreamMessages, 
  createSSEHeaders,
  getExternalServerConfig, 
  createMCPServerConfig
} from '@/lib/octra-agent';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    // Validate API keys
    const keyValidation = validateApiKeys();
    if (!keyValidation.isValid) {
      return NextResponse.json(
        { error: keyValidation.error },
        { status: 503 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { messages, fileContent, textFromEditor, selectionRange } = body || {};

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

    // Process content and infer intent
    const numberedContent = buildNumberedContent(fileContent, textFromEditor);
    const lastUser = messages[messages.length - 1];
    const userText = typeof lastUser?.content === 'string' ? lastUser.content : '';
    const intent = inferIntent(userText);

    // Collect AST-based edits
    const collectedEdits: ASTEdit[] = [];

    // Create SSE stream
    const { stream, writeEvent, cleanup } = createSSEStream();

    // Create tool context
    const toolContext = {
      fileContent,
      numberedContent,
      textFromEditor,
      selectionRange,
      collectedEdits,
      intent,
      writeEvent,
    };

    // Create tools and MCP server
    const tools = createOctraTools(toolContext);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sdkServer = createSdkMcpServer(createMCPServerConfig(tools) as any);

    // Build system prompt
    const systemPrompt = buildSystemPrompt(numberedContent, textFromEditor, selectionRange);
    const fullPrompt = `${systemPrompt}\n\nUser request:\n${userText}`;

    // Get configuration
    const { queryOptions } = getExternalServerConfig();
    console.log('Using in-process MCP server only');

    // Configure query options
    const finalQueryOptions = {
      ...queryOptions,
      mcpServers: {
        'octra-tools': sdkServer,
      },
    };

    // Initialize AI agent
    let gen;
    try {
      gen = query({
        prompt: fullPrompt,
        options: finalQueryOptions,
      });
    } catch (error) {
      console.error('Failed to initialize Claude Agent SDK:', error);
      return NextResponse.json(
        { 
          error: 'Failed to initialize AI agent', 
          details: error instanceof Error ? error.message : 'Unknown initialization error',
          suggestion: 'The Claude Code server may not be available. Please check the external server status.'
        },
        { status: 503 }
      );
    }

    // Start processing
    writeEvent('status', { state: 'started' });

    // Process stream messages
    (async () => {
      try {
        const finalText = await processStreamMessages(gen, writeEvent, collectedEdits);
        writeEvent('done', { text: finalText, edits: collectedEdits });
      } catch (err) {
        writeEvent('error', { message: (err as Error)?.message || 'Stream error' });
      } finally {
        cleanup();
      }
    })();

    return new Response(stream, {
      headers: createSSEHeaders(),
    });
  } catch (error) {
    console.error('Octra Agent SDK error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to process agent request', details: message },
      { status: 500 }
    );
  }
}
