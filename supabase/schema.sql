-- Muse Note 正式スキーマ
-- ユーザーは public.app_users に統一します。

create extension if not exists "pgcrypto";

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  line_user_id text not null unique,
  display_name text not null default 'LINEユーザー',
  picture_url text,
  status text not null default 'active',
  role text not null default 'user',
  created_at timestamptz not null default now(),
  last_login_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint app_users_status_check check (status in ('active', 'disabled')),
  constraint app_users_role_check check (role in ('user', 'admin'))
);

create table if not exists public.words (
  id bigint primary key,
  school_level text,
  grade int,
  term int,
  exam_type text,
  category1 text,
  category2 text,
  category3 text,
  importance text,
  japanese text not null,
  english text not null,
  phonetic text,
  example text,
  pos_code text,
  pos_full text,
  pos_j text,
  antonym text,
  antonym_jp text,
  text text
);

create table if not exists public.history (
  id bigint generated always as identity primary key,
  app_user_id uuid not null references public.app_users(id) on delete cascade,
  word_id bigint not null references public.words(id) on delete cascade,
  answer text not null default '',
  correct boolean not null,
  answered_at timestamptz not null default now()
);

create table if not exists public.stats (
  id bigint generated always as identity primary key,
  app_user_id uuid not null references public.app_users(id) on delete cascade,
  word_id bigint not null references public.words(id) on delete cascade,
  success_count int not null default 0,
  mistake_count int not null default 0,
  attempt_count int not null default 0,
  accuracy numeric(5,2) not null default 0,
  priority int not null default 0,
  last_correct timestamptz,
  last_wrong timestamptz,
  updated_at timestamptz not null default now(),
  unique(app_user_id, word_id)
);

create table if not exists public.word_sets (
  id uuid primary key default gen_random_uuid(),
  app_user_id uuid not null references public.app_users(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.word_set_items (
  id bigint generated always as identity primary key,
  word_set_id uuid not null references public.word_sets(id) on delete cascade,
  word_id bigint not null references public.words(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(word_set_id, word_id)
);

create index if not exists idx_history_app_user_id on public.history(app_user_id);
create index if not exists idx_history_word_id on public.history(word_id);
create index if not exists idx_stats_app_user_id on public.stats(app_user_id);
create index if not exists idx_stats_word_id on public.stats(word_id);
create index if not exists idx_word_sets_app_user_id on public.word_sets(app_user_id);
create index if not exists idx_word_set_items_word_set_id on public.word_set_items(word_set_id);

alter table public.app_users enable row level security;
alter table public.words enable row level security;
alter table public.history enable row level security;
alter table public.stats enable row level security;
alter table public.word_sets enable row level security;
alter table public.word_set_items enable row level security;

revoke all on table public.app_users from anon, authenticated;
revoke all on table public.words from anon, authenticated;
revoke all on table public.history from anon, authenticated;
revoke all on table public.stats from anon, authenticated;
revoke all on table public.word_sets from anon, authenticated;
revoke all on table public.word_set_items from anon, authenticated;

grant usage on schema public to service_role;
grant all on table public.app_users to service_role;
grant select on table public.words to service_role;
grant all on table public.history to service_role;
grant all on table public.stats to service_role;
grant all on table public.word_sets to service_role;
grant all on table public.word_set_items to service_role;
grant usage, select on all sequences in schema public to service_role;
