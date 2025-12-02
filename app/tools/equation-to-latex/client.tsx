'use client';

import { useState } from 'react';
import {
  CodeXml,
  Eye,
  Loader2,
  Copy,
  Check,
  Image as ImageIcon,
  X,
  Download,
} from 'lucide-react';
import Image from 'next/image';
import Editor from '@monaco-editor/react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { KatexPreview, extractBody } from '@/components/latex/katex-preview';
import { useImageUpload } from '@/hooks/use-image-upload';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { convertImageToLatex } from '@/lib/image-to-latex';

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

function stripCodeFences(text: string): string {
  return text
    .replace(/^```(?:latex)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}

export default function EquationToLatexClient() {
  const [equation, setEquation] = useState('');
  const [latex, setLatex] = useState('');
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState('');
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [activeTab, setActiveTab] = useState<'code' | 'preview'>('code');

  const { copied, copyToClipboard } = useCopyToClipboard();
  const {
    uploadedImage,
    imageFileName,
    isDragging,
    handleImageUpload,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleRemoveImage,
  } = useImageUpload(setError);

  const handleConvert = async () => {
    if (!equation.trim() && !uploadedImage) {
      setError('Please enter an equation or upload an image');
      return;
    }

    setIsConverting(true);
    setError('');
    setLatex('');

    try {
      const [imageResult, textResult] = await Promise.all([
        uploadedImage
          ? convertImageToLatex(uploadedImage, imageFileName)
          : Promise.resolve({ success: true as const, latex: '' }),
        equation.trim()
          ? fetch('/api/equation-to-latex', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ equation }),
            }).then(async (res) => {
              const data = await res.json();
              if (!res.ok) throw new Error(data.error || 'failed to convert');
              return { success: true as const, latex: data.latex as string };
            })
          : Promise.resolve({ success: true as const, latex: '' }),
      ]);

      if (!imageResult.success) throw new Error(imageResult.error);

      const imageContent = imageResult.latex
        ? extractBody(stripCodeFences(imageResult.latex))
        : '';
      const textContent = textResult.latex
        ? extractBody(stripCodeFences(textResult.latex))
        : '';

      let combinedContent = '';
      if (imageContent && textContent) {
        combinedContent = `% From image:\n${imageContent}\n\n% From text:\n${textContent}`;
      } else {
        combinedContent = imageContent || textContent;
      }

      setLatex(
        combinedContent ? LATEX_TEMPLATE.replace('{CONTENT}', combinedContent) : ''
      );
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
    if (latex) downloadFile(latex, 'equation.tex', 'text/plain');
  };

  const exportAsPdf = async () => {
    if (!latex) return;
    setIsExportingPdf(true);

    try {
      const response = await fetch('/api/compile-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: [{ path: 'main.tex', content: latex }] }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'failed to compile pdf');

      const pdfBlob = await fetch(`data:application/pdf;base64,${data.pdf}`).then(
        (r) => r.blob()
      );
      downloadFile(pdfBlob, 'equation.pdf');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to export pdf');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const canConvert = equation.trim() || uploadedImage;

  return (
    <div className="grid grid-cols-2 gap-8">
      {/* Input Panel */}
      <div className="flex flex-col">
        <div className="h-[72px] mb-6 flex flex-col justify-start">
          <div className="mb-2 flex items-center gap-3">
            <Badge className="bg-orange-50 text-orange-900 border-orange-200 hover:bg-orange-50">
              INPUT
            </Badge>
            <h2 className="text-xl font-medium text-gray-900">Equation Input</h2>
          </div>
          <p className="text-sm text-gray-600">
            Describe your equation, upload an image, or both
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="text-base font-medium text-gray-900 mb-2">
              Equation Description
            </h3>
            <textarea
              value={equation}
              onChange={(e) => setEquation(e.target.value)}
              placeholder="Describe your equation (e.g., 'quadratic formula: x equals negative b plus or minus square root of b squared minus 4ac, all over 2a')"
              className="w-full h-32 resize-none border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-400"
            />
          </div>

          <div>
            <h3 className="text-base font-medium text-gray-900 mb-2">
              Upload Equation Image
            </h3>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`relative border-2 border-dashed rounded-lg transition-colors ${
                isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'
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
                  <ImageIcon className="h-12 w-12 text-gray-400 mb-3" />
                  <p className="text-base font-medium text-gray-700 mb-1">
                    Drag and drop your image here, or click to select
                  </p>
                  <p className="text-sm text-gray-500">Supports PNG, JPG, and JPEG</p>
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

        <Button
          onClick={handleConvert}
          disabled={isConverting || !canConvert}
          className="mt-4 w-full py-3 text-base"
          size="lg"
        >
          {isConverting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Converting...
            </>
          ) : (
            'Convert to LaTeX'
          )}
        </Button>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
      </div>

      {/* Output Panel */}
      <div className="flex flex-col">
        <div className="h-[72px] mb-6 flex flex-col justify-start">
          <div className="mb-2 flex items-center gap-3">
            <Badge className="bg-green-50 text-green-900 border-green-200 hover:bg-green-50">
              OUTPUT
            </Badge>
            <h2 className="text-xl font-medium text-gray-900">LaTeX Code</h2>
          </div>
          <p className="text-sm text-gray-600">Ready to use in your LaTeX documents</p>
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
                      onClick={() => copyToClipboard(latex)}
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
                        padding: { top: 10, bottom: 10 },
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center flex-1">
                  <p className="text-gray-400">Converted LaTeX will appear here...</p>
                </div>
              )
            ) : (
              <div className="flex-1 overflow-auto p-6">
                <KatexPreview latex={latex} />
              </div>
            )}
          </div>
        </div>

        {latex && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="mt-4 w-full" disabled={isExportingPdf}>
                {isExportingPdf ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Exporting PDF...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    Export
                  </>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[180px]">
              <DropdownMenuItem onClick={exportAsLatex}>
                Export as LaTeX
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportAsPdf}>
                Export as PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
