import { NextResponse } from 'next/server';

import type { Tables } from '@/database.types';
import { searchKnowledgeBase, upsertKnowledgeBaseEntry } from '@/lib/octra-knowledge-base';

type UpsertRequestBody = {
  entries?: {
    id?: string;
    title: string;
    content: string;
    metadata?: Record<string, unknown>;
  }[];
  id?: string;
  title?: string;
  content?: string;
  metadata?: Record<string, unknown>;
};

const ADMIN_KEY = process.env.OCTRA_KB_ADMIN_KEY;

function extractAdminKey(request: Request) {
  const headerKey = request.headers.get('x-octra-kb-key');
  if (headerKey) {
    return headerKey;
  }

  const authorization = request.headers.get('authorization');
  if (authorization?.startsWith('Bearer ')) {
    return authorization.slice('Bearer '.length);
  }

  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.trim() ?? '';

  if (!query) {
    return NextResponse.json({ matches: [] });
  }

  const limit = Number.parseInt(searchParams.get('limit') ?? '', 10);
  const matchCount = Number.isNaN(limit) ? undefined : Math.min(Math.max(limit, 1), 10);

  const matches = await searchKnowledgeBase(query, { matchCount });

  return NextResponse.json({ matches });
}

export async function POST(request: Request) {
  if (!ADMIN_KEY) {
    return NextResponse.json(
      { error: 'Knowledge base admin key not configured' },
      { status: 503 }
    );
  }

  const providedKey = extractAdminKey(request);
  if (providedKey !== ADMIN_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload: UpsertRequestBody;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const entries = Array.isArray(payload.entries)
    ? payload.entries
    : payload.title && payload.content
      ? [{ id: payload.id, title: payload.title, content: payload.content, metadata: payload.metadata }]
      : [];

  if (!entries.length) {
    return NextResponse.json(
      { error: 'At least one entry with title and content is required' },
      { status: 400 }
    );
  }

  try {
    const results: Tables<'knowledge_base_entries'>[] = [];

    for (const entry of entries) {
      if (!entry.title?.trim() || !entry.content?.trim()) {
        return NextResponse.json(
          { error: 'Each entry must include a title and content' },
          { status: 400 }
        );
      }

      const result = await upsertKnowledgeBaseEntry({
        id: entry.id,
        title: entry.title.trim(),
        content: entry.content.trim(),
        metadata: entry.metadata ?? {},
      });

      results.push(result);
    }

    return NextResponse.json({ entries: results });
  } catch (error) {
    console.error('Knowledge base upsert failed:', error);
    return NextResponse.json(
      { error: 'Failed to upsert knowledge base entries' },
      { status: 500 }
    );
  }
}
