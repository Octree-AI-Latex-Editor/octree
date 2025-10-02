'use client';

import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ImageViewerProps {
  imageData: string; // base64 data URL
  fileName: string;
}

export function ImageViewer({ imageData, fileName }: ImageViewerProps) {
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = imageData;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Simple Toolbar with Download Button */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
        <h2 className="text-lg font-semibold text-gray-900 truncate">
          {fileName}
        </h2>
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownload}
        >
          <Download className="h-4 w-4 mr-2" />
          Download
        </Button>
      </div>

      {/* Image Container - Always Fitted */}
      <div className="flex-1 flex items-center justify-center bg-gray-100 p-4">
        <img
          src={imageData}
          alt={fileName}
          className="max-w-full max-h-full object-contain shadow-lg rounded-lg"
          draggable={false}
        />
      </div>
    </div>
  );
}
