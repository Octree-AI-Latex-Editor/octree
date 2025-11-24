import type { CompilationError } from '@/types/compilation';
import { isBinaryFile } from '@/lib/constants/file-types';

export function normalizePath(name: string): string {
  if (!name) return 'document.tex';
  return name.includes('.') ? name : `${name}.tex`;
}

export function summarizeLog(log?: string): string | undefined {
  if (!log) return undefined;
  const lines = log.split('\n').filter((line) => line.trim().length > 0);
  const lastLines = lines.slice(-5);
  return lastLines.join('\n');
}

export function createCompilationError(
  data: any,
  errorMessage: string
): CompilationError {
  return {
    message: errorMessage,
    details: data?.details,
    log: data?.log,
    stdout: data?.stdout,
    stderr: data?.stderr,
    code: data?.code,
    requestId: data?.requestId,
    queueMs: data?.queueMs,
    durationMs: data?.durationMs,
    summary: summarizeLog(data?.log || data?.stderr || data?.stdout),
  };
}

export async function processFileContent(
  fileBlob: Blob,
  fileName: string
): Promise<{ path: string; content: string; encoding?: string }> {
  const isBinary = isBinaryFile(fileName);
  let content: string;

  if (isBinary) {
    const arrayBuffer = await fileBlob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    content = btoa(String.fromCharCode(...uint8Array));
  } else {
    content = await fileBlob.text();
  }

  const fileEntry: {
    path: string;
    content: string;
    encoding?: string;
  } = {
    path: fileName,
    content: content,
  };

  if (isBinary) {
    fileEntry.encoding = 'base64';
  }

  return fileEntry;
}

export async function makeCompilationRequest(
  filesPayload: Array<{ path: string; content: string; encoding?: string }>,
  normalizedFileName: string,
  projectId?: string
): Promise<{ response: Response; data: any }> {
  const requestBody = {
    files: filesPayload,
    projectId,
    lastModifiedFile: normalizedFileName,
  };

  const response = await fetch('/api/compile-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  const raw = await response.text();
  let data: any;
  try {
    data = JSON.parse(raw);
  } catch (parseError) {
    throw new Error('Unexpected response from compilation service');
  }

  return { response, data };
}
