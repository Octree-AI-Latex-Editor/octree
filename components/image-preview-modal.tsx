'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ArrowLeft, Copy, Check } from 'lucide-react';
import { useState } from 'react';

interface ImagePreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string;
  latexCode: string;
  fileName: string;
  fileId?: string;
  onBack: () => void;
}

export function ImagePreviewModal({
  open,
  onOpenChange,
  imageUrl,
  latexCode,
  fileName,
  onBack,
}: ImagePreviewModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(latexCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Image Converted Successfully</DialogTitle>
          <DialogDescription>
            Your image "{fileName}" has been uploaded and converted to LaTeX code.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Image Preview */}
          <div className="flex justify-center">
            <img
              src={imageUrl}
              alt={fileName}
              className="max-h-64 rounded-lg border shadow-sm"
            />
          </div>

          {/* LaTeX Code Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">LaTeX Code:</label>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="h-8"
              >
                {copied ? (
                  <>
                    <Check className="mr-2 h-3 w-3" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-3 w-3" />
                    Copy
                  </>
                )}
              </Button>
            </div>
            <div className="rounded-md border bg-muted/50 p-4">
              <pre className="text-sm overflow-x-auto whitespace-pre-wrap">
                <code>{latexCode}</code>
              </pre>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Upload Another
            </Button>
            <Button onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
