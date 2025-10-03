import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import type { Tables, TablesInsert, TablesUpdate } from '@/database.types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; fileId: string }> }
) {
  try {
    const supabase = await createClient();
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId, fileId } = await params;

    // First, check if the file exists in the files table
    const { data: fileData, error: fileError } = await supabase
      .from('files' as const)
      .select('*')
      .eq('id', fileId)
      .eq('project_id', projectId)
      .single<Tables<'files'>>();

    if (fileError || !fileData) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Check if there's a corresponding document in the documents table
    const { data: documentData, error: documentError } = await supabase
      .from('documents' as const)
      .select('*')
      .eq('project_id', projectId)
      .eq('filename', fileData.name)
      .eq('owner_id', user.id)
      .single<Tables<'documents'>>();

    if (documentError) {
      // If no document exists, create one with default content
      const insertDoc: TablesInsert<'documents'> = {
        title: fileData.name,
        content: `% ${fileData.name}\n% Created on ${new Date().toISOString()}\n\n\\documentclass{article}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amsmath}\n\\usepackage{amsfonts}\n\\usepackage{amssymb}\n\\usepackage{graphicx}\n\\usepackage{geometry}\n\\geometry{margin=1in}\n\n\\title{${fileData.name.replace(/\\.\\w+$/, '')}}\n\\author{}\n\\date{\\today}\n\n\\begin{document}\n\n\\maketitle\n\n\\section{Introduction}\n\nYour content here.\n\n\\end{document}`,
        owner_id: user.id,
        project_id: projectId,
        filename: fileData.name,
        document_type: 'article',
      };

      const { data: newDocument, error: createError } = await (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        supabase.from('documents') as any
      )
        .insert(insertDoc)
        .select('*')
        .single();

      if (createError) {
        return NextResponse.json({ error: 'Failed to create document' }, { status: 500 });
      }

      return NextResponse.json({
        file: fileData,
        document: newDocument,
      });
    }

    return NextResponse.json({
      file: fileData,
      document: documentData,
    });

  } catch (error) {
    console.error('Error fetching file:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; fileId: string }> }
) {
  try {
    const supabase = await createClient();
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId, fileId } = await params;
    const { content } = await request.json();

    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    // First, check if the file exists in the files table
    const { data: fileData, error: fileError } = await supabase
      .from('files' as const)
      .select('*')
      .eq('id', fileId)
      .eq('project_id', projectId)
      .single<Tables<'files'>>();

    if (fileError || !fileData) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Check if there's a corresponding document in the documents table
    const { data: documentData, error: documentError } = await supabase
      .from('documents' as const)
      .select('*')
      .eq('project_id', projectId)
      .eq('filename', fileData.name)
      .eq('owner_id', user.id)
      .single<Tables<'documents'>>();

    if (documentError) {
      // If no document exists, create one
      const insertDoc: TablesInsert<'documents'> = {
        title: fileData.name,
        content: content,
        owner_id: user.id,
        project_id: projectId,
        filename: fileData.name,
        document_type: 'article',
      };

      const { data: newDocument, error: createError } = await (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        supabase.from('documents') as any
      )
        .insert(insertDoc)
        .select('*')
        .single();

      if (createError) {
        return NextResponse.json({ error: 'Failed to create document' }, { status: 500 });
      }

      return NextResponse.json({
        file: fileData,
        document: newDocument,
      });
    }

    // Update the existing document
    const updateDoc: TablesUpdate<'documents'> = {
      content: content,
      updated_at: new Date().toISOString(),
    };

    const { data: updatedDocument, error: updateError } = await (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase.from('documents') as any
    )
      .update(updateDoc)
      .eq('id', documentData.id)
      .select('*')
      .single();

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update document' }, { status: 500 });
    }

    // Save version to document_versions table
    const versionInsert: TablesInsert<'document_versions'> = {
      document_id: documentData.id,
      content: content,
      change_summary: 'Auto-saved version',
      created_by: user.id,
    };

    const { error: versionError } = await (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase.from('document_versions') as any
    ).insert(versionInsert);

    if (versionError) {
      console.warn('Failed to save version:', versionError);
      // Don't throw here as the main document was saved successfully
    }

    return NextResponse.json({
      file: fileData,
      document: updatedDocument,
    });

  } catch (error) {
    console.error('Error saving file:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 