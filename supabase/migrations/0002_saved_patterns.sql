-- Real server-side persistence for Sequencer's saved-pattern library (S5
-- from the strategic review: persistence was localStorage-only despite a
-- real Supabase project existing). Same access model as 0001: RLS enabled,
-- no anon/authenticated policies, service_role (which is all the backend
-- ever uses) bypasses RLS regardless.

create table if not exists public.saved_patterns (
  id text primary key,
  user_id text not null,
  name text not null,
  genre text,
  mood text,
  style text,
  pattern jsonb not null,
  saved_at timestamptz not null default now()
);
alter table public.saved_patterns enable row level security;
create index if not exists saved_patterns_user_saved_idx
  on public.saved_patterns (user_id, saved_at desc);
