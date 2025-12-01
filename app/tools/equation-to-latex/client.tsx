'use client';

import { useState, useRef, useEffect } from 'react';
import { CodeXml, Eye, Loader2, Copy, Check, Image as ImageIcon, X, ChevronDown, Download } from 'lucide-react';
import Image from 'next/image';
import Editor from '@monaco-editor/react';
import katex from 'katex';
// @ts-ignore
import 'katex/dist/katex.min.css';

const LATEX_TEMPLATE = `\\documentclass{article}
\\usepackage{amsmath}
\\usepackage{amssymb}
\\usepackage{hyperref}
\\usepackage{graphicx}
\\usepackage{booktabs}
\\usepackage{listings}

\\begin{document}

{CONTENT}

\\end{document}`;

function extractBody(latex: string): string {
  const documentMatch = latex.match(/\\begin\{document\}([\s\S]*?)\\end\{document\}/);
  return documentMatch ? documentMatch[1].trim() : latex;
}

function cleanLatexForKatex(latex: string) {
  let equationContent = extractBody(latex);
  
  equationContent = equationContent
    .replace(/\\documentclass(\[.*?\])?\{.*?\}/g, '')
    .replace(/\\usepackage(\[.*?\])?\{.*?\}/g, '')
    .replace(/\\begin\{document\}/g, '')
    .replace(/\\end\{document\}/g, '')
    .replace(/\\maketitle/g, '')
    .replace(/\\title\{.*?\}/g, '')
    .replace(/\\author\{.*?\}/g, '')
    .replace(/\\date\{.*?\}/g, '')
    .trim();
  
  equationContent = equationContent
    .replace(/\\begin\{equation\*?\}/g, '')
    .replace(/\\end\{equation\*?\}/g, '\\\\');

  equationContent = equationContent.replace(/\\\]\s*\\\[/g, '\\\\');

  equationContent = equationContent
    .replace(/\\\[/g, '')
    .replace(/\\\]/g, '')
    .replace(/\\\(/g, '')
    .replace(/\\\)/g, '');

  equationContent = equationContent.replace(/(^|[^\\])\$/g, '$1').trim();

  equationContent = equationContent.replace(/([^\\])\n/g, '$1 \\\\ ');
  
  if (equationContent) {
    return `\\begin{gathered}${equationContent}\\end{gathered}`;
  }
  return '';
}

