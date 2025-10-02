'use client';

import { useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useFileViewer } from '@/app/context/file-viewer';

interface File {
  id: string;
  name: string;
  project_id: string;
  type: string;
  size: number;
  uploaded_at: string | null;
}

interface DocumentData {
  id: string;
  title: string;
  content: string;
  owner_id: string;
  project_id: string;
  filename: string;
  document_type: string | null;
  created_at: string;
  updated_at: string;
}

export function useFileSwitcher() {
  const { switchToFile } = useFileViewer();

  const fetchAndSwitchToFile = useCallback(async (fileId: string, projectId: string) => {
    try {
      const supabase = createClient();
      
      // Fetch file data
      const { data: file, error: fileError } = await supabase
        .from('files')
        .select('*')
        .eq('id', fileId)
        .eq('project_id', projectId)
        .single();

      if (fileError || !file) {
        console.error('Error fetching file:', fileError);
        return;
      }

      // Fetch document data
      const { data: document, error: documentError } = await supabase
        .from('documents')
        .select('*')
        .eq('project_id', projectId)
        .eq('filename', file.name)
        .single();

      if (documentError || !document) {
        console.error('Error fetching document:', documentError);
        return;
      }

      // Switch to the file
      switchToFile(file as File, document as DocumentData);
      
    } catch (error) {
      console.error('Error switching to file:', error);
    }
  }, [switchToFile]);

  return { fetchAndSwitchToFile };
}
