import { useCallback, useRef, useState } from 'react';
import { Upload, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MAX_ATTACHMENTS, MAX_FILE_SIZE } from '@/types/attachment';

interface AttachmentUploadProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
  canAddMore: boolean;
  isProcessing?: boolean;
}

export function AttachmentUpload({
  onFilesSelected,
  disabled,
  canAddMore,
  isProcessing = false,
}: AttachmentUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || !canAddMore) return;
      
      const fileArray = Array.from(files);
      onFilesSelected(fileArray);
    },
    [onFilesSelected, canAddMore]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && canAddMore) {
      setIsDragging(true);
    }
  }, [disabled, canAddMore]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (disabled || !canAddMore) return;

      const { files } = e.dataTransfer;
      handleFiles(files);
    },
    [disabled, canAddMore, handleFiles]
  );

  const handleClick = useCallback(() => {
    if (!disabled && canAddMore) {
      fileInputRef.current?.click();
    }
  }, [disabled, canAddMore]);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFiles(e.target.files);
      // Reset input so same file can be selected again
      e.target.value = '';
    },
    [handleFiles]
  );

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileInputChange}
        disabled={disabled || !canAddMore}
      />
      
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'relative',
          isDragging && 'opacity-50'
        )}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleClick}
          disabled={disabled || !canAddMore || isProcessing}
          className="size-6 rounded-full"
          title={
            !canAddMore
              ? `Maximum ${MAX_ATTACHMENTS} attachments`
              : isProcessing
                ? 'Processing attachments...'
                : `Attach files (max ${MAX_FILE_SIZE / 1024 / 1024}MB each)`
          }
        >
          <Paperclip className="h-4 w-4" />
        </Button>
        
        {isDragging && (
          <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center rounded-md border-2 border-dashed border-blue-400 bg-blue-50/50">
            <div className="flex flex-col items-center gap-2">
              <Upload className="h-6 w-6 text-blue-600" />
              <span className="text-sm font-medium text-blue-600">
                Drop files here
              </span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

