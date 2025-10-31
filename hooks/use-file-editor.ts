'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export interface Project {
  id: string;
  title: string;
  user_id: string;
  created_at: string | null;
  updated_at: string | null;
}

export interface FileData {
  id: string;
  name: string;
  project_id: string;
  size: number | null;
  type: string | null;
  uploaded_at: string | null;
}

export interface DocumentData {
  id: string;
  title: string;
  content: string;
  owner_id: string;
  project_id: string;
  filename: string;
  document_type: string;
  created_at: string | null;
  updated_at: string | null;
}

export interface FileEditorState {
  project: Project | null;
  file: FileData | null;
  documentData: DocumentData | null;
  isLoading: boolean;
  error: string | null;
  title: string;
  setTitle: (title: string) => void;
}

export function useFileEditor(): FileEditorState {
  const supabase = createClient();
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const fileId = params.fileId as string;

  const [project, setProject] = useState<Project | null>(null);
  const [file, setFile] = useState<FileData | null>(null);
  const [documentData, setDocumentData] = useState<DocumentData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');

  useEffect(() => {
    const fetchFile = async () => {
      if (!projectId || !fileId) return;

      try {
        setIsLoading(true);
        setError(null);

        // Get current user
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.user) {
          router.push('/auth/login');
          return;
        }

        // Fetch the project
        const { data: projectData, error: projectError } = await supabase
          .from('projects')
          .select('*')
          .eq('id', projectId)
          .eq('user_id', session.user.id)
          .single();

        if (projectError) {
          throw new Error('Project not found');
        }

        setProject(projectData);

        // Fetch the specific file and its document
        const response = await fetch(
          `/api/projects/${projectId}/files/${fileId}`
        );

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('File not found');
          }
          throw new Error('Failed to fetch file');
        }

        const { file: fileData, document: documentData } =
          await response.json();

        console.log('Loaded file:', {
          fileName: fileData.name,
          contentLength: documentData.content?.length,
          contentPreview: documentData.content?.substring(0, 100),
          updatedAt: documentData.updated_at
        });

        setFile(fileData);
        setDocumentData(documentData);
        setTitle(documentData.title);

        setIsLoading(false);
      } catch (error) {
        console.error('Error loading file:', error);
        setError(
          error instanceof Error ? error.message : 'Failed to load file'
        );
        setIsLoading(false);
      }
    };

    fetchFile();
  }, [projectId, fileId, supabase, router]);

  return {
    project,
    file,
    documentData,
    isLoading,
    error,
    title,
    setTitle,
  };
}
