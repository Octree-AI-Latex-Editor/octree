import OpenAI from 'openai';

import { createAdminClient } from '@/lib/supabase/admin';

const DEFAULT_MATCH_COUNT = Number(process.env.OCTRA_KB_MATCH_COUNT ?? '3');
const DEFAULT_MATCH_THRESHOLD = Number(process.env.OCTRA_KB_MATCH_THRESHOLD ?? '0.35');
const EMBEDDING_MODEL = process.env.OCTRA_KB_EMBEDDING_MODEL ?? 'text-embedding-3-large';
const MAX_CONTEXT_CHARACTERS = Number(process.env.OCTRA_KB_CONTEXT_LIMIT ?? '1500');

let openai: OpenAI | null = null;

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required for knowledge base operations');
  }

  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  return openai;
}

type KnowledgeBaseMatch = {
  id: string;
  title: string;
  content: string;
  metadata: Record<string, unknown> | null;
  similarity: number | null;
};

type KnowledgeBaseQueryOptions = {
  matchCount?: number;
  matchThreshold?: number;
};

type KnowledgeBaseEntry = {
  id?: string;
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
};

async function embedText(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('Cannot embed empty text');
  }

  const input = trimmed.slice(0, 8000);
  const response = await getOpenAIClient().embeddings.create({
    model: EMBEDDING_MODEL,
    input,
  });

  const [embedding] = response.data;
  if (!embedding) {
    throw new Error('Failed to generate embedding for knowledge base text');
  }

  return embedding.embedding;
}

function safeCreateAdminClient() {
  try {
    return createAdminClient();
  } catch (error) {
    console.warn('Knowledge base disabled: unable to create Supabase admin client.', error);
    return null;
  }
}

export async function searchKnowledgeBase(
  query: string,
  options: KnowledgeBaseQueryOptions = {}
): Promise<KnowledgeBaseMatch[]> {
  const supabase = safeCreateAdminClient();

  if (!supabase) {
    return [];
  }

  const effectiveQuery = query.trim();
  if (!effectiveQuery) {
    return [];
  }

  try {
    const queryEmbedding = await embedText(effectiveQuery);

    const { data, error } = await supabase.rpc('match_octra_knowledge_base', {
      query_embedding: queryEmbedding,
      match_count: options.matchCount ?? DEFAULT_MATCH_COUNT,
      match_threshold: options.matchThreshold ?? DEFAULT_MATCH_THRESHOLD,
    });

    if (error) {
      console.error('Knowledge base search error:', error);
      return [];
    }

    return (data as KnowledgeBaseMatch[]) ?? [];
  } catch (error) {
    console.error('Knowledge base search failure:', error);
    return [];
  }
}

export async function formatKnowledgeBaseContext(queryParts: string[]): Promise<string> {
  const filtered = queryParts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));

  if (filtered.length === 0) {
    return '';
  }

  const matches = await searchKnowledgeBase(filtered.join('\n\n'));

  if (!matches.length) {
    return '';
  }

  return matches
    .map((match, index) => {
      const content = match.content.length > MAX_CONTEXT_CHARACTERS
        ? `${match.content.slice(0, MAX_CONTEXT_CHARACTERS)}...`
        : match.content;
      const similarityPercent = match.similarity
        ? `${Math.round(match.similarity * 1000) / 10}%`
        : 'N/A';

      return `Entry ${index + 1} — ${match.title} (similarity: ${similarityPercent})\n${content}`;
    })
    .join('\n\n');
}

export async function upsertKnowledgeBaseEntry(entry: KnowledgeBaseEntry) {
  const supabase = safeCreateAdminClient();

  if (!supabase) {
    throw new Error('Knowledge base admin client is not configured');
  }

  const embedding = await embedText(`${entry.title}\n\n${entry.content}`);

  const payload = {
    id: entry.id,
    title: entry.title,
    content: entry.content,
    metadata: entry.metadata ?? {},
    embedding,
  };

  const { data, error } = await supabase
    .from('knowledge_base_entries')
    .upsert(payload)
    .select()
    .limit(1);

  if (error) {
    throw error;
  }

  if (!data || !data.length) {
    throw new Error('Knowledge base upsert returned no data');
  }

  return data[0];
}
