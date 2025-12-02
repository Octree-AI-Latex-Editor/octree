'use client';

import { useRef, useEffect } from 'react';
import katex from 'katex';
// @ts-ignore
import 'katex/dist/katex.min.css';

function extractBody(latex: string): string {
  const documentMatch = latex.match(
    /\\begin\{document\}([\s\S]*?)\\end\{document\}/
  );
  const content = documentMatch ? documentMatch[1].trim() : latex;
  
  const hasMathDelimiters = /(\$|\\\[|\\\(|\\begin\{(equation|align|gather|displaymath)\*?\})/.test(content);
  if (!hasMathDelimiters && content.trim()) {
    const looksLikeMath = /[\\^_]|\\frac|\\sqrt|\\sum|\\int|\\lim/.test(content);
    if (looksLikeMath) {
      const lines = content.split('\n').filter(line => line.trim());
      if (lines.length > 1) {
        const alignContent = lines.map(line => line.trim()).join(' \\\\\n');
        return `\\begin{align*}\n${alignContent}\n\\end{align*}`;
      }
      return `\\[\n${content}\n\\]`;
    }
  }
  
  return content;
}

function cleanLatexForKatex(latex: string): string {
  let content = extractBody(latex);

  content = content
    .replace(/\\documentclass(\[.*?\])?\{.*?\}/g, '')
    .replace(/\\usepackage(\[.*?\])?\{.*?\}/g, '')
    .replace(/\\begin\{document\}/g, '')
    .replace(/\\end\{document\}/g, '')
    .replace(/\\maketitle/g, '')
    .replace(/\\title\{.*?\}/g, '')
    .replace(/\\author\{.*?\}/g, '')
    .replace(/\\date\{.*?\}/g, '')
    .trim();

  content = content
    .replace(/\\begin\{equation\*?\}/g, '')
    .replace(/\\end\{equation\*?\}/g, '\\\\');

  content = content
    .replace(/\\\]\s*\\\[/g, '\\\\')
    .replace(/\\\[/g, '')
    .replace(/\\\]/g, '')
    .replace(/\\\(/g, '')
    .replace(/\\\)/g, '');

  content = content.replace(/(^|[^\\])\$/g, '$1').trim();

  content = content.replace(/([^\\])\n/g, '$1 \\\\ ');

  return content ? `\\begin{gathered}${content}\\end{gathered}` : '';
}

interface KatexPreviewProps {
  latex: string;
  className?: string;
}

export function KatexPreview({ latex, className }: KatexPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!latex || !containerRef.current) return;

    try {
      const content = cleanLatexForKatex(latex);
      containerRef.current.innerHTML = '';

      katex.render(content, containerRef.current, {
        displayMode: true,
        throwOnError: false,
        trust: true,
        output: 'html',
      });
    } catch (err) {
      console.error('KaTeX rendering error:', err);
      if (containerRef.current) {
        containerRef.current.textContent = 'Error rendering equation';
      }
    }
  }, [latex]);

  if (!latex) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-400">Preview will appear here...</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-full w-full overflow-x-auto p-4">
      <div ref={containerRef} className={className ?? 'text-xl'} />
    </div>
  );
}

export { extractBody };
