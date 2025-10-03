import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { TablesInsert } from '@/database.types';

const allowedOrigin = process.env.ALLOWED_TOOLS_ORIGIN || 'https://tools.useoctree.com';

function withCors(response: NextResponse) {
  response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  return response;
}

export async function OPTIONS() {
  const res = NextResponse.json({}, { status: 204 });
  return withCors(res);
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return withCors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
    }

    let content: string | null = null;
    let title: string | null = null;
    let source: string | null = null;

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await request.json();
      content = body.content || null;
      title = body.title || null;
      source = body.source || null;
    } else {
      const form = await request.formData();
      content = (form.get('content') as string) || null;
      title = (form.get('title') as string) || null;
      source = (form.get('source') as string) || null;
    }

    if (!content || typeof content !== 'string') {
      return withCors(NextResponse.json({ error: 'Missing LaTeX content' }, { status: 400 }));
    }

    const projectTitle = (title && typeof title === 'string' ? title : 'Imported from Tools').slice(0, 120);

    const projectData: TablesInsert<'projects'> = {
      title: projectTitle,
      user_id: user.id,
    };

    const { data: project, error: projectError } = await (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase.from('projects') as any
    )
      .insert(projectData)
      .select()
      .single();

    if (projectError || !project) {
      console.error('Error creating project:', projectError);
      return withCors(NextResponse.json({ error: 'Failed to create project' }, { status: 500 }));
    }

    const docData: TablesInsert<'documents'> = {
      title: projectTitle,
      content,
      owner_id: user.id,
      project_id: project.id,
      filename: 'main.tex',
      document_type: 'article',
    };

    const { data: document, error: documentError } = await (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase.from('documents') as any
    )
      .insert(docData)
      .select()
      .single();

    if (documentError || !document) {
      console.error('Error creating document:', documentError);
      return withCors(NextResponse.json({ error: 'Failed to create document' }, { status: 500 }));
    }

    const fileData: TablesInsert<'files'> = {
      project_id: project.id,
      name: 'main.tex',
      type: 'text/plain',
      size: content.length,
    };

    await (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase.from('files') as any
    ).insert(fileData);

    return withCors(NextResponse.json({ success: true, projectId: project.id, projectUrl: `/projects/${project.id}`, source: source || null }));
  } catch (err) {
    console.error('Import error:', err);
    return withCors(NextResponse.json({ error: 'Internal Server Error' }, { status: 500 }));
  }
} 