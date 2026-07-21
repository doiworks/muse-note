import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';
import { getAppSessionFromRequest } from '../../../../lib/auth/appSession';
import { createScopeKey } from '../../../../lib/fairQuiz';
import { applyWordPickerFilters } from '../list/route';
import { filterWordsByWrongHistory, uniqueWrongWordIds } from '../../../../lib/wrongWords';

const COLUMNS = 'id,japanese,english,phonetic,importance,school_level,grade,term,exam_type,category1,category2,category3';
const PAGE = 1000;
const error = (message, status = 500) => NextResponse.json({ error: message }, { status });
const paramsFor = (body) => ({ get: (key) => key === 'importantOnly' ? (body.importantOnly ? 'true' : '') : (body[key] || '') });

async function fetchAll(queryFactory) {
  const rows = [];
  for (let from = 0;; from += PAGE) {
    const { data, error: queryError } = await queryFactory().order('id').range(from, from + PAGE - 1);
    if (queryError) throw queryError;
    rows.push(...(data || []));
    if ((data || []).length < PAGE) return rows;
  }
}

export async function POST(request) {
  const session = await getAppSessionFromRequest(request);
  if (!session) return error('ログインが必要です。', 401);
  try {
    const body = await request.json().catch(() => ({}));
    const requestedCount = Math.max(0, Math.floor(Number(body.requestedCount) || 0));
    if (!requestedCount) return error('出題数を指定してください。', 400);
    const supabase = getSupabaseAdmin();
    let words;
    const explicitIds = [...new Set((body.wordIds || []).map(Number).filter(Number.isFinite))];
    if (explicitIds.length) {
      words = await fetchAll(() => supabase.from('words').select(COLUMNS).in('id', explicitIds));
    } else {
      words = await fetchAll(() => applyWordPickerFilters(supabase.from('words').select(COLUMNS), paramsFor(body)));
    }
    if (body.mode === 'wrong') {
      const historyRows = await fetchAll(() => supabase.from('history').select('word_id,correct')
        .eq('app_user_id', session.appUserId).eq('correct', false));
      const wrongWordIds = uniqueWrongWordIds(historyRows);
      words = filterWordsByWrongHistory(words, wrongWordIds);
      if (!words.length) return NextResponse.json({
        words: [], reservation_id: null,
        empty_reason: wrongWordIds.length ? 'no_matching_words' : 'no_wrong_history'
      });
    }
    const excluded = new Set((body.excludedIds || []).map(Number));
    words = words.filter((word) => !excluded.has(Number(word.id)));
    if (!words.length) return NextResponse.json({ words: [], reservation_id: null, empty_reason: 'no_matching_words' });
    const scopeInput = { ...body, wordIds: words.map((word) => word.id), mode: body.mode || 'balanced' };
    const scopeKey = createScopeKey(scopeInput);
    const { data: reserved, error: reserveError } = await supabase.rpc('reserve_fair_quiz_words', {
      p_app_user_id: session.appUserId, p_scope_key: scopeKey,
      p_word_ids: words.map((word) => word.id), p_requested_count: Math.min(requestedCount, words.length), p_ttl_seconds: 900
    });
    if (reserveError) throw reserveError;
    const byId = new Map(words.map((word) => [Number(word.id), word]));
    const ordered = (reserved || []).sort((a,b) => a.position-b.position).map((row) => byId.get(Number(row.word_id))).filter(Boolean);
    return NextResponse.json({ words: ordered, reservation_id: reserved?.[0]?.reservation_id || null, scope_key: scopeKey });
  } catch (caught) {
    console.error('Failed to reserve fair quiz selection:', caught);
    return error('均一出題の確保に失敗しました。問題は開始されていません。再試行してください。');
  }
}
