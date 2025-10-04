import { NextResponse } from 'next/server';
import { query, tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

export const runtime = 'nodejs';

function validateApiKeys(): { isValid: boolean; error?: string } {
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  if (!hasAnthropic) {
    return {
      isValid: false,
      error: 'No Anthropic API key configured. Please set ANTHROPIC_API_KEY.',
    };
  }
  return { isValid: true };
}

function buildNumberedContent(fileContent: string, textFromEditor?: string | null) {
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

export async function POST(request: Request) {
  try {
    const keyValidation = validateApiKeys();
    if (!keyValidation.isValid) {
      return NextResponse.json(
        { error: keyValidation.error },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { messages, fileContent, textFromEditor } = body || {};

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

    const numberedContent = buildNumberedContent(fileContent, textFromEditor);

    // Collect edits proposed via tool calls for returning to client as JSON
    const collectedEdits: Array<{
      startLine: number;
      originalLineCount: number;
      newText: string;
      explanation?: string;
    }> = [];

    // Create an SSE stream
    const encoder = new TextEncoder();
    type StreamController = { enqueue: (chunk: Uint8Array) => void; close: () => void };
    let streamController: StreamController | null = null;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        // Cast to structural type for Node/Edge compatibility without DOM lib
        streamController = controller as unknown as StreamController;
      },
      cancel() {
        streamController = null;
      },
    });

    const writeEvent = (event: string, data: unknown) => {
      if (!streamController) return;
      const payload = typeof data === 'string' ? data : JSON.stringify(data);
      const chunk = encoder.encode(`event: ${event}\ndata: ${payload}\n\n`);
      streamController.enqueue(chunk);
    };

    // Define tools for the Agent SDK
    const getContextTool = tool(
      'get_context',
      'Retrieve the current LaTeX file context with numbered lines and optional user selection.',
      {
        includeNumbered: z.boolean().optional().default(true),
        includeSelection: z.boolean().optional().default(true),
      },
      async (args) => {
        const payload: Record<string, unknown> = {
          lineCount: fileContent.split('\n').length,
        };
        if (args.includeNumbered !== false) {
          payload.numberedContent = numberedContent;
        }
        if (args.includeSelection !== false && textFromEditor) {
          payload.selection = textFromEditor;
        }
        writeEvent('tool', { name: 'get_context' });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(payload),
            },
          ],
        };
      }
    );

    const proposeEditsTool = tool(
      'propose_edits',
      'Propose JSON-structured edits to the LaTeX document. Use when ready to suggest concrete changes.',
      {
        edits: z
          .array(
            z.object({
              startLine: z.number().int().min(1),
              originalLineCount: z.number().int().min(0),
              newText: z.string(),
              explanation: z.string().optional(),
            })
          )
          .min(1),
      },
      async (args) => {
        for (const e of args.edits) {
          collectedEdits.push(e);
        }
        // Stream edits incrementally to the client
        writeEvent('tool', { name: 'propose_edits', count: args.edits.length });
        writeEvent('edits', args.edits);
        return {
          content: [
            {
              type: 'text',
              text: `Recorded ${args.edits.length} edit(s) as JSON.`,
            },
          ],
        };
      }
    );

    const sdkServer = createSdkMcpServer({
      name: 'octra-tools',
      version: '1.0.0',
      tools: [getContextTool, proposeEditsTool],
    });

    const systemPrompt = `You are Octra, a LaTeX expert AI assistant. Your goal is to provide helpful explanations and suggest precise code edits.\n\nNever ask the user for permission to run tools; assume permission is granted and call tools directly.\n\nWhen you are ready to suggest changes, you MUST call the tool 'propose_edits' with a JSON array of edits. Each edit must include: { startLine, originalLineCount, newText, explanation? }. If you need more context at any time, call the tool 'get_context'.\n\nThe user's current file content will be provided with line numbers prepended, like "1: \\documentclass...".\n\nWhen suggesting edits based on the user's request and the provided numbered file content:\n1.  Format edits strictly as latex-diff code blocks:\n\n\`\`\`latex-diff\n@@ -startLine,originalLineCount +newStartLine,newLineCount @@\n-old line 1 content (NO line number prefix!)\n-old line 2 content (NO line number prefix!)\n+new line 1 content (NO line number prefix!)\n+new line 2 content (NO line number prefix!)\n\`\`\`\n\n2. Line Number Accuracy: The startLine and originalLineCount in the header must reflect the prepended line numbers.\n3. Diff Body Content: Do not include the prepended line numbers in '-' or '+' lines.\n4. Minimal edits; preserve structure.\n5. Use multiple hunks for distant changes.\n6. Always include a short explanation outside the code block.\n\nCurrent numbered file content:\n---\n${numberedContent}\n---\n${textFromEditor ? `\nSelected text from editor for context:\n---\n${textFromEditor}\n---\n` : ''}`;

    const lastUser = messages[messages.length - 1];
    const userText = typeof lastUser?.content === 'string' ? lastUser.content : '';
    const fullPrompt = `${systemPrompt}\n\nUser request:\n${userText}`;

    const gen = query({
      prompt: fullPrompt,
      options: {
        includePartialMessages: true,
        // Expose our in-process MCP server to the Agent SDK
        mcpServers: {
          'octra-tools': sdkServer,
        },
        allowedTools: ['get_context', 'propose_edits'],
        // Fully bypass permission prompts so tools run without asking
        permissionMode: 'bypassPermissions',
      },
    });

    let finalText = '';
    // Immediately send a started status
    writeEvent('status', { state: 'started' });

    (async () => {
      try {
        for await (const msg of gen) {
          // Partial streaming events
          if ((msg as any)?.type === 'stream_event') {
            const delta = (msg as any)?.event?.delta;
            const text = (delta?.text ?? delta?.partial_text ?? '')
              .replace(/\r\n/g, '\n')
              .replace(/\r/g, '\n');
            if (text) {
              writeEvent('assistant_partial', { text });
            }
            continue;
          }

          if (msg.type === 'assistant') {
            try {
              const parts = (msg as any)?.message?.content || [];
              const textParts = parts
                .filter((p: any) => p?.type === 'text' && typeof p?.text === 'string')
                .map((p: any) => String(p.text).replace(/\r\n/g, '\n').replace(/\r/g, '\n'))
                .join('\n');
              if (textParts) {
                finalText = textParts;
                writeEvent('assistant_message', { text: textParts });
              }
            } catch {}
            continue;
          }

          if (msg.type === 'result' && msg.subtype === 'success') {
            finalText = msg.result || finalText;
            writeEvent('result', { text: finalText, edits: collectedEdits });
            continue;
          }
        }
      } catch (err) {
        writeEvent('error', { message: (err as Error)?.message || 'Stream error' });
      } finally {
        writeEvent('done', { text: finalText, edits: collectedEdits });
        (streamController as unknown as { close?: () => void } | null)?.close?.();
      }
    })();

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
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


