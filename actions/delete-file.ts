'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const DeleteFile = z.object({
  fileId: z.string().uuid('Invalid file ID'),
  projectId: z.string().uuid('Invalid project ID'),
});

export type State = {
  fileId: string | null;
  projectId: string | null;
  message?: string | null;
  success?: boolean;
};

export async function deleteFile(prevState: State, formData: FormData) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      redirect('/auth/login');
    }

    const validatedFields = DeleteFile.safeParse({
      fileId: formData.get('fileId') as string,
      projectId: formData.get('projectId') as string,
    });

    if (!validatedFields.success) {
      throw new Error(validatedFields.error.errors[0].message);
    }

    const { fileId, projectId } = validatedFields.data;

    // Verify the file exists and belongs to the user's project
    const { data: file, error: fileError } = await supabase
      .from('files')
      .select('id, name, project_id')
      .eq('id', fileId)
      .eq('project_id', projectId)
      .single();

    if (fileError || !file) {
      throw new Error(
        'File not found or you do not have permission to delete it'
      );
    }

    // Verify the project belongs to the user
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, user_id')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();

    if (projectError || !project) {
      throw new Error(
        'Project not found or you do not have permission to delete files from it'
      );
    }

    // Delete the file
    const { error: deleteError } = await supabase
      .from('files')
      .delete()
      .eq('id', fileId);

    if (deleteError) {
      console.error('Error deleting file:', deleteError);
      throw new Error('Failed to delete file');
    }

    revalidatePath(`/projects/${projectId}`);

    return {
      fileId,
      projectId,
      message: null,
      success: true,
    };
  } catch (error) {
    console.error('Error deleting file:', error);
    return {
      fileId: null,
      projectId: null,
      message:
        error instanceof Error ? error.message : 'Failed to delete file',
      success: false,
    };
  }
}
