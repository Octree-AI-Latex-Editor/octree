import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const execAsync = promisify(exec);

export const runtime = 'nodejs';

interface FileEntry {
  path: string;
  content: string;
  encoding?: string; // "base64" for binary files
}

interface CompileRequest {
  content?: string; // Single file (backward compatibility)
  files?: FileEntry[]; // Multi-file support
}

export async function POST(request: Request) {
  try {
    const body: CompileRequest = await request.json();
    const { content, files } = body;
    
    // Validate: must have either content or files
    if (!content && (!files || files.length === 0)) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: 'Must provide either content or files array',
          suggestion: 'Please provide valid LaTeX content or files'
        },
        { status: 400 }
      );
    }

    // For backward compatibility, if content is provided, validate it
    if (content && typeof content !== 'string') {
      return NextResponse.json(
        {
          error: 'Invalid content',
          details: 'Content must be a non-empty string',
          suggestion: 'Please provide valid LaTeX content'
        },
        { status: 400 }
      );
    }

    // Validate LaTeX structure (check main.tex or single content file)
    let mainContent = '';
    if (files && files.length > 0) {
      // Find main.tex in multi-file project
      const mainFile = files.find(f => f.path === 'main.tex') || files.find(f => f.path.endsWith('.tex'));
      mainContent = mainFile?.content || '';
    } else if (content) {
      mainContent = content;
    }

    if (mainContent) {
      const hasDocumentClass = mainContent.includes('\\documentclass');
      const hasBeginDocument = mainContent.includes('\\begin{document}');
      const hasEndDocument = mainContent.includes('\\end{document}');

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
    }

    const isProd = process.env.ENVIRONMENT === 'prod';
    const compileServiceUrl = process.env.COMPILE_SERVICE_URL || 'http://localhost:3001';

    // Prepare request body for octree-compile
    let requestBody: string;
    let requestHeaders: Record<string, string>;

    if (files && files.length > 0) {
      // Multi-file mode: send JSON with files array
      requestBody = JSON.stringify({ files });
      requestHeaders = { 'Content-Type': 'application/json' };
      console.log(`Multi-file compilation: ${files.length} files`, files.map(f => f.path));
    } else {
      // Single-file mode: send plain text (backward compatibility)
      requestBody = content!;
      requestHeaders = { 'Content-Type': 'text/plain' };
      console.log('Single-file compilation');
    }

    if (isProd) {
      // Use the octree-compile service in production
      try {
        console.log('Attempting LaTeX compilation via octree-compile...');
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
        
        const response = await fetch(`${compileServiceUrl}/compile`, {
          method: 'POST',
          headers: requestHeaders,
          body: requestBody,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('octree-compile error response:', errorText);
          
          // Parse octree-compile error response (always JSON on error)
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { error: errorText };
          }
          const requestId = response.headers.get('x-compile-request-id') || errorData.requestId || null;
          const durationMs = response.headers.get('x-compile-duration-ms');
          const queueMs = response.headers.get('x-compile-queue-ms');
          
          return NextResponse.json(
            {
              error: errorData.error || 'LaTeX compilation failed',
              details: errorData.message || errorData.details || `Server returned status ${response.status}`,
              log: errorData.log,
              stdout: errorData.stdout,
              stderr: errorData.stderr,
              requestId,
              queueMs: queueMs ? Number(queueMs) : errorData.queueMs,
              durationMs: durationMs ? Number(durationMs) : errorData.durationMs,
              suggestion: 'Check your LaTeX syntax and try again'
            },
            { status: response.status }
          );
        }

        const requestId = response.headers.get('x-compile-request-id') || null;
        const durationMs = response.headers.get('x-compile-duration-ms');
        const queueMs = response.headers.get('x-compile-queue-ms');
        const sha256 = response.headers.get('x-compile-sha256');

        const pdfArrayBuffer = await response.arrayBuffer();

        // Check if we got a valid PDF
        if (pdfArrayBuffer.byteLength === 0) {
          throw new Error('octree-compile returned empty response');
        }

        // Verify PDF magic number (%PDF)
        const pdfBuffer = Buffer.from(pdfArrayBuffer);
        const firstBytes = pdfBuffer.toString('utf8', 0, 4);
        if (firstBytes !== '%PDF') {
          throw new Error(`Invalid PDF format. Expected %PDF, got: ${firstBytes}`);
        }

        // Convert to Base64
        const base64PDF = pdfBuffer.toString('base64');

        console.log('octree-compile successful:', {
          size: pdfBuffer.length,
          requestId,
          queueMs: queueMs ? Number(queueMs) : null,
          durationMs: durationMs ? Number(durationMs) : null,
          sha256
        });

        // Return with compilation metadata
        return NextResponse.json({
          pdf: base64PDF,
          size: pdfBuffer.length,
          mimeType: 'application/pdf',
          debugInfo: {
            contentLength: pdfArrayBuffer.byteLength,
            base64Length: base64PDF.length,
            requestId,
            durationMs: durationMs ? Number(durationMs) : null,
            queueMs: queueMs ? Number(queueMs) : null,
            sha256,
          },
        });
      } catch (error) {
        console.error('octree-compile error:', error);
        
        if (error instanceof Error && error.name === 'AbortError') {
          return NextResponse.json(
            {
              error: 'LaTeX compilation timed out',
              details: 'Request took longer than 60 seconds',
              suggestion: 'Try simplifying your LaTeX document or contact support if the issue persists'
            },
            { status: 504 }
          );
        }
        
        return NextResponse.json(
          {
            error: 'LaTeX compilation failed',
            details: String(error),
            suggestion: 'The octree-compile service may be temporarily unavailable'
          },
          { status: 500 }
        );
      }
    }

    // Development: Use octree-compile service
    console.log('Development mode: Using octree-compile service...');
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);
      
      const response = await fetch(`${compileServiceUrl}/compile`, {
        method: 'POST',
        headers: requestHeaders,
        body: requestBody,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        const requestId = response.headers.get('x-compile-request-id') || errorData.requestId || null;
        const durationMs = response.headers.get('x-compile-duration-ms');
        const queueMs = response.headers.get('x-compile-queue-ms');
        
        return NextResponse.json(
          {
            error: errorData.error || 'LaTeX compilation failed',
            details: errorData.message || errorData.details || `Server returned status ${response.status}`,
            log: errorData.log,
            stdout: errorData.stdout,
            stderr: errorData.stderr,
            requestId,
            queueMs: queueMs ? Number(queueMs) : errorData.queueMs,
            durationMs: durationMs ? Number(durationMs) : errorData.durationMs,
            suggestion: 'Check your LaTeX syntax and try again'
          },
          { status: response.status }
        );
      }

      const pdfArrayBuffer = await response.arrayBuffer();

      if (pdfArrayBuffer.byteLength === 0) {
        throw new Error('octree-compile returned empty response');
      }

      // Verify PDF magic number
      const pdfBuffer = Buffer.from(pdfArrayBuffer);
      const firstBytes = pdfBuffer.toString('utf8', 0, 4);
      if (firstBytes !== '%PDF') {
        throw new Error(`Invalid PDF format. Expected %PDF, got: ${firstBytes}`);
      }

      const base64PDF = pdfBuffer.toString('base64');

      const requestId = response.headers.get('x-compile-request-id') || null;
      const durationMs = response.headers.get('x-compile-duration-ms');
      const queueMs = response.headers.get('x-compile-queue-ms');
      const sha256 = response.headers.get('x-compile-sha256');

      console.log('octree-compile successful (dev):', {
        size: pdfBuffer.length,
        requestId,
        queueMs: queueMs ? Number(queueMs) : null,
        durationMs: durationMs ? Number(durationMs) : null
      });

      return NextResponse.json({
        pdf: base64PDF,
        size: pdfBuffer.length,
        mimeType: 'application/pdf',
        debugInfo: {
          contentLength: pdfArrayBuffer.byteLength,
          requestId,
          durationMs: durationMs ? Number(durationMs) : null,
          queueMs: queueMs ? Number(queueMs) : null,
          sha256,
        },
      });
    } catch (compileError) {
      console.error('octree-compile failed:', compileError);
      
      if (compileError instanceof Error && compileError.name === 'AbortError') {
        return NextResponse.json(
          {
            error: 'LaTeX compilation timed out',
            details: 'Request took longer than 60 seconds',
            suggestion: 'Try simplifying your LaTeX document'
          },
          { status: 504 }
        );
      }
      
      return NextResponse.json(
        {
          error: 'LaTeX compilation failed',
          details: String(compileError),
          suggestion: 'The octree-compile service may be temporarily unavailable. Please try again.'
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
