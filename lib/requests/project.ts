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

  const { data: filesData, error: filesError } = await supabase
    .from('files')
    .select('*')
    .eq('project_id', projectId)
    .order('uploaded_at', { ascending: false });

  if (filesError) throw filesError;
  if (!filesData) return [];

  const filesWithDocuments = await Promise.all(
    filesData.map(async (file: Tables<'files'>) => {
      const { data: documentData, error: documentError } = await supabase
        .from('documents')
        .select('*')
        .eq('project_id', projectId)
        .eq('filename', file.name)
        .eq('owner_id', session.user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (documentError || !documentData) {
        return {
          file,
          document: null,
        };
      }

      return {
        file,
        document: documentData,
      };
    })
  );

  return filesWithDocuments.filter((item) => item.document !== null);
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
  fileId: string,
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

  const { error: updateFileError } = await (supabase.from('files') as any)
    .update({ name: newName })
    .eq('id', fileId)
    .eq('project_id', projectId);

  if (updateFileError) {
    throw new Error('Failed to rename file');
  }

  const { error: updateDocumentError } = await (
    supabase.from('documents') as any
  )
    .update({
      title: newName,
      filename: newName,
      updated_at: new Date().toISOString(),
    })
    .eq('project_id', projectId)
    .eq('filename', currentName)
    .eq('owner_id', session.user.id);

  if (updateDocumentError) {
    console.warn(
      'Failed to update associated document name:',
      updateDocumentError
    );
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

  const { error: deleteDocumentError } = await (
    supabase.from('documents') as any
  )
    .delete()
    .eq('project_id', projectId)
    .eq('filename', fileName)
    .eq('owner_id', session.user.id);

  if (deleteDocumentError) {
    console.warn('Failed to delete associated document:', deleteDocumentError);
  }

  const { error: deleteFileError } = await (supabase.from('files') as any)
    .delete()
    .eq('id', fileId)
    .eq('project_id', projectId);

  if (deleteFileError) {
    throw new Error('Failed to delete file');
  }
};
