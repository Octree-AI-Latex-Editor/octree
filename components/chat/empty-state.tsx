'use client';

import { useEffect, useState } from 'react';

export function EmptyState() {
  const [isMac, setIsMac] = useState(true);

  useEffect(() => {
    setIsMac(navigator.platform.toUpperCase().indexOf('MAC') >= 0);
  }, []);

  return (
    <div className="flex h-full flex-col items-center justify-center space-y-4 text-center">
      <div className="space-y-2">
        <h3 className="text-md font-semibold text-slate-800">
          How can I help?
        </h3>
        <p className="text-sm text-slate-500">
          Ask about LaTeX or select text
          <br />& press{' '}
          <code className="font-medium">{isMac ? '⌘B' : 'Ctrl+B'}</code> to
          improve.
        </p>
      </div>
    </div>
  );
}
