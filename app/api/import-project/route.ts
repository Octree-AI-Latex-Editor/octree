import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { TablesInsert } from '@/database.types';
import JSZip from 'jszip';
import {
  getContentTypeByFilename,
  SUPPORTED_TEXT_FILE_EXTENSIONS,
} from '@/lib/constants/file-types';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB limit
const MAX_FILES = 100; // Maximum files per project

interface ExtractedFile {
  name: string; // Full relative path including folders (e.g., "figures/image.png")
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
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
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
      if (zipEntry.dir) continue;

      // Skip hidden files and common non-essential directories
      if (
        relativePath.startsWith('__MACOSX/') ||
        relativePath.includes('/.') ||
        relativePath.startsWith('.') ||
        relativePath.includes('/._') // macOS resource forks
      ) {
        continue;
      }

      // Use the full relative path as-is to preserve folder structure
      const fileName = relativePath.split('/').pop() || relativePath;
      const isTexFile = fileName.endsWith('.tex');

      const isTextFile = SUPPORTED_TEXT_FILE_EXTENSIONS.some((ext) =>
        fileName.toLowerCase().endsWith(ext)
      );

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
          name: relativePath, // Use full relative path to preserve folder structure
          content,
          isText,
          size: isText
            ? (content as string).length
            : (content as ArrayBuffer).byteLength,
        };

        extractedFiles.push(extractedFile);

        if (isTexFile) {
          texFiles.push(extractedFile);
        }
      } catch (error) {
        console.error(`Failed to extract file ${relativePath}:`, error);
      }
    }

    // Check if we have at least one .tex file
    if (texFiles.length === 0) {
      return NextResponse.json(
        { error: 'No LaTeX (.tex) files found in ZIP' },
        { status: 400 }
      );
    }

    // Determine project title from filename
    const projectTitle =
      file.name.replace('.zip', '').slice(0, 120) || 'Imported Project';

    // Create project
    const projectData: TablesInsert<'projects'> = {
      title: projectTitle,
      user_id: user.id,
    };

    const { data: project, error: projectError } =
      await // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from('projects') as any).insert(projectData).select().single();

    if (projectError || !project) {
      console.error('Error creating project:', projectError);
      return NextResponse.json(
        { error: 'Failed to create project' },
        { status: 500 }
      );
    }

    // Upload all files to Supabase Storage
    const uploadPromises = extractedFiles.map(async (file) => {
      try {
        const mimeType = getContentTypeByFilename(file.name);
        let blob: Blob;

        if (file.isText) {
          blob = new Blob([file.content as string], { type: mimeType });
        } else {
          blob = new Blob([file.content as ArrayBuffer], { type: mimeType });
        }

        const { error: uploadError } = await supabase.storage
          .from('octree')
          .upload(`projects/${project.id}/${file.name}`, blob, {
            cacheControl: '3600',
            upsert: false,
            contentType: mimeType,
          });

        if (uploadError) {
          console.error(`Failed to upload file ${file.name}:`, uploadError);
          return { success: false, error: uploadError, fileName: file.name };
        }

        return { success: true, fileName: file.name };
      } catch (error) {
        console.error(`Error uploading file ${file.name}:`, error);
        return { success: false, error, fileName: file.name };
      }
    });

    const uploadResults = await Promise.all(uploadPromises);
    const uploadErrors = uploadResults.filter((r) => !r.success);

    if (uploadErrors.length > 0) {
      console.error('Some files failed to upload:', uploadErrors);
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
