/* eslint-disable @typescript-eslint/no-explicit-any */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { TablesInsert } from '@/database.types';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const draftId = url.searchParams.get('draft');
  if (!draftId) {
    return NextResponse.redirect(new URL('/', url.origin));
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL('/auth/login', url.origin);
    loginUrl.searchParams.set('next', `/import?draft=${encodeURIComponent(draftId)}`);
    return NextResponse.redirect(loginUrl);
  }

  // Fetch draft
  const { data: draft, error: draftError } = await (supabase
    .from('drafts' as any)
    .select('*')
    .eq('id', draftId)
    .single() as any);

  if (draftError || !draft) {
    return NextResponse.redirect(new URL('/', url.origin));
  }

  const title: string = (draft.title as string) || 'Imported from Tools';
  const content: string = draft.content as string;

  // Create project
  const projectData: TablesInsert<'projects'> = {
    title: title.slice(0, 120),
    user_id: user.id,
  };

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .insert(projectData)
    .select()
    .single();

  if (projectError || !project) {
    return NextResponse.redirect(new URL('/', url.origin));
  }

  const { error: docError } = await supabase
    .from('documents')
    .insert({
      title: title.slice(0, 120),
      content,
      owner_id: user.id,
      project_id: project.id,
      filename: 'main.tex',
      document_type: 'article',
    });

  if (docError) {
    return NextResponse.redirect(new URL('/', url.origin));
  }

  // Insert file record and capture ID for redirect to editor
  const { data: file, error: fileError } = await supabase
    .from('files')
    .insert({
      project_id: project.id,
      name: 'main.tex',
      type: 'text/plain',
      size: content.length,
    })
    .select('id')
    .single();

  if (fileError || !file) {
    return NextResponse.redirect(new URL(`/projects/${project.id}`, url.origin));
  }

  // Delete draft (best effort)
  await (supabase.from('drafts' as any).delete().eq('id', draftId) as any);

  return NextResponse.redirect(new URL(`/projects/${project.id}`, url.origin));
} 