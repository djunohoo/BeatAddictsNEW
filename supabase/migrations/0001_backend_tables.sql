-- Beat Addicts backend tables (ai_generations, ai_feedback, midi_files,
-- training_batches) matching what backend/services/db.py already writes to.
--
-- RLS is enabled on all four with zero policies for anon/authenticated,
-- which blocks those roles entirely by default -- the service_role key
-- always bypasses RLS regardless of policies, so the backend (which only
-- ever uses SUPABASE_SERVICE_KEY) keeps full access with no policy needed.
-- This is the "service-role-only" access model from TASKS.md B4: safe for
-- now since there's no real per-user auth yet to write a meaningful
-- per-user policy against. Revisit once that exists.

create table if not exists public.ai_generations (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  kind text not null,
  genre text,
  payload jsonb,
  opt_in boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.ai_generations enable row level security;
create index if not exists ai_generations_user_created_idx
  on public.ai_generations (user_id, created_at);

create table if not exists public.ai_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  accepted boolean not null,
  pattern jsonb,
  genre text,
  created_at timestamptz not null default now()
);
alter table public.ai_feedback enable row level security;

create table if not exists public.midi_files (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  midi_url text not null,
  created_at timestamptz not null default now()
);
alter table public.midi_files enable row level security;

create table if not exists public.training_batches (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  batch_id text not null,
  created_at timestamptz not null default now()
);
alter table public.training_batches enable row level security;
