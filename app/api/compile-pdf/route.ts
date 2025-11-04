import { NextResponse } from 'next/server';
import type { CompileRequest, CompileCachePayload } from './types';
import { buildCacheKey, getCachedResponse, storeCachedResponse, getCacheStats } from './cache';
import { validateCompileRequest, validateLatexStructure } from './validation';
import { compileLatex } from './compiler';

export const runtime = 'nodejs';

const COMPILE_SERVICE_URL = process.env.COMPILE_SERVICE_URL || 'http://localhost:3001';
const IS_PROD = process.env.ENVIRONMENT === 'prod';

export async function POST(request: Request) {
  try {
    // Parse request body
    const body: CompileRequest = await request.json();

    // Validate request
    const requestValidationError = validateCompileRequest(body);
    if (requestValidationError) {
      return NextResponse.json(requestValidationError, { status: 400 });
    }

    // // Validate LaTeX structure
    // const latexValidationError = validateLatexStructure(body);
    // if (latexValidationError) {
    //   return NextResponse.json(latexValidationError, { status: 400 });
    // }

    // Check cache
    const cacheKey = buildCacheKey(body);
    console.log('[COMPILE CACHE] Cache key generated:', cacheKey?.substring(0, 16) + '...');

    const cachedPayload = getCachedResponse(cacheKey);
    if (cachedPayload) {
      console.log('🎯 [COMPILE CACHE] ⚡ CACHE HIT - Serving from cache instantly!', {
        cacheKey: cacheKey?.substring(0, 16) + '...',
        pdfSize: cachedPayload.size,
        projectId: body.projectId,
      });
      return NextResponse.json({
        ...cachedPayload,
        debugInfo: {
          ...(cachedPayload.debugInfo ?? {}),
          cacheStatus: 'hit',
          cacheKey,
        },
      });
    }

    console.log('❌ [COMPILE CACHE] CACHE MISS - Compiling with octree-compile', {
      cacheKey: cacheKey?.substring(0, 16) + '...',
      projectId: body.projectId,
      filesCount: body.files?.length,
    });

    // Compile
    const compileResult = await compileLatex(body, COMPILE_SERVICE_URL);

    // Handle compilation error
    if (!compileResult.success || !compileResult.base64PDF || !compileResult.pdfBuffer) {
      return NextResponse.json(
        {
          ...compileResult.error,
          suggestion: compileResult.error?.suggestion || 'Check your LaTeX syntax and try again',
        },
        { status: 500 }
      );
    }

    // Build response payload
    const responsePayload: CompileCachePayload = {
      pdf: compileResult.base64PDF,
      size: compileResult.pdfBuffer.length,
      mimeType: 'application/pdf',
      debugInfo: {
        contentLength: compileResult.pdfBuffer.byteLength,
        base64Length: compileResult.base64PDF.length,
        requestId: compileResult.requestId,
        durationMs: compileResult.durationMs,
        queueMs: compileResult.queueMs,
        sha256: compileResult.sha256,
      },
    };

    // Store in cache
    storeCachedResponse(cacheKey, responsePayload);
    const stats = getCacheStats();
    console.log('💾 [COMPILE CACHE] Stored in cache', {
      cacheKey: cacheKey?.substring(0, 16) + '...',
      pdfSize: compileResult.pdfBuffer.length,
      ttlMs: stats.ttlMs,
      cacheSize: stats.size,
      maxSize: stats.maxSize,
    });

    return NextResponse.json({
      ...responsePayload,
      debugInfo: {
        ...(responsePayload.debugInfo ?? {}),
        cacheStatus: 'miss',
        cacheKey,
      },
    });
  } catch (error) {
    console.error('LaTeX compilation error:', error);
    return NextResponse.json(
      {
        error: 'LaTeX compilation failed',
        details: String(error),
        suggestion: 'Check your LaTeX syntax and try again',
      },
      { status: 500 }
    );
  }
}