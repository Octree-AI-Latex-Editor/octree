import { type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import LatexRenderer from '../latex-renderer';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../ui/accordion';
import { ProposalIndicator } from './proposal-indicator';
import { ProposalIndicator as ProposalIndicatorType } from './use-edit-proposals';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ChatMessageProps {
  message: ChatMessage;
  isLoading?: boolean;
  proposalIndicator?: ProposalIndicatorType;
  textFromEditor?: string | null;
}

function renderMessageContent(content: string): ReactNode {
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
          <ReactMarkdown>{content.slice(lastIndex, match.index)}</ReactMarkdown>
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
        className="my-2 flex items-center gap-2 rounded-md border px-3 py-1 text-xs font-medium text-slate-600 duration-500 animate-in fade-in-0 slide-in-from-bottom-2"
      >
        <Loader2 className="h-3 w-3 animate-spin" />
        LaTeX Diff
      </div>
    );

    return parts;
  }

  if (lastIndex < content.length) {
    parts.push(
      <div key={`text-after-${lastIndex}`} className="mt-2 whitespace-pre-wrap">
        <ReactMarkdown>{content.slice(lastIndex)}</ReactMarkdown>
      </div>
    );
  }

  return parts;
}

export function ChatMessageComponent({
  message,
  isLoading,
  proposalIndicator,
  textFromEditor,
}: ChatMessageProps) {
  return (
    <div
      className={cn(
        'shadow-xs mb-4 min-w-0 break-words rounded-lg border',
        message.role === 'assistant'
          ? 'border-slate-200 bg-gradient-to-br from-blue-50 to-blue-50/50 p-3'
          : 'border-slate-200 bg-white p-3'
      )}
    >
      <div className="mb-1 text-sm font-semibold text-blue-800">
        {message.role === 'assistant' ? 'Octra' : 'You'}
      </div>

      <div className="min-w-0 overflow-hidden whitespace-pre-wrap break-words text-sm text-slate-800">
        {message.role === 'assistant' && !message.content && isLoading ? (
          <div className="flex items-center gap-1.5">
            <span className="animate-pulse text-sm italic text-slate-500">
              Thinking
            </span>
            <div className="flex items-center space-x-0.5">
              <div className="h-1 w-1 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]"></div>
              <div className="h-1 w-1 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]"></div>
              <div className="h-1 w-1 animate-bounce rounded-full bg-slate-400"></div>
            </div>
          </div>
        ) : (
          renderMessageContent(message.content)
        )}
      </div>

      {message.role === 'assistant' && !textFromEditor && proposalIndicator && (
        <div className="mt-3 border-t border-blue-100 pt-3">
          <ProposalIndicator indicator={proposalIndicator} />
        </div>
      )}
    </div>
  );
}
