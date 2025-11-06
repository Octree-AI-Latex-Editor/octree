import { createClient } from '@/lib/supabase/client';
import type { ProjectFile } from '@/hooks/use-file-editor';
import type { Tables, TablesInsert } from '@/database.types';

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

export const createDocumentForFile = async (
  projectId: string,
  fileName: string,
  content?: string
): Promise<Tables<'documents'>> => {
  const supabase = createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    throw new Error('User not authenticated');
  }

  const documentContent = content || DEFAULT_LATEX_CONTENT(fileName);

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

const DEFAULT_LATEX_CONTENT = (fileName: string) => {
  const cleanTitle = fileName.replace(/\.\w+$/, '');
  return `% ${fileName}
% Created on ${new Date().toISOString()}

\\documentclass{article}
\\usepackage[utf8]{inputenc}
\\usepackage{amsmath}
\\usepackage{amsfonts}
\\usepackage{amssymb}
\\usepackage{graphicx}
\\usepackage{geometry}
\\geometry{margin=1in}

\\title{${cleanTitle}}
\\author{}
\\date{\\today}

\\begin{document}

\\maketitle

\\section{Introduction}

Your content here.

\\end{document}`;
};
