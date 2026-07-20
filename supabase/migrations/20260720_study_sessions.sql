create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  app_user_id uuid not null references public.app_users(id) on delete cascade,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'interrupted')),
  completed_questions int not null default 0,
  total_questions int not null check (total_questions > 0),
  correct_count int not null default 0,
  wrong_count int not null default 0,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);
alter table public.history add column if not exists study_session_id uuid references public.study_sessions(id) on delete set null;
create index if not exists idx_history_study_session_id on public.history(study_session_id);
create index if not exists idx_study_sessions_app_user_id on public.study_sessions(app_user_id);
alter table public.study_sessions enable row level security;
revoke all on table public.study_sessions from anon, authenticated;
grant all on table public.study_sessions to service_role;
