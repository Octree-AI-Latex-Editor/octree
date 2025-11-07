import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { TablesInsert } from '@/database.types';
import JSZip from 'jszip';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB limit
const MAX_FILES = 100; // Maximum files per project

interface ExtractedFile {
  name: string;
  content: string | ArrayBuffer;
  isText: boolean;
  size: number;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Check file type
    if (!file.name.endsWith('.zip')) {
      return NextResponse.json(
        { error: 'Only ZIP files are supported' },
        { status: 400 }
      );
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds 50MB limit' },
        { status: 400 }
      );
    }

    // Read and extract ZIP
    const arrayBuffer = await file.arrayBuffer();
    const zip = new JSZip();
    const zipContent = await zip.loadAsync(arrayBuffer);

    // Extract all files
    const extractedFiles: ExtractedFile[] = [];
    const texFiles: ExtractedFile[] = [];

    const fileEntries = Object.entries(zipContent.files);
    
    if (fileEntries.length > MAX_FILES) {
      return NextResponse.json(
        { error: `Too many files. Maximum ${MAX_FILES} files allowed.` },
        { status: 400 }
      );
    }

    for (const [relativePath, zipEntry] of fileEntries) {
      if (zipEntry.dir) continue; // Skip directories

      // Skip hidden files and common non-essential directories
      if (
        relativePath.startsWith('__MACOSX/') ||
        relativePath.includes('/.') ||
        relativePath.startsWith('.')
      ) {
        continue;
      }

      const fileName = relativePath.split('/').pop() || relativePath;
      const isTexFile = fileName.endsWith('.tex');
      
      // Determine if file is text-based (includes BibTeX files .bib and .bst)
      const textExtensions = ['.tex', '.sty', '.bib', '.bst', '.cls', '.txt', '.md', '.csv', '.json', '.xml', '.log'];
      const isTextFile = textExtensions.some(ext => fileName.toLowerCase().endsWith(ext));
      
      try {
        let content: string | ArrayBuffer;
        let isText = false;

        if (isTextFile) {
          content = await zipEntry.async('text');
          isText = true;
        } else {
          content = await zipEntry.async('arraybuffer');
          isText = false;
        }

        const extractedFile: ExtractedFile = {
          name: fileName,
          content,
          isText,
          size: isText ? (content as string).length : (content as ArrayBuffer).byteLength,
        };

        extractedFiles.push(extractedFile);

        if (isTexFile) {
          texFiles.push(extractedFile);
        }
      } catch (error) {
        console.error(`Failed to extract file ${relativePath}:`, error);
        // Continue with other files
      }
    }

    // Check if we have at least one .tex file
    if (texFiles.length === 0) {
      return NextResponse.json(
        { error: 'No LaTeX (.tex) files found in ZIP' },
        { status: 400 }
      );
    }

    // Find main.tex or use the first .tex file
    const mainTexFile =
      texFiles.find((f) => f.name === 'main.tex') || texFiles[0];

    // Determine project title from filename
    const projectTitle =
      file.name.replace('.zip', '').slice(0, 120) || 'Imported Project';

    // Create project
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
      return NextResponse.json(
        { error: 'Failed to create project' },
        { status: 500 }
      );
    }

    // Create document records for ALL files (text files as plain text, binary as base64)
    const documentPromises = extractedFiles.map(async (file) => {
      // Convert binary files to base64
      let content: string;
      if (file.isText) {
        content = file.content as string;
      } else {
        // Convert ArrayBuffer to base64
        const buffer = file.content as ArrayBuffer;
        const bytes = new Uint8Array(buffer);
        content = Buffer.from(bytes).toString('base64');
      }

      const docData: TablesInsert<'documents'> = {
        title: projectTitle,
        content: content,
        owner_id: user.id,
        project_id: project.id,
        filename: file.name,
        document_type: file.name.endsWith('.tex') ? 'article' : 'asset',
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (supabase.from('documents') as any).insert(docData);
    });

    const documentResults = await Promise.all(documentPromises);
    const documentErrors = documentResults.filter((r) => r.error);

    if (documentErrors.length > 0) {
      console.error('Some documents failed to create:', documentErrors);
    }

    // Create file records for all extracted files
    const filePromises = extractedFiles.map(async (extractedFile) => {
      const fileData: TablesInsert<'files'> = {
        project_id: project.id,
        name: extractedFile.name,
        type: extractedFile.isText ? 'text/plain' : 'application/octet-stream',
        size: extractedFile.size,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (supabase.from('files') as any).insert(fileData);
    });

    const fileResults = await Promise.all(filePromises);
    const fileErrors = fileResults.filter((r) => r.error);

    if (fileErrors.length > 0) {
      console.error('Some files failed to create:', fileErrors);
    }

    return NextResponse.json({
      success: true,
      projectId: project.id,
      totalFiles: extractedFiles.length,
      texFiles: texFiles.length,
      otherFiles: extractedFiles.length - texFiles.length,
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: 'Failed to import project. Please check your ZIP file.' },
      { status: 500 }
    );
  }
}

