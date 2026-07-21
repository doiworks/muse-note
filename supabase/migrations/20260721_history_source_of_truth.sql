-- history is the source of truth; stats is a rebuildable aggregate cache.
create index if not exists idx_history_user_correct_word
  on public.history(app_user_id, correct, word_id);

create or replace function public.record_answer_and_update_stats(
  p_app_user_id uuid,
  p_word_id bigint,
  p_answer text,
  p_correct boolean,
  p_study_session_id uuid default null,
  p_answered_at timestamptz default now()
)
returns table(history_id bigint, stats_updated boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_history_id bigint;
begin
  insert into public.history(app_user_id, word_id, answer, correct, study_session_id, answered_at)
  values (p_app_user_id, p_word_id, coalesce(p_answer, ''), p_correct, p_study_session_id, p_answered_at)
  returning id into v_history_id;

  insert into public.stats(
    app_user_id, word_id, success_count, mistake_count, attempt_count, accuracy,
    last_correct, last_wrong, updated_at
  ) values (
    p_app_user_id, p_word_id, case when p_correct then 1 else 0 end,
    case when p_correct then 0 else 1 end, 1, case when p_correct then 100 else 0 end,
    case when p_correct then p_answered_at end,
    case when not p_correct then p_answered_at end, p_answered_at
  )
  on conflict(app_user_id, word_id) do update set
    success_count = public.stats.success_count + case when p_correct then 1 else 0 end,
    mistake_count = public.stats.mistake_count + case when p_correct then 0 else 1 end,
    attempt_count = public.stats.attempt_count + 1,
    accuracy = round(
      ((public.stats.success_count + case when p_correct then 1 else 0 end)::numeric /
       (public.stats.attempt_count + 1)::numeric) * 100, 2),
    last_correct = case when p_correct then greatest(public.stats.last_correct, p_answered_at) else public.stats.last_correct end,
    last_wrong = case when not p_correct then greatest(public.stats.last_wrong, p_answered_at) else public.stats.last_wrong end,
    updated_at = greatest(public.stats.updated_at, p_answered_at);

  return query select v_history_id, true;
end;
$$;

revoke all on function public.record_answer_and_update_stats(uuid,bigint,text,boolean,uuid,timestamptz)
  from public, anon, authenticated;
grant execute on function public.record_answer_and_update_stats(uuid,bigint,text,boolean,uuid,timestamptz)
  to service_role;

-- Idempotent repair: values are replaced from history, never incremented.
-- priority is deliberately omitted from both insert updates and conflict updates,
-- preserving an existing row's priority (new rows receive the schema default).
insert into public.stats(
  app_user_id, word_id, success_count, mistake_count, attempt_count, accuracy,
  last_correct, last_wrong, updated_at
)
select
  h.app_user_id,
  h.word_id,
  count(*) filter (where h.correct)::int,
  count(*) filter (where not h.correct)::int,
  count(*)::int,
  round((count(*) filter (where h.correct))::numeric / count(*)::numeric * 100, 2),
  max(h.answered_at) filter (where h.correct),
  max(h.answered_at) filter (where not h.correct),
  max(h.answered_at)
from public.history h
join public.words w on w.id = h.word_id
group by h.app_user_id, h.word_id
on conflict(app_user_id, word_id) do update set
  success_count = excluded.success_count,
  mistake_count = excluded.mistake_count,
  attempt_count = excluded.attempt_count,
  accuracy = excluded.accuracy,
  last_correct = excluded.last_correct,
  last_wrong = excluded.last_wrong,
  updated_at = excluded.updated_at;
