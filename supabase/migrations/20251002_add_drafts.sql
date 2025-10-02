-- Create drafts table to support server-draft import flow
create extension if not exists pgcrypto;

create table if not exists public.drafts (
  id uuid primary key default gen_random_uuid(),
  title text,
  content text not null,
  source text,
  created_at timestamptz not null default now()
);

alter table public.drafts enable row level security;

-- Allow anonymous and authenticated inserts/selects/deletes for short-lived drafts
create policy if not exists drafts_insert_any on public.drafts
  for insert to anon, authenticated
  with check (true);

create policy if not exists drafts_select_any on public.drafts
  for select to anon, authenticated
  using (true);

create policy if not exists drafts_delete_any on public.drafts
  for delete to anon, authenticated
  using (true);

-- Optional: simple cleanup helper (not executed automatically)
-- delete from public.drafts where created_at < now() - interval '24 hours'; 