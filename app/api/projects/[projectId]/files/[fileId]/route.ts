import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getContentTypeByFilename } from '@/lib/constants/file-types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; fileId: string }> }
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId, fileId } = await params;

    const { data: storageFiles, error: listError } = await supabase.storage
      .from('octree')
      .list(`projects/${projectId}`);

    if (listError || !storageFiles) {
      return NextResponse.json(
        { error: 'Failed to list files' },
        { status: 500 }
      );
    }

    const file = storageFiles.find((f) => f.id === fileId);

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from('octree')
      .download(`projects/${projectId}/${file.name}`);

    if (downloadError || !fileBlob) {
      return NextResponse.json(
        { error: 'Failed to download file' },
        { status: 500 }
      );
    }

    const content = await fileBlob.text();

    return NextResponse.json({
      file: {
        id: file.id,
        name: file.name,
        project_id: projectId,
        size: file.metadata?.size || null,
        type: file.metadata?.mimetype || null,
        uploaded_at: file.created_at,
      },
      document: {
        id: file.id,
        title: file.name,
        content: content,
        owner_id: user.id,
        project_id: projectId,
        filename: file.name,
        document_type: file.name === 'main.tex' ? 'article' : 'file',
        created_at: file.created_at,
        updated_at: file.updated_at || file.created_at,
      },
    });
  } catch (error) {
    console.error('Error fetching file:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; fileId: string }> }
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId, fileId } = await params;
    const { content } = await request.json();

    if (content === undefined || content === null) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }

    const { data: storageFiles, error: listError } = await supabase.storage
      .from('octree')
      .list(`projects/${projectId}`);

    if (listError || !storageFiles) {
      return NextResponse.json(
        { error: 'Failed to list files' },
        { status: 500 }
      );
    }

    const file = storageFiles.find((f) => f.id === fileId);

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const contentType = getContentTypeByFilename(file.name);
    const blob = new Blob([content], { type: contentType });

    const { error: uploadError } = await supabase.storage
      .from('octree')
      .upload(`projects/${projectId}/${file.name}`, blob, {
        cacheControl: '3600',
        upsert: true,
        contentType,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json(
        { error: 'Failed to save file' },
        { status: 500 }
      );
    }

    revalidatePath(`/projects/${projectId}`);

    return NextResponse.json({
      file: {
        id: file.id,
        name: file.name,
        project_id: projectId,
        size: file.metadata?.size || null,
        type: file.metadata?.mimetype || null,
        uploaded_at: file.created_at,
      },
      document: {
        id: file.id,
        title: file.name,
        content: content,
        owner_id: user.id,
        project_id: projectId,
        filename: file.name,
        document_type: file.name === 'main.tex' ? 'article' : 'file',
        created_at: file.created_at,
        updated_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error saving file:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
