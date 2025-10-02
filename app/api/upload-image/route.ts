import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get the current user session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse the form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const projectId = formData.get('projectId') as string;
    const fileName = formData.get('fileName') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!projectId) {
      return NextResponse.json(
        { error: 'No project ID provided' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Only PNG and JPEG files are allowed' },
        { status: 400 }
      );
    }

    // Validate file size (5MB limit)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size must be less than 5MB' },
        { status: 400 }
      );
    }

    // Verify project ownership
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', session.user.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 404 }
      );
    }

    // Convert image to base64 for database storage (similar to how text files are handled)
    const arrayBuffer = await file.arrayBuffer();
    const base64String = Buffer.from(arrayBuffer).toString('base64');
    const dataUrl = `data:${file.type};base64,${base64String}`;

    // Use the custom fileName if provided, otherwise use the original file name
    const finalFileName = fileName && fileName.trim() ? fileName.trim() : file.name;

    // Create file record in database
    const { data: fileData, error: fileError } = await supabase
      .from('files')
      .insert({
        project_id: projectId,
        name: finalFileName,
        type: file.type,
        size: file.size,
        uploaded_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (fileError) {
      console.error('Database insert error:', fileError);
      return NextResponse.json(
        { error: 'Failed to create file record' },
        { status: 500 }
      );
    }

    // Create document record for the image (store base64 data like other files)
    const { error: documentError } = await supabase
      .from('documents')
      .insert({
        title: finalFileName,
        content: dataUrl, // Store the base64 data URL as content
        owner_id: session.user.id,
        project_id: projectId,
        filename: finalFileName,
        document_type: 'image',
      });

    if (documentError) {
      console.warn('Failed to create document record:', documentError);
    }

    return NextResponse.json({
      success: true,
      file: {
        id: fileData.id,
        name: finalFileName,
        type: fileData.type,
        size: fileData.size,
        url: dataUrl,
      }
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
