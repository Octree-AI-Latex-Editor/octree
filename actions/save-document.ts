'use server';

import { createClient } from '@/lib/supabase/server';
import type { TablesInsert, TablesUpdate } from '@/database.types';

export interface SaveDocumentResult {
  success: boolean;
  error: string | null;
}

export async function saveDocument(
  projectId: string,
  contentToSave: string
): Promise<SaveDocumentResult> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return {
        success: false,
        error: 'User not authenticated',
      };
    }

    const { data: documentData, error: documentError } = await supabase
      .from('documents' as const)
      .select('id')
      .eq('project_id', projectId)
      .eq('filename', 'main.tex')
      .eq('owner_id', user.id)
      .single<{ id: string }>();

    if (documentError || !documentData) {
      return {
        success: false,
        error: 'Document not found',
      };
    }

    const updatePayload: TablesUpdate<'documents'> = {
      content: contentToSave,
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await (supabase
      .from('documents') as any)
      .update(updatePayload)
      .eq('id', documentData.id);

    if (updateError) {
      return {
        success: false,
        error: 'Failed to update document',
      };
    }

    const versionPayload: TablesInsert<'document_versions'> = {
      document_id: documentData.id,
      content: contentToSave,
      change_summary: 'Auto-saved version',
      created_by: user.id,
    };

    const { error: versionError } = await (supabase
      .from('document_versions') as any)
      .insert(versionPayload);

    if (versionError) {
      console.warn('Failed to save version:', versionError);
    }

    return {
      success: true,
      error: null,
    };
  } catch (error) {
    console.error('Error saving document:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save document',
    };
  }
}
