'use client';

import { useEffect, useState } from 'react';

export function EmptyState() {
  const [isMac, setIsMac] = useState(true);

  useEffect(() => {
    setIsMac(navigator.platform.toUpperCase().indexOf('MAC') >= 0);
  }, []);

  return (
    <div className="flex h-full flex-col items-center justify-center space-y-4 px-6 text-center">
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-slate-800">
          How can I help with your LaTeX document?
        </h3>
        <p className="text-sm leading-relaxed text-slate-600">
          Select text & press{' '}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-700">
            {isMac ? '⌘B' : 'Ctrl+B'}
          </code>{' '}
          to edit with AI
        </p>
      </div>

      <div className="mt-2 max-w-md space-y-2 text-left">
        <p className="text-xs font-medium text-slate-500">Examples:</p>
        <ul className="space-y-1.5 text-xs text-slate-600">
          <li className="flex items-start gap-2">
            <span className="text-primary">•</span>
            <span>Fix LaTeX syntax errors and compile issues</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary">•</span>
            <span>Format equations, tables, and figures</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary">•</span>
            <span>Improve writing clarity and academic tone</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary">•</span>
            <span>Add sections, references, and citations</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary">•</span>
            <span>Restructure content and organize document</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
