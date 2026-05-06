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
-- words は商品データのため anon には公開しません。
-- LINE Login 実装後に authenticated ユーザー向けの SELECT ポリシーを追加します。
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

-- RLSを有効にしますが、anon向けSELECTポリシーは作りません。
-- 現時点ではAPI Routeのservice_role経由だけが words を読める方針です。
alter table public.words enable row level security;

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
