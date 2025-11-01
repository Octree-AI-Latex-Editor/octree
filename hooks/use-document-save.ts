'use client';

import { useState, useCallback } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { saveDocument } from '@/lib/requests/document';

export interface DocumentSaveState {
  isSaving: boolean;
  lastSaved: Date | null;
  handleSaveDocument: (contentToSave?: string) => Promise<boolean>;
  debouncedSave: (content: string) => void;
  setLastSaved: (date: Date | null) => void;
}

interface UseDocumentSaveProps {
  projectId: string;
  fileId: string;
  content: string;
}

export function useDocumentSave({
  projectId,
  fileId,
  content,
}: UseDocumentSaveProps): DocumentSaveState {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const handleSaveDocument = useCallback(
    async (contentToSave?: string): Promise<boolean> => {
      if (!projectId || !fileId) {
        console.log('Cannot save: missing projectId or fileId', { projectId, fileId });
        return false;
      }

      const contentToUse =
        contentToSave !== undefined ? contentToSave : content;

      console.log('Saving document:', {
        projectId,
        fileId,
        contentLength: contentToUse.length,
        contentPreview: contentToUse.substring(0, 100)
      });

      try {
        setIsSaving(true);

        const result = await saveDocument(projectId, fileId, contentToUse);

        if (!result.success) {
          console.error('Error saving document:', result.error);
          return false;
        }

        console.log('Document saved successfully');
        setLastSaved(new Date());
        return true;
      } catch (error) {
        console.error('Error saving document:', error);
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [projectId, fileId, content]
  );

  // Debounced auto-save function
  const debouncedSave = useDebouncedCallback(
    (content: string) => {
      handleSaveDocument(content);
    },
    2000 // Save after 2 seconds of inactivity
  );

  return {
    isSaving,
    lastSaved,
    handleSaveDocument,
    debouncedSave,
    setLastSaved,
  };
}
