import { createClient } from '@/lib/supabase/client';
import type { ProjectFile } from '@/hooks/use-file-editor';
import type { Tables, TablesInsert } from '@/database.types';
import { DEFAULT_LATEX_CONTENT_FROM_FILENAME } from '@/data/constants';

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

type CreateDocumentOptions = {
  useDefaultContent?: boolean;
};

export const createDocumentForFile = async (
  projectId: string,
  fileName: string,
  content?: string,
  options?: CreateDocumentOptions
): Promise<Tables<'documents'>> => {
  const supabase = createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    throw new Error('User not authenticated');
  }

  const shouldUseDefaultContent = options?.useDefaultContent ?? true;

  const documentContent = (() => {
    if (typeof content === 'string') {
      return content;
    }

    if (!shouldUseDefaultContent) {
      return '';
    }

    if (fileName.endsWith('.bib')) {
      return '';
    }

    return DEFAULT_LATEX_CONTENT_FROM_FILENAME(fileName);
  })();

  const insertDoc: TablesInsert<'documents'> = {
    title: fileName,
    content: documentContent,
    owner_id: session.user.id,
    project_id: projectId,
    filename: fileName,
    document_type: fileName === 'main.tex' ? 'article' : 'file',
  };

  const { data: newDocument, error: createError } =
    await // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from('documents') as any).insert(insertDoc).select('*').single();

  if (createError) {
    throw new Error('Failed to create document');
  }

  return newDocument;
};

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

  const { data: storageFiles, error: storageError } = await supabase.storage
    .from('octree')
    .list(`projects/${projectId}`, {
      sortBy: { column: 'created_at', order: 'desc' },
    });

  if (storageError) throw storageError;
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

        const content = await fileBlob.text();

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
