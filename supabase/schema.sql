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

create table if not exists public.history (
  id bigint generated always as identity primary key,
  app_user_id uuid not null references public.app_users(id) on delete cascade,
  word_id bigint not null references public.words(id) on delete cascade,
  answer text not null default '',
  correct boolean not null,
  study_session_id uuid references public.study_sessions(id) on delete set null,
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
create index if not exists idx_history_study_session_id on public.history(study_session_id);
create index if not exists idx_study_sessions_app_user_id on public.study_sessions(app_user_id);
create index if not exists idx_stats_app_user_id on public.stats(app_user_id);
create index if not exists idx_stats_word_id on public.stats(word_id);
create index if not exists idx_word_sets_app_user_id on public.word_sets(app_user_id);
create index if not exists idx_word_set_items_word_set_id on public.word_set_items(word_set_id);

alter table public.app_users enable row level security;
alter table public.words enable row level security;
alter table public.history enable row level security;
alter table public.study_sessions enable row level security;
alter table public.stats enable row level security;
alter table public.word_sets enable row level security;
alter table public.word_set_items enable row level security;

revoke all on table public.app_users from anon, authenticated;
revoke all on table public.words from anon, authenticated;
revoke all on table public.history from anon, authenticated;
revoke all on table public.study_sessions from anon, authenticated;
revoke all on table public.stats from anon, authenticated;
revoke all on table public.word_sets from anon, authenticated;
revoke all on table public.word_set_items from anon, authenticated;

grant usage on schema public to service_role;
grant all on table public.app_users to service_role;
grant select on table public.words to service_role;
grant all on table public.history to service_role;
grant all on table public.study_sessions to service_role;
grant all on table public.stats to service_role;
grant all on table public.word_sets to service_role;
grant all on table public.word_set_items to service_role;
grant usage, select on all sequences in schema public to service_role;
-- Server-authoritative, per-user/per-scope fair quiz reservations.
create table if not exists public.quiz_word_progress (
  app_user_id uuid not null references public.app_users(id) on delete cascade,
  scope_key text not null,
  word_id bigint not null references public.words(id) on delete cascade,
  presented_count integer not null default 0 check (presented_count >= 0),
  last_presented_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (app_user_id, scope_key, word_id)
);
create table if not exists public.quiz_reservations (
  id uuid primary key default gen_random_uuid(),
  app_user_id uuid not null references public.app_users(id) on delete cascade,
  scope_key text not null,
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  created_at timestamptz not null default now()
);
create table if not exists public.quiz_reservation_items (
  reservation_id uuid not null references public.quiz_reservations(id) on delete cascade,
  word_id bigint not null references public.words(id) on delete cascade,
  position integer not null,
  presented_at timestamptz,
  primary key (reservation_id, word_id),
  unique (reservation_id, position)
);
create index if not exists idx_quiz_progress_scope_count on public.quiz_word_progress(app_user_id, scope_key, presented_count);
create index if not exists idx_quiz_reservations_expiry on public.quiz_reservations(expires_at);
create index if not exists idx_quiz_reservation_items_word on public.quiz_reservation_items(word_id, reservation_id);
alter table public.quiz_word_progress enable row level security;
alter table public.quiz_reservations enable row level security;
alter table public.quiz_reservation_items enable row level security;
revoke all on table public.quiz_word_progress, public.quiz_reservations, public.quiz_reservation_items from anon, authenticated;
grant all on table public.quiz_word_progress, public.quiz_reservations, public.quiz_reservation_items to service_role;

create or replace function public.reserve_fair_quiz_words(p_app_user_id uuid, p_scope_key text, p_word_ids bigint[], p_requested_count integer, p_ttl_seconds integer default 900)
returns table(reservation_id uuid, word_id bigint, position integer)
language plpgsql security definer set search_path = public as $$
declare v_reservation uuid; v_word bigint; v_position integer := 0;
begin
  if p_app_user_id is null or coalesce(p_scope_key, '') = '' or p_requested_count < 1 then raise exception 'invalid reservation request'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_app_user_id::text || ':' || p_scope_key, 0));
  delete from public.quiz_reservations where expires_at <= now();
  insert into public.quiz_reservations(app_user_id, scope_key, expires_at)
    values(p_app_user_id, p_scope_key, now() + make_interval(secs => greatest(30, least(p_ttl_seconds, 3600)))) returning id into v_reservation;
  while v_position < least(p_requested_count, cardinality(p_word_ids)) loop
    select candidate.id into v_word
    from (select distinct unnest(p_word_ids) as id) candidate
    left join public.quiz_word_progress progress on progress.app_user_id=p_app_user_id and progress.scope_key=p_scope_key and progress.word_id=candidate.id
    where not exists (select 1 from public.quiz_reservation_items own_item where own_item.reservation_id=v_reservation and own_item.word_id=candidate.id)
      and not exists (
        select 1 from public.quiz_reservation_items active_item join public.quiz_reservations active_res on active_res.id=active_item.reservation_id
        where active_res.app_user_id=p_app_user_id and active_res.scope_key=p_scope_key and active_res.expires_at>now()
          and active_item.presented_at is null and active_item.word_id=candidate.id and active_res.id<>v_reservation)
    order by coalesce(progress.presented_count,0), random() limit 1;
    exit when v_word is null;
    insert into public.quiz_reservation_items(reservation_id, word_id, position) values(v_reservation, v_word, v_position);
    v_position := v_position + 1;
  end loop;
  return query select v_reservation, item.word_id, item.position from public.quiz_reservation_items item where item.reservation_id=v_reservation order by item.position;
end $$;

create or replace function public.confirm_quiz_word_presented(p_app_user_id uuid, p_reservation_id uuid, p_word_id bigint)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_scope text; v_updated integer;
begin
  select scope_key into v_scope from public.quiz_reservations where id=p_reservation_id and app_user_id=p_app_user_id;
  if v_scope is null then return false; end if;
  update public.quiz_reservation_items set presented_at=now() where reservation_id=p_reservation_id and word_id=p_word_id and presented_at is null;
  get diagnostics v_updated = row_count;
  if v_updated=0 then return exists(select 1 from public.quiz_reservation_items where reservation_id=p_reservation_id and word_id=p_word_id and presented_at is not null); end if;
  insert into public.quiz_word_progress(app_user_id,scope_key,word_id,presented_count,last_presented_at,updated_at)
    values(p_app_user_id,v_scope,p_word_id,1,now(),now())
    on conflict(app_user_id,scope_key,word_id) do update set presented_count=quiz_word_progress.presented_count+1,last_presented_at=now(),updated_at=now();
  return true;
end $$;
revoke all on function public.reserve_fair_quiz_words(uuid,text,bigint[],integer,integer) from public, anon, authenticated;
revoke all on function public.confirm_quiz_word_presented(uuid,uuid,bigint) from public, anon, authenticated;
grant execute on function public.reserve_fair_quiz_words(uuid,text,bigint[],integer,integer) to service_role;
grant execute on function public.confirm_quiz_word_presented(uuid,uuid,bigint) to service_role;
