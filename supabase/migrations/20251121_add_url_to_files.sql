-- Add url field to files table for storing storage URLs

alter table files
  add column if not exists url text;

create index if not exists files_url_idx
  on files (url);

