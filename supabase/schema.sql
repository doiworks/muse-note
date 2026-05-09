-- Muse Note 用の最小スキーマ
-- Supabase SQL Editorにそのまま貼り付けて実行できます。

create extension if not exists "pgcrypto";

-- ユーザー情報テーブル
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  line_user_id text unique,
  user_name text not null default 'new user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 単語マスターテーブル
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
  note text
);

-- 回答履歴テーブル
create table if not exists public.history (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  word_id bigint not null references public.words(id) on delete cascade,
  answer_text text,
  is_correct boolean not null,
  answered_at timestamptz not null default now()
);

-- 学習統計テーブル（ユーザー×単語）
create table if not exists public.stats (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  word_id bigint not null references public.words(id) on delete cascade,
  correct_count int not null default 0,
  wrong_count int not null default 0,
  attempt_count int not null default 0,
  accuracy_rate numeric(5,2) not null default 0,
  updated_at timestamptz not null default now(),
  unique(user_id, word_id)
);

create index if not exists idx_history_user_id on public.history(user_id);
create index if not exists idx_history_word_id on public.history(word_id);
create index if not exists idx_stats_user_id on public.stats(user_id);
create index if not exists idx_stats_word_id on public.stats(word_id);

-- RLSはONのままにします。
-- anon / authenticated に公開SELECTポリシーは作らず、ブラウザから直接 words を読ませません。
alter table public.users enable row level security;
alter table public.words enable row level security;
alter table public.history enable row level security;
alter table public.stats enable row level security;

-- 念のため、公開ロールから直接テーブルを読める権限を外します。
-- アプリは app/api/words/route.js から service_role で必要なデータだけ返します。
revoke all on table public.users from anon, authenticated;
revoke all on table public.words from anon, authenticated;
revoke all on table public.history from anon, authenticated;
revoke all on table public.stats from anon, authenticated;

-- service_role はサーバー側APIだけで使う強い権限です。
-- RLSをOFFにせず、サーバー側APIが words を読めるように最低限の権限を付与します。
grant usage on schema public to service_role;
grant select on table public.words to service_role;
grant all on table public.users to service_role;
grant all on table public.history to service_role;
grant all on table public.stats to service_role;
grant usage, select on all sequences in schema public to service_role;
