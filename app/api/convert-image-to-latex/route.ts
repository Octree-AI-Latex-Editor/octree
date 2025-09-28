import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import fs from 'fs';
import path from 'path';

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

    // Convert image to base64 for processing
    const arrayBuffer = await file.arrayBuffer();
    const base64String = Buffer.from(arrayBuffer).toString('base64');
    const dataUrl = `data:${file.type};base64,${base64String}`;

    // Save image file to public directory for LaTeX compilation
    const publicDir = path.join(process.cwd(), 'public', 'images', projectId);
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
    
    const imagePath = path.join(publicDir, file.name);
    fs.writeFileSync(imagePath, Buffer.from(arrayBuffer));

    // For now, we'll use a simple placeholder LaTeX generation
    // In a real implementation, you would integrate with an OCR service like:
    // - Google Vision API
    // - Azure Computer Vision
    // - AWS Textract
    // - Or a custom AI model trained for mathematical expressions
    
    // Generate proper LaTeX code that references the actual image file
    const baseFileName = file.name.replace(/\.[^/.]+$/, ""); // Remove extension but keep original name
    const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';
    
    // Escape special LaTeX characters in the filename for the caption
    const escapedCaption = baseFileName
      .replace(/\\/g, '\\textbackslash{}')
      .replace(/\{/g, '\\{')
      .replace(/\}/g, '\\}')
      .replace(/\$/g, '\\$')
      .replace(/&/g, '\\&')
      .replace(/%/g, '\\%')
      .replace(/#/g, '\\#')
      .replace(/\^/g, '\\textasciicircum{}')
      .replace(/_/g, '\\_')
      .replace(/~/g, '\\textasciitilde{}');
    
    // Create a safe label (alphanumeric only)
    const safeLabel = baseFileName.toLowerCase().replace(/[^a-zA-Z0-9]/g, '');
    
    const latexCode = `\\begin{figure}[H]
  \\centering
  \\includegraphics[width=0.7\\linewidth]{${file.name}}
  \\caption{${escapedCaption}}
  \\label{fig:${safeLabel}}
\\end{figure}`;

    // Save the original image to the project folder
    const { data: fileData, error: fileError } = await supabase
      .from('files')
      .insert({
        project_id: projectId,
        name: file.name,
        type: file.type,
        size: file.size,
        uploaded_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (fileError) {
      console.error('Failed to save image file:', fileError);
      // Continue with LaTeX conversion even if file saving fails
    }

    // Create document record for the image (store base64 data like other files)
    const { error: documentError } = await supabase
      .from('documents')
      .insert({
        title: file.name,
        content: dataUrl, // Store the base64 data URL as content
        owner_id: session.user.id,
        project_id: projectId,
        filename: file.name,
        document_type: 'image',
      });

    if (documentError) {
      console.warn('Failed to create document record:', documentError);
    }

    return NextResponse.json({
      success: true,
      latexCode,
      imageUrl: dataUrl,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      fileId: fileData?.id || null
    });

  } catch (error) {
    console.error('Image conversion error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

