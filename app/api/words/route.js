import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { getAppSessionFromRequest } from '../../../lib/auth/appSession';
import { filterWordsByWrongHistory, uniqueWrongWordIds } from '../../../lib/wrongWords';

const WORD_COLUMNS = [
  'id','school_level','grade','term','exam_type','category1','category2','category3','importance',
  'japanese','english','phonetic','example','pos_code','pos_full','pos_j','antonym','antonym_jp','text'
].join(',');
const WORD_FETCH_ERROR_MESSAGE = '単語データの取得に失敗しました。時間をおいて再度お試しください。';
const DEFAULT_FETCH_LIMIT = 200;
const MAX_FETCH_LIMIT = 500;
const WORD_PAGE_SIZE = 500;
const STATS_FILTER_CHUNK_SIZE = 500;
const WORD_MODE = { BALANCED: 'balanced', WRONG: 'wrong', SELECT: 'select' };

function createErrorResponse(message, status) { return NextResponse.json({ error: message }, { status }); }
function parseLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_FETCH_LIMIT;
  return Math.min(Math.floor(parsed), MAX_FETCH_LIMIT);
}
function parseOffset(value) {
  const parsed = Number(value);
  return !Number.isFinite(parsed) || parsed < 0 ? 0 : Math.floor(parsed);
}
function hasIdValue(value) { return value !== null && value !== undefined; }
function parseWordIds(value) {
  return [...new Set(String(value || '').split(',').map((item) => Number(item.trim())).filter(Number.isFinite))];
}

async function fetchWordsByIds(supabaseAdmin, wordIds) {
  if (!wordIds.length) return { data: [], error: null };
  const { data, error } = await supabaseAdmin.from('words').select(WORD_COLUMNS).in('id', wordIds);
  if (error) return { data: null, error };
  const order = new Map(wordIds.map((id, index) => [id, index]));
  return { data: [...(data ?? [])].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)), error: null };
}

function rankWordForBalancedOrder(word) {
  const attemptCount = Number(word?.stats?.attempt_count ?? 0);
  const lastAnsweredAt = word?.last_answered_at ? Date.parse(word.last_answered_at) : null;
  return {
    isUnseen: word.stats == null,
    attemptCount,
    recencyScore: Number.isFinite(lastAnsweredAt) ? lastAnsweredAt : Number.NEGATIVE_INFINITY,
    tieBreaker: Math.random()
  };
}
function sortWordsForBalancedQuestions(wordsWithStats) {
  return [...wordsWithStats].sort((a, b) => {
    const rankA = rankWordForBalancedOrder(a);
    const rankB = rankWordForBalancedOrder(b);
    if (rankA.isUnseen !== rankB.isUnseen) return rankA.isUnseen ? -1 : 1;
    if (rankA.attemptCount !== rankB.attemptCount) return rankA.attemptCount - rankB.attemptCount;
    if (rankA.recencyScore !== rankB.recencyScore) return rankA.recencyScore - rankB.recencyScore;
    return rankA.tieBreaker - rankB.tieBreaker;
  });
}
function rankWordForWrongOrder(word) {
  const stats = word?.stats || {};
  const lastWrongAt = stats.last_wrong ? Date.parse(stats.last_wrong) : null;
  const lastAnsweredAt = word?.last_answered_at ? Date.parse(word.last_answered_at) : null;
  return {
    mistakeCount: Number(stats.mistake_count ?? 0), accuracy: Number(stats.accuracy ?? 100),
    hasLastWrong: Boolean(stats.last_wrong),
    lastWrongScore: Number.isFinite(lastWrongAt) ? lastWrongAt : Number.NEGATIVE_INFINITY,
    isImportant: Number(word?.importance) === 1, attemptCount: Number(stats.attempt_count ?? 0),
    recencyScore: Number.isFinite(lastAnsweredAt) ? lastAnsweredAt : Number.NEGATIVE_INFINITY,
    tieBreaker: Math.random()
  };
}
function sortWordsForWrongQuestions(wordsWithStats) {
  return [...wordsWithStats].sort((a, b) => {
    const rankA = rankWordForWrongOrder(a);
    const rankB = rankWordForWrongOrder(b);
    if (rankA.mistakeCount !== rankB.mistakeCount) return rankB.mistakeCount - rankA.mistakeCount;
    if (rankA.accuracy !== rankB.accuracy) return rankA.accuracy - rankB.accuracy;
    if (rankA.hasLastWrong !== rankB.hasLastWrong) return rankA.hasLastWrong ? -1 : 1;
    if (rankA.lastWrongScore !== rankB.lastWrongScore) return rankB.lastWrongScore - rankA.lastWrongScore;
    if (rankA.isImportant !== rankB.isImportant) return rankA.isImportant ? -1 : 1;
    if (rankA.attemptCount !== rankB.attemptCount) return rankA.attemptCount - rankB.attemptCount;
    if (rankA.recencyScore !== rankB.recencyScore) return rankA.recencyScore - rankB.recencyScore;
    return rankA.tieBreaker - rankB.tieBreaker;
  });
}
async function fetchWordPage(supabaseAdmin, offset, limit) {
  return supabaseAdmin.from('words').select(WORD_COLUMNS).order('id', { ascending: true }).range(offset, offset + limit - 1);
}
async function fetchAllWords(supabaseAdmin) {
  const allWords = [];
  let offset = 0;
  let hasMore = true;
  while (hasMore) {
    const { data, error } = await fetchWordPage(supabaseAdmin, offset, WORD_PAGE_SIZE);
    if (error) return { data: null, error };
    const wordRows = data ?? [];
    allWords.push(...wordRows);
    hasMore = wordRows.length === WORD_PAGE_SIZE;
    offset += WORD_PAGE_SIZE;
  }
  return { data: allWords, error: null };
}
async function fetchStatsForWordIds(supabaseAdmin, appUserId, wordIds) {
  const statsRows = [];
  for (let index = 0; index < wordIds.length; index += STATS_FILTER_CHUNK_SIZE) {
    const wordIdChunk = wordIds.slice(index, index + STATS_FILTER_CHUNK_SIZE);
    if (!wordIdChunk.length) continue;
    const { data, error } = await supabaseAdmin
      .from('stats')
      .select('word_id,accuracy,attempt_count,success_count,mistake_count,last_correct,last_wrong,updated_at')
      .eq('app_user_id', appUserId)
      .in('word_id', wordIdChunk);
    if (error) return { data: null, error };
    statsRows.push(...(data ?? []));
  }
  return { data: statsRows, error: null };
}
function attachStatsToWords(wordRows, statsRows) {
  const statsMap = Object.fromEntries((statsRows ?? []).map((row) => [row.word_id, {
    accuracy: row.accuracy, attempt_count: row.attempt_count, success_count: row.success_count,
    mistake_count: row.mistake_count, last_correct: row.last_correct, last_wrong: row.last_wrong,
    updated_at: row.updated_at
  }]));
  return wordRows.map((word) => ({ ...word, stats: statsMap[word.id] ?? null, last_answered_at: statsMap[word.id]?.updated_at ?? null }));
}

