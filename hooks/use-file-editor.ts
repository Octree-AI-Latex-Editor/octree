'use client';

import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { getProject, getProjectFiles } from '@/lib/requests/project';
import type { Project } from '@/types/project';
import { useFileStore } from '@/stores/file';

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

export interface FileApiResponse {
  file: FileData;
  document: DocumentData;
}

export interface FileEditorState {
  project: Project | null;
  file: FileData | null;
  documentData: DocumentData | null;
  isLoading: boolean;
  error: string | null;
}

export function useFileEditor(): FileEditorState {
  const params = useParams();
  const projectId = params.projectId as string;

  const { selectedFileId } = useFileStore();
  const fileId = selectedFileId;

  const {
    data: projectData,
    isLoading: isProjectLoading,
    error: projectError,
  } = useSWR<Project>(projectId ? ['project', projectId] : null, () =>
    getProject(projectId)
  );

  const {
    data: filesData,
    isLoading: isFileLoading,
    error: fileError,
  } = useSWR<FileApiResponse[]>(
    projectId ? ['project-files', projectId] : null,
    () => getProjectFiles(projectId)
  );

  const selectedFileResponse = filesData?.find(
    (fileResponse) => fileResponse.file.id === fileId
  );

  const file = selectedFileResponse?.file ?? null;
  const documentData = selectedFileResponse?.document ?? null;
  const isLoading = isProjectLoading || isFileLoading;
  const error = projectError?.message || fileError?.message || null;

  return {
    project: projectData ?? null,
    file,
    documentData,
    isLoading,
    error,
  };
}
