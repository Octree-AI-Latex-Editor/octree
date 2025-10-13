/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, X, Maximize2, Minimize2 } from 'lucide-react';
import { OctreeLogo } from '@/components/icons/octree-logo';
import { motion, AnimatePresence } from 'framer-motion';
import { EditSuggestion } from '@/types/edit';
import { cn } from '@/lib/utils';
import { useChatStream } from './use-chat-stream';
import { useEditProposals } from './use-edit-proposals';
import { useFileAttachments } from './use-file-attachments';
import { ChatMessageComponent } from './chat-message';
import { ChatInput } from './chat-input';
import { EmptyState } from './empty-state';

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

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversionStatus, setConversionStatus] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [isMac, setIsMac] = useState(true);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const shouldStickToBottomRef = useRef<boolean>(true);

  useEffect(() => {
    setIsMac(navigator.platform.toUpperCase().indexOf('MAC') >= 0);
  }, []);

  const { startStream, parseStream, stopStream } = useChatStream();
  const {
    proposalIndicators,
    clearProposals,
    setPending,
    incrementProgress,
    setError: setProposalError,
    convertEditsToSuggestions,
  } = useEditProposals(fileContent);
  const {
    attachments,
    addFiles,
    removeAttachment,
    clearAttachments,
    getAttachmentContext,
    canAddMore: canAddMoreAttachments,
    isProcessing: isProcessingAttachments,
  } = useFileAttachments();

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    setError(null);

    // Store user input for display
    const userDisplayContent = trimmed;

    // Show user message immediately (just the text, not the extracted image content)
    const userMsg: ChatMessage = {
      id: `${Date.now()}-user`,
      role: 'user',
      content: userDisplayContent,
    };
    setMessages((prev) => [...prev, userMsg]);

    setInput('');
    clearAttachments(); // Clear attachments after sending

    // Now start processing (shows conversion status if images)
    setIsLoading(true);
    setConversionStatus(null);
    if (textFromEditor) {
      setTextFromEditor(null);
    }

    // Get attachment context (this extracts content from images using GPT-4o-mini)
    const attachmentContext = await getAttachmentContext((message) => {
      setConversionStatus(message);
    });

    // Clear conversion status - now Claude takes over
    setConversionStatus(null);

    // Build the actual content for Claude (with extracted image content)
    const userContentForClaude = attachmentContext
      ? `${trimmed}${attachmentContext}`
      : trimmed;

    clearProposals();

    const assistantId = `${Date.now()}-assistant`;

    try {
      // Create messages array with the actual content for Claude (including image analysis)
      const messagesForClaude = [
        ...messages, // All previous messages
        { ...userMsg, content: userContentForClaude }, // User message with enhanced content
      ];

      const { response, controller } = await startStream(
        messagesForClaude,
        fileContent,
        textFromEditor,
        selectionRange,
        {
          onTextUpdate: (text) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: text } : m
              )
            );
            if (shouldStickToBottomRef.current) scrollToBottom();
          },
          onEdits: (edits) => {
            const suggestions = convertEditsToSuggestions(edits, assistantId);
            if (suggestions.length > 0) {
              onEditSuggestion(suggestions);
            }
          },
          onToolCall: (name, count, violations, progressIncrement) => {
            if (name === 'propose_edits') {
              const violationCount = Array.isArray(violations)
                ? violations.length
                : undefined;
              if (typeof count === 'number') {
                setPending(assistantId, count, violationCount);
              }
              if (typeof progressIncrement === 'number') {
                incrementProgress(assistantId, progressIncrement, true);
              }
            }
          },
          onError: (errorMsg) => {
            setError(new Error(errorMsg));
            setProposalError(assistantId, errorMsg);
          },
          onStatus: (state) => {
            if (state === 'started') setIsLoading(true);
          },
        }
      );

      if (!response.ok || !response.body) {
        let errorMessage = `Request failed with ${response.status}`;
        try {
          const data = await response.json();
          errorMessage = data.error || errorMessage;
        } catch {
          // Use default
        }

        setMessages((prev) => [
          ...prev,
          { id: assistantId, role: 'assistant', content: '' },
        ]);
        setProposalError(assistantId, errorMessage);
        throw new Error(errorMessage);
      }

      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: 'assistant', content: '' },
      ]);

      if (response.body) {
        const reader = response.body.getReader();
        await parseStream(reader, {
          onTextUpdate: (text) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: text } : m
              )
            );
            if (shouldStickToBottomRef.current) scrollToBottom();
          },
          onEdits: (edits) => {
            const suggestions = convertEditsToSuggestions(edits, assistantId);
            if (suggestions.length > 0) {
              onEditSuggestion(suggestions);
            }
          },
          onToolCall: (name, count, violations) => {
            if (name === 'propose_edits') {
              const violationCount = Array.isArray(violations)
                ? violations.length
                : undefined;
              setPending(assistantId, count, violationCount);
            }
          },
          onError: (errorMsg) => {
            setError(new Error(errorMsg));
            setProposalError(assistantId, errorMsg);
          },
          onStatus: (state) => {
            if (state === 'started') setIsLoading(true);
          },
        });
      }
    } catch (err) {
      console.error('Octra Agent API error:', err);
      if ((err as any)?.name !== 'AbortError') setError(err);
    } finally {
      setIsLoading(false);
      setInput('');
      window.dispatchEvent(new Event('usage-update'));
    }
  };

  useEffect(() => {
    if (error) {
      console.error('Chat error:', error);
    }
  }, [error]);

  useEffect(() => {
    if (shouldStickToBottomRef.current) scrollToBottom();
  }, [messages, isLoading, conversionStatus]);

  useEffect(() => {
    const el = chatContainerRef.current;
    if (!el) return;

    const onScroll = () => {
      const { scrollTop, clientHeight, scrollHeight } = el;
      shouldStickToBottomRef.current =
        scrollTop + clientHeight >= scrollHeight - 80;
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
        className="fixed bottom-4 right-4 z-20 flex cursor-pointer flex-col items-end space-y-2"
        onClick={() => setIsOpen(true)}
      >
        <div className="mb-2 rounded-md border border-blue-100 bg-white/80 px-3 py-1.5 text-sm text-foreground shadow-sm backdrop-blur-sm">
          Press{' '}
          <kbd className="rounded-sm bg-slate-100 px-1.5 py-0.5 font-mono text-xs">
            {isMac ? '⌘' : 'Ctrl'}
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
        'fixed bottom-4 right-4 z-20 w-96 rounded-md border border-blue-100 bg-white shadow-2xl transition-all duration-200',
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
            <p className="text-xs text-slate-500">LaTeX Assistant</p>
          </div>
        </div>

        <div className="flex gap-1">
          {isLoading && (
            <div className="flex items-center pr-1" aria-live="polite">
              <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMinimized(!isMinimized)}
            className="h-8 w-8 rounded-lg p-0 text-blue-600 hover:bg-blue-50 hover:text-blue-800"
          >
            {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(false)}
            className="h-8 w-8 rounded-lg p-0 text-blue-600 hover:bg-blue-50 hover:text-blue-800"
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
                'h-[440px] overflow-y-auto overflow-x-hidden p-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-neutral-300',
                textFromEditor && 'pb-24'
              )}
            >
              {messages.length === 0 && !isLoading && !conversionStatus && (
                <EmptyState />
              )}
              {messages.map((message) => (
                <ChatMessageComponent
                  key={message.id}
                  message={message}
                  isLoading={isLoading}
                  proposalIndicator={proposalIndicators[message.id]}
                  textFromEditor={textFromEditor}
                />
              ))}

              {/* Image Analysis Status Indicator (like propose_edits) */}
              {conversionStatus && (
                <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50/50 px-3 py-2">
                  <div className="flex items-center gap-2 text-sm text-blue-700">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span className="font-medium">{conversionStatus}</span>
                  </div>
                </div>
              )}
            </div>

            <ChatInput
              input={input}
              isLoading={isLoading}
              textFromEditor={textFromEditor}
              attachments={attachments}
              canAddMoreAttachments={canAddMoreAttachments}
              onInputChange={setInput}
              onSubmit={handleSubmit}
              onClearEditor={() => setTextFromEditor(null)}
              onStop={stopStream}
              onFilesSelected={addFiles}
              onRemoveAttachment={removeAttachment}
              onResetError={() => setError(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