export default function EquationToLatexClient() {
  const [equation, setEquation] = useState('');
  const [latex, setLatex] = useState('');
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'code' | 'preview'>('code');
  const [copied, setCopied] = useState(false);
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [imageFileName, setImageFileName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  
  const katexRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  if (latex && katexRef.current && activeTab === 'preview') {
    try {
      const equationContent = cleanLatexForKatex(latex);
      
      katexRef.current.innerHTML = '';
      
      katex.render(equationContent, katexRef.current, {
        displayMode: true,
        throwOnError: false,
        trust: true,
        output: 'html',
      });
    } catch (err) {
      console.error('KaTeX rendering error:', err);
      if (katexRef.current) {
        katexRef.current.textContent = 'Error rendering equation';
      }
    }
  }
}, [latex, activeTab]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsExportDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const processImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64String = event.target?.result as string;
      setUploadedImage(base64String);
      setImageFileName(file.name);
      setError('');
    };
    reader.readAsDataURL(file);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const handleRemoveImage = () => {
    setUploadedImage(null);
    setImageFileName('');
  };

  const handleConvert = async () => {
    if (!equation.trim() && !uploadedImage) {
      setError('Please enter an equation or upload an image');
      return;
    }

    setIsConverting(true);
    setError('');
    setLatex('');

    try {
      const promises: Promise<string>[] = [];

      if (uploadedImage) {
        promises.push((async () => {
          const response = await fetch('/api/octra-agent/image-to-latex', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: uploadedImage, fileName: imageFileName }),
          });

          if (!response.ok) throw new Error('failed to convert image');

          const reader = response.body?.getReader();
          const decoder = new TextDecoder();
          let result = '';

          if (reader) {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              result += decoder.decode(value, { stream: true });
            }
          }
          return result.replace(/^```(?:latex)?\s*/i, '').replace(/\s*```$/, '').trim();
        })());
      } else {
        promises.push(Promise.resolve(''));
      }

      if (equation.trim()) {
        promises.push((async () => {
          const response = await fetch('/api/equation-to-latex', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ equation }),
          });

          const data = await response.json();
          if (!response.ok) throw new Error(data.error || 'failed to convert equation');
          return data.latex.replace(/^```(?:latex)?\s*/i, '').replace(/\s*```$/, '').trim();
        })());
      } else {
        promises.push(Promise.resolve(''));
      }

      const [imageLatex, textLatex] = await Promise.all(promises);
      
      const imageContent = imageLatex ? extractBody(imageLatex) : '';
      const textContent = textLatex ? extractBody(textLatex) : '';
      
      let combinedContent = '';
      if (imageContent && textContent) {
        combinedContent = `% From image:\n${imageContent}\n\n% From text:\n${textContent}`;
      } else {
        combinedContent = imageContent || textContent;
      }

      const finalLatex = combinedContent ? LATEX_TEMPLATE.replace('{CONTENT}', combinedContent) : '';
      
      setLatex(finalLatex);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'conversion failed');
    } finally {
      setIsConverting(false);
    }
  };

  const downloadFile = (content: string | Blob, filename: string, type?: string) => {
    const blob = content instanceof Blob ? content : new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportAsLatex = () => {
    if (!latex) return;
    downloadFile(latex, 'equation.tex', 'text/plain');
    setIsExportDropdownOpen(false);
  };

  const exportAsPdf = async () => {
    if (!latex) return;

    setIsExportingPdf(true);
    setIsExportDropdownOpen(false);

    try {
      const response = await fetch('/api/compile-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: [{ path: 'main.tex', content: latex }] }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'failed to compile pdf');

      const pdfBlob = await fetch(`data:application/pdf;base64,${data.pdf}`).then(r => r.blob());
      downloadFile(pdfBlob, 'equation.pdf');
    } catch (err) {
      console.error('PDF export error:', err);
      setError(err instanceof Error ? err.message : 'failed to export pdf');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleCopy = async () => {
    if (!latex) return;
    
    try {
      await navigator.clipboard.writeText(latex);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };



  return (
    <div className="grid grid-cols-2 gap-8">
      <div className="flex flex-col">
        <div className="h-[72px] mb-6 flex flex-col justify-start">
          <div className="mb-2 flex items-center gap-3">
            <span className="inline-flex items-center rounded-md bg-orange-50 px-3 py-1.5 text-sm font-medium text-orange-900 border border-orange-200">
              INPUT
            </span>
            <h2 className="text-xl font-medium text-gray-900">
              Equation Input
            </h2>
          </div>
          <p className="text-sm text-gray-600">
            Describe your equation, upload an image, or both
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="text-base font-medium text-gray-900 mb-2">Equation Description</h3>
            <textarea
              value={equation}
              onChange={(e) => setEquation(e.target.value)}
              placeholder="Describe your equation (e.g., 'quadratic formula: x equals negative b plus or minus square root of b squared minus 4ac, all over 2a')"
              className="w-full h-32 resize-none border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-400"
            />
          </div>

          <div>
            <h3 className="text-base font-medium text-gray-900 mb-2">Upload Equation Image</h3>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`relative border-2 border-dashed rounded-lg transition-colors ${
                isDragging
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 bg-gray-50'
              }`}
            >
              {uploadedImage ? (
                <div className="p-6 flex flex-col items-center justify-center min-h-[240px]">
                  <div className="relative">
                    <Image
                      src={uploadedImage}
                      alt="Uploaded equation"
                      width={400}
                      height={200}
                      className="object-contain rounded border border-gray-200"
                      style={{ maxHeight: '200px', width: 'auto' }}
                    />
                    <button
                      onClick={handleRemoveImage}
                      className="absolute -top-2 -right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-md"
                      aria-label="Remove image"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="mt-3 text-sm text-gray-600">{imageFileName}</p>
                  <label className="mt-4 px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 text-sm font-medium cursor-pointer hover:bg-gray-50 transition-colors">
                    Change Image
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center p-8 cursor-pointer min-h-[240px]">
                  <div className="flex flex-col items-center justify-center text-center">
                    <ImageIcon className="h-12 w-12 text-gray-400 mb-3" />
                    <p className="text-base font-medium text-gray-700 mb-1">
                      Drag and drop your image here, or click to select
                    </p>
                    <p className="text-sm text-gray-500">Supports PNG, JPG, and JPEG</p>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={handleConvert}
          disabled={isConverting || (!equation.trim() && !uploadedImage)}
          className="mt-4 w-full px-6 py-3 bg-blue-600 text-white text-base font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isConverting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Converting...
            </>
          ) : (
            'Convert to LaTeX'
          )}
        </button>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
      </div>

      <div className="flex flex-col">
        <div className="h-[72px] mb-6 flex flex-col justify-start">
          <div className="mb-2 flex items-center gap-3">
            <span className="inline-flex items-center rounded-md bg-green-50 px-3 py-1.5 text-sm font-medium text-green-900 border border-green-200">
              OUTPUT
            </span>
            <h2 className="text-xl font-medium text-gray-900">LaTeX Code</h2>
          </div>
          <p className="text-sm text-gray-600">
            Ready to use in your LaTeX documents
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl h-[520px] w-full flex flex-col overflow-hidden">
          <div className="border-b border-gray-200 flex-shrink-0">
            <div className="flex gap-1 px-6 pt-4">
              <button
                onClick={() => setActiveTab('code')}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'code'
                    ? 'border-gray-900 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <CodeXml className="h-4 w-4" />
                Code
              </button>
              <button
                onClick={() => setActiveTab('preview')}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'preview'
                    ? 'border-gray-900 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Eye className="h-4 w-4" />
                Preview
              </button>
            </div>
          </div>

          <div className="flex-1 flex flex-col overflow-hidden">
            {activeTab === 'code' ? (
              latex ? (
                <div className="flex flex-col h-full">
                  <div className="flex items-center justify-between px-6 pt-4 pb-2">
                    <p className="text-xs text-gray-500">LaTeX Output</p>
                    <button
                      onClick={handleCopy}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      {copied ? (
                        <>
                          <Check className="h-3 w-3" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <Editor
                      height="100%"
                      defaultLanguage="latex"
                      value={latex}
                      theme="vs-light"
                      options={{
                        readOnly: true,
                        minimap: { enabled: false },
                        fontSize: 13,
                        wordWrap: 'on',
                        lineNumbers: 'on',
                        scrollBeyondLastLine: false,
                        padding: {
                          top: 10,
                          bottom: 10,
                        },
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center flex-1">
                  <p className="text-gray-400">
                    Converted LaTeX will appear here...
                  </p>
                </div>
              )
            ) : (
              <div className="flex-1 overflow-auto p-6">
                {latex ? (
                  <div className="flex items-center justify-center min-h-full w-full overflow-x-auto p-4">
                    <div
                      ref={katexRef}
                      className="text-xl"
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-gray-400">Preview will appear here...</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {latex && (
          <div className="relative mt-4" ref={dropdownRef}>
            <button
              onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
              disabled={isExportingPdf}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExportingPdf ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Exporting PDF...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Export
                  <ChevronDown className="h-4 w-4" />
                </>
              )}
            </button>

            {isExportDropdownOpen && (
              <div className="absolute bottom-full mb-1 right-0 bg-white border border-gray-200 rounded-md shadow-lg overflow-hidden z-10 min-w-[180px]">
                <button
                  onClick={exportAsLatex}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Export as LaTeX
                </button>
                <button
                  onClick={exportAsPdf}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors border-t border-gray-100"
                >
                  Export as PDF
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}