/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { query, tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { join } from 'path';
import { existsSync, writeFileSync, chmodSync } from 'fs';

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

// Heuristic intent inference from the latest user message
function inferIntent(userText: string) {
  const t = (userText || '').toLowerCase();
  
  // Explicit editing requests
  const wantsInsert = /(insert|add|append|create)/.test(t);
  const wantsDelete = /(delete|remove|strip|drop)/.test(t);
  const wantsReplace = /(replace|edit|update|revamp|rewrite|overhaul|refactor|fix)/.test(t);
  const wantsGrammar = /(grammar|proofread|typo|spelling|punctuation|hyphen|capitalize|formatting)/.test(t);
  const wantsCleanup = /(cleanup|clean\s*up|tidy|normalize|standardize|consistency|consistent)/.test(t);
  const wantsDedupe = /(dedup|de-dup|duplicate|remove\s+duplicates|duplicates)/.test(t);
  const wantsMulti = /(multi|multiple|several|batch)/.test(t);
  const wantsFull = /(complete\s+revamp|rewrite\s+everything|from\s+scratch)/.test(t);
  
  // Broader vocabulary for common editing requests
  const wantsImprove = /(improve|enhance|polish|refine|better|strengthen|clarify|expand|elaborate|develop)/.test(t);
  const wantsModify = /(modify|change|adjust|tweak|revise|amend|correct|improve|polish)/.test(t);
  
  // Comprehensive restriction detection - be conservative
  const hasExplicitRestriction = /(only|just|merely|simply)\s+(read|view|check|examine|review|look|see)/.test(t);
  const hasNegativeRestriction = /(don'?t|do\s+not|no|never|avoid|prevent|stop)\s+(edit|modify|change|alter|update|delete|remove|add|insert|create|fix|correct)/.test(t);
  const hasReadOnlyIntent = /(read|view|check|examine|review|look|see|show|display|inspect|analyze|understand|explain|describe)/.test(t) && 
    !/(edit|modify|change|fix|correct|improve|add|remove|delete|insert|create)/.test(t);
  
  // Conservative approach: only allow edits when explicitly requested
  const hasExplicitEditRequest = wantsInsert || wantsDelete || wantsReplace || wantsGrammar || wantsCleanup || wantsDedupe || wantsFull || wantsImprove || wantsModify;
  
  return {
    allowInsert: hasExplicitEditRequest && !hasExplicitRestriction && !hasNegativeRestriction,
    allowDelete: hasExplicitEditRequest && !hasExplicitRestriction && !hasNegativeRestriction,
    allowReplace: hasExplicitEditRequest && !hasExplicitRestriction && !hasNegativeRestriction,
    multiEdit: wantsMulti || wantsReplace || wantsFull || wantsImprove,
    fullRevamp: wantsFull,
    wantsDedupe,
    wantsGrammar: wantsGrammar || wantsCleanup,
    isReadOnly: hasReadOnlyIntent || hasExplicitRestriction || hasNegativeRestriction,
  };
}

function classifyEdit(originalLineCount: number, newText: string) {
  if (originalLineCount === 0 && newText.length > 0) return 'insert';
  if (originalLineCount > 0 && newText.length === 0) return 'delete';
  if (originalLineCount > 0 && newText.length > 0) return 'replace';
  return 'unknown';
}

function getLocalWindow(fileContent: string, startLine: number, radius: number = 25) {
  const lines = fileContent.split('\n');
  const idx = Math.max(0, Math.min(lines.length - 1, startLine - 1));
  const start = Math.max(0, idx - radius);
  const end = Math.min(lines.length, idx + radius + 1);
  return lines.slice(start, end).join('\n');
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

    const numberedContent = buildNumberedContent(fileContent, textFromEditor);

    // Determine user intent up-front for server-side validation
    const lastUser = messages[messages.length - 1];
    const userText = typeof lastUser?.content === 'string' ? lastUser.content : '';
    const intent = inferIntent(userText);

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
        // Heartbeat to keep SSE connection alive for intermediaries
        const hb = setInterval(() => {
          try {
            writeEvent('ping', Date.now());
          } catch {}
        }, 15000);
        // Store cleanup on controller
        (streamController as unknown as { __hb?: NodeJS.Timeout }).__hb = hb as NodeJS.Timeout;
      },
      cancel() {
        try {
          const anyCtrl = streamController as unknown as { __hb?: NodeJS.Timeout } | null;
          if (anyCtrl?.__hb) clearInterval(anyCtrl.__hb);
        } catch {}
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
        if (selectionRange) {
          payload.selectionRange = selectionRange;
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
        const violations: Array<string> = [];
        const accepted: typeof collectedEdits = [];
        for (const e of args.edits) {
          const kind = classifyEdit(e.originalLineCount, e.newText);
          // Enforce intent-based permissions
          if (kind === 'insert' && !intent.allowInsert) {
            violations.push(`Insertion not allowed by inferred intent at startLine ${e.startLine}.`);
            continue;
          }
          if (kind === 'delete' && !intent.allowDelete) {
            violations.push(`Deletion not allowed by inferred intent at startLine ${e.startLine}.`);
            continue;
          }
          if (kind === 'replace' && !intent.allowReplace) {
            violations.push(`Replacement not allowed by inferred intent at startLine ${e.startLine}.`);
            continue;
          }
          // Idempotency guard: only for insertions, and scoped locally to avoid blocking legitimate grammar fixes
          if (kind === 'insert') {
            const trimmed = e.newText.trim();
            if (trimmed.length > 0) {
              const local = getLocalWindow(fileContent, e.startLine, 40);
              if (local.includes(trimmed)) {
                violations.push(`Duplicate insertion avoided near line ${e.startLine}. Similar content already present locally.`);
                continue;
              }
            }
          }
          collectedEdits.push(e);
          accepted.push(e);
        }
        writeEvent('tool', { name: 'propose_edits', count: accepted.length, violations });
        if (accepted.length) writeEvent('edits', accepted);
        return {
          content: [
            {
              type: 'text',
              text: `Accepted ${accepted.length} edit(s). ${violations.length ? 'Blocked ' + violations.length + ' edit(s) due to intent/duplication guards.' : ''}`,
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

    const systemPrompt = `You are Octra, a LaTeX expert AI assistant. Your goal is to provide helpful explanations and propose precise, minimal edits that match the user's intent.\n\nNever ask the user for permission to run tools; assume permission is granted and call tools directly.\n\nHARD CONSTRAINTS:\n- Preserve all LaTeX packages, macros, colors, spacing, and structure unless explicitly asked to change them.\n- Understand the user's intent and choose the correct operation: INSERT, DELETE, or REPLACE.\n  * INSERT: Use { originalLineCount: 0, newText: '...'} and anchor at an exact line. Avoid duplicates by checking for similar content in the local context.\n  * DELETE: Use { originalLineCount: N, newText: '' } for the exact contiguous block to remove.\n  * REPLACE: Use { originalLineCount: N, newText: '...'} to swap a precise range.\n- For multiple, non-adjacent changes, propose multiple edits rather than one giant edit.\n- If a selectionRange is provided, prioritize edits within that range.\n- Do not introduce duplicate headers/sections; when appropriate, replace/update the existing section instead of inserting a new one.\n\nSpecial cases:\n- Grammar/cleanup requests: perform targeted REPLACEs to fix typos, punctuation, hyphenation (e.g., 'problem-solving'), capitalization, and style consistency.\n- Deduplication: when duplicate bullets/sections are detected, DELETE the redundant copy and keep one canonical version.\n\nWhen ready, you MUST call the tool 'propose_edits' with a JSON array of edits. Each edit must include: { startLine, originalLineCount, newText, explanation? }. If you need more context at any time, call 'get_context'.\n\nThe user's current file content will be provided with line numbers prepended, like "1: \\documentclass...".\n\nGuidance for accuracy:\n1. Line Number Accuracy: 'startLine' and 'originalLineCount' must match the prepended line numbers.\n2. Diff Minimality: Only change what is necessary to satisfy the request; preserve surrounding structure.\n3. Multiple Edits: Use separate edits for distant regions.\n4. Idempotency: Avoid duplicating content. Prefer REPLACE or DELETE to remove duplicates.\n\nCurrent numbered file content:\n---\n${numberedContent}\n---\n${textFromEditor ? `\nSelected text from editor for context:\n---\n${textFromEditor}\n---\n` : ''}\n${selectionRange ? `\nSelection range (line numbers refer to the numbered content above): ${selectionRange.startLineNumber}-${selectionRange.endLineNumber}` : ''}`;

    const fullPrompt = `${systemPrompt}\n\nUser request:\n${userText}`;

    // Resolve Claude Code CLI executable path
    const pathToClaudeCodeExecutable = process.env.CLAUDE_CODE_EXECUTABLE || 
      (() => {
        // Try common installation paths
        const possiblePaths = [
          join(process.cwd(), 'node_modules', '.bin', 'claude-code'),
          join(process.cwd(), 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude-code'),
          '/usr/local/bin/claude-code',
          '/opt/homebrew/bin/claude-code',
        ];
        
        for (const path of possiblePaths) {
          if (existsSync(path)) {
            return path;
          }
        }
        return null;
      })();

    // Debug logging for CLI path resolution
    const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.FUNCTIONS_EMULATOR;
    console.log('Claude Code CLI path resolution:', {
      envVar: process.env.CLAUDE_CODE_EXECUTABLE,
      resolved: pathToClaudeCodeExecutable,
      cwd: process.cwd(),
      vercelEnv: process.env.VERCEL,
      isServerless,
    });

    // In serverless environments, we might need to disable CLI entirely
    const queryOptions: any = {
      includePartialMessages: true,
      // Expose our in-process MCP server to the Agent SDK
      mcpServers: {
        'octra-tools': sdkServer,
      },
      allowedTools: ['get_context', 'propose_edits'],
      // Fully bypass permission prompts so tools run without asking
      permissionMode: 'bypassPermissions',
    };

    // Handle CLI path configuration for different environments
    if (isServerless) {
      console.log('Serverless environment detected - attempting to use bundled CLI');
      // Try multiple possible CLI paths in serverless environment
      const possibleCliPaths = [
        join(process.cwd(), 'node_modules', '@anthropic-ai', 'claude-agent-sdk', 'cli.js'),
        join(process.cwd(), 'node_modules', '@anthropic-ai', 'claude-agent-sdk', 'dist', 'cli.js'),
        join(process.cwd(), 'node_modules', '@anthropic-ai', 'claude-agent-sdk', 'bin', 'claude-code'),
        '/vercel/path0/node_modules/@anthropic-ai/claude-agent-sdk/cli.js', // Vercel-specific path
      ];
      
      let foundCliPath = null;
      for (const cliPath of possibleCliPaths) {
        if (existsSync(cliPath)) {
          foundCliPath = cliPath;
          break;
        }
      }
      
      if (foundCliPath) {
        queryOptions.pathToClaudeCodeExecutable = foundCliPath;
        console.log('Using bundled CLI at:', foundCliPath);
      } else {
        console.log('No bundled CLI found - attempting to create minimal CLI for SDK compatibility');
        // Try to create a minimal executable that satisfies the SDK
        const dummyCliPath = join(process.cwd(), 'dummy-claude-code.js');
        try {
          // Create a minimal Node.js executable that does nothing but satisfies the SDK
          const dummyContent = `#!/usr/bin/env node
// Dummy CLI for serverless compatibility
console.log('Dummy Claude Code CLI - serverless mode');
process.exit(0);
`;
          writeFileSync(dummyCliPath, dummyContent);
          chmodSync(dummyCliPath, '755'); // Make it executable
          queryOptions.pathToClaudeCodeExecutable = dummyCliPath;
          console.log('Created dummy CLI at:', dummyCliPath);
        } catch (createError) {
          console.log('Failed to create dummy CLI, attempting without CLI path');
          // Don't set pathToClaudeCodeExecutable at all
        }
      }
    } else if (pathToClaudeCodeExecutable) {
      queryOptions.pathToClaudeCodeExecutable = pathToClaudeCodeExecutable;
    }

    let gen;
    try {
      gen = query({
        prompt: fullPrompt,
        options: queryOptions,
      });
    } catch (error) {
      console.error('Failed to initialize Claude Agent SDK:', error);
      
      // In serverless environments, provide a more specific error message
      if (isServerless) {
        return NextResponse.json(
          { 
            error: 'Claude Agent SDK not compatible with serverless environment', 
            details: error instanceof Error ? error.message : 'Unknown initialization error',
            suggestion: 'The Claude Agent SDK requires CLI access which is not available in serverless environments. Consider using a different AI service or deploying to a non-serverless environment.',
            environment: 'serverless',
            cliPath: queryOptions.pathToClaudeCodeExecutable || 'not set'
          },
          { status: 503 }
        );
      }
      
      // For non-serverless environments, return generic error
      return NextResponse.json(
        { 
          error: 'Failed to initialize AI agent', 
          details: error instanceof Error ? error.message : 'Unknown initialization error',
          suggestion: 'The Claude Code CLI may not be available in this environment. Please try again or contact support.'
        },
        { status: 503 }
      );
    }

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
        try {
          const anyCtrl = streamController as unknown as { __hb?: NodeJS.Timeout; close?: () => void } | null;
          if (anyCtrl?.__hb) clearInterval(anyCtrl.__hb);
        } catch {}
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
