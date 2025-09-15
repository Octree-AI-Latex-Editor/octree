'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { TablesInsert } from '@/database.types';
import { z } from 'zod';
import { DEFAULT_LATEX_CONTENT } from '@/data/constants';

const CreateProject = z.object({
  title: z.string().min(1, 'Project title is required').trim(),
});

type State = {
  projectId: string | null;
  message?: string | null;
  success?: boolean;
};

export async function createProject(prevState: State, formData: FormData) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      redirect('/auth/login');
    }

    const validatedFields = CreateProject.safeParse({
      title: formData.get('title') as string,
    });

    if (!validatedFields.success) {
      throw new Error(validatedFields.error.errors[0].message);
    }

    const { title } = validatedFields.data;

    const projectData: TablesInsert<'projects'> = {
      title,
      user_id: user.id,
    };

    const { data, error } = await supabase
      .from('projects')
      .insert(projectData)
      .select()
      .single();

    if (error) {
      console.error('Error creating project:', error);
      throw new Error('Failed to create project');
    }

    const defaultContent = DEFAULT_LATEX_CONTENT(title);

    const { data: documentData, error: documentError } = await supabase
      .from('documents')
      .insert({
        title: title,
        content: defaultContent,
        owner_id: user.id,
        project_id: data.id,
        filename: 'main.tex',
        document_type: 'article',
      })
      .select()
      .single();

    if (documentError) {
      console.error('Error creating document:', documentError);
      throw new Error('Failed to create document');
    }

    // Create a file record for the main.tex file
    const { error: fileError } = await supabase.from('files').insert({
      project_id: data.id,
      name: 'main.tex',
      type: 'text/plain',
      size: defaultContent.length,
    });

    if (fileError) {
      console.error('Error creating file record:', fileError);
      // Don't throw here as the document was created successfully
    }

    revalidatePath('/');

    return {
      projectId: data.id,
      message: null,
      success: true,
    };
  } catch (error) {
    console.error('Error creating project:', error);
    return {
      projectId: null,
      message:
        error instanceof Error ? error.message : 'Failed to create project',
    };
  }
}