export async function GET(request) {
  const session = await getAppSessionFromRequest(request);
  if (!session) return createErrorResponse('ログインが必要です。', 401);
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const searchParams = new URL(request.url).searchParams;
    const limit = parseLimit(searchParams.get('limit'));
    const offset = parseOffset(searchParams.get('offset'));
    const idsParam = searchParams.get('ids');
    if (idsParam) {
      const wordIds = parseWordIds(idsParam);
      const { data: wordRows, error } = await fetchWordsByIds(supabaseAdmin, wordIds);
      if (error) return createErrorResponse(WORD_FETCH_ERROR_MESSAGE, 500);
      const { data: statsRows, error: statsError } = await fetchStatsForWordIds(supabaseAdmin, session.appUserId, wordIds);
      if (statsError) return createErrorResponse(WORD_FETCH_ERROR_MESSAGE, 500);
      return NextResponse.json({ words: attachStatsToWords(wordRows ?? [], statsRows ?? []), has_more: false });
    }
    const modeParam = String(searchParams.get('mode') || WORD_MODE.BALANCED).toLowerCase();
    const isWrongMode = modeParam === WORD_MODE.WRONG || modeParam === 'review';
    const isSelectMode = modeParam === WORD_MODE.SELECT;
    if (isSelectMode) {
      const { data, error } = await fetchWordPage(supabaseAdmin, offset, limit);
      if (error) return createErrorResponse(WORD_FETCH_ERROR_MESSAGE, 500);
      const wordRows = data ?? [];
      return NextResponse.json({ words: attachStatsToWords(wordRows, []), has_more: wordRows.length === limit });
    }
    const { data: wordRows, error } = await fetchAllWords(supabaseAdmin);
    if (error) return createErrorResponse(WORD_FETCH_ERROR_MESSAGE, 500);
    const wordIds = (wordRows ?? []).map((word) => word.id).filter(hasIdValue);
    const { data: statsRows, error: statsError } = await fetchStatsForWordIds(supabaseAdmin, session.appUserId, wordIds);
    if (statsError) return createErrorResponse(WORD_FETCH_ERROR_MESSAGE, 500);
    const wordsWithStats = attachStatsToWords(wordRows ?? [], statsRows ?? []);
    let candidateWords = wordsWithStats;
    if (isWrongMode) {
      const { data: wrongHistory, error: historyError } = await supabaseAdmin.from('history')
        .select('word_id,correct').eq('app_user_id', session.appUserId).eq('correct', false);
      if (historyError) return createErrorResponse(WORD_FETCH_ERROR_MESSAGE, 500);
      candidateWords = filterWordsByWrongHistory(wordsWithStats, uniqueWrongWordIds(wrongHistory));
    }
    const responseWords = isWrongMode ? sortWordsForWrongQuestions(candidateWords) : sortWordsForBalancedQuestions(candidateWords);
    return NextResponse.json({ words: responseWords.slice(0, limit), has_more: false });
  } catch (error) {
    console.error('Failed to use words API:', error);
    return createErrorResponse(WORD_FETCH_ERROR_MESSAGE, 500);
  }
}
