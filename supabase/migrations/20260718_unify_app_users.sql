-- 既存データを残したまま、ユーザー管理を app_users / app_user_id に統一します。
begin;

create extension if not exists "pgcrypto";

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  line_user_id text,
  display_name text not null default 'LINEユーザー',
  picture_url text,
  status text not null default 'active',
  role text not null default 'user',
  created_at timestamptz not null default now(),
  last_login_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.app_users add column if not exists line_user_id text;
alter table public.app_users add column if not exists display_name text;
alter table public.app_users add column if not exists picture_url text;
alter table public.app_users add column if not exists status text;
alter table public.app_users add column if not exists role text;
alter table public.app_users add column if not exists created_at timestamptz;
alter table public.app_users add column if not exists last_login_at timestamptz;
alter table public.app_users add column if not exists updated_at timestamptz;

do $$
begin
  if to_regclass('public.users') is not null then
    execute $sql$
      insert into public.app_users (id, line_user_id, display_name, created_at, updated_at)
      select
        u.id,
        coalesce(nullif(u.line_user_id, ''), 'legacy_' || replace(u.id::text, '-', '')),
        coalesce(nullif(u.user_name, ''), '移行ユーザー'),
        coalesce(u.created_at, now()),
        coalesce(u.updated_at, now())
      from public.users u
      where not exists (
        select 1 from public.app_users a
        where a.id = u.id
           or (u.line_user_id is not null and a.line_user_id = u.line_user_id)
      )
    $sql$;
  end if;
end $$;

insert into public.app_users (
  id, line_user_id, display_name, status, role, created_at, last_login_at, updated_at
) values (
  '00000000-0000-4000-8000-000000000001',
  'dev_preview_user',
  '開発確認ユーザー',
  'active',
  'user',
  now(),
  now(),
  now()
)
on conflict (id) do update set
  line_user_id = excluded.line_user_id,
  display_name = excluded.display_name,
  status = excluded.status,
  updated_at = excluded.updated_at;

do $$
begin
  if to_regclass('public.history') is not null then
    if exists (select 1 from information_schema.columns where table_schema='public' and table_name='history' and column_name='user_id')
       and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='history' and column_name='app_user_id') then
      alter table public.history rename column user_id to app_user_id;
    end if;
    if exists (select 1 from information_schema.columns where table_schema='public' and table_name='history' and column_name='answer_text')
       and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='history' and column_name='answer') then
      alter table public.history rename column answer_text to answer;
    end if;
    if exists (select 1 from information_schema.columns where table_schema='public' and table_name='history' and column_name='is_correct')
       and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='history' and column_name='correct') then
      alter table public.history rename column is_correct to correct;
    end if;
  end if;
end $$;

create table if not exists public.history (
  id bigint generated always as identity primary key,
  app_user_id uuid,
  word_id bigint not null,
  answer text,
  correct boolean,
  answered_at timestamptz not null default now()
);
alter table public.history add column if not exists app_user_id uuid;
alter table public.history add column if not exists answer text;
alter table public.history add column if not exists correct boolean;
alter table public.history add column if not exists answered_at timestamptz;

do $$
begin
  if to_regclass('public.stats') is not null then
    if exists (select 1 from information_schema.columns where table_schema='public' and table_name='stats' and column_name='user_id')
       and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='stats' and column_name='app_user_id') then
      alter table public.stats rename column user_id to app_user_id;
    end if;
    if exists (select 1 from information_schema.columns where table_schema='public' and table_name='stats' and column_name='correct_count')
       and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='stats' and column_name='success_count') then
      alter table public.stats rename column correct_count to success_count;
    end if;
    if exists (select 1 from information_schema.columns where table_schema='public' and table_name='stats' and column_name='wrong_count')
       and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='stats' and column_name='mistake_count') then
      alter table public.stats rename column wrong_count to mistake_count;
    end if;
    if exists (select 1 from information_schema.columns where table_schema='public' and table_name='stats' and column_name='accuracy_rate')
       and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='stats' and column_name='accuracy') then
      alter table public.stats rename column accuracy_rate to accuracy;
    end if;
  end if;
end $$;

