-- Enable required extensions
create extension if not exists "pgcrypto";
create extension if not exists vector;

-- Knowledge base table
create table if not exists knowledge_base_entries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  title text not null,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  embedding vector(1536) not null
);

-- Keep updated_at fresh
create or replace function set_knowledge_base_updated_at()
returns trigger as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$ language plpgsql;

create trigger knowledge_base_entries_set_updated_at
before update on knowledge_base_entries
for each row
execute function set_knowledge_base_updated_at();

-- Vector index for fast similarity search
create index if not exists knowledge_base_entries_embedding_idx
  on knowledge_base_entries
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Full text index for fallback keyword search
create index if not exists knowledge_base_entries_search_idx
  on knowledge_base_entries
  using gin (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, '')));

-- RLS configuration
alter table knowledge_base_entries enable row level security;

create policy "Knowledge base public read"
  on knowledge_base_entries
  for select
  using (true);

create policy "Knowledge base service write"
  on knowledge_base_entries
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Similarity search helper
create or replace function match_octra_knowledge_base(
  query_embedding vector(1536),
  match_count int default 5,
  match_threshold float default 0.35
)
returns table (
  id uuid,
  title text,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
begin
  if query_embedding is null then
    return;
  end if;

  perform set_config('ivfflat.probes', '10', true);

  return query
  select
    k.id,
    k.title,
    k.content,
    k.metadata,
    1 - (k.embedding <=> query_embedding) as similarity
  from knowledge_base_entries k
  where match_threshold is null
     or 1 - (k.embedding <=> query_embedding) >= match_threshold
  order by k.embedding <=> query_embedding
  limit match_count;
end;
$$;
