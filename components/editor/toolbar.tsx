'use client';

import { Button } from '@/components/ui/button';
import { ButtonGroup, ButtonGroupItem } from '@/components/ui/button-group';
import { UsageIndicator } from '@/components/subscription/usage-indicator';
import { Loader2, Sparkles, WandSparkles } from 'lucide-react';
import { useEffect, useState } from 'react';

interface EditorToolbarProps {
  onTextFormat: (format: 'bold' | 'italic' | 'underline') => void;
  onCompile: () => void;
  onExportPDF: () => void;
  onOpenChat: () => void;
  compiling: boolean;
  exportingPDF: boolean;
  isSaving: boolean;
  lastSaved: Date | null;
}

export function EditorToolbar({
  onTextFormat,
  onCompile,
  onExportPDF,
  onOpenChat,
  compiling,
  exportingPDF,
  isSaving,
  lastSaved,
}: EditorToolbarProps) {
  const [isMac, setIsMac] = useState(true);

  useEffect(() => {
    setIsMac(navigator.platform.toUpperCase().indexOf('MAC') >= 0);
  }, []);
  return (
    <div className="flex-shrink-0 border-b border-slate-200 bg-white p-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ButtonGroup>
            <ButtonGroupItem
              onClick={() => onTextFormat('bold')}
              className="w-8 px-2.5 py-1"
            >
              <span className="font-bold">B</span>
            </ButtonGroupItem>
            <ButtonGroupItem
              onClick={() => onTextFormat('italic')}
              className="w-8 px-2.5 py-1"
            >
              <span className="italic">I</span>
            </ButtonGroupItem>
            <ButtonGroupItem
              onClick={() => onTextFormat('underline')}
              className="w-8 px-2.5 py-1"
            >
              <span className="underline">U</span>
            </ButtonGroupItem>
          </ButtonGroup>

          <Button
            variant="default"
            size="sm"
            onClick={onOpenChat}
            className="h-8 gap-1.5 border-slate-300 bg-gradient-to-b from-primary-light to-primary px-3 text-white hover:bg-gradient-to-b hover:from-primary-light/90 hover:to-primary/90"
            title="Edit with AI (⌘B)"
          >
            <WandSparkles className="h-3.5 w-3.5" />
            <span className="font-medium">Edit with AI</span>
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <UsageIndicator />
          {lastSaved && (
            <span className="text-sm text-slate-500">
              Last saved: {lastSaved.toLocaleTimeString()}
            </span>
          )}
          {/* {isSaving && (
            <span className="flex items-center gap-1 text-sm text-blue-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving
            </span>
          )} */}

          <Button
            variant="ghost"
            size="sm"
            onClick={onCompile}
            disabled={compiling}
            className="w-[90px] gap-1"
          >
            {compiling ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Compiling
              </>
            ) : (
              <>
                Compile
                <span className="ml-1 pt-0.5 text-xs text-muted-foreground">
                  {isMac ? '⌘S' : 'Ctrl+S'}
                </span>
              </>
            )}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onExportPDF}
            disabled={exportingPDF || isSaving}
          >
            {exportingPDF ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                Exporting
              </>
            ) : (
              'Export'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
