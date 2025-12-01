'use client';

import { useState, useCallback } from 'react';

interface UseImageUploadReturn {
  uploadedImage: string | null;
  imageFileName: string;
  isDragging: boolean;
  handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDragLeave: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => void;
  handleRemoveImage: () => void;
  setError: (error: string) => void;
}

export function useImageUpload(
  onError?: (error: string) => void
): UseImageUploadReturn {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [imageFileName, setImageFileName] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const setError = useCallback(
    (error: string) => {
      onError?.(error);
    },
    [onError]
  );

  const processImageFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith('image/')) {
        setError('Please upload an image file');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const base64String = event.target?.result as string;
        setUploadedImage(base64String);
        setImageFileName(file.name);
      };
      reader.readAsDataURL(file);
    },
    [setError]
  );

  const handleImageUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        processImageFile(file);
      }
    },
    [processImageFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const file = e.dataTransfer.files?.[0];
      if (file) {
        processImageFile(file);
      }
    },
    [processImageFile]
  );

  const handleRemoveImage = useCallback(() => {
    setUploadedImage(null);
    setImageFileName('');
  }, []);

  return {
    uploadedImage,
    imageFileName,
    isDragging,
    handleImageUpload,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleRemoveImage,
    setError,
  };
}
