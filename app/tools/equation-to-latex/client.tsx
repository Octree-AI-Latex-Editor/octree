'use client';

import { useState } from 'react';
import { CodeXml, Eye, Loader2, Copy, Check, Image as ImageIcon, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Editor from '@monaco-editor/react';

const DynamicPDFViewer = dynamic(
  () => import('@/components/dynamic-pdf-viewer'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    ),
  }
);

export default function EquationToLatexClient() {
  const [equation, setEquation] = useState('');
  const [latex, setLatex] = useState('');
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'code' | 'preview'>('code');
  const [pdfData, setPdfData] = useState<string | null>(null);
  const [isPdfCompiling, setIsPdfCompiling] = useState(false);
  const [copied, setCopied] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [imageFileName, setImageFileName] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);

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
    setPdfData(null);

    try {
      let imageLatex = '';
      let textLatex = '';
      
      // Process image if provided
      if (uploadedImage) {
        const response = await fetch('/api/octra-agent/image-to-latex', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            image: uploadedImage,
            fileName: imageFileName 
          }),
        });

        if (!response.ok) {
          throw new Error('failed to convert image');
        }

        // Stream the response
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            imageLatex += chunk;
            
            // Show streaming result if only image is provided
            if (!equation.trim()) {
              setLatex(imageLatex);
            }
          }
        }
      }
      
      // Process text equation if provided
      if (equation.trim()) {
        const response = await fetch('/api/equation-to-latex', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ equation }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'failed to convert equation');
        }

        textLatex = data.latex;
      }
      
      // Combine results if both are present
      let finalLatex = '';
      if (imageLatex && textLatex) {
        finalLatex = `% From image:\n${imageLatex}\n\n% From text:\n${textLatex}`;
      } else if (imageLatex) {
        finalLatex = imageLatex;
      } else {
        finalLatex = textLatex;
      }
      
      setLatex(finalLatex);
      
      // Auto-compile PDF preview
      await compilePdf(finalLatex);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'conversion failed');
    } finally {
      setIsConverting(false);
    }
  };

  const compilePdf = async (latexCode: string) => {
    if (!latexCode.trim()) return;
    
    setIsPdfCompiling(true);
    
    // Wrap the equation in a complete LaTeX document
    const fullDocument = `\\documentclass{article}
\\usepackage{amsmath}
\\usepackage{amssymb}
\\usepackage{graphicx}
\\begin{document}
${latexCode}
\\end{document}`;

    try {
      const response = await fetch('/api/compile-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          files: [{ path: 'main.tex', content: fullDocument }],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'failed to compile pdf');
      }

      setPdfData(data.pdf);
    } catch (err) {
      console.error('PDF compilation error:', err);
      // Don't show error to user, PDF preview is optional
    } finally {
      setIsPdfCompiling(false);
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

  const exampleEquations = [
    { label: 'Quadratic Formula', value: 'x = (-b ± sqrt(b^2 - 4ac)) / 2a' },
    { label: 'Pythagorean Theorem', value: 'a^2 + b^2 = c^2' },
    { label: 'Integral', value: 'integral from 0 to infinity of e^(-x) dx' },
    { label: 'Matrix', value: '2x2 matrix with entries 1, 2, 3, 4' },
  ];

  return (
    <div className="grid grid-cols-2 gap-8">
      {/* Left side - Input */}
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
          className="mt-6 w-full px-6 py-3 bg-blue-600 text-white text-base font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
              <div className="flex-1 overflow-hidden">
                {latex ? (
                  <DynamicPDFViewer
                    pdfData={pdfData}
                    isLoading={isPdfCompiling}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-gray-400">PDF preview will appear here...</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}