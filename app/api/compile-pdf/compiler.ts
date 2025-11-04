import type { CompileRequest, FileEntry, CompilerResponse } from './types';

const COMPILE_TIMEOUT_MS = 60000; // 60 seconds

/**
 * Compiles LaTeX using the octree-compile service
 */
export async function compileLatex(
  body: CompileRequest,
  compileServiceUrl: string
): Promise<CompilerResponse> {
  const { content, files, projectId, lastModifiedFile } = body;

  // Prepare request
  let requestBody: string;
  let requestHeaders: Record<string, string>;

  if (files && files.length > 0) {
    // Multi-file mode: send JSON with files array
    requestBody = JSON.stringify({
      files,
      projectId,
      lastModifiedFile,
    });
    requestHeaders = { 'Content-Type': 'application/json' };
    console.log(`Multi-file compilation: ${files.length} files`, files.map(f => f.path));
    if (projectId) {
      console.log(`Project ID: ${projectId}`);
    }
  } else {
    // Single-file mode: send plain text (backward compatibility)
    requestBody = content!;
    requestHeaders = { 'Content-Type': 'text/plain' };
    console.log('Single-file compilation');
  }

  try {
    console.log('Attempting LaTeX compilation via octree-compile...');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), COMPILE_TIMEOUT_MS);

    const response = await fetch(`${compileServiceUrl}/compile`, {
      method: 'POST',
      headers: requestHeaders,
      body: requestBody,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return await handleCompileError(response);
    }

    return await handleCompileSuccess(response);
  } catch (error) {
    return handleCompileException(error);
  }
}

/**
 * Handles successful compilation response
 */
async function handleCompileSuccess(response: Response): Promise<CompilerResponse> {
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
    sha256,
  });

  return {
    success: true,
    pdfBuffer,
    base64PDF,
    requestId,
    durationMs: durationMs ? Number(durationMs) : null,
    queueMs: queueMs ? Number(queueMs) : null,
    sha256,
  };
}

/**
 * Handles compilation error response
 */
async function handleCompileError(response: Response): Promise<CompilerResponse> {
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

  return {
    success: false,
    error: {
      error: errorData.error || 'LaTeX compilation failed',
      details: errorData.message || errorData.details || `Server returned status ${response.status}`,
      log: errorData.log,
      stdout: errorData.stdout,
      stderr: errorData.stderr,
      requestId,
      queueMs: queueMs ? Number(queueMs) : errorData.queueMs,
      durationMs: durationMs ? Number(durationMs) : errorData.durationMs,
    },
  };
}

/**
 * Handles compilation exceptions
 */
function handleCompileException(error: unknown): CompilerResponse {
  console.error('octree-compile error:', error);

  if (error instanceof Error && error.name === 'AbortError') {
    return {
      success: false,
      error: {
        error: 'LaTeX compilation timed out',
        details: `Request took longer than ${COMPILE_TIMEOUT_MS / 1000} seconds`,
        suggestion: 'Try simplifying your LaTeX document or contact support if the issue persists',
      },
    };
  }

  return {
    success: false,
    error: {
      error: 'LaTeX compilation failed',
      details: String(error),
      suggestion: 'The octree-compile service may be temporarily unavailable',
    },
  };
}

