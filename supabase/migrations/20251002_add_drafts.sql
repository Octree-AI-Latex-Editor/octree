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
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'drafts' AND policyname = 'drafts_insert_any'
  ) THEN
    CREATE POLICY drafts_insert_any ON public.drafts
      FOR INSERT TO anon, authenticated
      WITH CHECK (true);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'drafts' AND policyname = 'drafts_select_any'
  ) THEN
    CREATE POLICY drafts_select_any ON public.drafts
      FOR SELECT TO anon, authenticated
      USING (true);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'drafts' AND policyname = 'drafts_delete_any'
  ) THEN
    CREATE POLICY drafts_delete_any ON public.drafts
      FOR DELETE TO anon, authenticated
      USING (true);
  END IF;
END
$$;

-- Optional: simple cleanup helper (not executed automatically)
-- delete from public.drafts where created_at < now() - interval '24 hours'; 