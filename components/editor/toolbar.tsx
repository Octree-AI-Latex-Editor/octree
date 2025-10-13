'use client';

import { Button } from '@/components/ui/button';
import { ButtonGroup, ButtonGroupItem } from '@/components/ui/button-group';
import { UsageIndicator } from '@/components/subscription/usage-indicator';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface EditorToolbarProps {
  onTextFormat: (format: 'bold' | 'italic' | 'underline') => void;
  onCompile: () => void;
  onExportPDF: () => void;
  compiling: boolean;
  exportingPDF: boolean;
  isSaving: boolean;
  lastSaved: Date | null;
}

export function EditorToolbar({
  onTextFormat,
  onCompile,
  onExportPDF,
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

        <div className="flex items-center gap-2">
          <UsageIndicator />
          {lastSaved && (
            <span className="text-xs text-slate-500">
              Last saved: {lastSaved.toLocaleTimeString()}
            </span>
          )}
          {isSaving && (
            <span className="flex items-center text-xs text-blue-500">
              <Loader2 className="mr-1 inline h-4 w-4 animate-spin" />
              Saving
            </span>
          )}

          <Button
            variant="ghost"
            size="xs"
            onClick={onCompile}
            disabled={compiling}
            className="w-[90px]"
          >
            {compiling ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Compiling
              </>
            ) : (
              <>
                Compile
                <span className="ml-1 text-xs opacity-60">
                  {isMac ? '⌘S' : 'Ctrl+S'}
                </span>
              </>
            )}
          </Button>

          <Button
            variant="ghost"
            size="xs"
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
