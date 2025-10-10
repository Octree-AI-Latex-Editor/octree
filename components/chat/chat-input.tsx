import { useRef, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { X, StopCircle, ArrowUp, Loader2 } from 'lucide-react';

interface ChatInputProps {
  input: string;
  isLoading: boolean;
  textFromEditor: string | null;
  onInputChange: (value: string) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onClearEditor: () => void;
  onStop: () => void;
}

export function ChatInput({
  input,
  isLoading,
  textFromEditor,
  onInputChange,
  onSubmit,
  onClearEditor,
  onStop,
}: ChatInputProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const formEvent = new Event('submit', {
        bubbles: true,
        cancelable: true,
      });
      const form = e.currentTarget.form;
      if (form) {
        form.dispatchEvent(formEvent);
      }
    }
  };

  return (
    <div className="relative px-2">
      {textFromEditor && (
        <div className="pointer-events-auto absolute top-0 left-1/2 z-10 w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-full rounded-t-md border border-b-0 border-slate-300 bg-slate-50 px-2 py-1 text-xs shadow-xs">
          <Button
            onClick={onClearEditor}
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
        onSubmit={onSubmit}
        className="relative flex w-full flex-col items-end rounded-md border p-1"
      >
        <Textarea
          ref={inputRef}
          value={input}
          placeholder="Prompt to edit your document..."
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className="scrollbar-thin scrollbar-thumb-neutral-300 scrollbar-track-transparent relative h-[70px] resize-none border-none px-1 shadow-none focus-visible:ring-0"
        />
        {isLoading && (
          <Button
            type="button"
            size="icon"
            variant="secondary"
            onClick={onStop}
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
  );
}

