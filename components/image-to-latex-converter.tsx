'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ImageIcon } from 'lucide-react';
import { ImageUploadModal } from './image-upload-modal';
import { ImagePreviewModal } from './image-preview-modal';
import { useProjectRefresh } from '@/app/context/project';

interface ImageToLatexConverterProps {
  projectId: string;
  className?: string;
}

interface ConversionResult {
  latexCode: string;
  imageUrl: string;
  fileName: string;
  fileId?: string;
}

export function ImageToLatexConverter({
  projectId,
  className,
}: ImageToLatexConverterProps) {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [conversionResult, setConversionResult] = useState<ConversionResult | null>(null);
  const { refreshProjects } = useProjectRefresh();

  const handleUploadSuccess = (result: ConversionResult) => {
    setConversionResult(result);
    setShowUploadModal(false);
    setShowPreviewModal(true);
    
    // Refresh the sidebar to show the newly added image file
    if (result.fileId) {
      refreshProjects();
    }
  };

  const handleBack = () => {
    setShowPreviewModal(false);
    setShowUploadModal(true);
  };

  const handleClose = () => {
    setShowUploadModal(false);
    setShowPreviewModal(false);
    setConversionResult(null);
  };

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setShowUploadModal(true)}
        className={className}
      >
        <ImageIcon className="mr-2 h-4 w-4" />
        Upload Image
      </Button>

      <ImageUploadModal
        open={showUploadModal}
        onOpenChange={setShowUploadModal}
        projectId={projectId}
        onSuccess={handleUploadSuccess}
      />

      {conversionResult && (
        <ImagePreviewModal
          open={showPreviewModal}
          onOpenChange={handleClose}
          imageUrl={conversionResult.imageUrl}
          latexCode={conversionResult.latexCode}
          fileName={conversionResult.fileName}
          fileId={conversionResult.fileId}
          onBack={handleBack}
        />
      )}
    </>
  );
}
