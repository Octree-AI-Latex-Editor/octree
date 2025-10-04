'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const DeleteProject = z.object({
  projectId: z.string().uuid('Invalid project ID'),
});

export type State = {
  projectId: string | null;
  message?: string | null;
  success?: boolean;
};

export async function deleteProject(prevState: State, formData: FormData) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      redirect('/auth/login');
    }

    const validatedFields = DeleteProject.safeParse({
      projectId: formData.get('projectId') as string,
    });

    if (!validatedFields.success) {
      throw new Error(validatedFields.error.errors[0].message);
    }

    const { projectId } = validatedFields.data;

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, title')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();

    if (projectError || !project) {
      throw new Error(
        'Project not found or you do not have permission to delete it'
      );
    }

    const { error: documentsError } = await supabase
      .from('documents')
      .delete()
      .eq('project_id', projectId);

    if (documentsError) {
      console.error('Error deleting project documents:', documentsError);
      throw new Error('Failed to delete project documents');
    }

    const { error: filesError } = await supabase
      .from('files')
      .delete()
      .eq('project_id', projectId);

    if (filesError) {
      console.error('Error deleting project files:', filesError);
      throw new Error('Failed to delete project files');
    }

    const { error: deleteError } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId)
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('Error deleting project:', deleteError);
      throw new Error('Failed to delete project');
    }

    // Revalidate the projects dashboard specifically
    revalidatePath('/projects');

    return {
      projectId,
      message: null,
      success: true,
    };
  } catch (error) {
    console.error('Error deleting project:', error);
    return {
      projectId: null,
      message:
        error instanceof Error ? error.message : 'Failed to delete project',
      success: false,
    };
  }
}
