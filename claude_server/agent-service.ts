import express from 'express';
import cors from 'cors';
import { query, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import {
  validateApiKeys, buildNumberedContent, buildSystemPrompt,
  inferIntent, createOctraTools, createMCPServerConfig,
  processStreamMessages,
} from './lib/octra-agent';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.post('/agent', async (req, res) => {
  try {
    const keyValidation = validateApiKeys();
    if (!keyValidation.isValid) return res.status(503).json({ error: keyValidation.error });

    const { messages, fileContent, textFromEditor, selectionRange } = req.body || {};
    if (!messages?.length || typeof fileContent !== 'string') return res.status(400).json({ error: 'Invalid request' });

    // Non-blocking operations to avoid blocking the event loop
    const numbered = await buildNumberedContent(fileContent, textFromEditor);
    const userText = typeof messages[messages.length - 1]?.content === 'string' ? messages[messages.length - 1].content : '';
    const intent = await inferIntent(userText);
    const collectedEdits: unknown[] = [];

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const writeEvent = (event: string, data: unknown) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const tools = createOctraTools({ fileContent, numberedContent: numbered, textFromEditor, selectionRange, collectedEdits, intent, writeEvent } as any);
    const sdkServer = createSdkMcpServer(createMCPServerConfig(tools) as any);
    const fullPrompt = `${buildSystemPrompt(numbered, textFromEditor, selectionRange)}\n\nUser request:\n${userText}`;

    const gen = query({
      prompt: fullPrompt,
      options: {
        includePartialMessages: true,
        permissionMode: 'bypassPermissions',
        allowedTools: ['get_context', 'propose_edits'],
        mcpServers: { 'octra-tools': sdkServer },
      },
    });

    writeEvent('status', { state: 'started' });
    
    // Use processStreamMessages to convert SDK events to chat-compatible events
    const finalText = await processStreamMessages(gen as AsyncIterable<any>, writeEvent, collectedEdits);
    
    writeEvent('done', { text: finalText, edits: collectedEdits });
    res.end();
  } catch (e: any) {
    res.write(`event: error\n`);
    res.write(`data: ${JSON.stringify({ message: e?.message || 'internal error' })}\n\n`);
    res.end();
  }
});

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => console.log(`Agent service listening on :${PORT}`));
