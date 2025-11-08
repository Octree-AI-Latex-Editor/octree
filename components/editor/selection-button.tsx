'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface SelectionButtonProps {
  show: boolean;
  position: { top: number; left: number };
  onCopy: () => void;
  className?: string;
}

export function SelectionButton({
  show,
  position,
  onCopy,
  className = '',
}: SelectionButtonProps) {
  const [isMac, setIsMac] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsMac(navigator.platform.toUpperCase().indexOf('MAC') >= 0);
  }, []);

  if (!show || !mounted) return null;

  const button = (
    <Button
      variant="outline"
      size="sm"
      onClick={onCopy}
      className={cn('absolute z-10 font-medium', className)}
      style={{
        top: position.top,
        left: position.left,
      }}
    >
      Edit
      <kbd className="ml-1 text-xs opacity-60">{isMac ? '⌘B' : 'Ctrl+B'}</kbd>
    </Button>
  );

  return createPortal(button, document.body);
}
