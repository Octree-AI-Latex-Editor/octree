import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const execAsync = promisify(exec);

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const { content } = await request.json();
    
    // Validate LaTeX content structure
    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        {
          error: 'Invalid content',
          details: 'Content must be a non-empty string',
          suggestion: 'Please provide valid LaTeX content'
        },
        { status: 400 }
      );
    }

    // Check if content has proper LaTeX structure
    const hasDocumentClass = content.includes('\\documentclass');
    const hasBeginDocument = content.includes('\\begin{document}');
    const hasEndDocument = content.includes('\\end{document}');

    if (!hasDocumentClass) {
      return NextResponse.json(
        {
          error: 'Invalid LaTeX structure',
          details: 'LaTeX document must start with \\documentclass declaration',
          suggestion: 'Add \\documentclass{article} at the beginning of your document'
        },
        { status: 400 }
      );
    }

    if (!hasBeginDocument || !hasEndDocument) {
      return NextResponse.json(
        {
          error: 'Invalid LaTeX structure',
          details: 'LaTeX document must have \\begin{document} and \\end{document}',
          suggestion: 'Wrap your content between \\begin{document} and \\end{document}'
        },
        { status: 400 }
      );
    }

    const isProd = process.env.ENVIRONMENT === 'prod';

    if (isProd) {
      // Use the remote TeX Live service in production
      try {
        console.log('Attempting remote LaTeX compilation...');
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
        
        const response = await fetch('http://142.93.195.236:3001/compile', {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain',
          },
          body: content,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Remote server error response:', errorText);
          
          // Try to parse error response as JSON
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { error: errorText };
          }
          
          return NextResponse.json(
            {
              error: errorData.error || 'LaTeX compilation failed',
              details: errorData.details || errorData.message || `Server returned status ${response.status}`,
              log: errorData.log,
              stdout: errorData.stdout,
              stderr: errorData.stderr,
              code: errorData.code,
              suggestion: 'Check your LaTeX syntax and try again'
            },
            { status: response.status }
          );
        }

        const pdfArrayBuffer = await response.arrayBuffer();

        // Check if we got a valid PDF
        if (pdfArrayBuffer.byteLength === 0) {
          throw new Error('Remote server returned empty response');
        }

        // Check the first few bytes to verify it's a PDF
        const firstBytes = Buffer.from(pdfArrayBuffer.slice(0, 4)).toString('hex');
        if (firstBytes !== '25504446') { // PDF magic number
          throw new Error(`Invalid PDF format. First bytes: ${firstBytes}`);
        }

        // Convert to Base64
        const pdfBuffer = Buffer.from(pdfArrayBuffer);
        const base64PDF = pdfBuffer.toString('base64');

        console.log('Remote compilation successful:', {
          size: pdfBuffer.length,
          firstBytes: firstBytes
        });

        // Return with verbose info
        return NextResponse.json({
          pdf: base64PDF,
          size: pdfBuffer.length,
          mimeType: 'application/pdf',
          debugInfo: {
            firstBytesHex: firstBytes,
            contentLength: pdfArrayBuffer.byteLength,
            base64Length: base64PDF.length,
          },
        });
      } catch (error) {
        console.error('Remote compilation error:', error);
        
        if (error instanceof Error && error.name === 'AbortError') {
          return NextResponse.json(
            {
              error: 'LaTeX compilation timed out on remote server',
              details: 'Request took longer than 60 seconds',
              suggestion: 'Try again or contact support if the issue persists'
            },
            { status: 504 }
          );
        }
        
        return NextResponse.json(
          {
            error: 'LaTeX compilation failed on remote server',
            details: String(error),
            suggestion: 'The remote compilation service may be temporarily unavailable'
          },
          { status: 500 }
        );
      }
    }

    // Fallback: Use local compilation if remote fails or in development
    console.log('Using local LaTeX compilation...');
    
    // Create a unique ID for this compilation
    const compilationId = uuidv4();

    // Create temp directory at project root to work with Docker
    const tempDir = path.join(process.cwd(), 'tmp', compilationId);
    fs.mkdirSync(tempDir, { recursive: true });

    // Copy all images from all project directories to temp directory root
    const imagesDir = path.join(process.cwd(), 'public', 'images');
    if (fs.existsSync(imagesDir)) {
      // Read all subdirectories (project directories)
      const projectDirs = fs.readdirSync(imagesDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);
      
      // Copy all images from all project directories to temp directory root
      for (const projectDir of projectDirs) {
        const projectImagesDir = path.join(imagesDir, projectDir);
        const images = fs.readdirSync(projectImagesDir);
        
        for (const image of images) {
          const sourcePath = path.join(projectImagesDir, image);
          const destPath = path.join(tempDir, image);
          fs.copyFileSync(sourcePath, destPath);
        }
      }
    }

    // Write the LaTeX content to a file
    const texFilePath = path.join(tempDir, 'main.tex');
    fs.writeFileSync(texFilePath, content);

    try {
      // Run pdflatex in Docker - continue even with LaTeX errors
      const { stdout, stderr } = await execAsync(
        `docker run --rm -v ${tempDir}:/data texlive/texlive pdflatex -interaction=nonstopmode -output-directory=/data /data/main.tex`
      );

      if (stderr) console.error('Docker stderr:', stderr);

      // Check if PDF was created regardless of errors
      const pdfPath = path.join(tempDir, 'main.pdf');

      if (fs.existsSync(pdfPath)) {
        // Read the PDF file
        const pdfBuffer = fs.readFileSync(pdfPath);

        // Convert to Base64
        const base64PDF = pdfBuffer.toString('base64');

        // Clean up temp directory
        fs.rmSync(tempDir, { recursive: true, force: true });

        console.log('Local compilation successful:', {
          size: pdfBuffer.length,
          compilationId
        });

        return NextResponse.json({
          pdf: base64PDF,
          size: pdfBuffer.length,
          mimeType: 'application/pdf',
          debugInfo: {
            compilationId,
            method: 'local-docker',
            stdout: stdout.substring(0, 200),
            stderr: stderr ? stderr.substring(0, 200) : null
          },
        });
      } else {
        // PDF not created, check for log file
        const logPath = path.join(tempDir, 'main.log');
        let logContent = '';
        
        if (fs.existsSync(logPath)) {
          logContent = fs.readFileSync(logPath, 'utf-8');
        }

        // Clean up temp directory
        fs.rmSync(tempDir, { recursive: true, force: true });

        return NextResponse.json(
          {
            error: 'PDF not generated',
            details: 'LaTeX compilation completed but no PDF was created',
            log: logContent.substring(0, 2000), // Limit log size
            stdout: stdout.substring(0, 1000),
            stderr: stderr ? stderr.substring(0, 1000) : null,
            suggestion: 'Check your LaTeX syntax and ensure all required packages are included'
          },
          { status: 500 }
        );
      }
    } catch (dockerError) {
      // Clean up temp directory
      fs.rmSync(tempDir, { recursive: true, force: true });

      console.error('Docker compilation error:', dockerError);
      
      // Try to get log content for debugging
      const logPath = path.join(tempDir, 'main.log');
      let logContent = '';
      if (fs.existsSync(logPath)) {
        logContent = fs.readFileSync(logPath, 'utf-8');
      }

      return NextResponse.json(
        {
          error: 'Docker compilation failed',
          details: String(dockerError),
          log: logContent.substring(0, 2000),
          suggestion: 'Check your LaTeX syntax and try again'
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('LaTeX compilation error:', error);
    return NextResponse.json(
      {
        error: 'LaTeX compilation failed',
        details: String(error),
        suggestion: 'Check your LaTeX syntax and try again'
      },
      { status: 500 }
    );
  }
}
