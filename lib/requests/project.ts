import { createClient } from '@/lib/supabase/client';
import type { ProjectFile } from '@/hooks/use-file-editor';
import { isBinaryFile } from '@/lib/constants/file-types';

export const getProject = async (projectId: string) => {
  const supabase = createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .eq('user_id', session.user.id)
    .single();

  if (error) throw error;
  return data;
};

async function listAllFiles(
  supabase: any,
  projectId: string,
  path: string = ''
): Promise<any[]> {
  const listPath = path
    ? `projects/${projectId}/${path}`
    : `projects/${projectId}`;

  const { data: items, error } = await supabase.storage
    .from('octree')
    .list(listPath, {
      sortBy: { column: 'created_at', order: 'desc' },
    });

  if (error || !items) return [];

  const allFiles: any[] = [];

  for (const item of items) {
    if (item.id) {
      const fullPath = path ? `${path}/${item.name}` : item.name;
      allFiles.push({
        ...item,
        name: fullPath,
      });
    } else if (item.name !== '.emptyFolderPlaceholder') {
      const subPath = path ? `${path}/${item.name}` : item.name;
      const subFiles = await listAllFiles(supabase, projectId, subPath);
      allFiles.push(...subFiles);
    }
  }

  return allFiles;
}

export const getProjectFiles = async (
  projectId: string
): Promise<ProjectFile[]> => {
  const supabase = createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    throw new Error('User not authenticated');
  }

  const storageFiles = await listAllFiles(supabase, projectId);

  if (!storageFiles || storageFiles.length === 0) return [];

  const actualFiles = storageFiles.filter((item) => item.id !== null);

  const filesWithContent = await Promise.all(
    actualFiles.map(async (storageFile) => {
      try {
        const cacheBuster = `?t=${Date.now()}`;
        const { data: fileBlob, error: downloadError } = await supabase.storage
          .from('octree')
          .download(`projects/${projectId}/${storageFile.name}${cacheBuster}`);

        if (downloadError || !fileBlob) {
          console.warn(
            `Failed to download file ${storageFile.name}:`,
            downloadError
          );
          return {
            file: {
              id: storageFile.id,
              name: storageFile.name,
              project_id: projectId,
              size: null,
              type: null,
              uploaded_at: storageFile.created_at,
            },
            document: null,
          };
        }

        let content: string;
        if (isBinaryFile(storageFile.name)) {
          const arrayBuffer = await fileBlob.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          content = btoa(String.fromCharCode(...uint8Array));
        } else {
          content = await fileBlob.text();
        }

        return {
          file: {
            id: storageFile.id,
            name: storageFile.name,
            project_id: projectId,
            size: storageFile.metadata?.size || null,
            type: storageFile.metadata?.mimetype || null,
            uploaded_at: storageFile.created_at,
          },
          document: {
            id: storageFile.id,
            title: storageFile.name,
            content: content,
            owner_id: session.user.id,
            project_id: projectId,
            filename: storageFile.name,
            document_type: storageFile.name === 'main.tex' ? 'article' : 'file',
            created_at: storageFile.created_at,
            updated_at: storageFile.updated_at || storageFile.created_at,
          },
        };
      } catch (error) {
        console.error(`Error processing file ${storageFile.name}:`, error);
        return {
          file: {
            id: storageFile.id,
            name: storageFile.name,
            project_id: projectId,
            size: null,
            type: null,
            uploaded_at: storageFile.created_at,
          },
          document: null,
        };
      }
    })
  );

  return filesWithContent.filter((item) => item.document !== null);
};

export interface ImportProjectResponse {
  success: boolean;
  projectId?: string;
  totalFiles?: number;
  texFiles?: number;
  otherFiles?: number;
  error?: string;
}

export const importProject = async (
  file: File
): Promise<ImportProjectResponse> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/import-project', {
    method: 'POST',
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    return {
      success: false,
      error: data.error || 'Failed to import project',
    };
  }

  return data;
};

export const renameFile = async (
  projectId: string,
  currentName: string,
  newName: string
): Promise<void> => {
  const supabase = createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    throw new Error('User not authenticated');
  }

  const { error: moveError } = await supabase.storage
    .from('octree')
    .move(
      `projects/${projectId}/${currentName}`,
      `projects/${projectId}/${newName}`
    );

  if (moveError) {
    throw new Error('Failed to rename file');
  }
};

export const deleteFile = async (
  projectId: string,
  fileId: string,
  fileName: string
): Promise<void> => {
  const supabase = createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    throw new Error('User not authenticated');
  }

  const { error: deleteError } = await supabase.storage
    .from('octree')
    .remove([`projects/${projectId}/${fileName}`]);

  if (deleteError) {
    throw new Error('Failed to delete file');
  }
};
