/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect, useRef, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, X, Maximize2, Minimize2, ArrowUp, StopCircle } from 'lucide-react';
import { OctreeLogo } from '@/components/icons/octree-logo';
import { motion, AnimatePresence } from 'framer-motion';
import { EditSuggestion, isLegacyEditSuggestion } from '@/types/edit';
import { ASTEdit } from '@/lib/octra-agent/ast-edits';
import { cn } from '@/lib/utils';
import { parseLatexDiff } from '@/lib/parse-latex-diff';
import { Textarea } from './ui/textarea';
import LatexRenderer from './latex-renderer';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from './ui/accordion';

interface ChatProps {
  onEditSuggestion: (edit: EditSuggestion | EditSuggestion[]) => void;
  fileContent: string;
  textFromEditor: string | null;
  setTextFromEditor: (text: string | null) => void;
  selectionRange?: {
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
  } | null;
  isMinimized: boolean;
  setIsMinimized: React.Dispatch<React.SetStateAction<boolean>>;
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export function Chat({
  isMinimized,
  setIsMinimized,
  isOpen,
  setIsOpen,
  onEditSuggestion,
  fileContent,
  textFromEditor,
  setTextFromEditor,
  selectionRange,
}: ChatProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const pendingTextRef = useRef<string>('');
  const shouldStickToBottomRef = useRef<boolean>(true);
  
  interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
  }

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const dispatchedForMessageRef = useRef<Set<string>>(new Set());
  const processedEditsRef = useRef<Set<string>>(new Set());

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  };

  const renderMessageContent = (content: string): ReactNode => {
    const incompleteLatexDiffMatch = content.match(
      /```latex-diff(?!\n[\s\S]*?\n```)/
    );

    const latexDiffRegex = /```latex-diff\n([\s\S]*?)\n```/g;

    const hasLatexDiff = content.includes('```latex-diff');

    if (!hasLatexDiff) {
      return (
        <div className="whitespace-pre-wrap break-words">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      );
    }

    const parts: ReactNode[] = [];
    let lastIndex = 0;
    let match;

    while ((match = latexDiffRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push(
          <div
            key={`text-before-${match.index}`}
            className="mb-2 whitespace-pre-wrap"
          >
            <ReactMarkdown>
              {content.slice(lastIndex, match.index)}
            </ReactMarkdown>
          </div>
        );
      }

      const isComplete = match[1] && match[1].trim().length > 0;

      parts.push(
        <div key={`latex-${match.index}`} className="my-2">
          <Accordion type="single" collapsible className="rounded-md border">
            <AccordionItem value="latex-diff" className="border-none">
              <AccordionTrigger className="px-3 py-1 text-xs font-medium text-slate-600 hover:no-underline">
                <div className="flex items-center gap-2">
                  {!isComplete && <Loader2 className="h-3 w-3 animate-spin" />}
                  LaTeX Diff
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-3 pb-2">
                <LatexRenderer latex={match[1]} />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      );

      lastIndex = match.index + match[0].length;
    }

    if (incompleteLatexDiffMatch) {
      const incompleteIndex = incompleteLatexDiffMatch.index!;

      if (incompleteIndex > lastIndex) {
        parts.push(
          <div
            key={`text-before-incomplete`}
            className="mb-2 whitespace-pre-wrap"
          >
            <ReactMarkdown>
              {content.slice(lastIndex, incompleteIndex)}
            </ReactMarkdown>
          </div>
        );
      }

      parts.push(
        <div
          key="latex-incomplete"
          className="animate-in fade-in-0 slide-in-from-bottom-2 my-2 flex items-center gap-2 rounded-md border px-3 py-1 text-xs font-medium text-slate-600 duration-500"
        >
          <Loader2 className="h-3 w-3 animate-spin" />
          LaTeX Diff
        </div>
      );

      return parts;
    }

    if (lastIndex < content.length) {
      parts.push(
        <div
          key={`text-after-${lastIndex}`}
          className="mt-2 whitespace-pre-wrap"
        >
          <ReactMarkdown>{content.slice(lastIndex)}</ReactMarkdown>
        </div>
      );
    }

    return parts;
  };

  const parseEditSuggestions = (content: string): EditSuggestion[] => {
    return parseLatexDiff(content);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement> | Event) => {
    // Prevent default form submission if available
    if ((e as any)?.preventDefault) (e as any).preventDefault();

    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    // Clear input immediately so text doesn't linger while streaming
    setInput('');

    // Cancel any existing stream before starting a new one
    if (abortControllerRef.current) {
      try {
        abortControllerRef.current.abort();
      } catch {}
      abortControllerRef.current = null;
    }

    // reset any pending raf-flush
    if (rafIdRef.current != null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    pendingTextRef.current = '';
    
    // Clear processed edits for new request
    processedEditsRef.current.clear();

    setIsLoading(true);
    setError(null);

    const userMsg: ChatMessage = {
      id: `${Date.now()}-user`,
      role: 'user',
      content: trimmed,
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const res = await fetch('/api/octra-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsg],
          fileContent,
          textFromEditor,
          selectionRange,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        try {
          const data = await res.json();
          throw new Error(data.error || `Request failed with ${res.status}`);
        } catch {
          throw new Error(`Request failed with ${res.status}`);
        }
      }

      // Add a placeholder assistant message to stream into
      const assistantId = `${Date.now()}-assistant`;
      setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let lastAssistantText = '';

      const flushAssistant = (text: string) => {
        // Normalize newlines so streaming chunks display as paragraphs
        const normalized = text
          .replace(/\r\n/g, '\n')
          .replace(/\r/g, '\n');
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: normalized } : m))
        );
        if (shouldStickToBottomRef.current) scrollToBottom();
      };

      const handleEdits = (edits: ASTEdit[]) => {
        // Create a unique key for this set of edits to prevent duplicates
        const editsKey = JSON.stringify(edits.map(e => ({ 
          type: e.editType, 
          line: e.position?.line, 
          content: e.content?.substring(0, 50) // First 50 chars for key
        })));
        
        // Skip if we've already processed these exact edits
        if (processedEditsRef.current.has(editsKey)) return;
        processedEditsRef.current.add(editsKey);
        
        const mapped: EditSuggestion[] = edits.map((edit, idx) => {
          // For delete operations, we need to populate the original field
          // by extracting the content that's being deleted from the file
          let originalContent = '';
          if (edit.editType === 'delete' && edit.position?.line && edit.originalLineCount) {
            const startLine = edit.position.line;
            const lineCount = edit.originalLineCount;
            const lines = fileContent.split('\n');
            const endLine = Math.min(startLine + lineCount - 1, lines.length);
            originalContent = lines.slice(startLine - 1, endLine).join('\n');
          }
          
          return {
            ...edit,
            id: `${Date.now()}-${idx}`,
            status: 'pending' as const,
            original: originalContent,
          };
        });
        if (mapped.length > 0) onEditSuggestion(mapped);
      };

      const maybeEmitDiffSuggestions = (text: string) => {
        if (dispatchedForMessageRef.current.has(assistantId)) return;
        const suggestions = parseLatexDiff(text);
        if (suggestions.length > 0) {
          onEditSuggestion(suggestions);
          dispatchedForMessageRef.current.add(assistantId);
        }
      };

      // Minimal SSE parser
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let sepIndex;
        // Process complete events separated by double newlines
        while ((sepIndex = buffer.indexOf('\n\n')) !== -1) {
          const rawEvent = buffer.slice(0, sepIndex);
          buffer = buffer.slice(sepIndex + 2);

          const lines = rawEvent.split('\n');
          let eventName = 'message';
          const dataLines: string[] = [];
          for (const line of lines) {
            if (line.startsWith('event:')) {
              eventName = line.slice(6).trim();
            } else if (line.startsWith('data:')) {
              dataLines.push(line.slice(5).trim());
            }
          }

          const dataText = dataLines.join('\n');
          let payload: any = dataText;
          try {
            payload = JSON.parse(dataText);
          } catch {}

          if (eventName === 'assistant_partial' && payload?.text) {
            const chunk = String(payload.text)
              .replace(/\r\n/g, '\n')
              .replace(/\r/g, '\n');
            pendingTextRef.current += chunk;
            if (rafIdRef.current == null) {
              rafIdRef.current = requestAnimationFrame(() => {
                const toFlush = pendingTextRef.current;
                pendingTextRef.current = '';
                rafIdRef.current = null;
                const merged = (lastAssistantText || '') + toFlush;
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantId ? { ...m, content: merged } : m))
                );
                lastAssistantText = merged;
                if (shouldStickToBottomRef.current) scrollToBottom();
              });
            }
            // Do not surface suggestions during partial stream to avoid random popups
          } else if (eventName === 'assistant_message' && payload?.text) {
            const full = String(payload.text);
            flushAssistant(full);
            lastAssistantText = full;
            // Defer suggestion surfacing to result/done for stable UX
          } else if (eventName === 'edits' && Array.isArray(payload)) {
            handleEdits(payload);
          } else if (eventName === 'status') {
            // started/finished
            if (payload?.state === 'started') setIsLoading(true);
          } else if (eventName === 'tool') {
            const name = payload?.name ? String(payload.name) : 'tool';
            const count = typeof payload?.count === 'number' ? payload.count : 0;
            const violations = payload?.violations ? ` - ${payload.violations.length} blocked` : '';
            
            // Append tool usage to assistant message
            const toolText = name === 'propose_edits' 
              ? `\n\n✨ Proposed ${count} edit${count !== 1 ? 's' : ''}${violations}`
              : `\n\n🔧 Used ${name}`;
            
            setMessages((prev) =>
              prev.map((m) => 
                m.id === assistantId 
                  ? { ...m, content: (m.content || '') + toolText }
                  : m
              )
            );
          } else if (eventName === 'error') {
            if (payload?.message) setError(new Error(String(payload.message)));
          } else if (eventName === 'result' && payload?.text) {
            const full = String(payload.text);
            flushAssistant(full);
            lastAssistantText = full;
            if (Array.isArray(payload.edits)) handleEdits(payload.edits);
            else maybeEmitDiffSuggestions(full);
          } else if (eventName === 'done') {
            if (payload?.text && typeof payload.text === 'string') {
              flushAssistant(payload.text);
              lastAssistantText = payload.text;
            }
            if (Array.isArray(payload?.edits) && payload.edits.length > 0) {
              handleEdits(payload.edits);
            } else if (lastAssistantText) {
              // Fallback: parse latex-diff in final assistant text
              const suggs = parseEditSuggestions(lastAssistantText);
              if (suggs.length > 0) onEditSuggestion(suggs);
              else maybeEmitDiffSuggestions(lastAssistantText);
            }
          }
        }
      }
    } catch (err) {
      console.error('Octra Agent API error:', err);
      // Swallow AbortErrors gracefully
      if ((err as any)?.name !== 'AbortError') setError(err);
    } finally {
      setIsLoading(false);
      setInput('');
      if (rafIdRef.current != null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      pendingTextRef.current = '';
      try {
        abortControllerRef.current = null;
      } catch {}
    }
  };

  // Log any errors
  useEffect(() => {
    if (error) {
      console.error('Chat error:', error);
    }
  }, [error]);

  useEffect(() => {
    if (textFromEditor) {
      inputRef.current?.focus();
    }
  }, [textFromEditor]);

  useEffect(() => {
    if (shouldStickToBottomRef.current) scrollToBottom();
  }, [messages, isLoading]);

  // Track whether user is near the bottom to decide auto-scroll behavior
  useEffect(() => {
    const el = chatContainerRef.current;
    if (!el) return;
    const onScroll = () => {
      const { scrollTop, clientHeight, scrollHeight } = el;
      shouldStickToBottomRef.current = scrollTop + clientHeight >= scrollHeight - 80;
    };
    el.addEventListener('scroll', onScroll);
    onScroll();
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        const target = e.target as HTMLElement;

        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          setIsOpen((prev) => !prev);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setIsOpen]);

  if (!isOpen) {
    return (
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="fixed right-4 bottom-4 z-20 flex cursor-pointer flex-col items-end space-y-2"
        onClick={() => setIsOpen(true)}
      >
        <div className="text-foreground mb-2 rounded-md border border-blue-100 bg-white/80 px-3 py-1.5 text-sm shadow-sm backdrop-blur-sm">
          Press{' '}
          <kbd className="rounded-sm bg-slate-100 px-1.5 py-0.5 font-mono text-xs">
            ⌘
          </kbd>
          {' + '}
          <kbd className="rounded-sm bg-slate-100 px-1.5 py-0.5 font-mono text-xs">
            B
          </kbd>{' '}
          to chat
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 20, opacity: 0 }}
      className={cn(
        'fixed right-4 bottom-4 z-20 w-96 rounded-md border border-blue-100 bg-white shadow-2xl transition-all duration-200',
        isMinimized ? 'h-15' : 'h-[610px]'
      )}
    >
      {/* Header */}
      <div
        className={cn(
          'flex items-center justify-between px-3 py-2',
          !isMinimized && 'border-b border-blue-100/50'
        )}
      >
        <div className="flex items-center space-x-3">
          <div className="rounded-lg bg-blue-100/50 p-1.5">
            <OctreeLogo className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-blue-800">Octra</h3>
            <div className="flex items-center gap-2">
              <p className="text-xs text-slate-500">LaTeX Assistant</p>
            </div>
          </div>
        </div>

        <div className="flex gap-1">
          {isLoading && (
            <div
              className="flex items-center pr-1"
              aria-live="polite"
              aria-label="Loading"
            >
              <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsMinimized(!isMinimized);
            }}
            className="z-20 h-8 w-8 rounded-lg p-0 text-blue-600 hover:bg-blue-50 hover:text-blue-800"
          >
            {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsOpen(false);
            }}
            className="z-20 h-8 w-8 rounded-lg p-0 text-blue-600 hover:bg-blue-50 hover:text-blue-800"
          >
            <X size={16} />
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {!isMinimized && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              ref={chatContainerRef}
              className={cn(
                'scrollbar-thin scrollbar-thumb-neutral-300 scrollbar-track-transparent h-[440px] overflow-x-hidden overflow-y-auto p-4',
                textFromEditor && 'pb-24'
              )}
            >
              {messages.length === 0 && !isLoading && (
                <div className="flex h-full flex-col items-center justify-center space-y-4 text-center">
                  <div>
                    <h3 className="text-md font-semibold text-slate-800">
                      How can I help?
                    </h3>
                    <p className="text-sm text-slate-500">
                      Ask about LaTeX or select text & press ⌘B to improve.
                    </p>
                  </div>
                </div>
              )}
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`mb-4 min-w-0 break-words ${
                    message.role === 'assistant'
                      ? 'rounded-lg border border-slate-200 bg-gradient-to-br from-blue-50 to-blue-50/50 p-3 shadow-xs'
                      : 'rounded-lg border border-slate-200 bg-white p-3 shadow-xs'
                  }`}
                >
                  <div className="mb-1 text-sm font-semibold text-blue-800">
                    {message.role === 'assistant' ? 'Octra' : 'You'}
                  </div>
                  <div className="min-w-0 overflow-hidden text-sm text-slate-800 whitespace-pre-wrap break-words">
                    {message.role === 'assistant' && !message.content && isLoading ? (
                      <span className="italic text-slate-500">thinking...</span>
                    ) : (
                      renderMessageContent(message.content)
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="relative px-2">
              {textFromEditor && (
                <div className="pointer-events-auto absolute top-0 left-1/2 z-10 w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-full rounded-t-md border border-b-0 border-slate-300 bg-slate-50 px-2 py-1 text-xs shadow-xs">
                  <Button
                    onClick={() => setTextFromEditor(null)}
                    size="icon"
                    variant="ghost"
                    className="absolute top-0 right-0 size-5 text-slate-500 hover:text-slate-700"
                    aria-label="Close"
                  >
                    <X className="size-3" />
                  </Button>
                  <p className="text-slate-500">Attached From Editor</p>
                  <code className="scrollbar-thin scrollbar-thumb-neutral-300 scrollbar-track-transparent block max-h-20 overflow-x-hidden overflow-y-scroll whitespace-pre">
                    {textFromEditor}
                  </code>
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleSubmit(e);
                  setTextFromEditor(null);
                }}
                className="relative flex w-full flex-col items-end rounded-md border p-1"
              >
                <Textarea
                  ref={inputRef}
                  value={input}
                  placeholder="Prompt to edit your document..."
                  onChange={handleInputChange}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      const formEvent = new Event('submit', { bubbles: true, cancelable: true });
                      void handleSubmit(formEvent as unknown as React.FormEvent<HTMLFormElement>);
                      setTextFromEditor(null);
                    }
                  }}
                  className="scrollbar-thin scrollbar-thumb-neutral-300 scrollbar-track-transparent relative h-[70px] resize-none border-none px-1 shadow-none focus-visible:ring-0"
                />
                {isLoading && (
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    onClick={() => abortControllerRef.current?.abort()}
                    className="mr-2 size-6 rounded-full"
                    aria-label="Stop streaming"
                  >
                    <StopCircle className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  type="submit"
                  size="icon"
                  variant="default"
                  disabled={isLoading}
                  className="size-6 rounded-full"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowUp />
                  )}
                </Button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
