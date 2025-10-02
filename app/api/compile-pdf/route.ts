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

    // Development: Try remote service directly (skip broken Docker)
    console.log('Development mode: Using remote LaTeX compilation service...');
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);
      
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
            suggestion: 'Check your LaTeX syntax and try again'
          },
          { status: response.status }
        );
      }

      const pdfArrayBuffer = await response.arrayBuffer();

      if (pdfArrayBuffer.byteLength === 0) {
        throw new Error('Remote server returned empty response');
      }

      const firstBytes = Buffer.from(pdfArrayBuffer.slice(0, 4)).toString('hex');
      if (firstBytes !== '25504446') {
        throw new Error(`Invalid PDF format. First bytes: ${firstBytes}`);
      }

      const pdfBuffer = Buffer.from(pdfArrayBuffer);
      const base64PDF = pdfBuffer.toString('base64');

      console.log('Remote compilation successful:', {
        size: pdfBuffer.length,
        method: 'remote-development'
      });

      return NextResponse.json({
        pdf: base64PDF,
        size: pdfBuffer.length,
        mimeType: 'application/pdf',
        debugInfo: {
            method: 'remote-development',
          contentLength: pdfArrayBuffer.byteLength,
        },
      });
    } catch (remoteError) {
      console.error('Remote compilation failed:', remoteError);
      
      if (remoteError instanceof Error && remoteError.name === 'AbortError') {
        return NextResponse.json(
          {
            error: 'LaTeX compilation timed out',
            details: 'Request took longer than 60 seconds',
            suggestion: 'Try again or simplify your LaTeX document'
          },
          { status: 504 }
        );
      }
      
      return NextResponse.json(
        {
          error: 'LaTeX compilation failed',
          details: String(remoteError),
          suggestion: 'The remote compilation service may be temporarily unavailable. Please try again.'
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
