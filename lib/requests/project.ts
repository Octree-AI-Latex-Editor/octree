import { createClient } from '@/lib/supabase/client';
import type { FileApiResponse } from '@/hooks/use-file-editor';
import type { Tables } from '@/database.types';

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

export const getProjectFiles = async (
  projectId: string
): Promise<FileApiResponse[]> => {
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