create table if not exists public.stats (
  id bigint generated always as identity primary key,
  app_user_id uuid,
  word_id bigint not null,
  success_count int not null default 0,
  mistake_count int not null default 0,
  attempt_count int not null default 0,
  accuracy numeric(5,2) not null default 0,
  priority int not null default 0,
  last_correct timestamptz,
  last_wrong timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.stats add column if not exists app_user_id uuid;
alter table public.stats add column if not exists success_count int not null default 0;
alter table public.stats add column if not exists mistake_count int not null default 0;
alter table public.stats add column if not exists attempt_count int not null default 0;
alter table public.stats add column if not exists accuracy numeric(5,2) not null default 0;
alter table public.stats add column if not exists priority int not null default 0;
alter table public.stats add column if not exists last_correct timestamptz;
alter table public.stats add column if not exists last_wrong timestamptz;
alter table public.stats add column if not exists updated_at timestamptz not null default now();

create table if not exists public.word_sets (
  id uuid primary key default gen_random_uuid(),
  app_user_id uuid,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.word_sets add column if not exists app_user_id uuid;

create table if not exists public.word_set_items (
  id bigint generated always as identity primary key,
  word_set_id uuid not null,
  word_id bigint not null,
  created_at timestamptz not null default now()
);

insert into public.app_users (id, line_user_id, display_name, status, role, created_at, updated_at)
select distinct h.app_user_id, 'legacy_' || replace(h.app_user_id::text, '-', ''), '移行ユーザー', 'active', 'user', now(), now()
from public.history h
where h.app_user_id is not null
  and not exists (select 1 from public.app_users a where a.id = h.app_user_id)
on conflict do nothing;

insert into public.app_users (id, line_user_id, display_name, status, role, created_at, updated_at)
select distinct s.app_user_id, 'legacy_' || replace(s.app_user_id::text, '-', ''), '移行ユーザー', 'active', 'user', now(), now()
from public.stats s
where s.app_user_id is not null
  and not exists (select 1 from public.app_users a where a.id = s.app_user_id)
on conflict do nothing;

insert into public.app_users (id, line_user_id, display_name, status, role, created_at, updated_at)
select distinct w.app_user_id, 'legacy_' || replace(w.app_user_id::text, '-', ''), '移行ユーザー', 'active', 'user', now(), now()
from public.word_sets w
where w.app_user_id is not null
  and not exists (select 1 from public.app_users a where a.id = w.app_user_id)
on conflict do nothing;

update public.app_users set line_user_id = 'legacy_' || replace(id::text, '-', '') where line_user_id is null or line_user_id = '';
update public.app_users set display_name = 'LINEユーザー' where display_name is null or display_name = '';
update public.app_users set status = 'active' where status is null or status = '';
update public.app_users set role = 'user' where role is null or role = '';
update public.app_users set created_at = now() where created_at is null;
update public.app_users set updated_at = now() where updated_at is null;

alter table public.app_users alter column line_user_id set not null;
alter table public.app_users alter column display_name set not null;
alter table public.app_users alter column status set not null;
alter table public.app_users alter column role set not null;
alter table public.app_users alter column created_at set not null;
alter table public.app_users alter column updated_at set not null;

create unique index if not exists app_users_line_user_id_key on public.app_users(line_user_id);
create unique index if not exists stats_app_user_word_key on public.stats(app_user_id, word_id);
create unique index if not exists word_set_items_set_word_key on public.word_set_items(word_set_id, word_id);
create index if not exists idx_history_app_user_id on public.history(app_user_id);
create index if not exists idx_stats_app_user_id on public.stats(app_user_id);
create index if not exists idx_word_sets_app_user_id on public.word_sets(app_user_id);

do $$
declare constraint_row record;
begin
  for constraint_row in
    select c.conrelid::regclass as table_name, c.conname
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
    where c.contype = 'f'
      and c.conrelid in ('public.history'::regclass, 'public.stats'::regclass, 'public.word_sets'::regclass)
      and a.attname = 'app_user_id'
  loop
    execute format('alter table %s drop constraint %I', constraint_row.table_name, constraint_row.conname);
  end loop;
end $$;

alter table public.history add constraint history_app_user_id_fkey foreign key (app_user_id) references public.app_users(id) on delete cascade;
alter table public.stats add constraint stats_app_user_id_fkey foreign key (app_user_id) references public.app_users(id) on delete cascade;
alter table public.word_sets add constraint word_sets_app_user_id_fkey foreign key (app_user_id) references public.app_users(id) on delete cascade;

update public.history set app_user_id = '00000000-0000-4000-8000-000000000001' where app_user_id is null;
update public.history set answer = '' where answer is null;
update public.history set correct = false where correct is null;
update public.history set answered_at = now() where answered_at is null;
update public.stats set app_user_id = '00000000-0000-4000-8000-000000000001' where app_user_id is null;
update public.word_sets set app_user_id = '00000000-0000-4000-8000-000000000001' where app_user_id is null;

alter table public.history alter column app_user_id set not null;
alter table public.history alter column answer set default '';
alter table public.history alter column answer set not null;
alter table public.history alter column correct set not null;
alter table public.history alter column answered_at set not null;
alter table public.stats alter column app_user_id set not null;
alter table public.word_sets alter column app_user_id set not null;

alter table public.app_users drop column if exists legacy_user_id;
alter table public.history drop column if exists user_id;
alter table public.history drop column if exists answer_text;
alter table public.history drop column if exists is_correct;
alter table public.stats drop column if exists user_id;
alter table public.stats drop column if exists correct_count;
alter table public.stats drop column if exists wrong_count;
alter table public.stats drop column if exists accuracy_rate;
drop table if exists public.users;

alter table public.app_users enable row level security;
alter table public.history enable row level security;
alter table public.stats enable row level security;
alter table public.word_sets enable row level security;
alter table public.word_set_items enable row level security;

revoke all on table public.app_users from anon, authenticated;
revoke all on table public.history from anon, authenticated;
revoke all on table public.stats from anon, authenticated;
revoke all on table public.word_sets from anon, authenticated;
revoke all on table public.word_set_items from anon, authenticated;

grant usage on schema public to service_role;
grant all on table public.app_users to service_role;
grant all on table public.history to service_role;
grant all on table public.stats to service_role;
grant all on table public.word_sets to service_role;
grant all on table public.word_set_items to service_role;
grant usage, select on all sequences in schema public to service_role;

commit;
