-- Optional Supabase table for usage logging when SCRIBE_SUPABASE_* env vars are set.

create table if not exists public.scribe_usage (
  id bigint generated always as identity primary key,
  app_id text not null,
  engine text not null,
  duration_seconds double precision not null default 0,
  cost_usd_estimate double precision not null default 0,
  language text not null default 'en',
  audio_bytes integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists scribe_usage_app_id_created_at_idx
  on public.scribe_usage (app_id, created_at desc);

-- Restrict access: service role only (default for server-side inserts).
alter table public.scribe_usage enable row level security;
