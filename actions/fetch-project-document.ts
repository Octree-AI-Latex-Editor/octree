'use server';

import { createClient } from '@/lib/supabase/server';
import { DEFAULT_LATEX_CONTENT } from '@/data/constants';
import type { Tables, TablesInsert } from '@/database.types';

export interface ProjectDocumentData {
  project: Tables<'projects'>;
  document: Pick<Tables<'documents'>, 'content' | 'title'>;
}

export interface FetchProjectDocumentResult {
  data: ProjectDocumentData | null;
  error: string | null;
}

export async function fetchProjectAndDocument(
  projectId: string
): Promise<FetchProjectDocumentResult> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return {
        data: null,
        error: 'User not authenticated',
      };
    }

    const { data: projectData, error: projectError } = await supabase
      .from('projects' as const)
      .select('*')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single<Tables<'projects'>>();

    if (projectError || !projectData) {
      return {
        data: null,
        error: 'Project not found',
      };
    }

    const { data: documentData, error: documentError } = await supabase
      .from('documents' as const)
      .select('content, title')
      .eq('project_id', projectId)
      .eq('filename', 'main.tex')
      .eq('owner_id', user.id)
      .single<Pick<Tables<'documents'>, 'content' | 'title'>>();

    if (documentError || !documentData) {
      const defaultContent = DEFAULT_LATEX_CONTENT(projectData.title);

      const newDocInsert: TablesInsert<'documents'> = {
        title: projectData.title,
        content: defaultContent,
        owner_id: user.id,
        project_id: projectId,
        filename: 'main.tex',
        document_type: 'article',
      };

      const { data: newDocumentRaw, error: createError } = await (supabase
        .from('documents') as any)
        .insert(newDocInsert)
        .select('content, title')
        .single();

      if (createError || !newDocumentRaw) {
        return {
          data: null,
          error: 'Failed to create document',
        };
      }

      const newDocument = newDocumentRaw as Pick<
        Tables<'documents'>,
        'content' | 'title'
      >;

      return {
        data: {
          project: projectData,
          document: newDocument,
        },
        error: null,
      };
    }

    return {
      data: {
        project: projectData,
        document: documentData,
      },
      error: null,
    };
  } catch (error) {
    console.error('Error loading project:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to load project',
    };
  }
}
